import fitz
import easyocr
import pandas as pd
import json
import os
import re
from config.gemini_config import gemini_model

reader = easyocr.Reader(['en'])

def extract_text_from_pdf(pdf_path):
    text = ""
    try:
        with fitz.open(pdf_path) as doc:
            for page in doc:
                text += page.get_text()
        return text.strip()
    except Exception as e:
        print(f"Error extracting text from PDF {pdf_path}: {e}")
        return ""

def extract_data_from_excel(excel_path):
    try:
        df = pd.read_excel(excel_path)
        return df.to_json(orient="records")
    except Exception as e:
        print(f"Error extracting data from Excel {excel_path}: {e}")
        return ""

def extract_text_from_image(image_path):
    try:
        text = reader.readtext(image_path, detail=0)
        return " ".join(text).strip()
    except Exception as e:
        print(f"Error processing image {image_path}: {e}")
        return ""

def send_to_gemini(data, email, date, time):
    prompt = f"""
You are an AI that extracts **structured order details** from the provided text and returns a valid JSON object.  
Your primary task is to **accurately extract product details from both email body and attachments**, combining information from both sources.

### **IMPORTANT INSTRUCTIONS**:
1. Focus on finding product names and quantities in the text
2. Look for customer information like name, phone, and address
3. If a product name is mentioned without a quantity, assume quantity is 1
4. If multiple quantities are mentioned for the same product, use the most recent one
5. Extract as much information as possible, even if incomplete

### **STRICT RESPONSE FORMAT (MUST FOLLOW THIS JSON SCHEMA)**:
{{
    "customer": {{
        "name": "string or empty if not found",
        "email": "{email}",
        "phone": "string or empty if not found",
        "address": "string or empty if not found"
    }},
    "orders": [
        {{
            "product": "string",
            "quantity": integer
        }}
    ]
}}

### **INPUT TEXT**:
{data}

### **RETURN ONLY THE JSON DATA WITHOUT ANY MARKDOWN OR CODE BLOCK MARKERS**
"""
    try:
        response = gemini_model.generate_content(prompt)

        if response and hasattr(response, 'text'):
            response_text = response.text.strip()
            
            clean_json = re.sub(r'```json\s*|\s*```', '', response_text).strip()
            
            try:
                parsed_json = json.loads(clean_json)
                if not parsed_json.get("orders"):
                    parsed_json["orders"] = []
                if not parsed_json.get("customer"):
                    parsed_json["customer"] = {
                        "name": "",
                        "email": email,
                        "phone": "",
                        "address": ""
                    }
                
                return parsed_json
            except json.JSONDecodeError as e:
                print(f"Error parsing JSON response: {e}")
                print(f"Raw response text: {response_text}")
                print(f"Cleaned JSON text: {clean_json}")
                
                return {
                    "customer": {"name": "", "email": email, "phone": "", "address": ""},
                    "orders": []
                }
        else:
            print("Gemini API did not return valid structured data.")
            return {
                "customer": {"name": "", "email": email, "phone": "", "address": ""},
                "orders": []
            }
    except Exception as e:
        print(f"Error in Gemini API request: {e}")
        return {
            "customer": {"name": "", "email": email, "phone": "", "address": ""},
            "orders": []
        }

def process_attachment(attachment_path, email_body, email, date, time):
    if not attachment_path or not os.path.exists(attachment_path):
        print("No valid attachment path provided")
        return None
    
    extracted_data = ""
    
    if attachment_path.endswith(".pdf"):
        extracted_data = extract_text_from_pdf(attachment_path)
    elif attachment_path.endswith((".xlsx", ".xls", ".csv")):
        extracted_data = extract_data_from_excel(attachment_path)
    elif attachment_path.endswith((".jpg", ".jpeg", ".png")):
        extracted_data = extract_text_from_image(attachment_path)
    
    if extracted_data:
        combined_text = f"""
            EMAIL BODY:
            {email_body}
            
            ATTACHMENT CONTENT:
            {extracted_data}
        """
        structured_data = send_to_gemini(combined_text, email, date, time)
        
        if structured_data and isinstance(structured_data, dict):
            customer = structured_data.get("customer", {})
            orders = structured_data.get("orders", [])
            
            if not customer.get("email"):
                structured_data["customer"]["email"] = email
            
            if orders and len(orders) > 0:
                print("Successfully extracted order details from attachment")
                return structured_data
            else:
                print("No valid order items extracted from attachment")
        else:
            print("Failed to extract structured data from combined sources")
    else:
        print(f"No data extracted from attachment at {attachment_path}")
    
    return send_to_gemini(email_body, email, date, time)

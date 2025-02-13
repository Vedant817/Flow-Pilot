import os
import fitz  # PyMuPDF for PDF text extraction
import easyocr  # OCR for image text extraction
import pandas as pd
import pymongo
import requests
import json
import bson.json_util  # Fixes ObjectId serialization issue

# Initialize EasyOCR Reader (for English)
reader = easyocr.Reader(['en'])

# Sample Email Data
sample_email_data = {
    "customer_name": "Vishal Mahajan",
    "email": "vmahajan_be22@thapar.edu",
    "body": "Hello, I would like to order 2 MacBook and 1 iPhone\n",
    "Date": "2025-02-01",
    "Time": "14:12:54"
}

# Google Gemini API Key
GEMINI_API_KEY = "AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U"

# MongoDB Connection
MONGO_URI = "mongodb+srv://kumarshresth2004:Shresth%40123@cluster0.lly1dz4.mongodb.net/"
DB_NAME = "store_db"
COLLECTION_NAME = "orders"

# Directory to Read Attachments
ATTACHMENTS_DIR = r"D:\Deloitte\Prototype\python\attachments"

# Connect to MongoDB
client = pymongo.MongoClient(MONGO_URI)
db = client[DB_NAME]
orders_collection = db[COLLECTION_NAME]


# Extract Text from PDF
def extract_text_from_pdf(pdf_path):
    text = ""
    with fitz.open(pdf_path) as doc:
        for page in doc:
            text += page.get_text()
    return text.strip()


# Extract Data from Excel
def extract_data_from_excel(excel_path):
    df = pd.read_excel(excel_path)
    return df.to_json(orient="records")  # Convert to structured JSON format


# Extract Text from Image (JPG, PNG) using EasyOCR
def extract_text_from_image(image_path):
    try:
        text = reader.readtext(image_path, detail=0)  # Extract text without box coordinates
        return " ".join(text).strip()
    except Exception as e:
        print(f"❌ Error processing image {image_path}: {e}")
        return ""


# Send Data to Gemini API for Structuring
def send_to_gemini(data):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    prompt = f"""
You are an AI that extracts structured order details from the provided text and returns a valid JSON object. The response should strictly follow this schema:

{{
    "Customer Name": "string",
    "Email": "string",
    "Date": "YYYY-MM-DD",
    "Time": "HH:MM:SS",
    "Products": [
        {{
            "product": "string",
            "quantity": integer
        }}
    ]
}}

### Instructions:
1. **Ensure the "Products" array is never empty.** If no products are found, return `"Products": []` but prioritize extracting products correctly.
2. **Extract product names and quantities accurately** from the given data. If quantity is missing, assume it as `1`.
3. **Use the latest date and time found in the text** for `"Date"` and `"Time"`.
4. **Do not include unnecessary text** in the JSON. **Only return valid JSON** with no explanations or markdown formatting.

### Input:
{data}

### Expected Output:
Return only the JSON object as per the schema above.
"""

    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    response = requests.post(url, json=payload)
    # print(response.text)
    if response.status_code == 200:
        try:
            gemini_response = response.json()
            response_text = gemini_response.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

            if response_text:
                clean_json = response_text.replace("```json", "").replace("```", "").strip()
                return json.loads(clean_json)  # Convert to dictionary
            else:
                print("❌ Gemini API did not return valid structured data.")
                return {}
        except json.JSONDecodeError:
            print("❌ Failed to parse Gemini API response.")
            return {}
    else:
        print(f"❌ Gemini API Error {response.status_code}: {response.text}")
        return {}


# Store Data in MongoDB
def store_data_in_mongodb(order_data):
    try:
        inserted_order = orders_collection.insert_one(order_data)
        stored_order = orders_collection.find_one({"_id": inserted_order.inserted_id})
        
        json_data = bson.json_util.dumps(stored_order, indent=4)
        print("✅ Order stored in MongoDB:", json_data)
    except Exception as e:
        print("❌ Error storing order:", e)


# Process Attachments in Directory
def process_attachments():
    if not os.path.exists(ATTACHMENTS_DIR):
        print("❌ Attachments directory does not exist!")
        return

    combined_text = sample_email_data["body"]  # Start with email body

    for file in os.listdir(ATTACHMENTS_DIR):
        filepath = os.path.join(ATTACHMENTS_DIR, file)
        extracted_data = ""

        if file.endswith(".pdf"):
            extracted_data = extract_text_from_pdf(filepath)
        elif file.endswith(".xlsx") or file.endswith(".csv"):
            extracted_data = extract_data_from_excel(filepath)
        elif file.endswith(".jpg") or file.endswith(".png"):
            extracted_data = extract_text_from_image(filepath)

        if extracted_data:
            combined_text += f"\n{extracted_data}"

    if combined_text.strip():
        print(f"📜 Extracted Combined Data: {combined_text[:500]}...")

        gemini_response = send_to_gemini(combined_text)

        if gemini_response:
            structured_order = {
                "Customer Name": gemini_response.get("Customer Name") or sample_email_data["customer_name"],
                "Email": sample_email_data["email"],
                "Date": gemini_response.get("Date", sample_email_data["Date"]),
                "Time": gemini_response.get("Time", sample_email_data["Time"]),
                "Products": gemini_response.get("Products", [])
            }

            if structured_order["Products"]:  # Ensure Products array is not empty before storing
                store_data_in_mongodb(structured_order)
            else:
                print("⚠️ Extracted data does not contain valid products. Order not stored.")
        else:
            print("❌ No structured data extracted.")
    else:
        print("⚠️ No text extracted from email or attachments.")


if __name__ == "__main__":
    process_attachments()

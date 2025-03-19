from ai21 import AI21Client
from ai21.models.chat import UserMessage
import json
import os
from dotenv import load_dotenv
from datetime import datetime
from config.dbConfig import connect_db
from werkzeug.exceptions import HTTPException
from flask import jsonify

load_dotenv()
db = connect_db()
error_collection = db["errors"]



def handle_exception(e):
    if isinstance(e, HTTPException):
        error_data = {
            "errorMessage": e.description,
            "type": "Customer",
            "severity": "Low" if e.code == 400 else "Medium",
            "timestamp": datetime.utcnow()
        }
        error_collection.insert_one(error_data)
        return jsonify({"error": e.description}), e.code

    # General system errors
    error_data = {
        "errorMessage": str(e),
        "type": "Customer",
        "severity": "Critical",  # Assume critical severity for unhandled system errors
        "timestamp": datetime.utcnow()
    }

    error_collection.insert_one(error_data)
    return jsonify({"error": "Internal Server Error", "message": str(e)}), 500

API_KEY = os.getenv("AI21KEY")

client = AI21Client(api_key=API_KEY)

def extract_email_details(email_text):
    """
    Extracts structured order and customer details from an email.
    Returns a dictionary with order details and customer information.
    If details are missing, returns null for those fields.
    """
    messages = [
        UserMessage(
            content=f"""
            You are an AI assistant extracting order and customer details from an email.
            Extract and return only in JSON format.

            **Email:**
            "{email_text}"

            **Expected JSON Output:**
            {{
                "customer": {{
                    "name": "Customer Name",
                    "email": "customer@example.com",
                    "phone": "123-456-7890"
                    "address: "123 Main Street Los Angeles, CA 90001 USA"
                }},
                "orders": [
                    {{"product": "Product Name", "quantity": Number}}
                ]
            }}

            If customer details are not provided, set "customer" as null.
            If order details are not provided, set "orders" as null.
            """
        )
    ]
    
    try:
        response = client.chat.completions.create(
            model="jamba-1.5-large",
            messages=messages,
            top_p=1.0 
        )

        result = response.model_dump()

        if "choices" in result and result["choices"]:
            content_str = result["choices"][0]["message"]["content"]
            extracted_data = json.loads(content_str)
            
            return {
                "customer": extracted_data.get("customer", None),
                "orders": extracted_data.get("orders", None)
            }
        else:
            print("Error: No choices found in API response.")
            return {"customer": None, "orders": None}
    except Exception as e:
        print(f"Error extracting email details: {e}")
        return {"customer": None, "orders": None}, #handle_exception(e)

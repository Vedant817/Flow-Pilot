from openai import OpenAI
import smtplib
import json
from pymongo import MongoClient
from ai21 import AI21Client
from ai21.models.chat import UserMessage

# OPEN_AI_KEY = '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'
# MONGO_URI = "mongodb+srv://kumarshresth2004:Shresth%40123@cluster0.lly1dz4.mongodb.net/EmailAutomation"
JAMBA_KEY = 'D1BceAJqiz4b6oKoPjzTcM2OduvgVcye'

# client = OpenAI(api_key = OPEN_AI_KEY)
ai21_client = AI21Client(api_key = JAMBA_KEY)


# mongoClient = MongoClient(MONGO_URI)
# db = mongoClient["order_database"]
# orders_collection = db["orders"]

INVENTORY = {
    "iPhone 15": 5,
    "MacBook Pro": 2,
    "iPad Air": 10
}

email_text = 'Dear seller, I would like to order three iPhone 15s and two MacBook Pros. Thank you!'

def extract_order_details(email_text):
    """
    Uses AI21 Jamba to extract structured order details.
    Returns JSON format.
    """
    prompt = f"""
    You are an AI assistant extracting order details from emails.
    Extract and format in JSON:
    
    Email: "{email_text}"
    
    **JSON Output Format:**
    {{
        "orders": [
            {{"product": "Product Name", "quantity": Number}}
        ],
        "missing_details": true/false
    }}
    """

    response = ai21_client.chat.completions.create(
        model="jamba-1.5-large",
        messages=[UserMessage(role="user", content=prompt)],
        temperature=0.2,
        system = "ai21",
    )

    try:
        return json.loads(response.completions[0].data.text)
    except json.JSONDecodeError:
        return {"orders": [], "missing_details": True}
    
print(extract_order_details(email_text))


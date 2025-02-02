from ai21 import AI21Client
from ai21.models.chat import UserMessage
import json
from dbConfig import connect_db

db = connect_db()

client = AI21Client(api_key="D1BceAJqiz4b6oKoPjzTcM2OduvgVcye")
order_collection = db['orders']

def extract_order_details_ai(email_text):
    """
    Extracts structured order details from an email using AI21.
    Returns a list of products and quantities.
    """
    messages = [
        UserMessage(
            content=f"""
            You are an AI assistant extracting order details from an email.
            Extract and return only in JSON format:

            **Email:**
            "{email_text}"

            **Expected JSON Output:**
            {{
                "orders": [
                    {{"product": "Product Name", "quantity": Number}}
                ]
            }}
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
            extracted_orders = json.loads(content_str)
            return extracted_orders.get("orders", [])
        else:
            print("Error: No choices found in API response.")
            return []
    except Exception as e:
        print(f"Error extracting order details: {e}")
        return []

from datetime import datetime, timedelta
import json

def add_orders_to_collection(email, subject, date, time, order_details):
    """
    Adds extracted order details to the MongoDB orders collection if no duplicate
    within 5 minutes.
    """
    # Combine the date and time to create a datetime object for comparison
    order_datetime = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M:%S")
    
    # Check if there is an existing entry within 5 minutes
    existing_order = order_collection.find_one(
        {
            "email": email,
            "subject": subject,
            "products": order_details,
            "date": {"$gte": (order_datetime - timedelta(minutes=5)).strftime("%Y-%m-%d")},
            "time": {"$gte": (order_datetime - timedelta(minutes=5)).strftime("%H:%M:%S")}
        }
    )
    
    if existing_order:
        print("Duplicate entry detected. Order not added.")
    else:
        formatted_entry = {
            "email": email,
            "subject": subject,
            "date": date,
            "time": time,
            "products": order_details
        }
        order_collection.insert_one(formatted_entry)

    # Optionally print current orders (without duplicates)
    all_orders = list(order_collection.find({}, {"_id": 0}))


def process_order_details(email, subject, date, time, order_details):
    """
    Processes extracted order details and adds them to the database.
    """
    structured_orders = []
    for order in order_details:
        structured_orders.append({
            "product": order["product"],
            "quantity": order["quantity"]
        })
    
    if structured_orders:
        add_orders_to_collection(email, subject, date, time, structured_orders)    
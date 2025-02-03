from ai21 import AI21Client
from ai21.models.chat import UserMessage
import json
from dbConfig import connect_db
from datetime import datetime, timedelta
from send_email import send_acknowledgment
from send_email import send_email

db = connect_db()

client = AI21Client(api_key="D1BceAJqiz4b6oKoPjzTcM2OduvgVcye")
order_collection = db['orders']
inventory_collection = db['inventory']

def validate_order_details_ai(order_details):
    """
    Uses AI21 to validate order details and determine if they are incomplete or incorrect.
    Returns True if valid, False otherwise, along with an error message.
    """
    messages = [
        UserMessage(
            content=f"""
            You are an AI assistant validating order details.
            Check if the order contains incomplete, incorrect, or unclear details.
            Always give errors in such that it can be sent through email and can be easily understood by the email reader and understand the issue.
            **Order Details:**
            {json.dumps(order_details, indent=2)}

            **Expected JSON Output:**
            {{
                "valid": true/false,
                "errors": ["Error message 1", "Error message 2"]
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
            validation_result = json.loads(content_str)
            return validation_result.get("valid", False), validation_result.get("errors", [])
        else:
            print("Error: No choices found in API response.")
            return False, ["AI validation failed"]
    except Exception as e:
        print(f"Error validating order details: {e}")
        return False, ["System error while validating order"]

def send_order_issue_email(email, errors):
    """
    Sends an email notifying the user that their order could not be processed due to errors.
    """
    
    error_message = "\n".join(errors)
    body = f"Dear Customer,\n\nWe could not process your order due to the following issues:\n\n{error_message}\n\nPlease review and resend your order.\n\nThank you."
    send_email(
        subject="Order Processing Issue",
        body=body,
        recipient_email=email
    )

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

def check_inventory(order_details):
    """
    Checks if the inventory can fulfill the given order.
    Returns True if order can be fulfilled, otherwise False.
    """
    for order in order_details:
        product = order["product"]
        quantity = order["quantity"]
        
        inventory_item = inventory_collection.find_one({"item": product})
        if not inventory_item or inventory_item["quantity"] < quantity:
            return False

    return True

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
    
    can_fulfill = check_inventory(order_details=order_details)
    
    formatted_entry = {
        "email": email,
        "subject": subject,
        "date": date,
        "time": time,
        "products": order_details,
        "can_fulfill": can_fulfill
    }
    order_collection.insert_one(formatted_entry)
    send_acknowledgment(formatted_entry)

def process_order_details(email, subject, date, time, order_details):
    """
    Processes extracted order details, validates them using AI, and adds them to the database.
    Sends an email if the order is invalid.
    """
    is_valid, errors = validate_order_details_ai(order_details)

    if not is_valid:
        send_order_issue_email(email, errors)
        return  # Stop further processing

    structured_orders = []
    for order in order_details:
        structured_orders.append({
            "product": order["product"],
            "quantity": order["quantity"]
        })
    
    if structured_orders:
        add_orders_to_collection(email, subject, date, time, order_details=structured_orders)   

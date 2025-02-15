from ai21 import AI21Client
from ai21.models.chat import UserMessage
import json
from dbConfig import connect_db
from datetime import datetime, timedelta
from send_email import send_acknowledgment, send_email, send_order_issue_email
import os
from dotenv import load_dotenv

load_dotenv()
db = connect_db()

API_KEY = os.getenv("AI21KEY")

client = AI21Client(api_key=API_KEY)
order_collection = db['orders']
inventory_collection = db['inventory']
customers_collection = db['customers']

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
            Always return errors in simple, easy-to-read format.

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

def get_customer_from_db(email):
    """
    Fetches customer details from the database using email.
    Returns customer details if found, otherwise None.
    """
    return customers_collection.find_one({"email": email})

def add_orders_to_collection(email, subject, date, time, customer_details, order_details):
    """
    Adds extracted order details to the MongoDB orders collection if no duplicate
    within 5 minutes.
    """
    order_datetime = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M:%S")

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
        return

    can_fulfill = check_inventory(order_details=order_details)

    formatted_entry = {
        "customer": customer_details,
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
    Checks if the customer exists and fills missing details if needed.
    """
    customer_details = order_details.get("customer", None)
    orders = order_details.get("orders", None)

    if not orders:
        send_order_issue_email(email, ["No order details were found in your email. Please send a valid order."])
        return

    is_valid, errors = validate_order_details_ai(orders)

    print('Is valid:', is_valid)
    print('Errors:', errors)
    # if not is_valid:
    #     send_order_issue_email(email, errors)
    #     return

    # existing_customer = get_customer_from_db(email)

    # if existing_customer:
    #     if not customer_details or not all(k in customer_details for k in ["name", "email", "phone"]):
    #         customer_details = {
    #             "name": existing_customer.get("name", ""),
    #             "email": existing_customer.get("email", ""),
    #             "phone": existing_customer.get("phone", "")
    #         }
        
    #     if not all(customer_details.values()):
    #         send_order_issue_email(email, ["Your customer details are incomplete. Please update your information."])
    #         return
    # else:
    #     send_order_issue_email(email, ["We could not find your details in our system. Please register first."])
    #     return

    # add_orders_to_collection(email, subject, date, time, customer_details, orders)

def process_order_change(email, subject, date, time, order_details):
    pass

def process_complaint(email, subject, body, date, time):
    pass

def process_other_email(email, subject, body, date, time):
    pass
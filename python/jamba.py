from ai21 import AI21Client
from ai21.models.chat import UserMessage
import json
from configdb import inventory_collection, order_collection
from smtp import send_email
import os
from dotenv import load_dotenv
load_dotenv()
from inv import generate_invoice


sender_email = os.getenv("SENDER_EMAIL")
sender_password = os.getenv("EMAIL_PASSWORD")
recipient_email = os.getenv("RECEIVER_EMAIL")

# AI21 API Key
client = AI21Client(api_key="D1BceAJqiz4b6oKoPjzTcM2OduvgVcye")

with open('changes.json', 'r') as f:
    changes = json.load(f)

email_text = ''
for new_value in changes.values():
    email_text = new_value

# Example Email
# email_text = 'Dear seller, I would like to order three iPhone 15s and two MacBook Pros. Thank you!'

def extract_order_details(email_text):
    """
    Extracts structured order details from an email.
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
            top_p=1.0  # Keep at 1 for a deterministic response
        )

        result = response.model_dump()
        
        if "choices" in result and result["choices"]:
            content_str = result["choices"][0]["message"]["content"]
            extracted_orders = json.loads(content_str)  # Convert string to dictionary

            return extracted_orders.get("orders", [])
        else:
            print("Error: No choices found in API response.")
            return []
    except Exception as e:
        print(f"Error extracting order details: {e}")
        return []

def check_availability(orders):
    """
    Checks whether the requested products are available in inventory.
    Returns structured availability info.
    """
    unavailable_items = []
    fulfilled_orders = []

    for order in orders:
        product = order["product"]
        requested_quantity = order["quantity"]

        product_data = inventory_collection.find_one({"product": product})
        available_quantity = product_data["quantity"] if product_data else 0

        if available_quantity >= requested_quantity:
            fulfilled_orders.append(order)
            inventory_collection.update_one(
                {"product": product},
                {"$inc": {"quantity": -requested_quantity}}
            )
        else:
            unavailable_items.append({
                "product": product,
                "requested": requested_quantity,
                "available": available_quantity
            })
    
    return fulfilled_orders, unavailable_items

# Run the functions
order_details = extract_order_details(email_text)
fulfilled_orders, unavailable_items = check_availability(order_details)

if fulfilled_orders:
    order_collection.insert_many(fulfilled_orders)
    print("Order placed successfully! Acknowledgment sent.")
    invoice_path = generate_invoice(fulfilled_orders, recipient_email)
    send_email("Order Acknowledgment","Your order has been placed successfully! Please find your invoice attached.", sender_email, sender_password, recipient_email,attachment_path=invoice_path)

if unavailable_items:
    print("Missing inventory for the following items:", unavailable_items)
    send_email("Order Error", f"Error processing order: {unavailable_items}", sender_email, sender_password, recipient_email)

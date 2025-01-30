from ai21 import AI21Client
from ai21.models.chat import UserMessage
import json

# AI21 API Key
client = AI21Client(api_key="D1BceAJqiz4b6oKoPjzTcM2OduvgVcye")

# Mock Inventory Data
INVENTORY = {
    "iPhone 15": 5,
    "MacBook Pro": 2,
    "iPad Air": 10
}

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

        # Convert response to JSON
        result = response.model_dump()

        # Extract JSON content
        if "choices" in result and result["choices"]:
            content_str = result["choices"][0]["message"]["content"]
            extracted_orders = json.loads(content_str)  # Convert string to dictionary

            # Validate extracted orders
            if "orders" in extracted_orders:
                return extracted_orders["orders"]
            else:
                print("Error: Unexpected response format.")
                return []
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
    availability = []

    for order in orders:
        product = order["product"]
        requested_quantity = order["quantity"]
        available_quantity = INVENTORY.get(product, 0)

        availability.append({
            "product": product,
            "requested": requested_quantity,
            "available": available_quantity
        })

    return {"availability": availability}


# Run the functions
order_details = extract_order_details(email_text)
availability_info = check_availability(order_details)

# Output results
# print(email_text)
# print("Extracted Order Details:", order_details)
print("Availability Check:", availability_info)

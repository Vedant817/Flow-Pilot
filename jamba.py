from ai21 import AI21Client
from ai21.models.chat import UserMessage
import json
import os

client = AI21Client(api_key="D1BceAJqiz4b6oKoPjzTcM2OduvgVcye")

INVENTORY = {
    "iPhone 15": 5,
    "MacBook Pro": 2,
    "iPad Air": 10
}

email_text = 'Dear seller, I would like to order three iPhone 15s and two MacBook Pros. Thank you!'

def extract_order_details(email_text):
    messages = [
        UserMessage(
            content=f"""
    You are an AI assistant extracting order details from emails.
    Extract and format in JSON:
    
    Email: "{email_text}"
    
    **JSON Output Format:**
    {{
        "orders": [
            {{"product": "Product Name", "quantity": Number}}
        ],
    }}
    """
        )
    ]

    try:
        response = client.chat.completions.create(
            model="jamba-1.5-large",
            messages=messages,
            top_p=1.0  # Keep it at 1 for more deterministic responses.
        )

        # Convert response to JSON
        result = response.model_dump()

        # Extract JSON content safely
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
        print(f"Error in extracting order details: {e}")
        return []

data = extract_order_details(email_text)

print(type(data))
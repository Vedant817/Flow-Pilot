from ai21 import AI21Client
from ai21.models.chat import UserMessage
import json

client = AI21Client(api_key="D1BceAJqiz4b6oKoPjzTcM2OduvgVcye")

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
            top_p=1.0 
        )

        result = response.model_dump()
        
        if "choices" in result and result["choices"]:
            content_str = result["choices"][0]["message"]["content"]
            print('Content: ', content_str)
            print("Extracted AI Response:", content_str)
            extracted_orders = json.loads(content_str)
            return extracted_orders.get("orders", [])
        else:
            print("Error: No choices found in API response.")
            return []
    except Exception as e:
        print(f"Error extracting order details: {e}")
        return []
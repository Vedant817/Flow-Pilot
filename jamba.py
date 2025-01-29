from ai21 import AI21Client
from ai21.models.chat import UserMessage

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

    response = client.chat.completions.create(
        model="jamba-1.5-large",
        messages=messages,
        top_p=1.0 # Setting to 1 encourages different responses each call.
    )
    print(response.to_json())

extract_order_details(email_text)
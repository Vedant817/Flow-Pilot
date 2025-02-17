import os
import argparse
import json
import requests
import warnings
from argparse import RawTextHelpFormatter
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Try importing Langflow upload_file function
try:
    from langflow.load import upload_file
except ImportError:
    warnings.warn("Langflow provides a function to help you upload files to the flow. Please install langflow to use it.")
    upload_file = None

# Environment Variables
BASE_API_URL = os.getenv("BASE_API_URL")
LANGFLOW_ID = os.getenv("LANGFLOW_ID")
FLOW_ID = os.getenv("FLOW_ID")
APPLICATION_TOKEN = os.getenv("APPLICATION_TOKEN")  # Fixed this variable name

# Default Endpoint
ENDPOINT = "db4b5f9f-3cf2-422a-8ef7-b6d5921f5b22?stream=false"

# Tweak Configuration (Ensures no input_value conflict)
TWEAKS = {
    "ChatInput-luQGs": {},
    "Google Generative AI Embeddings-hGwfP": {},
    "Prompt-7VX5q": {},
    "GoogleGenerativeAIModel-MglFn": {},
    "ChatOutput-1MdPY": {},
    "AstraDB-ypP5e": {},
    "ParseData-Qg0Ky": {},
    "File-YyNIC": {},
    "SplitText-QArOq": {},
    "File-Et11j": {},
    "File-dePja": {},
    "File-9MTWc": {}
}

# Function to run the flow
def run_flow(message: str,
             endpoint: str,
             output_type: str = "chat",
             input_type: str = "chat",
             tweaks: Optional[dict] = None,
             application_token: Optional[str] = None) -> dict:
    """
    Runs the Langflow chatbot flow with a given message.

    :param message: The input message
    :param endpoint: API endpoint ID
    :param output_type: Type of output (default: chat)
    :param input_type: Type of input (default: chat)
    :param tweaks: Custom tweaks to modify behavior
    :param application_token: Authentication token
    :return: JSON response from the API
    """

    api_url = f"{BASE_API_URL}/lf/{LANGFLOW_ID}/api/v1/run/{endpoint}"

    # Ensure tweaks do not contain an "input_value" key that conflicts with message
    if tweaks and "ChatInput-luQGs" in tweaks:
        tweaks["ChatInput-luQGs"].pop("input_value", None)  # Remove conflicting key

    # Construct API payload
    payload = {
        "input_value": message,
        "output_type": output_type,
        "input_type": input_type,
    }
    if tweaks:
        payload["tweaks"] = tweaks

    # Construct Headers
    headers = {"Content-Type": "application/json"}
    if application_token:
        headers["Authorization"] = f"Bearer {application_token}"

    # Send POST request
    response = requests.post(api_url, json=payload, headers=headers)

    # Debugging: Print API response before parsing
    print(f"Status Code: {response.status_code}")
    response_json = response.json()
    message = response_json["outputs"][0]["outputs"][0]["results"]["message"]["text"]
    print(f"Sentiment Analysis Result: {message}")

    # Handle API response errors
    if response.status_code != 200:
        raise ValueError(f"API Error {response.status_code}: {response.text}")

    try:
        return response.json()
    except requests.exceptions.JSONDecodeError:
        raise ValueError("API returned an empty or non-JSON response. Check API URL and authentication token.")

# Main function to handle CLI arguments
def main():
    parser = argparse.ArgumentParser(description="""Run a flow with a given message and optional tweaks.
Example usage:
    python chatbot.py "Your message here" --endpoint "your_endpoint" --tweaks '{"key": "value"}'""",
                                     formatter_class=RawTextHelpFormatter)

    parser.add_argument("message", type=str, help="The message to send to the flow")
    parser.add_argument("--endpoint", type=str, default=ENDPOINT or FLOW_ID, help="Flow ID or endpoint name")
    parser.add_argument("--tweaks", type=str, help="JSON tweaks for flow customization", default=json.dumps(TWEAKS))
    parser.add_argument("--application_token", type=str, default=APPLICATION_TOKEN, help="Authentication token")
    parser.add_argument("--output_type", type=str, default="chat", help="The output type")
    parser.add_argument("--input_type", type=str, default="chat", help="The input type")
    parser.add_argument("--upload_file", type=str, help="Path to a file to upload", default=None)
    parser.add_argument("--components", type=str, help="Components to upload the file to", default=None)

    args = parser.parse_args()

    # Load tweaks safely
    try:
        tweaks = json.loads(args.tweaks)
    except json.JSONDecodeError:
        raise ValueError("Invalid tweaks JSON string")

    # Handle file upload if requested
    if args.upload_file:
        if not upload_file:
            raise ImportError("Langflow is not installed. Install it to use the upload_file function.")
        if not args.components:
            raise ValueError("You must specify components to upload the file to.")

        tweaks = upload_file(file_path=args.upload_file, host=BASE_API_URL, flow_id=ENDPOINT,
                             components=args.components, tweaks=tweaks)

    # Run the chatbot flow
    response = run_flow(
        message=args.message,
        endpoint=args.endpoint,
        output_type=args.output_type,
        input_type=args.input_type,
        tweaks=tweaks,
        application_token=args.application_token
    )

    # Print the formatted response
    print(json.dumps(response, indent=2))

# Run the script
if __name__ == "__main__":
    main()

# Note: Replace **<YOUR_APPLICATION_TOKEN>** with your actual Application token

import argparse
import json
from argparse import RawTextHelpFormatter
import requests
from typing import Optional
import warnings
import os
from dotenv import load_dotenv
load_dotenv()
try:
    from langflow.load import upload_file
except ImportError:
    warnings.warn("Langflow provides a function to help you upload files to the flow. Please install langflow to use it.")
    upload_file = None

BASE_API_URL = os.getenv("BASE_API_URL")
LANGFLOW_ID = os.getenv("LANGFLOW_ID")
FLOW_ID = os.getenv("FLOW_ID")
APPLICATION_TOKEN = os.getenv("APPLICATION_TOKEN")
ENDPOINT = os.getenv("ENDPOINT")
# You can tweak the flow by adding a tweaks dictionary
# e.g {"OpenAI-XXXXX": {"model_name": "gpt-4"}}
TWEAKS = {
  "ChatInput-luQGs": {
    "files": "",
    "background_color": "",
    "chat_icon": "",
    "input_value": "",
    "sender": "User",
    "sender_name": "User",
    "session_id": "",
    "should_store_message": True,
    "text_color": ""
  },
  "Google Generative AI Embeddings-hGwfP": {
    "api_key": "AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U",
    "model_name": "models/text-embedding-004"
  },
  "Prompt-7VX5q": {
    "template": "Answer the following Question:\n{question}\n\ncontext:\n{context}",
    "tool_placeholder": "",
    "context": "",
    "question": ""
  },
  "GoogleGenerativeAIModel-MglFn": {
    "api_key": "AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U",
    "input_value": "",
    "max_output_tokens": None,
    "model_name": "gemini-2.0-flash-001",
    "n": None,
    "stream": False,
    "system_message": "",
    "temperature": 0.1,
    "tool_model_enabled": False,
    "top_k": None,
    "top_p": None
  },
  "ChatOutput-1MdPY": {
    "background_color": "",
    "chat_icon": "",
    "data_template": "{text}",
    "input_value": "",
    "sender": "Machine",
    "sender_name": "AI",
    "session_id": "",
    "should_store_message": True,
    "text_color": ""
  },
  "AstraDB-ypP5e": {
    "advanced_search_filter": "{}",
    "api_endpoint": "",
    "astradb_vectorstore_kwargs": "{}",
    "autodetect_collection": True,
    "collection_name": "",
    "content_field": "",
    "d_api_endpoint": "",
    "deletion_field": "",
    "embedding_choice": "Astra Vectorize",
    "environment": "",
    "ignore_invalid_documents": False,
    "keyspace": "",
    "number_of_results": 4,
    "search_query": "",
    "search_score_threshold": 0,
    "search_type": "Similarity",
    "token": "AstraCS:REdNBzEElPEtJvxiKXgiPYmx:9e3c7144b4a592d971996211e669d5986a1c2332af659fa3467a89ec6e8c999a"
  },
  "ParseData-Qg0Ky": {
    "sep": "\n",
    "template": "{text}"
  },
  "File-YyNIC": {
    "path": "inventory report.pdf",
    "concurrency_multithreading": 1,
    "delete_server_file_after_processing": True,
    "ignore_unspecified_files": False,
    "ignore_unsupported_extensions": True,
    "silent_errors": False,
    "use_multithreading": True
  },
  "SplitText-QArOq": {
    "chunk_overlap": 200,
    "chunk_size": 1000,
    "separator": "\n"
  },
  "File-Et11j": {
    "path": "dynamic pricing.pdf",
    "concurrency_multithreading": 1,
    "delete_server_file_after_processing": True,
    "ignore_unspecified_files": False,
    "ignore_unsupported_extensions": True,
    "silent_errors": False,
    "use_multithreading": True
  },
  "File-dePja": {
    "path": "feedback report.pdf",
    "concurrency_multithreading": 1,
    "delete_server_file_after_processing": True,
    "ignore_unspecified_files": False,
    "ignore_unsupported_extensions": True,
    "silent_errors": False,
    "use_multithreading": True
  },
  "File-9MTWc": {
    "path": "business report.pdf",
    "concurrency_multithreading": 1,
    "delete_server_file_after_processing": True,
    "ignore_unspecified_files": False,
    "ignore_unsupported_extensions": True,
    "silent_errors": False,
    "use_multithreading": True
  }
}

def run_flow(message: str,
  endpoint: str,
  output_type: str = "chat",
  input_type: str = "chat",
  tweaks: Optional[dict] = None,
  application_token: Optional[str] = None) -> dict:
    """
    Run a flow with a given message and optional tweaks.

    :param message: The message to send to the flow
    :param endpoint: The ID or the endpoint name of the flow
    :param tweaks: Optional tweaks to customize the flow
    :return: The JSON response from the flow
    """
    api_url = f"{BASE_API_URL}/lf/{LANGFLOW_ID}/api/v1/run/{endpoint}"

    payload = {
        "input_value": message,
        "output_type": output_type,
        "input_type": input_type,
    }
    headers = None
    if tweaks:
        payload["tweaks"] = tweaks
    if application_token:
        headers = {"Authorization": "Bearer " + application_token, "Content-Type": "application/json"}
    response = requests.post(api_url, json=payload, headers=headers)
    return response.json()

def main():
    parser = argparse.ArgumentParser(description="""Run a flow with a given message and optional tweaks.
Run it like: python <your file>.py "your message here" --endpoint "your_endpoint" --tweaks '{"key": "value"}'""",
        formatter_class=RawTextHelpFormatter)
    parser.add_argument("message", type=str, help="The message to send to the flow")
    parser.add_argument("--endpoint", type=str, default=ENDPOINT or FLOW_ID, help="The ID or the endpoint name of the flow")
    parser.add_argument("--tweaks", type=str, help="JSON string representing the tweaks to customize the flow", default=json.dumps(TWEAKS))
    parser.add_argument("--application_token", type=str, default=APPLICATION_TOKEN, help="Application Token for authentication")
    parser.add_argument("--output_type", type=str, default="chat", help="The output type")
    parser.add_argument("--input_type", type=str, default="chat", help="The input type")
    parser.add_argument("--upload_file", type=str, help="Path to the file to upload", default=None)
    parser.add_argument("--components", type=str, help="Components to upload the file to", default=None)

    args = parser.parse_args()
    try:
      tweaks = json.loads(args.tweaks)
    except json.JSONDecodeError:
      raise ValueError("Invalid tweaks JSON string")

    if args.upload_file:
        if not upload_file:
            raise ImportError("Langflow is not installed. Please install it to use the upload_file function.")
        elif not args.components:
            raise ValueError("You need to provide the components to upload the file to.")
        tweaks = upload_file(file_path=args.upload_file, host=BASE_API_URL, flow_id=ENDPOINT, components=args.components, tweaks=tweaks)

    response = run_flow(
        message=args.message,
        endpoint=args.endpoint,
        output_type=args.output_type,
        input_type=args.input_type,
        tweaks=tweaks,
        application_token=args.application_token
    )

    print(json.dumps(response, indent=2))

if __name__ == "__main__":
    main()

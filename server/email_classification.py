import requests
from dotenv import load_dotenv
import os

load_dotenv()

AUTH_TOKEN = os.getenv("EMAIL_CLASSIFICATION_AUTH")
LEVITY_API_URL = os.getenv("LEVITY_API_URL")

def classify_email(body):
    headers = {
        "Authorization": AUTH_TOKEN,
        "Content-Type": "application/json"
    }
    
    payload = {
        "textToClassify": body
    }
    
    response = requests.post(LEVITY_API_URL, json=payload, headers=headers)
    return response.json()['labels'][0]['value'], response.status_code
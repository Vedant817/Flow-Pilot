import requests
from dotenv import load_dotenv
import os

SURVEY_ID = os.getenv("FORMBRICKS_SURVEY_ID")
API_KEY = os.getenv("FORMBRICKS_API_KEY")

def process_feedback():
    url = f"https://app.formbricks.com/api/v1/management/responses?surveyId={SURVEY_ID}"
    headers = {
        "x-api-key": "7d6786522d18edd922b497a8b7c2e1c0",
        "Content-Type": "application/json"
    }
    response = requests.get(url, headers=headers)
    result = response.json()['data']
    
    return result, 200
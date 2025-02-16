import requests
from dotenv import load_dotenv
import os
from dbConfig import connect_db

load_dotenv()
db = connect_db()
feedback_collection = db["feedback"]

SURVEY_ID = os.getenv("FORMBRICKS_SURVEY_ID")
API_KEY = os.getenv("FORMBRICKS_API_KEY")

def fetch_feedback():
    url = f"https://app.formbricks.com/api/v1/management/responses?surveyId={SURVEY_ID}"
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    response = requests.get(url, headers=headers)
    data = response.json().get("data", [])
    
    return data

def store_feedback(responses):
    if not responses:
        return {"message": "No new responses"}, 200
    
    unique_ids = [resp["id"] for resp in responses]

    existing = feedback_collection.find({"id": {"$in": unique_ids}}, {"id": 1})
    existing_ids = {doc["id"] for doc in existing}

    new_responses = [
        {
            "id": resp["id"],
            "email": resp["data"].get("h8h3xidx4p90mqap6n02n2bl"),
            "review": resp["data"].get("wi0bvhuydlpyygo0w5233j77"),
            "createdAt": resp["createdAt"],
        }
        for resp in responses if resp["id"] not in existing_ids
    ]

    if new_responses:
        feedback_collection.insert_many(new_responses)

    return {"message": "Processed", "new_entries": len(new_responses)}

def process_complaint(email, subject, body, date, time):
    pass
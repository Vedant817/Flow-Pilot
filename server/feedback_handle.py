import requests
from dotenv import load_dotenv
import os
from dbConfig import connect_db
from gemini_config import gemini_model
import re
import uuid

load_dotenv()
db = connect_db()
feedback_collection = db["feedback"]

SURVEY_ID = os.getenv("FORMBRICKS_SURVEY_ID")
API_KEY = os.getenv("FORMBRICKS_API_KEY")

def extract_review(body):
    prompt = f"""
    Extract the review from the following text:
    ---
    {body}
    ---
    If no review is found, return "No review".
    """
    
    try:
        response = gemini_model.generate_content(prompt)
        ai_response = response.text.strip()
        clean_response = re.sub(r"```json|```", "", ai_response).strip()
        
        return clean_response if clean_response.lower() != "no review" else None
    except Exception as e:
        return None

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

    all_feedbacks = list(feedback_collection.find({}, {"_id": 0}))
    return {"feedbacks": all_feedbacks}

def process_complaint(email, body, date, time):
    review = extract_review(body)

    if not review:
        return {"message": "No review found, not stored"}

    feedback_entry = {
        "id": str(uuid.uuid4()),
        "email": email,
        "review": review,
        "createdAt": f"{date} {time}"
    }
    
    feedback_collection.insert_one(feedback_entry)
    
    return {"message": "Feedback stored successfully"}
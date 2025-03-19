import requests
from dotenv import load_dotenv
import os
from config.dbConfig import db
from config.gemini_config import gemini_model
import re
import uuid

load_dotenv()
feedback_collection = db["feedback"]

SURVEY_ID = os.getenv("FORMBRICKS_SURVEY_ID")
API_KEY = os.getenv("FORMBRICKS_API_KEY")

def classify_review(review):
    prompt = f"""
    You are a sentiment analysis expert. Carefully analyze the following customer review and classify it strictly into one of three categories:
    
    - "good": If the review expresses **clear satisfaction, appreciation, or positive feedback**.
    - "bad": If the review expresses **clear dissatisfaction, complaints, frustration, or negative feedback**.
    - "neutral": If the review is **unclear, mixed, generic, or does not strongly indicate positive or negative sentiment**.

    **Rules:**
    - Return **only one word**: "good", "bad", or "neutral".
    - Do **not** provide explanations or extra text.

    **Review:**  
    "{review}"
    """

    try:
        response = gemini_model.generate_content(prompt)
        classification = response.text.strip().lower()

        if classification in ["good", "bad", "neutral"]:
            return classification

        return "neutral"
    except Exception as e:
        print(f"Error in classify_review: {e}")
        return "neutral"

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

    new_responses = []
    for resp in responses:
        if resp["id"] not in existing_ids:
            review = resp["data"].get("wi0bvhuydlpyygo0w5233j77")
            review_type = classify_review(review) if review else "neutral"
            new_responses.append({
                "id": resp["id"],
                "email": resp["data"].get("h8h3xidx4p90mqap6n02n2bl"),
                "review": review,
                "type": review_type,
                "createdAt": resp["createdAt"],
            })
    
    if new_responses:
        feedback_collection.insert_many(new_responses)

    all_feedbacks = list(feedback_collection.find({}, {"_id": 0}))
    return {"feedbacks": all_feedbacks}

def process_complaint(email, body, date, time):
    review = extract_review(body)

    if not review:
        return {"message": "No review found, not stored"}

    review_type = classify_review(review) if review else "neutral"
    feedback_entry = {
        "id": str(uuid.uuid4()),
        "email": email,
        "review": review,
        "type": review_type,
        "createdAt": f"{date} {time}"
    }
    
    feedback_collection.insert_one(feedback_entry)
    
    return {"message": "Feedback stored successfully"}
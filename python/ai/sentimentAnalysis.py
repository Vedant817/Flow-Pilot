import os
import pymongo
import google.generativeai as genai
import pandas as pd
from flask import Flask, request, jsonify
from bson import ObjectId
from dotenv import load_dotenv

# ✅ Load Environment Variables
load_dotenv()

# ✅ Initialize Flask App
app = Flask(__name__)

# ✅ Secure MongoDB Connection
MONGO_URI = os.getenv("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["test_store_db"]
order_collection = db["orders"]
inventory_collection = db["inventory"]
feedback_collection = db["feedback"]  # ✅ New Feedback Collection

# ✅ Configure Gemini AI Key
GENAI_API_KEY = os.getenv("GENAI_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# ✅ AI Agent: Customer Sentiment Analysis
def generate_feedback_report():
    try:
        # Step 1: Fetch all feedback data
        feedbacks = list(feedback_collection.find({}, {"_id": 0}))  # ✅ Exclude MongoDB ID

        if not feedbacks:
            return "No feedback data available."

        # Step 2: Prepare AI Prompt
        prompt = f"""
        You are an AI specializing in **customer sentiment analysis**.

        **Customer Feedback Data:**
        {feedbacks}

        🔹 **Tasks:**
        1. Identify common **customer complaints**.
        2. Highlight **suggestions for improvement**.
        3. Analyze overall **customer satisfaction trends**.
        4. Categorize reviews into **positive, negative, and neutral**.

        🎯 Generate a structured **feedback analysis report** with actionable insights.
        """

        # Step 3: Query Gemini AI Model
        response = gemini_model.generate_content(prompt)
        return response.text

    except Exception as e:
        return f"Error generating feedback report: {str(e)}"

# ✅ API Route: Get Customer Feedback Report
@app.route('/feedback-report', methods=['GET'])
def feedback_report():
    report = generate_feedback_report()
    return jsonify({"feedback_report": report})

if __name__ == '__main__':
    app.run(debug=True, port=5002)
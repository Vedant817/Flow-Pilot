from flask import Flask, request, jsonify
import requests
from zerobouncesdk import ZeroBounce, ZBException

app = Flask(__name__)
zero_bounce = ZeroBounce("<YOUR_API_KEY>")

# Levity API Details
LEVITY_API_URL = "https://next.levity.ai/api/ai/v3/b49c72d6-1026-4516-afc8-cbc29742175e/classify"
AUTH_TOKEN = "your_auth_token_here"  # Replace with your actual authorization token

def classify_text(email):
    """
    Sends the given text to Levity API for classification.
    
    :param text: The text to classify
    :return: JSON response from Levity API
    """
    try:
        response = zero_bounce.validate(email, '')
        print("ZeroBounce validate response: " + str(response))
    except ZBException as e:
        print("ZeroBounce validate error: " + str(e))

@app.route('/classify-email', methods=['POST'])
def classify_route():
    try:
        data = request.get_json()
        if "text" not in data:
            return jsonify({"error": "Missing 'text' in request body"}), 400
        
        # Call classify_text function
        result, status_code = classify_text(data["text"])
        return jsonify(result), status_code

    except Exception as e:
        return jsonify({"error": str(e)}), 500
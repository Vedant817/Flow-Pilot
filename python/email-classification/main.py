from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Levity API Details
LEVITY_API_URL = "https://next.levity.ai/api/ai/v3/b49c72d6-1026-4516-afc8-cbc29742175e/classify"
AUTH_TOKEN = "your_auth_token_here"  # Replace with your actual authorization token

def classify_text(text):
    """
    Sends the given text to Levity API for classification.
    
    :param text: The text to classify
    :return: JSON response from Levity API
    """
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "textToClassify": text
    }
    
    response = requests.post(LEVITY_API_URL, json=payload, headers=headers)
    return response.json(), response.status_code

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
import os
import pymongo
import google.generativeai as genai
import json
import re
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

# ✅ Initialize Flask App
app = Flask(__name__)

# ✅ Secure MongoDB Connection
MONGO_URI = os.getenv("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["test_store_db"]
order_collection = db["orders"]

# ✅ Configure Gemini AI Key
genai.configure(api_key=os.getenv("GEMINI_API_KEY", "your_gemini_key"))
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# ✅ AI-powered Loyalty Reward Calculation
def assign_loyalty_rewards():
    try:
        # ✅ Fetch Order Data
        orders = list(order_collection.find({}, {"_id": 0}))

        # ✅ Analyze Customer Loyalty
        customer_orders = {}
        customer_spending = {}

        for order in orders:
            customer_name = order.get("customerName", "Unknown Customer")  
            order_value = sum(p.get("price", 0) * p.get("quantity", 0) for p in order.get("products", []))

            if customer_name != "Unknown Customer":
                customer_orders[customer_name] = customer_orders.get(customer_name, 0) + 1
                customer_spending[customer_name] = customer_spending.get(customer_name, 0) + order_value

        # ✅ AI Agent Prompt (Structured JSON Output)
        prompt = f"""
        You are an AI loyalty program manager. Assign discount rewards based on the rules below.

        **Loyalty Rules**:
        - **Gold Loyalty**: 3+ Orders OR Spending over $1000 → **20% Discount**
        - **Silver Loyalty**: 2-3 Orders OR Spending over $500 → **10% Discount**
        - **New Customers**: 1 Order → No discount unless first-time promo available.

        **Customer Orders**:
        {json.dumps(customer_orders, indent=2)}

        **Customer Spending**:
        {json.dumps(customer_spending, indent=2)}

        **Strict JSON Output (DO NOT EXPLAIN, STRICT FORMAT)**:
        ```json
        {{
          "loyalty_rewards": [
            {{
              "customerName": "John Doe",
              "loyaltyTier": "Gold",
              "discountPercent": 20,
              "reason": "Spent over $1000"
            }},
            {{
              "customerName": "Jane Smith",
              "loyaltyTier": "Silver",
              "discountPercent": 10,
              "reason": "Frequent customer with 3 orders"
            }}
          ]
        }}
        ```
        """

        # ✅ Get AI Response
        response = gemini_model.generate_content(prompt)
        ai_response = response.text.strip()

        # ✅ Parse JSON Response Safely
        rewards = clean_and_parse_ai_response(ai_response)
        return {"loyalty_rewards": rewards.get("loyalty_rewards", [])}

    except Exception as e:
        return {"error": f"Error assigning loyalty rewards: {str(e)}"}

# ✅ Clean AI Response Function
def clean_and_parse_ai_response(ai_response):
    try:
        clean_response = re.sub(r"```json|```", "", ai_response).strip()
        if not clean_response.startswith("{") or not clean_response.endswith("}"):
            raise ValueError("AI response is not valid JSON.")
        return json.loads(clean_response)
    except (json.JSONDecodeError, ValueError) as e:
        return {"error": f"Invalid AI response: {str(e)}", "response_text": ai_response}

# ✅ API Route: Get Loyalty Rewards
@app.route('/loyalty-rewards', methods=['GET'])
def get_loyalty_rewards():
    reward_list = assign_loyalty_rewards()
    return jsonify(reward_list)

# ✅ Global Error Handler
@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    return jsonify({"error": "Internal Server Error", "message": str(e)}), 500

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

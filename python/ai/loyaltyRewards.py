import os
import pymongo
import google.generativeai as genai
import json
import re
from flask import Flask, jsonify

# ✅ Initialize Flask App
app = Flask(__name__)

# ✅ Connect to MongoDB
MONGO_URI = "mongodb+srv://kumarshresth2004:Shresth%40123@cluster0.lly1dz4.mongodb.net/"
client = pymongo.MongoClient(MONGO_URI)
db = client["store_db"]
order_collection = db["orders"]

# ✅ Configure Gemini AI Key
genai.configure(api_key="AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U")
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
            customer_name = order.get("customerName", "Unknown Customer")  # ✅ Handle missing names safely
            order_value = sum(p.get("price", 0) * p.get("quantity", 0) for p in order.get("products", []))

            if customer_name != "Unknown Customer":
                customer_orders[customer_name] = customer_orders.get(customer_name, 0) + 1
                customer_spending[customer_name] = customer_spending.get(customer_name, 0) + order_value

        # ✅ AI Agent Prompt
        prompt = f"""
        You are an AI-based loyalty program manager. Assign **discount rewards** to customers based on their loyalty.

        **Loyalty Rules**:
        1. **Gold Loyalty** (VIP Customers):
            - **3+ Orders** or **Spent over $1000** → **20% Discount**
        2. **Silver Loyalty** (Frequent Customers):
            - **2-3 Orders** or **Spent over $500** → **10% Discount**
        3. **New Customers** (1 orders):
            - No discount unless first-time promo available.

        **Customer Data**:
        - Orders: {json.dumps(customer_orders)}
        - Spending: {json.dumps(customer_spending)}

        **Return JSON Format (Strict Format, No Explanation)**:
        {{
          "loyalty_rewards": [
            {{
              "customerName": "...",
              "loyaltyTier": "...",
              "discountPercent": ...,
              "reason": "..."
            }}
          ]
        }}
        """

        # ✅ Get AI Response
        response = gemini_model.generate_content(prompt)
        ai_response = response.text.strip()

        # ✅ Clean AI Response (Remove ```json formatting)
        clean_response = re.sub(r"```json|```", "", ai_response).strip()

        # ✅ Parse JSON Safely
        try:
            rewards = json.loads(clean_response)
            return {"loyalty_rewards": rewards.get("loyalty_rewards", [])}
        except json.JSONDecodeError as e:
            return {"error": f"Invalid AI response format. JSON Parsing Error: {str(e)}", "response_text": ai_response}

    except Exception as e:
        return {"error": f"Error assigning loyalty rewards: {str(e)}"}

# ✅ API Route: Get Loyalty Rewards
@app.route('/loyalty-rewards', methods=['GET'])
def get_loyalty_rewards():
    reward_list = assign_loyalty_rewards()
    return jsonify(reward_list)

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

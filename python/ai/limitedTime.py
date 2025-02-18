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
db = client["test_store_db"]
order_collection = db["orders"]
inventory_collection = db["inventory"]

# ✅ Configure Gemini AI Key
genai.configure(api_key="AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U")
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# ✅ AI-powered Limited-Time Deals Suggestion
def generate_limited_time_deals():
    try:
        # ✅ Fetch inventory & past sales data
        inventory = {item["name"]: item["quantity"] for item in inventory_collection.find({}, {"_id": 0})}
        orders = list(order_collection.find({}, {"_id": 0}))

        # ✅ Analyze sales history
        product_sales = {}
        for order in orders:
            for product in order.get("products", []):
                product_name = product["name"]
                quantity = product["quantity"]
                product_sales[product_name] = product_sales.get(product_name, 0) + quantity

        # ✅ AI Agent Prompt
        prompt = f"""
        You are an AI sales forecaster. Identify **limited-time deals** for products based on:
        - **High Inventory, Low Sales** → Products overstocked but not selling.
        - **Forecasted Sales Demand** → Predicted demand in the next 30 days.
        - **Seasonal Opportunities** → Items that may sell well in the current season.

        **Rules**:
        - Suggest only **5-10 best products** for deals.
        - Include an **optimal discount %** to boost sales.
        - Prioritize **high-inventory, low-demand items**.

        **Product Data**:
        - Inventory: {json.dumps(inventory)}
        - Past Sales: {json.dumps(product_sales)}

        **Return JSON Format (Strict Format, No Explanation)**:
        {{
          "limited_time_deals": [
            {{
              "name": "...",
              "original_price": ...,
              "discounted_price": ...,
              "discount_percent": ...,
              "deal_expires": "YYYY-MM-DD"
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
            deals = json.loads(clean_response)
            return {"limited_time_deals": deals.get("limited_time_deals", [])}
        except json.JSONDecodeError as e:
            return {"error": f"Invalid AI response format. JSON Parsing Error: {str(e)}", "response_text": ai_response}

    except Exception as e:
        return {"error": f"Error generating limited-time deals: {str(e)}"}

# ✅ API Route: Get Limited-Time Deals
@app.route('/limited-time-deals', methods=['GET'])
def get_limited_time_deals():
    deals_list = generate_limited_time_deals()
    return jsonify(deals_list)

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

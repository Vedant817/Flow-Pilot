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

# ✅ AI-powered Deadstock Analysis
def identify_deadstocks():
    try:
        # ✅ Fetch all orders and inventory
        orders = list(order_collection.find({}, {"_id": 0}))
        inventory = {item["name"]: item["quantity"] for item in inventory_collection.find({}, {"_id": 0})}

        # ✅ Analyze sales history
        product_sales = {}
        for order in orders:
            for product in order.get("products", []):
                product_name = product["name"]
                quantity = product["quantity"]
                if product_name in product_sales:
                    product_sales[product_name] += quantity
                else:
                    product_sales[product_name] = quantity

        # ✅ AI Agent Prompt
        prompt = f"""
        You are an AI inventory analyst. Identify **deadstocks** (products with very low sales but high inventory).
        
        **Rules**:
        - If sales are **0 or very low** and inventory is **high**, mark as "Low sales".
        - Return only the **top deadstocks in JSON format**.

        **Product Data**:
        - Inventory: {json.dumps(inventory)}
        - Sales: {json.dumps(product_sales)}

        **Output Format (Strict JSON, No Explanation)**:
        {{
          "deadstocks": [
            {{
              "name": "...",
              "inventory": ...,
              "sales": ...,
            }}
          ]
        }}
        """

        # ✅ Get AI Response
        response = gemini_model.generate_content(prompt)
        ai_response = response.text.strip()

        # ✅ Clean AI Response (Remove ```json ... ```)
        clean_response = re.sub(r"```json|```", "", ai_response).strip()

        # ✅ Parse JSON Safely
        try:
            deadstocks = json.loads(clean_response)
            return {"deadstocks": deadstocks.get("deadstocks", [])}
        except json.JSONDecodeError as e:
            return {"error": f"Invalid AI response format. JSON Parsing Error: {str(e)}", "response_text": ai_response}

    except Exception as e:
        return {"error": f"Error analyzing deadstocks: {str(e)}"}

# ✅ API Route: Get Deadstocks
@app.route('/deadstocks', methods=['GET'])
def get_deadstocks():
    deadstock_list = identify_deadstocks()
    return jsonify(deadstock_list)

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

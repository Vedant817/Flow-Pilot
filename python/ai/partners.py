import os
import pymongo
import google.generativeai as genai
import json
import re
from flask import Flask, jsonify

# ✅ Initialize Flask App
app = Flask(__name__)

# ✅ Connect to MongoDB
MONGO_URI = os.getenv("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["test_store_db"]
inventory_collection = db["inventory"]
partners_collection = db["partners"]  # ✅ Collection for partner products

# ✅ Configure Gemini AI Key
genai.configure(api_key="AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U")
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# ✅ AI-powered Partner Product Recommendation
def recommend_partner_products():
    try:
        # ✅ Fetch inventory & partner product data
        inventory = {item["name"]: item["quantity"] for item in inventory_collection.find({}, {"_id": 0})}
        partner_products = list(partners_collection.find({}, {"_id": 0}))

        # ✅ Identify Out-of-Stock Products
        out_of_stock = [p for p, qty in inventory.items() if qty == 0]

        if not out_of_stock:
            return {"message": "All products are in stock."}

        # ✅ AI Agent Prompt
        prompt = f"""
        You are an AI-driven sales expert. Recommend **alternative products from partner brands** when a product is **out of stock**.

        **Rules**:
        1. Match the **category and purpose** of the out-of-stock product.
        2. Prioritize products with **good availability** from partner brands.
        3. Ensure recommendations have **similar features and quality**.

        **Data Provided**:
        - Out of Stock Products: {json.dumps(out_of_stock)}
        - Available Partner Products: {json.dumps(partner_products)}

        **Return JSON Format (Strict Format, No Explanation)**:
        {{
          "recommendations": [
            {{
              "outOfStockProduct": "...",
              "recommendedPartnerProduct": "...",
              "partnerBrand": "...",
              "reason": "Similar Product & Available"
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
            recommendations = json.loads(clean_response)
            return {"recommendations": recommendations.get("recommendations", [])}
        except json.JSONDecodeError as e:
            return {"error": f"Invalid AI response format. JSON Parsing Error: {str(e)}", "response_text": ai_response}

    except Exception as e:
        return {"error": f"Error recommending partner products: {str(e)}"}

# ✅ API Route: Get Partner Product Recommendations
@app.route('/partner-product-recommendations', methods=['GET'])
def get_partner_product_recommendations():
    recommendations_list = recommend_partner_products()
    return jsonify(recommendations_list)

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

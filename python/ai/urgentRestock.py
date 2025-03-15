import os
import pymongo
import google.generativeai as genai
import pandas as pd
import json
from flask import Flask, jsonify

# ✅ Initialize Flask App
app = Flask(__name__)

# ✅ Connect to MongoDB
MONGO_URI = "mongodb+srv://kumarshresth2004:Shresth%40123@cluster0.lly1dz4.mongodb.net/"
client = pymongo.MongoClient(MONGO_URI)
db = client["test_store_db"]
order_collection = db["orders"]
inventory_collection = db["inventory"]

# ✅ Configure Gemini API Key
genai.configure(api_key="AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U")
gemini_model = genai.GenerativeModel("gemini-2.0-flash")  # ✅ Use Gemini-2.0-Flash

# ✅ Convert MongoDB Documents to JSON-Safe Format
def convert_mongo_docs(docs):
    """ Convert MongoDB documents to JSON-safe format (converting ObjectId to string). """
    for doc in docs:
        doc["_id"] = str(doc["_id"])  # Convert ObjectId to string
    return docs

# ✅ AI-Powered Restocking Analysis
def get_urgent_restocking():
    try:
        # Step 1: Fetch Orders & Inventory Data
        orders = list(order_collection.find())
        inventory = list(inventory_collection.find())

        if not orders:
            return {"error": "No orders found."}
        if not inventory:
            return {"error": "No inventory found."}

        # ✅ Convert MongoDB ObjectId fields to string for JSON compatibility
        orders = convert_mongo_docs(orders)
        inventory = convert_mongo_docs(inventory)

        # Step 2: Process Sales Data
        sales_data = {}
        for order in orders:
            products = order.get("products", [])
            for product in products:
                product_name = product.get("name", "Unknown")
                product_qty = product.get("quantity", 0)
                sales_data[product_name] = sales_data.get(product_name, 0) + product_qty

        # Step 3: Prepare AI Prompt
        prompt = f"""
        You are an AI assistant for inventory management. Based on recent sales and current stock levels, provide a JSON response with **only urgent restocking recommendations**.

        **Sales Data (Last Orders):**
        {json.dumps(sales_data)}

        **Current Inventory Levels:**
        {json.dumps(inventory)}

        ### Response Format:
        Ensure your response is a **valid JSON** with this format:

        ```json
        {{
          "urgent_restocking": [
            {{
              "product": "Product Name",
              "current_stock": 2,
              "recommended_stock": 10
            }},
            {{
              "product": "Another Product",
              "current_stock": 1,
              "recommended_stock": 15
            }}
          ]
        }}
        ```

        **Important:** 
        - Only include products that need **urgent restocking**.
        - Do NOT add explanations, only return JSON output.
        """

        # Step 4: Call Gemini AI
        response = gemini_model.generate_content(prompt)

        # Step 5: Extract JSON from AI Response Safely
        response_text = response.text.strip()

        try:
            # ✅ Extract JSON block safely
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            json_data = response_text[json_start:json_end]

            parsed_data = json.loads(json_data)  # ✅ Safe JSON parsing

            if "urgent_restocking" in parsed_data:
                return parsed_data
            else:
                return {"error": "Invalid AI response format"}

        except json.JSONDecodeError:
            return {"error": "AI response is not valid JSON"}

    except Exception as e:
        return {"error": str(e)}

# ✅ API Route: Get Urgent Restocking Items
@app.route('/urgent-restocking', methods=['GET'])
def urgent_restocking():
    restocking_data = get_urgent_restocking()
    return jsonify(restocking_data)

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

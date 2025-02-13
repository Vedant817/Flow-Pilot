import os
import pymongo
import google.generativeai as genai
import pandas as pd
from flask import Flask, request, jsonify
from bson import ObjectId

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
gemini_model = genai.GenerativeModel("gemini-2.0-flash")  # ✅ Correct API usage

# ✅ AI Agent: Dynamic Price Adjustment
def generate_price_adjustment_report():
    try:
        # Step 1: Fetch all orders & inventory data
        orders = list(order_collection.find({}, {"_id": 0}))  # Exclude `_id` field
        inventory = list(inventory_collection.find({}, {"_id": 0}))

        # Step 2: Convert to DataFrame for analysis
        order_df = pd.DataFrame(orders)
        inventory_df = pd.DataFrame(inventory)

        # Step 3: Prepare Data for AI (Extract Sales & Stock Levels)
        sales_data = {}
        for order in orders:
            products = order.get("products", [])  # ✅ Prevent KeyError
            for product in products:
                product_name = product.get("name", "Unknown")
                product_qty = product.get("quantity", 0)
                sales_data[product_name] = sales_data.get(product_name, 0) + product_qty

        stock_data = {item.get("name", "Unknown"): item.get("quantity", 0) for item in inventory}
        price_data = {item.get("name", "Unknown"): item.get("price", "N/A") for item in inventory}

        # Step 4: Prepare AI Prompt for Pricing Strategy
        prompt = f"""
        You are an AI specializing in **dynamic price adjustment** based on supply and demand. 

        **Sales Data (Recent Orders)**:
        {sales_data}

        **Current Inventory Levels**:
        {stock_data}

        **Current Product Prices**:
        {price_data}

        🔹 **Pricing Adjustment Goals**:
        1. If a product has **high demand but low stock**, suggest a **price increase**.
        2. If a product has **low demand but high stock**, suggest a **price decrease**.
        3. If demand and supply are balanced, keep the price stable.
        4. Identify potential **seasonal trends** and suggest pricing strategies accordingly.

        🔹 **Strict JSON Output Format**:
        {{
            "adjustments": [
                {{
                    "product": "Product Name",
                    "old_price": "Current Price",
                    "new_price": "Suggested New Price",
                    "reason": "Explanation"
                }}
            ]
        }}
        """

        # Step 5: Query Gemini AI Model
        response = gemini_model.generate_content(prompt)  # ✅ Correct API call
        
        # Step 6: Extract structured response
        if response and response.text:
            return response.text  # Gemini should return structured JSON
        else:
            return {"error": "No valid response from Gemini AI."}

    except Exception as e:
        return {"error": f"Error generating pricing report: {str(e)}"}

# ✅ API Route: Get Price Adjustment Report
@app.route('/price-adjustment-report', methods=['GET'])
def price_adjustment_report():
    report = generate_price_adjustment_report()
    return jsonify({"price_adjustment_report": report})

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)  

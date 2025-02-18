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

# ✅ Configure Gemini API Key
genai.configure(api_key="AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U")
gemini_model = genai.GenerativeModel("gemini-2.0-flash")  # ✅ Correct API usage

# ✅ AI Agent: Analyze Sales & Predict Future Demand
def generate_inventory_report():
    try:
        # Step 1: Fetch all orders & inventory data
        orders = list(order_collection.find())
        inventory = list(inventory_collection.find())

        # Step 2: Create DataFrame for analysis
        order_df = pd.DataFrame(orders)
        inventory_df = pd.DataFrame(inventory)

        # Step 3: Prepare Data for AI (Extract Sales Data)
        sales_data = {}
        for order in orders:
            products = order.get("products", [])  # ✅ Prevent KeyError
            for product in products:
                product_name = product.get("name", "Unknown")
                product_qty = product.get("quantity", 0)
                sales_data[product_name] = sales_data.get(product_name, 0) + product_qty

        # Step 4: Prepare AI Prompt for Forecasting
        prompt = f"""
        You are an inventory forecasting AI. Based on the following sales data and stock levels, generate a detailed report on restocking recommendations, overstocked items, and seasonal trends.

        **Sales Data (Last Orders)**:
        {sales_data}

        **Current Inventory Levels**:
        {inventory_df.to_dict(orient="records")}

        Provide insights on:
        1. Products that need urgent restocking.
        2. Products that are overstocked.
        3. Expected demand trends for the next 3 months.
        4. Recommendations for improving stock efficiency.
        """

        # Step 5: Query Gemini AI Model
        response = gemini_model.generate_content(prompt)  # ✅ Corrected Gemini API call
        return response.text

    except Exception as e:
        return f"Error generating report: {str(e)}"

# ✅ API Route: Get Inventory Forecast Report
@app.route('/inventory-report', methods=['GET'])
def inventory_report():
    report = generate_inventory_report()
    return jsonify({"inventory_report": report})

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

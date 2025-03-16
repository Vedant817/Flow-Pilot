import os
import pymongo
import google.generativeai as genai
import pandas as pd
from flask import Flask, request, jsonify
from bson import ObjectId
import json

# Initialize Flask App
app = Flask(__name__)

# Connect to MongoDB
MONGO_URI = "mongodb+srv://kumarshresth2004:Shresth%40123@cluster0.lly1dz4.mongodb.net/"
client = pymongo.MongoClient(MONGO_URI)
db = client["test_store_db"]
order_collection = db["orders"]
inventory_collection = db["inventory"]
customer_collection = db["customers"]

# Configure Gemini API Key
genai.configure(api_key=os.getenv("GENAI_API_KEY"))
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

def generate_customer_insights():
    try:
        # Fetch Orders & Customer Data
        orders = list(order_collection.find())
        customers = list(customer_collection.find())

        if not orders:
            return {"error": "No order data available."}
        if not customers:
            return {"error": "No customer data available."}

        print("Sample Order Data:", orders[:2])  # Debugging

        # Ensure all orders have 'email', fetch from customers if missing
        for order in orders:
            if 'email' not in order:
                customer = customer_collection.find_one({"_id": order.get("customer_id")})
                if customer and 'email' in customer:
                    order['email'] = customer['email']

        # Convert orders to DataFrame
        order_df = pd.DataFrame(orders)

        if 'email' not in order_df.columns:
            return {"error": "Still missing 'email' field in some orders."}

        order_df = order_df.dropna(subset=['email'])
        if order_df.empty:
            return {"error": "No valid orders with 'email' found."}

        # Convert 'date' to datetime format
        order_df['date'] = pd.to_datetime(order_df['date'], errors='coerce')

        # Calculate total amount (Mocking prices for now)
        def calculate_total(products):
            price_list = {
                "iPhone 15 Pro": 999,
                "AirPods Max": 549
            }
            return sum(price_list.get(p['name'], 0) * p['quantity'] for p in products)

        order_df['total_amount'] = order_df['products'].apply(calculate_total)

        # Match customers using 'email'
        customer_map = {c["email"]: c["Name"] for c in customers}
        order_df['customer_name'] = order_df['email'].map(customer_map)

        # Most Frequent Customers
        customer_freq = order_df['email'].value_counts().to_dict()
        loyal_customers = sorted(customer_freq, key=customer_freq.get, reverse=True)[:10]

        # Top 10 Customers by Spending
        top_spenders = order_df.groupby('email')['total_amount'].sum().nlargest(10).to_dict()

        # Generate AI Prompt
        prompt = f"""
        You are an AI analyzing customer order data. Based on the order history, provide insights on:

        1. Most Frequent Customers (Loyal Customers).
        2. Top 10 Customers by Spending.
        3. Order Trends for the last few months.

        **Order Data**:
        {order_df[['email', 'customer_name', 'total_amount', 'date']].to_dict(orient="records")}

        **Customer Data**:
        {customer_df[['email', 'Name', 'phone']].to_dict(orient="records")}
        """

        # Query Gemini AI Model
        response = gemini_model.generate_content(prompt)

        # Validate AI Response
        if not response or not hasattr(response, 'text') or not response.text.strip():
            return {"error": "Empty or invalid response from AI model."}

        try:
            insights = json.loads(response.text)
            return {
                "loyal_customers": loyal_customers,
                "top_spenders": top_spenders,
                "order_trends": insights.get("order_trends", [])
            }
        except json.JSONDecodeError:
            return {"error": "AI response is not a valid JSON format."}

    except Exception as e:
        return {"error": f"Exception occurred: {str(e)}"}

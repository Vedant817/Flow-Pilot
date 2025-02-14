import os
import pymongo
import google.generativeai as genai
import pandas as pd
from flask import Flask, jsonify

# ✅ Initialize Flask App
app = Flask(__name__)

# ✅ Connect to MongoDB
MONGO_URI = "mongodb+srv://kumarshresth2004:Shresth%40123@cluster0.lly1dz4.mongodb.net/"
client = pymongo.MongoClient(MONGO_URI)
db = client["test_store_db"]
customer_collection = db["customers"]
order_collection = db["orders"]
inventory_collection = db["inventory"]

# ✅ Configure Gemini AI Key
genai.configure(api_key="AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U")
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# ✅ AI Agent: Generate Business Summary
def generate_business_summary():
    try:
        # Fetch all customers, orders, and inventory
        customers = list(customer_collection.find({}, {"_id": 0}))
        orders = list(order_collection.find({}, {"_id": 0}))
        inventory = list(inventory_collection.find({}, {"_id": 0}))

        # Step 1: Customer Insights (Mapping Customers to Products)
        customer_orders = {cust["Email"]: [] for cust in customers}
        for order in orders:
            email = order.get("customerEmail", "")
            if email in customer_orders:
                customer_orders[email].extend(order.get("products", []))

        customer_summary = []
        for customer in customers:
            email = customer["Email"]
            order_history = customer_orders[email]
            category = "Loyal" if len(order_history) > 3 else "New" if len(order_history) == 0 else "Occasional"
            customer_summary.append({
                "Name": customer.get("Name", "Unknown"),
                "Email": email,
                "Total Orders": len(order_history),
                "Category": category,
                "Products Bought": order_history  # ✅ Include products bought
            })

        # Step 2: Inventory Insights
        inventory_summary = []
        for item in inventory:
            name = item.get("name", "Unknown")
            stock = item.get("quantity", 0)
            price = item.get("price", "N/A")
            inventory_summary.append({
                "Product": name,
                "Stock": stock,
                "Price": price
            })

        # Step 3: Sales Analysis
        sales_data = {}
        for order in orders:
            for product in order.get("products", []):
                name = product.get("name", "Unknown")
                quantity = product.get("quantity", 0)
                sales_data[name] = sales_data.get(name, 0) + quantity

        best_sellers = sorted(sales_data.items(), key=lambda x: x[1], reverse=True)[:5]
        low_sellers = sorted(sales_data.items(), key=lambda x: x[1])[:5]

        # Step 4: Generate AI Summary (Updated Prompt)
        prompt = f"""
        You are an AI business analyst. Provide a structured JSON summary of the business performance.

        🔹 **Customer Summary**:
        - Identify **loyal, new, and occasional customers** based on their order history.
        - Mention **products bought by each customer**.
        - Include total orders placed per customer.

        🔹 **Inventory Analysis**:
        - Highlight **stock availability & pricing**.

        🔹 **Sales Insights**:
        - Identify **best-selling and low-selling products**.

        **Data Provided**:
        - **Customers & Orders**:
          {customer_summary}
        - **Inventory**:
          {inventory_summary}
        - **Sales Data**:
          - Best-Sellers: {best_sellers}
          - Low-Sellers: {low_sellers}

        🔹 **Output Strict JSON Format**:
        {{
            "customers": [...],
            "inventory": [...],
            "sales": {{
                "best_sellers": [...],
                "low_sellers": [...]
            }}
        }}
        """

        response = gemini_model.generate_content(prompt)
        return response.text if response and response.text else {"error": "No response from AI"}

    except Exception as e:
        return {"error": f"Error generating summary: {str(e)}"}

# ✅ API Route: Get Business Summary
@app.route('/summary-report', methods=['GET'])
def summary_report():
    summary = generate_business_summary()
    return jsonify({"business_summary": summary})

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

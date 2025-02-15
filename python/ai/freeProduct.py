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

# ✅ AI-powered Free Product Allocation
def assign_free_products():
    try:
        # ✅ Fetch inventory & past sales data
        inventory = {item["name"]: item["quantity"] for item in inventory_collection.find({}, {"_id": 0})}
        orders = list(order_collection.find({}, {"_id": 0}))

        # ✅ Analyze sales history
        product_sales = {}
        customer_orders = {}

        for order in orders:
            customer_name = order.get("customerName", "Unknown Customer")  # ✅ Handle missing names safely
            total_order_value = sum(p.get("quantity", 0) for p in order.get("products", []))

            # ✅ Ensure only valid customers are stored
            if customer_name != "Unknown Customer":
                customer_orders[customer_name] = customer_orders.get(customer_name, 0) + total_order_value

            for product in order.get("products", []):
                product_name = product.get("name", "Unknown Product")
                quantity = product.get("quantity", 0)
                product_sales[product_name] = product_sales.get(product_name, 0) + quantity

        # ✅ Identify Low-Selling Products
        low_sales_products = [p for p, sales in product_sales.items() if sales < 5]  # ✅ Products with very low sales

        # ✅ AI Agent Prompt
        prompt = f"""
        You are an AI-driven sales expert. Assign **free low-sales products** to customers who placed **high-value orders**.

        **Rules**:
        1. Customers with the **highest total orders** should get **free low-selling products**.
        2. Free product allocation should **rotate** to ensure fairness.
        3. Prioritize products with **high inventory and low sales**.

        **Data Provided**:
        - Low Sales Products: {json.dumps(low_sales_products)}
        - High Order Customers: {json.dumps(customer_orders)}

        **Return JSON Format (Strict Format, No Explanation)**:
        {{
          "free_product_assignments": [
            {{
              "customerName": "...",
              "freeProduct": "...",
              "reason": "High Order Value"
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
            free_products = json.loads(clean_response)
            return {"free_product_assignments": free_products.get("free_product_assignments", [])}
        except json.JSONDecodeError as e:
            return {"error": f"Invalid AI response format. JSON Parsing Error: {str(e)}", "response_text": ai_response}

    except Exception as e:
        return {"error": f"Error assigning free products: {str(e)}"}

# ✅ API Route: Get Free Product Assignments
@app.route('/free-product-assignments', methods=['GET'])
def get_free_product_assignments():
    free_products_list = assign_free_products()
    return jsonify(free_products_list)

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

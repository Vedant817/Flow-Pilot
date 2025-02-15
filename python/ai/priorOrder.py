import os
import pymongo
import google.generativeai as genai
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

# ✅ Configure Gemini AI Key
genai.configure(api_key="AIzaSyBmBcIxK8yw8pxe3ZWCZAto8yqAaQknq4U")
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# ✅ Greedy Order Prioritization Algorithm with AI Agent
def prioritize_orders():
    try:
        # ✅ Fetch all orders and inventory
        orders = list(order_collection.find({}, {"_id": 0}))
        inventory = {item["name"]: item["quantity"] for item in inventory_collection.find({}, {"_id": 0})}

        fulfilled_orders = []
        partially_fulfilled_orders = []
        pending_orders = []
        remaining_inventory = inventory.copy()

        for order in orders:
            order_products = order.get("products", [])
            can_fully_fulfill = True
            can_partially_fulfill = False

            # ✅ Check fulfillment conditions
            for product in order_products:
                product_name = product["name"]
                required_qty = product["quantity"]
                available_qty = remaining_inventory.get(product_name, 0)

                if available_qty >= required_qty:
                    continue  # ✅ Enough stock for this product
                elif available_qty > 0:
                    can_fully_fulfill = False
                    can_partially_fulfill = True
                else:
                    can_fully_fulfill = False

            # ✅ Categorize the order
            if can_fully_fulfill:
                order["status"] = "fulfilled"
                fulfilled_orders.append(order)
                for product in order_products:
                    remaining_inventory[product["name"]] -= product["quantity"]
            elif can_partially_fulfill:
                order["status"] = "partially fulfilled"
                partially_fulfilled_orders.append(order)
            else:
                order["status"] = "pending fulfillment"
                pending_orders.append(order)

        # ✅ AI Agent for Greedy Prioritization
        prompt = f"""
        You are an AI logistics expert. Apply a **greedy sorting algorithm** to prioritize orders for fulfillment.

        **Sorting Rules**:
        1. **Fulfilled orders** → Always at the top.
        2. **Partially fulfilled orders** → Placed next.
        3. **Pending fulfillment orders** → Placed last.
        4. **Within each category**, sort by **earliest date and time**.

        **Data Provided**:
        - Fulfilled Orders: {json.dumps(fulfilled_orders)}
        - Partially Fulfilled Orders: {json.dumps(partially_fulfilled_orders)}
        - Pending Orders: {json.dumps(pending_orders)}
        - Inventory: {json.dumps(inventory)}

        **Output JSON Format (Strictly return JSON, do not include text):**
        {{
            "prioritized_orders": [
                {{"customerName": "...", "customerEmail": "...", "date": "...", "time": "...", "products": [...], "status": "...", "orderLink": "..." }},
                ...
            ]
        }}
        """

        response = gemini_model.generate_content(prompt)

        # ✅ Check if AI response is empty
        if not response or not response.text:
            return {"error": "AI did not return any response."}

        # ✅ Parse AI response safely
        try:
            ai_result = json.loads(response.text.strip())  # ✅ Remove any extra whitespace
            return {"prioritized_orders": ai_result.get("prioritized_orders", [])[:15]}  # ✅ Return Top 15 orders
        except json.JSONDecodeError as e:
            return {"error": f"Invalid AI response format. JSON Parsing Error: {str(e)}", "response_text": response.text}

    except Exception as e:
        return {"error": f"Error prioritizing orders: {str(e)}"}

# ✅ API Route: Get Prioritized Orders
@app.route('/prioritized-orders', methods=['GET'])
def get_prioritized_orders():
    prioritized_list = prioritize_orders()
    return jsonify(prioritized_list)

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

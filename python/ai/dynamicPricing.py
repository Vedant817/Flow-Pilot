import os
import pymongo
import google.generativeai as genai
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

# ✅ AI Agent: Generate Pricing Suggestions
def generate_pricing_suggestions():
    try:
        # Fetch all orders and inventory
        orders = list(order_collection.find({}, {"_id": 0}))
        inventory = list(inventory_collection.find({}, {"_id": 0}))

        # Step 1: Compute Demand for Each Product
        sales_data = {}
        for order in orders:
            for product in order.get("products", []):
                name = product.get("name", "Unknown")
                quantity = product.get("quantity", 0)
                sales_data[name] = sales_data.get(name, 0) + quantity

        # Step 2: Suggest New Prices Based on Demand & Supply
        price_suggestions = []
        for item in inventory:
            name = item.get("name", "Unknown")
            stock = item.get("quantity", 0)
            old_price = item.get("price", 0)
            demand = sales_data.get(name, 0)

            # ✅ Dynamic Pricing Strategy
            if demand > 10 and stock < 5:  # High demand, low supply
                new_price = round(old_price * 1.2, 2)  # Increase by 20%
            elif demand < 3 and stock > 20:  # Low demand, high supply
                new_price = round(old_price * 0.85, 2)  # Decrease by 15%
            else:
                new_price = old_price  # Keep unchanged

            price_suggestions.append({
                "Product": name,
                "Old Price": old_price,
                "New Price": new_price
            })

        # Step 3: Generate AI Summary
        prompt = f"""
        You are an AI business analyst. Based on demand and stock levels, suggest new pricing for each product.
        - Maintain previous prices for reference.
        
        **Pricing Suggestions (Old vs. New Price)**:
        {price_suggestions}

        Provide the output in JSON format:
        {{
            "pricing_recommendations": [
                {{"Product": "Product Name", "Old Price": Old_Price, "New Price": New_Price}}
            ]
        }}
        """

        response = gemini_model.generate_content(prompt)
        return response.text if response and response.text else {"error": "No response from AI"}

    except Exception as e:
        return {"error": f"Error generating pricing suggestions: {str(e)}"}

# ✅ API Route: Get Pricing Suggestions
@app.route('/pricing_suggestions', methods=['GET'])
def pricing_summary():
    suggestions = generate_pricing_suggestions()
    return jsonify({"pricing_recommendations": suggestions})

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

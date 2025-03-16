import json
from config.gemini_config import gemini_model
from config.dbConfig import db

order_collection = db["orders"]
inventory_collection = db["inventory"]

def convert_mongo_docs(docs):
    """ Convert MongoDB documents to JSON-safe format (converting ObjectId to string). """
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return docs

def get_urgent_restocking():
    try:
        orders = list(order_collection.find())
        inventory = list(inventory_collection.find())

        if not orders:
            return {"error": "No orders found."}
        if not inventory:
            return {"error": "No inventory found."}

        orders = convert_mongo_docs(orders)
        inventory = convert_mongo_docs(inventory)

        sales_data = {}
        for order in orders:
            products = order.get("products", [])
            for product in products:
                product_name = product.get("name", "Unknown")
                product_qty = product.get("quantity", 0)
                sales_data[product_name] = sales_data.get(product_name, 0) + product_qty

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

        response = gemini_model.generate_content(prompt)

        response_text = response.text.strip()

        try:
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            json_data = response_text[json_start:json_end]

            parsed_data = json.loads(json_data)

            if "urgent_restocking" in parsed_data:
                return parsed_data
            else:
                return {"error": "Invalid AI response format"}

        except json.JSONDecodeError:
            return {"error": "AI response is not valid JSON"}

    except Exception as e:
        return {"error": str(e)}

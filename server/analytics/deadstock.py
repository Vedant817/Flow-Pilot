from config.gemini_config import gemini_model
from config.dbConfig import db
import json
import re

order_collection = db["orders"]
inventory_collection = db["inventory"]

def identify_deadstocks():
    try:
        orders = list(order_collection.find({}, {"_id": 0}))
        inventory = {item["name"]: item["quantity"] for item in inventory_collection.find({}, {"_id": 0})}

        product_sales = {}
        for order in orders:
            for product in order.get("products", []):
                product_name = product["name"]
                quantity = product["quantity"]
                if product_name in product_sales:
                    product_sales[product_name] += quantity
                else:
                    product_sales[product_name] = quantity

        prompt = f"""
        You are an AI inventory analyst. Identify **deadstocks** (products with very low sales but high inventory).
        
        **Rules**:
        - If sales are **0 or very low** and inventory is **high**, mark as "Low sales".
        - Return only the **top deadstocks in JSON format**.

        **Product Data**:
        - Inventory: {json.dumps(inventory)}
        - Sales: {json.dumps(product_sales)}

        **Output Format (Strict JSON, No Explanation)**:
        {{
            "deadstocks": [
                {{
                "name": "...",
                "inventory": ...,
                "sales": ...,
                }}
            ]
        }}
        """

        response = gemini_model.generate_content(prompt)
        ai_response = response.text.strip()

        clean_response = re.sub(r"```json|```", "", ai_response).strip()

        try:
            deadstocks = json.loads(clean_response)
            return {"deadstocks": deadstocks.get("deadstocks", [])}
        except json.JSONDecodeError as e:
            return {"error": f"Invalid AI response format. JSON Parsing Error: {str(e)}", "response_text": ai_response}

    except Exception as e:
        return {"error": f"Error analyzing deadstocks: {str(e)}"}

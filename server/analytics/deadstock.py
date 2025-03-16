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
            if "products" in order and isinstance(order["products"], list):
                for product in order["products"]:
                    if isinstance(product, dict) and "name" in product:
                        product_name = product["name"]
                        quantity = product.get("quantity", 1)
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

        clean_response = re.sub(r'``````', '', ai_response).strip()

        try:
            deadstocks = json.loads(clean_response)
            return {"deadstocks": deadstocks.get("deadstocks", [])}
        except json.JSONDecodeError as e:
            try:
                match = re.search(r'``````', ai_response, re.DOTALL)
                if match:
                    json_str = match.group(1).strip()
                    deadstocks = json.loads(json_str)
                    return {"deadstocks": deadstocks.get("deadstocks", [])}
                else:
                    return {"error": f"Invalid AI response format. JSON Parsing Error: {str(e)}", "response_text": ai_response}
            except Exception as inner_e:
                return {"error": f"Failed to parse JSON: {str(inner_e)}", "response_text": ai_response}

    except Exception as e:
        import traceback
        return {"error": f"Error analyzing deadstocks: {str(e)}", "traceback": traceback.format_exc()}

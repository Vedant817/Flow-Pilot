from config.dbConfig import db

order_collection = db["orders"]
inventory_collection = db["inventory"]

def generate_pricing_suggestions():
    try:
        orders = list(order_collection.find({}, {"_id": 0}))
        inventory = list(inventory_collection.find({}, {"_id": 0}))

        sales_data = {}
        for order in orders:
            for product in order.get("products", []):
                name = product.get("name", "Unknown")
                quantity = product.get("quantity", 0)
                sales_data[name] = sales_data.get(name, 0) + quantity

        price_suggestions = []
        for item in inventory:
            name = item.get("name", "Unknown")
            stock = item.get("quantity", 0)
            old_price = item.get("price", 0)
            demand = sales_data.get(name, 0)

            if demand > 5 and stock < 35:
                new_price = round(old_price * 1.2, 2)
            elif demand < 3 and stock > 20:
                new_price = round(old_price * 0.85, 2) 
            else:
                new_price = old_price

            if new_price != old_price:
                price_suggestions.append({
                    "Product": name,
                    "Old Price": old_price,
                    "New Price": new_price
                })

        return {"pricing_recommendations": price_suggestions}

    except Exception as e:
        return {"error": f"Error generating pricing suggestions: {str(e)}"}

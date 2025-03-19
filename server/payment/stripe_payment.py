from config.dbConfig import db
import stripe # type: ignore
import os
from dotenv import load_dotenv

load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

def create_payment_link(order_id):
    try:
        orders_collection = db["orders"]
        order = orders_collection.find_one({"orderLink": order_id})
        
        if not order:
            order = orders_collection.find_one({"_id": order_id})
            
        if not order:
            print(f"Error: Order with ID {order_id} not found")
            return "Payment link unavailable"
        
        line_items = []
        
        for product in order["products"]:
            product_name = product["name"]
            quantity = product["quantity"]
            
            price = product.get("price", 0)
            if not price:
                inventory_collection = db["inventory"]
                product_info = inventory_collection.find_one({"name": product_name})
                if product_info:
                    price = product_info.get("price", 0)
            
            if price <= 0:
                print(f"Error: Product {product_name} has no price")
                return "Payment link unavailable"
                
            price_in_cents = int(price * 100)
            
            price = stripe.Price.create(
                unit_amount=price_in_cents,
                currency="usd",
                product_data={"name": product_name}
            )
            
            line_items.append({
                "price": price.id,
                "quantity": quantity
            })
        
        if not line_items:
            print("Error: No products with valid prices found")
            return "Payment link unavailable"
        
        payment_link = stripe.PaymentLink.create(
            line_items=line_items,
            metadata={"order_id": str(order_id)}
        )
        
        return payment_link.url
        
    except Exception as e:
        print(f"Error creating payment link: {e}")
        return "Payment link unavailable"

import stripe
import os
from flask import Flask, jsonify, request
from dotenv import load_dotenv
from config.dbConfig2 import connect_db

# Load environment variables
load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

app = Flask(__name__)

# Connect to MongoDB
db = connect_db()
inventory_collection = db["inventory"]
orders_collection = db["orders"]


@app.route("/create-payment-session/<order_id>", methods=["GET"])
def create_payment_session(order_id):
    """Find the order, get product prices from inventory, and generate a Stripe Checkout Session."""
    order = orders_collection.find_one({"orderLink": order_id})

    if not order:
        return jsonify({"error": "Order not found"}), 404

    line_items = []

    for product in order["products"]:
        product_name = product["name"]
        quantity = product["quantity"]

        # Fetch product details from inventory database
        product_info = inventory_collection.find_one({"name": product_name})

        if not product_info:
            return jsonify({"error": f"Product {product_name} not found in inventory"}), 400

        # Use price from inventory (Stripe requires amount in cents)
        price_in_cents = int(product_info["price"] * 100)

        line_items.append({
            "price_data": {  # ✅ Using dynamic price_data inside `checkout.Session.create`
                "currency": "usd",
                "product_data": {
                    "name": product_name,
                },
                "unit_amount": price_in_cents,
            },
            "quantity": quantity,
        })

    try:
        # Create Stripe Checkout Session (instead of Payment Link)
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url="https://yourwebsite.com/success",
            cancel_url="https://yourwebsite.com/cancel",
        )

        return jsonify({"checkout_url": session.url})

    except stripe.error.StripeError as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)

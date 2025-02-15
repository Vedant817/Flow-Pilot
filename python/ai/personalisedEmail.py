import os
import pymongo
import google.generativeai as genai
from flask import Flask, jsonify
from datetime import datetime, timedelta
import json

# ✅ Initialize Flask App
app = Flask(__name__)

# ✅ Secure API Keys & Credentials using Environment Variables
MONGO_URI = os.getenv("MONGO_URI")
GEMINI_API_KEY = os.getenv("GENAI_API_KEY", "your_gemini_api_key")

# ✅ Connect to MongoDB
client = pymongo.MongoClient(MONGO_URI)
db = client["test_store_db"]
customer_collection = db["customers"]
order_collection = db["orders"]

# ✅ Configure Gemini AI
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# ✅ AI Agent: Generate Personalized Offers
def generate_personalized_offers():
    try:
        # ✅ Fetch customers with valid emails
        customers = list(customer_collection.find(
            {"Email": {"$exists": True}}, {"_id": 0, "Email": 1, "Name": 1}))
        if not customers:
            return {"error": "No customers found with valid emails."}

        # ✅ Extract customer emails
        customer_emails = [c["Email"] for c in customers]

        # ✅ Fetch orders related to these customers
        orders = list(order_collection.find({"customerEmail": {"$in": customer_emails}}, {
                      "_id": 0, "customerEmail": 1, "products": 1, "date": 1}))

        # ✅ Initialize purchase tracking
        customer_purchases = {email: [] for email in customer_emails}
        customer_last_purchase = {email: None for email in customer_emails}

        # ✅ Process orders correctly
        for order in orders:
            email = order.get("customerEmail")  # Corrected field name
            products = order.get("products", [])
            date_str = order.get("date")

            if email and products:
                customer_purchases[email].extend(products)

                try:
                    order_date = datetime.strptime(
                        date_str, "%Y-%m-%d") if date_str else None
                except ValueError:
                    order_date = None  # Handle invalid date formats

                if order_date and (not customer_last_purchase[email] or order_date > customer_last_purchase[email]):
                    customer_last_purchase[email] = order_date

        # ✅ Separate Active & Inactive Customers
        last_3_months = datetime.now() - timedelta(days=90)
        active_customers, inactive_customers, new_customers = [], [], []

        for customer in customers:
            email = customer["Email"]
            last_purchase = customer_last_purchase[email]

            if not customer_purchases[email]:  # No purchases → New customer
                new_customers.append(customer)
            elif last_purchase and last_purchase >= last_3_months:
                active_customers.append(customer)
            else:
                inactive_customers.append(customer)

        # ✅ Prepare AI prompt with verified order data
        active_emails = [
            {"Email": c["Email"], "purchases": customer_purchases[c["Email"]]} for c in active_customers]
        inactive_emails = [
            {"Email": c["Email"], "purchases": customer_purchases[c["Email"]]} for c in inactive_customers]
        new_emails = [c["Email"] for c in new_customers]

        prompt = f"""
        You are an AI assistant. **Return ONLY valid JSON output** (without extra text) following this format:

        ```json
        {{
            "offers": [
                {{
                    "customer_email": "exact_email_from_database",
                    "offer_message": "Your personalized discount message",
                    "discount_code": "UNIQUECODE"
                }}
            ]
        }}
        ```

        **Customers Data (Orders Verified):**
        - **Active Customers (Recent Orders)**: {json.dumps(active_emails, indent=2)}
        - **Inactive Customers (Old Orders)**: {json.dumps(inactive_emails, indent=2)}
        - **New Customers (No Purchases Yet)**: {json.dumps(new_emails, indent=2)}

        **Offer Strategy:**
        - **Inactive Customers** → Discount on past purchases.
        - **Active Customers** → Loyalty rewards.
        - **New Customers** → Welcome offer.

        **Return JSON only! No explanations or extra text.**
        """

        # ✅ Generate Offers via Gemini AI
        response = gemini_model.generate_content(prompt)
        print(response.text)  # Debugging

        # ✅ Ensure AI response is valid JSON
        if response and response.text:
            try:
                # ✅ Ensure we extract only the valid JSON part
                json_text = response.text.strip()
                json_start = json_text.find("{")
                json_end = json_text.rfind("}") + 1
                # Extract valid JSON only
                json_cleaned = json_text[json_start:json_end]

                ai_response = json.loads(json_cleaned)
                return ai_response
            except json.JSONDecodeError as e:
                return {"error": f"AI response format is invalid. Details: {str(e)}"}

    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}


# ✅ API Route
@app.route('/personalized-offers', methods=['GET'])
def personalized_offers():
    offers = generate_personalized_offers()
    return jsonify({"personalized_offers": offers})


# ✅ Run Flask Server
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)  # ✅ Fixed Flask execution

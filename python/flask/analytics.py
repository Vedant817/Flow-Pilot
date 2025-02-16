import os
import sys
import pymongo
import google.generativeai as genai
import json
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
import re
from flask import Flask, jsonify
from flask_cors import CORS
from python.ai.deadstock import identify_deadstocks
from python.ai.dynamicPricing import generate_pricing_suggestions
from python.ai.freeProduct import assign_free_products
from python.ai.genReport import generate_business_summary
from python.ai.invFor import generate_inventory_report
from python.ai.limitedTime import generate_limited_time_deals
from python.ai.loyaltyRewards import assign_loyalty_rewards
from python.ai.personalisedEmail import generate_personalized_offers
from python.ai.priorOrder import prioritize_orders
from python.ai.sentimentAnalysis import generate_feedback_report
from python.ai.partners import recommend_partner_products

# ✅ Initialize Flask App
app = Flask(__name__)
CORS(app)

# ✅ Connect to MongoDB
MONGO_URI = os.getenv("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["test_store_db"]
customer_collection = db["customers"]
order_collection = db["orders"]
inventory_collection = db["inventory"]
feedback_collection = db["feedback"]

# ✅ Configure Gemini AI Key
API_KEY = os.getenv("GENAI_API_KEY")
genai.configure(api_key=API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

@app.route('/deadstocks', methods=['GET'])
def get_deadstocks():
    deadstock_list = identify_deadstocks()
    return jsonify(deadstock_list)

@app.route('/dynamic_pricing', methods=['GET'])
def price_summary():
    summary = generate_pricing_suggestions()
    return jsonify({"Pricing Suggestions": summary})

@app.route('/free-product-assignments', methods=['GET'])
def get_free_product_assignments():
    free_products_list = assign_free_products()
    return jsonify(free_products_list)

@app.route('/summary-report', methods=['GET'])
def summary_report():
    summary = generate_business_summary()
    return jsonify({"business_summary": summary})

@app.route('/inventory-report', methods=['GET'])
def inventory_report():
    report = generate_inventory_report()
    return jsonify({"inventory_report": report})


@app.route('/limited-time-deals', methods=['GET'])
def get_limited_time_deals():
    deals_list = generate_limited_time_deals()
    return jsonify(deals_list)

@app.route('/loyalty-rewards', methods=['GET'])
def get_loyalty_rewards():
    reward_list = assign_loyalty_rewards()
    return jsonify(reward_list)


@app.route('/personalized-offers', methods=['GET'])
def personalized_offers():
    offers = generate_personalized_offers()
    return jsonify({"personalized_offers": offers})

@app.route('/prioritized-orders', methods=['GET'])
def get_prioritized_orders():
    prioritized_list = prioritize_orders()
    return jsonify(prioritized_list)


@app.route('/feedback-report', methods=['GET'])
def feedback_report():
    report = generate_feedback_report()
    return jsonify({"feedback_report": report})

# @app.route('/partner-product-recommendations', methods=['GET'])
# def get_partner_product_recommendations():
#     recommendations_list = recommend_partner_products()
#     return jsonify(recommendations_list)

# ✅ Run Flask Server
if __name__ == '__main__':
    app.run(debug=True)

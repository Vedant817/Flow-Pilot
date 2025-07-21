from flask import Flask, jsonify, request, session
import threading
import uuid
import os
from file_monitor import start_monitoring
from config.dbConfig import db
from feedback.feedback_handle import fetch_feedback, store_feedback
from chatbot import ask_bot, refresh_data_and_update_vector_store, store_chat_history, get_chat_history
from flask_cors import CORS
from bson import ObjectId
from analytics.deadstock import identify_deadstocks
from analytics.dynamicPricing import generate_pricing_suggestions
from werkzeug.exceptions import HTTPException
import json
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'
RANGE_NAME = 'Sheet1!A1:Z'

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return json.JSONEncoder.default(self, obj)

load_dotenv()
load_dotenv()
app = Flask(__name__)
app.json_encoder = JSONEncoder
app.secret_key = os.getenv("FLASK_SECRET_KEY")

error_collection = db["errors"]

app.secret_key = os.getenv("FLASK_SECRET_KEY")

error_collection = db["errors"]

CORS(app, resources={
    r"/*": {
        "origins": "*"
    }
})

def start_monitoring_thread():
    if not any(thread.name == "FileMonitorThread" for thread in threading.enumerate()):
        thread = threading.Thread(target=start_monitoring, daemon=True, name="FileMonitorThread")
        thread.start()

start_monitoring_thread()

@app.before_request
def before_request():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())

@app.before_request
def before_request():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())

@app.route('/')
def index():
    return 'File Monitoring is Already Running!', 200

@app.route('/get-feedback')
def get_feedback():
    try:
        feedback_data = fetch_feedback()
        response = store_feedback(feedback_data)
        return jsonify(response), 200
    except Exception as e:
        handle_exception(e)
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

#? Chatbot Endpoints
@app.route('/chatbot', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({"error": "Query parameter is required"}), 400

        query = data['query']
        
        session_id = session.get('session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
            session['session_id'] = session_id
        print('Query:', query)
        print('Session ID:', session_id)
        response_data = ask_bot(query, session_id)
        response_text = response_data.get('response', '')
        
        if response_text:
            store_chat_history(session_id, query, response_text)
        print('Response:', response_text)
        return jsonify({"response": response_text, "session_id": session_id})
    except Exception as e:
        app.logger.error(f"Error in chatbot endpoint: {str(e)}")
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

@app.route('/chat-history', methods=['GET'])
def get_session_chat_history():
    try:
        session_id = session.get('session_id')
        if not session_id:
            return jsonify({"error": "No active session"}), 400
            
        limit = int(request.args.get("limit", 10))
        
        history = get_chat_history(session_id, limit)
        
        return jsonify({"history": history, "session_id": session_id})
    except Exception as e:
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

@app.route('/end-session', methods=['POST'])
def end_session():
    try:
        session_id = session.get('session_id')
        if not session_id:
            return jsonify({"error": "No active session"}), 400
        
        session.pop('session_id', None)
        
        return jsonify({"message": "Session ended"})
    except Exception as e:
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

@app.route('/refresh-data', methods=['POST'])
def refresh_data():
    try:
        refresh_data_and_update_vector_store()
        return jsonify({"message": "Data refreshed and vector store updated."})
    except Exception as e:
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

#? Analytics Endpoints
@app.route('/analytics/deadstocks', methods=['GET'])
def get_deadstocks():
    try:
        deadstock_list = identify_deadstocks()
        return jsonify(deadstock_list)
    except Exception as e:
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

@app.route('/analytics/dynamic_pricing', methods=['GET'])
def price_summary():
    try:
        summary = generate_pricing_suggestions()
        return jsonify({"Pricing Suggestions": summary})
    except Exception as e:
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        error_data = {
            "errorMessage": e.description,
            "type": "Customer",
            "severity": "Low" if e.code == 400 else "Medium",
            "timestamp": datetime.utcnow()
        }
        error_collection.insert_one(error_data)
        return jsonify({"error": e.description}), e.code

    error_data = {
        "errorMessage": str(e),
        "type": "System",
        "severity": "Critical",
        "timestamp": datetime.utcnow()
    }

    error_collection.insert_one(error_data)
    return jsonify({"error": "Internal Server Error", "message": str(e)}), 500

@app.route('/product-analytics', methods=['GET'])
def get_product_analytics():
    try:
        thirty_days_ago = datetime.now() - timedelta(days=30)
        
        orders_collection = db['orders']
        feedback_collection = db['feedback']
        
        pipeline_best = [
            {"$match": {"date": {"$gte": thirty_days_ago.strftime('%Y-%m-%d')}}},
            {"$unwind": "$products"},
            {"$group": {"_id": "$products.name", "quantity": {"$sum": "$products.quantity"}}},
            {"$sort": {"quantity": -1}},
            {"$limit": 5}
        ]
        best_selling = list(orders_collection.aggregate(pipeline_best))
        
        pipeline_worst = [
            {"$match": {"date": {"$gte": thirty_days_ago.strftime('%Y-%m-%d')}}},
            {"$unwind": "$products"},
            {"$group": {"_id": "$products.name", "quantity": {"$sum": "$products.quantity"}}},
            {"$sort": {"quantity": 1}},
            {"$limit": 5}
        ]
        worst_selling = list(orders_collection.aggregate(pipeline_worst))
        
        pipeline_revenue = [
            {"$match": {"date": {"$gte": thirty_days_ago.strftime('%Y-%m-%d')}}},
            {"$addFields": {
                "total_amount": {"$sum": {"$map": {
                    "input": "$products",
                    "as": "product",
                    "in": {"$multiply": ["$$product.price", "$$product.quantity"]}
                }}}
            }},
            {"$group": {"_id": "$date", "revenue": {"$sum": "$total_amount"}}},
            {"$sort": {"_id": 1}}
        ]
        revenue_per_day = list(orders_collection.aggregate(pipeline_revenue))
        
        recent_feedback = list(feedback_collection.find().sort("timestamp", -1).limit(5))
        
        response_data = {
            'productSales': {
                'bestSelling': [{'name': item['_id'], 'quantity': item['quantity']} for item in best_selling],
                'worstSelling': [{'name': item['_id'], 'quantity': item['quantity']} for item in worst_selling]
            },
            'revenuePerDay': [{'date': item['_id'], 'revenue': item['revenue']} for item in revenue_per_day],
            'customerFeedback': [
                {
                    'name': item.get('customer_name', 'Anonymous'),
                    'feedback': item.get('text', ''),
                    'sentiment': item.get('sentiment', 'neutral')
                } for item in recent_feedback
            ]
        }
        
        return jsonify(response_data)
    except Exception as e:
        print(f"Error in product analytics: {str(e)}")
        handle_exception(e)
        handle_exception(e)
        return jsonify({'error': str(e)}), 500

@app.route('/customer-analytics', methods=['GET'])
def get_customer_analytics():
    try:
        thirty_days_ago = datetime.now() - timedelta(days=30)
        
        orders_collection = db['orders']
        
        pipeline_trends = [
            {"$match": {"date": {"$gte": thirty_days_ago.strftime('%Y-%m-%d')}}},
            {"$group": {"_id": "$date", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        order_trends = list(orders_collection.aggregate(pipeline_trends))
        
        pipeline_frequent = [
            {"$match": {"date": {"$gte": thirty_days_ago.strftime('%Y-%m-%d')}}},
            {"$group": {"_id": "$name", "order_count": {"$sum": 1}}},
            {"$sort": {"order_count": -1}},
            {"$limit": 10}
        ]
        frequent_customers = list(orders_collection.aggregate(pipeline_frequent))
        
        pipeline_spenders = [
            {"$match": {"date": {"$gte": thirty_days_ago.strftime('%Y-%m-%d')}}},
            {"$unwind": "$products"},
            {"$addFields": {
                "item_total": {"$multiply": ["$products.price", "$products.quantity"]}
            }},
            {"$group": {
                "_id": "$name", 
                "total_spent": {"$sum": "$item_total"}
            }},
            {"$sort": {"total_spent": -1}},
            {"$limit": 10}
        ]

        top_spenders = list(orders_collection.aggregate(pipeline_spenders))
        
        response_data = {
            'orderTrends': {
                'dates': [item['_id'] for item in order_trends],
                'counts': [item['count'] for item in order_trends]
            },
            'frequentCustomers': {
                'names': [item['_id'] for item in frequent_customers],
                'counts': [item['order_count'] for item in frequent_customers]
            },
            'topSpenders': {
                'names': [item['_id'] for item in top_spenders],
                'amounts': [item['total_spent'] for item in top_spenders]
            }
        }
        
        return jsonify(response_data)
    except Exception as e:
        print(f"Error in customer analytics: {str(e)}")
        handle_exception(e)
        handle_exception(e)
        return jsonify({'error': str(e)}), 500


@app.route("/create-payment-link/<order_id>", methods=["GET"])
def create_payment_link(order_id):
    try:
        payment_link = create_payment_link(order_id)
        return jsonify({"payment_link": payment_link})
    except Exception as e:
        print(f"Error creating payment link: {str(e)}")
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

@app.route('/errors', methods=['GET'])
def get_errors():
    try:
        errors = list(error_collection.find({}, {'_id': 0}))
        return {"errors": errors}
    except Exception as e:
        return handle_exception(e)

def scheduled_refresh():
    scheduler = BackgroundScheduler()
    scheduler.add_job(refresh_data_and_update_vector_store, 'interval', hours=1)
    scheduler.start()
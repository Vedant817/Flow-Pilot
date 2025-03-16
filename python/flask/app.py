from flask import Flask, jsonify, request # type: ignore
import threading
from file_monitor import start_monitoring
from config.dbConfig import db
from feedback_handle import fetch_feedback, store_feedback
from chatbot import ask_bot, refresh_data_and_update_vector_store
from flask_cors import CORS
from bson.objectid import ObjectId
from analytics.deadstock import identify_deadstocks
from analytics.dynamicPricing import generate_pricing_suggestions
from analytics.urgentRestock import get_urgent_restocking
from werkzeug.exceptions import HTTPException
from flask_apscheduler import APScheduler

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*"
    }
})

scheduler = APScheduler()
scheduler.init_app(app)
scheduler.start()

def start_monitoring_thread():
    if not any(thread.name == "FileMonitorThread" for thread in threading.enumerate()):
        thread = threading.Thread(target=start_monitoring, daemon=True, name="FileMonitorThread")
        thread.start()

start_monitoring_thread()

@scheduler.task('interval', id='refresh_data', hours=1)
def scheduled_refresh():
    try:
        print("Performing scheduled refresh of data...")
        print("Scheduled refresh completed")
    except Exception as e:
        print(f"Error in scheduled refresh: {e}")

start_monitoring_thread()

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
        return jsonify({"error": str(e)}), 500

@app.route('/chatbot', methods=['POST'])
def chat():
    query = request.args.get('query')
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400
    
    response = ask_bot(query)
    return jsonify({"response": response})

@app.route('/get-inventory')
def get_inventory():
    try:
        inventory_collection = db['inventory']
        inventory_items = list(inventory_collection.find({}, {'_id': 0}))
        print(inventory_items)
        return jsonify(inventory_items), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/orders/<order_id>', methods=['GET'])
def get_order_info(order_id):
    try:
        order_collection = db['orders']
        order = order_collection.find_one({"_id": ObjectId(order_id)})
        
        if not order:
            return jsonify({"error": "Order not found"}), 404
        
        order_data = {
            "id": str(order["_id"]),
            "name": order["name"],
            "phone": order["phone"],
            "email": order["email"],
            "date": order["date"],
            "time": order["time"],
            "products": order["products"],
            "status": order["status"],
            "orderLink": order["orderLink"]
        }
        
        return jsonify(order_data), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#! Analytics Endpoints
@app.route('/analytics/deadstocks', methods=['GET'])
def get_deadstocks():
    deadstock_list = identify_deadstocks()
    return jsonify(deadstock_list)

@app.route('/analytics/dynamic_pricing', methods=['GET'])
def price_summary():
    summary = generate_pricing_suggestions()
    return jsonify({"Pricing Suggestions": summary})

@app.route('/analytics/urgent-restocking', methods=['GET'])
def urgent_restocking():
    restocking_data = get_urgent_restocking()
    return jsonify(restocking_data)

@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    return jsonify({"error": "Internal Server Error", "message": str(e)}), 500

if __name__ == '__main__':
    vector_store = refresh_data_and_update_vector_store()
    
    if not app.debug:
        refresh_thread = threading.Thread(target=scheduled_refresh, daemon=True)
        refresh_thread.start()
    else:
        scheduler = APScheduler()
        scheduler.init_app(app)
        scheduler.add_job(id='refresh_job', func=refresh_data_and_update_vector_store, 
                            trigger='interval', hours=1)
        scheduler.start()
    
    app.run(host='0.0.0.0', debug=True)

from flask import Flask, jsonify, request  # type: ignore
import threading
from file_monitor import start_monitoring
from config.dbConfig2 import connect_db
from feedback_handle import fetch_feedback, store_feedback
from chatbot import ask_bot
from flask_cors import CORS
from bson.objectid import ObjectId
from analytics.deadstock import identify_deadstocks
from analytics.dynamicPricing import generate_pricing_suggestions
from analytics.urgentRestock import get_urgent_restocking
from werkzeug.exceptions import HTTPException
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
db = connect_db()

# MongoDB collections
inventory_collection = db["inventory"]
feedback_collection = db["feedback"]
orders_collection = db["orders"]
customers_collection = db["customers"]
error_collection = db["errors"]

# JSON Encoder to handle ObjectId
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return json.JSONEncoder.default(self, obj)

app = Flask(__name__)
app.json_encoder = JSONEncoder
CORS(app, resources={r"/*": {"origins": "*"}})

# Start File Monitoring Thread
def start_monitoring_thread():
    if not any(thread.name == "FileMonitorThread" for thread in threading.enumerate()):
        thread = threading.Thread(target=start_monitoring, daemon=True, name="FileMonitorThread")
        thread.start()

start_monitoring_thread()

@app.route('/')
def index():
    return 'File Monitoring is Already Running!', 200

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

    # General system errors
    error_data = {
        "errorMessage": str(e),
        "type": "System",
        "severity": "Critical",  # Assume critical severity for unhandled system errors
        "timestamp": datetime.utcnow()
    }

    error_collection.insert_one(error_data)
    return jsonify({"error": "Internal Server Error", "message": str(e)}), 500


# Fetch Feedback
@app.route('/get-feedback', methods=['GET'])
def get_feedback():
    try:
        feedback_data = fetch_feedback()
        response = store_feedback(feedback_data)
        return jsonify(response), 200
    except Exception as e:
        return handle_exception(e)


# Chatbot API
@app.route('/chatbot', methods=['POST'])
def chat():
    try:
        query = request.args.get('query')
        if not query:
            return jsonify({"error": "Query parameter is required"}), 400

        response = ask_bot(query)
        return jsonify({"response": response}), 200
    except Exception as e:
        return handle_exception(e)


# Get Order by ID
@app.route('/orders/<order_id>', methods=['GET'])
def get_order_info(order_id):
    try:
        if not ObjectId.is_valid(order_id):
            return jsonify({"error": "Invalid order ID"}), 400

        order = orders_collection.find_one({"_id": ObjectId(order_id)})
        if not order:
            return jsonify({"error": "Order not found"}), 404

        order["_id"] = str(order["_id"])
        return jsonify(order), 200
    except Exception as e:
        return handle_exception(e)


# Analytics Routes
@app.route('/analytics/deadstocks', methods=['GET'])
def get_deadstocks():
    try:
        return jsonify(identify_deadstocks()), 200
    except Exception as e:
        return handle_exception(e)


@app.route('/analytics/dynamic_pricing', methods=['GET'])
def price_summary():
    try:
        return jsonify({"Pricing Suggestions": generate_pricing_suggestions()}), 200
    except Exception as e:
        return handle_exception(e)


@app.route('/analytics/urgent-restocking', methods=['GET'])
def urgent_restocking():
    try:
        return jsonify(get_urgent_restocking()), 200
    except Exception as e:
        return handle_exception(e)


# Get Orders
@app.route('/get-orders', methods=['GET'])
def get_orders():
    try:
        orders = list(orders_collection.find({}, {'_id': 0}))
        return jsonify(orders), 200
    except Exception as e:
        return handle_exception(e)


# Update Order Status
@app.route('/update-status', methods=['PUT', 'OPTIONS'])
def handle_status_update():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json()
        order_id = data.get('orderId')
        new_status = data.get('status')

        if not order_id or not new_status:
            return jsonify({"error": "Order ID and status are required"}), 400

        result = orders_collection.update_one(
            {"orderLink": order_id},
            {"$set": {"status": new_status}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Order not found or status not changed"}), 404

        return jsonify({"success": True, "message": "Order status updated successfully"}), 200
    except Exception as e:
        return handle_exception(e)


# Inventory Management
@app.route('/get-inventory', methods=['GET'])
def get_inventory():
    try:
        inventory_items = list(inventory_collection.find({}, {}))
        for item in inventory_items:
            item['_id'] = str(item['_id'])
        return jsonify(inventory_items), 200
    except Exception as e:
        return handle_exception(e)


@app.route('/get-inventory/<item_id>', methods=['GET'])
def get_inventory_item(item_id):
    try:
        if not ObjectId.is_valid(item_id):
            return jsonify({"error": "Invalid inventory item ID"}), 400

        item = inventory_collection.find_one({"_id": ObjectId(item_id)})
        if not item:
            return jsonify({"error": "Item not found"}), 404

        item['_id'] = str(item['_id'])
        return jsonify(item), 200
    except Exception as e:
        return handle_exception(e)


@app.route('/add-inventory', methods=['POST'])
def add_inventory():
    try:
        data = request.json
        required_fields = ['name', 'category', 'price', 'quantity', 'warehouse_location', 'stock_alert_level']

        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        result = inventory_collection.insert_one(data)
        data['_id'] = str(result.inserted_id)

        return jsonify(data), 201
    except Exception as e:
        return handle_exception(e)


@app.route('/update-inventory/<item_id>', methods=['PUT'])
def update_inventory(item_id):
    try:
        if not ObjectId.is_valid(item_id):
            return jsonify({"error": "Invalid inventory item ID"}), 400

        data = request.json
        if '_id' in data:
            del data['_id']

        result = inventory_collection.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": data}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Item not found"}), 404

        updated_item = inventory_collection.find_one({"_id": ObjectId(item_id)})
        updated_item['_id'] = str(updated_item['_id'])

        return jsonify(updated_item), 200
    except Exception as e:
        return handle_exception(e)


@app.route('/delete-inventory/<item_id>', methods=['DELETE'])
def delete_inventory(item_id):
    try:
        if not ObjectId.is_valid(item_id):
            return jsonify({"error": "Invalid inventory item ID"}), 400

        result = inventory_collection.delete_one({"_id": ObjectId(item_id)})
        if result.deleted_count == 0:
            return jsonify({"error": "Item not found"}), 404

        return jsonify({"success": True, "message": "Item deleted successfully"}), 200
    except Exception as e:
        return handle_exception(e)
    
@app.route('/api/errors', methods=['GET'])
def get_errors():
    try:
        errors = list(error_collection.find({}, {'_id': 0}))
        return {"errors": errors}
    except Exception as e:
        return handle_exception(e)


if __name__ == '__main__':
    app.run(debug=True)

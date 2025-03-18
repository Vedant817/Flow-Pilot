from flask import Flask, jsonify, request # type: ignore
import threading
from file_monitor import start_monitoring
from config.dbConfig import db
from feedback_handle import fetch_feedback, store_feedback
from chatbot import ask_bot
from flask_cors import CORS
from bson.objectid import ObjectId
from analytics.deadstock import identify_deadstocks
from analytics.dynamicPricing import generate_pricing_suggestions
from analytics.urgentRestock import get_urgent_restocking
from werkzeug.exceptions import HTTPException
from send_email import send_invoice
import json
from datetime import datetime, timedelta
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return json.JSONEncoder.default(self, obj)

app = Flask(__name__)
app.json_encoder = JSONEncoder
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

@app.route('/orders/<order_id>', methods=['GET'])
def get_order_info(order_id):
    try:
        if not ObjectId.is_valid(order_id):
            return jsonify({"error": "Invalid order ID"}), 400

        order_collection = db['orders']
        order = order_collection.find_one({"_id": ObjectId(order_id)})

        if not order:
            return jsonify({"error": "Order not found"}), 404

        order_data = {
            "id": str(order["_id"]),
            "name": order.get("name", ""),
            "phone": order.get("phone", ""),
            "email": order.get("email", ""),
            "date": order.get("date", ""),
            "time": order.get("time", ""),
            "products": order.get("products", []),
            "status": order.get("status", ""),
            "orderLink": order.get("orderLink", "")
        }

        return jsonify(order_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

#? Analytics Endpoints
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
        return jsonify({'error': str(e)}), 500

#? CRUD Endpoints
@app.route('/get-orders', methods=['GET'])
def get_orders():
    orders_collection = db['orders']
    orders = list(orders_collection.find({}, {'_id': 0}))
    return jsonify(orders), 200

@app.route('/update-status', methods=['PUT', 'OPTIONS'])
def handle_status_update():
    if request.method == 'OPTIONS':
        return '', 200
        
    data = request.get_json()
    order_id = data.get('orderId')
    new_status = data.get('status')
    
    if not order_id or not new_status:
        return jsonify({"error": "Order ID and status are required"}), 400
        
    orders_collection = db['orders']
    result = orders_collection.update_one(
        {"orderLink": order_id},
        {"$set": {"status": new_status}}
    )
    
    if result.modified_count == 0:
        return jsonify({"error": "Order not found or status not changed"}), 404
    
    if new_status == "fulfilled":
        send_invoice(order_id)
        
    return jsonify({"success": True, "message": "Order status updated successfully"}), 200

@app.route('/get-inventory')
def get_inventory():
    try:
        inventory_collection = db['inventory']
        inventory_items = list(inventory_collection.find({}, {}))
        
        for item in inventory_items:
            item['_id'] = str(item['_id'])
        
        return jsonify(inventory_items), 200
    except Exception as e:
        print(f"Error retrieving inventory: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-inventory/<item_id>', methods=['GET'])
def get_inventory_item(item_id):
    try:
        inventory_collection = db['inventory']
        item = inventory_collection.find_one({"_id": ObjectId(item_id)})
        if not item:
            return jsonify({"error": "Item not found"}), 404
            
        item['_id'] = str(item['_id'])
        return jsonify(item), 200
    except Exception as e:
        print(f"Error retrieving item: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/add-inventory', methods=['POST'])
def add_inventory():
    try:
        inventory_collection = db['inventory']
        data = request.json
        
        required_fields = ['name', 'category', 'price', 'quantity', 'warehouse_location', 'stock_alert_level']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        result = inventory_collection.insert_one(data)
        
        new_item = data
        new_item['_id'] = str(result.inserted_id)
        
        return jsonify(new_item), 201
    except Exception as e:
        print(f"Error adding inventory item: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/update-inventory/<item_id>', methods=['PUT'])
def update_inventory(item_id):
    try:
        inventory_collection = db['inventory']
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
        print(f"Error updating inventory item: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/delete-inventory/<item_id>', methods=['DELETE'])
def delete_inventory(item_id):
    try:
        inventory_collection = db['inventory']
        result = inventory_collection.delete_one({"_id": ObjectId(item_id)})
        
        if result.deleted_count == 0:
            return jsonify({"error": "Item not found"}), 404
        
        return jsonify({"message": "Item deleted successfully"}), 200
    except Exception as e:
        print(f"Error deleting inventory item: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/create-payment-link/<order_id>", methods=["GET"])
def create_payment_link(order_id):
    payment_link = create_payment_link(order_id)
    return jsonify({"payment_link": payment_link})

if __name__ == '__main__':
    app.run(host = '0.0.0.0', debug=True)
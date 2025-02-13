import uuid
import sys, os
import json  # ✅ Import json for debugging
from flask import Flask, request, jsonify
import pymongo
from bson import ObjectId  # ✅ Import ObjectId from bson

# Add the project directory to sys.path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

# Import collections from your database configuration
from python.db.configdb import inventory_collection, order_collection

app = Flask(__name__)

# Debugging: Retrieve an order by its ObjectId
order_id = "67ac828dc423b5a0e7d4bda7"
try:
    # Convert string to ObjectId and query the database
    order = order_collection.find_one({"_id": ObjectId(order_id)})
    print("Using ObjectId:", order)
except Exception as e:
    print(f"Error retrieving order: {e}")

# Route to track an order by its ObjectId
@app.route('/track-order/<order_id>', methods=['GET'])
def track_order(order_id):
    try:
        # Convert string to ObjectId and query the database
        order = order_collection.find_one({"_id": ObjectId(order_id)})
        
        if order:
            # Convert ObjectId to string for JSON serialization
            order["_id"] = str(order["_id"])
            return jsonify(order)  # ✅ Return the serialized order object
        else:
            return jsonify({"error": "Order not found"}), 404  # ✅ Handle missing orders gracefully
    except Exception as e:
        return jsonify({"error": f"Invalid request: {e}"}), 400  # ✅ Handle invalid ObjectId or other errors

if __name__ == '__main__':
    app.run(debug=True)

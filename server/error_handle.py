from flask import jsonify
from datetime import datetime
from werkzeug.exceptions import HTTPException
from config.dbConfig import db

error_collection = db["errors"]

def handle_exception(e, source="system"):
    if isinstance(e, HTTPException):
        error_data = {
            "errorMessage": e.description,
            "type": "System" if source == "system" else "Customer",
            "severity": "Low" if e.code == 400 else "Medium",
            "timestamp": datetime.now(datetime.timezone.utc)
        }
        error_collection.insert_one(error_data)
        return jsonify({"error": e.description}), e.code

    error_data = {
        "errorMessage": str(e),
        "type": "System" if source == "system" else "Customer", 
        "severity": "Critical",
        "timestamp": datetime.utcnow()
    }

    error_collection.insert_one(error_data)
    return jsonify({"error": "Internal Server Error", "message": str(e)}), 500

def handle_order_error(email, error_msg, order_id=None, error_type="Customer", transaction_id=None):
    print(f"Handling Order Error: {error_msg}")

    severity = "Low"
    if "duplicate" in error_msg.lower():
        severity = "Medium"
    elif "transaction id missing" in error_msg.lower() or "payment" in error_msg.lower():
        severity = "High"
    else:
        severity = "Critical"

    error_data = {
        "email": email,
        "errorMessage": error_msg,
        "order_id": order_id,
        "transaction_id": transaction_id,
        "type": error_type,
        "severity": severity,
        "timestamp": datetime.utcnow()
    }
    
    try:
        result = error_collection.insert_one(error_data)
        if result.inserted_id:
            print("Error logged successfully:", result.inserted_id)
            return "Customer Error added"
        else:
            print("Error logging failed!")
    except Exception as e:
        print("Database insertion error:", e)
        # Log this exception to prevent losing error information
        fallback_error = {
            "errorMessage": f"Failed to log original error: {str(e)}",
            "type": "System",
            "severity": "Critical",
            "timestamp": datetime.utcnow()
        }
        try:
            error_collection.insert_one(fallback_error)
        except:
            pass
    
    return "Failed to log error"


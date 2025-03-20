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
            "timestamp": datetime.utcnow()
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
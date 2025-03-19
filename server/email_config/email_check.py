from zerobouncesdk import ZeroBounce, ZBException
import os
from config.dbConfig import connect_db
from datetime import datetime
from flask import jsonify
from werkzeug.exceptions import HTTPException


API_KEY = os.getenv("ZERO_BOUNCE_KEY")
zero_bounce = ZeroBounce(API_KEY)

from dotenv import load_dotenv

load_dotenv()
db = connect_db()
error_collection = db["errors"]



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
        "type": "Customer",
        "severity": "Critical",  # Assume critical severity for unhandled system errors
        "timestamp": datetime.utcnow()
    }

    error_collection.insert_one(error_data)
    return jsonify({"error": "Internal Server Error", "message": str(e)}), 500


def suspicious_email_check(email):
    try:
        response = zero_bounce.validate(email, '127.0.0.1')
        response = response.__dict__

        is_valid = str(response['status']).split(".")[-1].lower() == 'valid'

        suspicious_keywords = ["disposable", "role_based", "toxic", "spamtrap"]
        sub_status = str(response.get('sub_status', '')).split(".")[-1].lower()

        is_suspicious = any(keyword in sub_status for keyword in suspicious_keywords)

        return is_valid, "Suspicious" if is_suspicious else "Safe"

    except ZBException as e:
        print("ZeroBounce validate error: " + str(e))
        return handle_exception(e)
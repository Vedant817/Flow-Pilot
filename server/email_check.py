from zerobouncesdk import ZeroBounce, ZBException
from dotenv import load_dotenv
import os
import json
import re

load_dotenv()

API_KEY = os.getenv("ZERO_BOUNCE_KEY")
zero_bounce = ZeroBounce(API_KEY)

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
        return False, "Exception"

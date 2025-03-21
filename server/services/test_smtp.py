import smtplib
import os
from dotenv import load_dotenv
import ssl

load_dotenv()
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")


def test_smtp_connection():
    print("Testing SMTP connection...")
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context, timeout=10) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            print("SMTP_SSL connection successful!")
            return True
    except Exception as e:
        print(f"SMTP_SSL test failed: {e}")
        
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            print("SMTP+TLS connection successful!")
            return True
    except Exception as e:
        print(f"SMTP+TLS test failed: {e}")
        
    return False

# Run this before attempting to send emails
if not test_smtp_connection():
    print("Unable to establish SMTP connection. Please check your credentials and network.")

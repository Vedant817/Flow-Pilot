import smtplib
import base64
import json
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

EMAIL = 'kumarshresth2004@gmail.com'

# Load Google OAuth2 credentials
CLIENT_ID = "373768242257-jjaifs7slbeds8afr07f1q8pptm2bmva.apps.googleusercontent.com"
CLIENT_SECRET = "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"
REFRESH_TOKEN = "1//0gSvoU5RDLilECgYIARAAGBASNwF-L9Irj8prFnA0DFn3UHKGn_g2qw7sGPSUYxux0Ob9vQPQqFyqnvVnnQ-GpdTu6xHrpO2UnQk"
TOKEN_URL = "https://oauth2.googleapis.com/token"

def get_access_token():
    """Get a new access token using the refresh token."""
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type": "refresh_token",
    }
    response = requests.post(TOKEN_URL, data=data)
    response_data = response.json()
    print(response_data)
    return response_data.get("access_token")

def send_email():
    """Send an email using Gmail SMTP with OAuth2 authentication."""
    ACCESS_TOKEN = get_access_token()
    AUTH_STRING = f"user={EMAIL}\x01auth=Bearer {ACCESS_TOKEN}\x01\x01"
    AUTH_STRING_ENCODED = base64.b64encode(AUTH_STRING.encode()).decode()

    # Connect to Gmail's SMTP server
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    server = smtplib.SMTP(smtp_server, smtp_port)
    server.starttls()

    # Authenticate with OAuth2
    server.ehlo()
    server.docmd("AUTH", "XOAUTH2 " + AUTH_STRING_ENCODED)

    # Send email
    sender_email = "kumarshresth2004@gmail.com"
    receiver_email = "deepzgavali143@gmail.com"
    subject = "OAuth SMTP Test"
    body = "This email was sent using OAuth2 authentication!"

    email_message = f"Subject: {subject}\n\n{body}"
    server.sendmail(sender_email, receiver_email, email_message)
    server.quit()
    print("Email sent successfully!")

# send_email()
send_email()
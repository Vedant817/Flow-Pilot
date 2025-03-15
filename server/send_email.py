import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os
from dotenv import load_dotenv
import json
from generate_invoice import generate_invoice
import re

load_dotenv()
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

def send_email(subject, body, recipient_email,attachment_path=None):
    """
    Sends an email with an optional attachment.
    """
    msg = MIMEMultipart()
    msg["From"] = SENDER_EMAIL
    msg["To"] = recipient_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    if attachment_path:
        with open(attachment_path, "rb") as attachment:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment.read())
        
        encoders.encode_base64(part)
        part.add_header(
            "Content-Disposition",
            f"attachment; filename={attachment_path}",
        )
        msg.attach(part)

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, recipient_email, msg.as_string())
        server.quit()
        print("Email sent successfully!")
    except Exception as e:
        print(f"Error sending email: {e}")

def send_acknowledgment(order):
    order_email = order["email"]
    match = re.search(r'<([^<>]+)>', order_email)
    recipient_email = match.group(1) if match else order_email
    
    product_list = "\n".join([f"- {item['name']}: {item['quantity']} units" for item in order['products']])
    
    order_id = str(order["_id"])
    tracking_url = f"http://localhost:3000/track-order/{order_id}"
    
    subject = "Order Confirmation - Thank You!"
    
    body = f"""Dear {order['name']},

    Thank you for your order! We have received your request and it is currently pending fulfillment.
    
    Order Details:
    {product_list}
    
    Order Date: {order['date']} at {order['time']}
    
    You can track your order status at any time using this link:
    {tracking_url}
    
    We will process your order as soon as possible. If you have any questions or need to make changes, please reply to this email or contact our customer support.
    
    Thank you for shopping with us!
    
    Best regards,
    The Sales Team
    """
    
    send_email(subject=subject, body=body, recipient_email=recipient_email)
    print(f"Order acknowledgment sent to {recipient_email}")

def send_order_issue_email(email, errors):
    """
    Sends an email notifying the user that their order could not be processed due to errors.
    """
    
    error_message = "\n".join(errors)
    body = f"Dear Customer,\n\nWe could not process your order due to the following issues:\n\n{error_message}\n\nPlease review and resend your order.\n\nThank you."
    send_email(
        subject="Order Processing Issue",
        body=body,
        recipient_email=email
    )
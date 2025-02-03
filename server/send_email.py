import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os
from dotenv import load_dotenv
import json
from generate_invoice import generate_invoice

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
    recipient_email = order["email"]
    order_status = order["can_fulfill"]
    attachment_path =  None
    
    if order_status:
        subject = "Order Confirmation"
        body = f"Dear Customer,\n\nYour order has been placed successfully! We will process your order soon.\n\nOrder Details:\n{json.dumps(order['products'], indent=2)}\n\nThank you for shopping with us!"
        attachment_path = generate_invoice(order)
    else:
        subject = "Order Update"
        body = f"Dear Customer,\n\nWe regret to inform you that we cannot fulfill your order due to insufficient stock.\n\nOrder Details:\n{json.dumps(order['products'], indent=2)}\n\nWe apologize for the inconvenience."
    
    send_email(subject, body=body, recipient_email=recipient_email, attachment_path=attachment_path)
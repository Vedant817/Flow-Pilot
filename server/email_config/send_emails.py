import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os
from dotenv import load_dotenv
import re
from payment.stripe_payment import create_payment_link
from payment.generate_invoice import generate_invoice
from config.dbConfig import db
from bson import ObjectId

load_dotenv()
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")
FEEDBACK_FORM_LINK  = os.getenv("FORM_LINK")

def send_email(subject, body, recipient_email,attachment_path=None):
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

def send_acknowledgment(order, message="", customer_subject=""):
    order_email = order["email"]
    match = re.search(r'<([^<>]+)>', order_email)
    recipient_email = match.group(1) if match else order_email
    
    product_list = "\n".join([f"- {item['name']}: {item['quantity']} units" for item in order['products']])
    
    order_id = str(order["_id"])
    tracking_url = f"http://localhost:3000/track-order/{order_id}"
    
    subject = customer_subject if customer_subject else "Order Confirmation - Thank You!"
    
    tracking_info = f"Your order is confirmed, you can track your order status at any time using this link:\n{tracking_url}" if not message else ""
    
    body = f"""Dear {order['name']},

            Thank you for your order! We have received your request.
            
            Order Details:
            {product_list}

            Order Date: {order['date']} at {order['time']}

            {tracking_info}

            {message if message else ""}

            {'' if customer_subject else "We will process your order as soon as possible."}
            If you have any questions or need to make changes, please reply to this email or contact our customer support.

            Thank you for shopping with us!

            Best regards,  
            The Sales Team
        """
    
    send_email(subject=subject, body=body, recipient_email=recipient_email)
    print(f"Order acknowledgment sent to {recipient_email}")

def send_order_update_confirmation(email, latest_order, previous_order):
    match = re.search(r'<([^<>]+)>', email)
    recipient_email = match.group(1) if match else email
    
    order_id = str(latest_order["_id"])
    tracking_url = f"http://localhost:3000/track-order/{order_id}"
    
    previous_product_list = "\n".join([f"• {item['name']}: {item['quantity']} units" for item in previous_order['products']])
    
    updated_product_list = "\n".join([f"• {item['name']}: {item['quantity']} units" for item in latest_order['products']])
    
    subject = "Order Update Confirmation"
    
    body = f"""Dear Valued Customer,

        Thank you for updating your order with us. Your changes have been successfully processed.

        Previous Order Details:
        {previous_product_list}

        Updated Order Details:
        {updated_product_list}

        Order Date: {latest_order['date']} at {latest_order['time']}

        You can track your order status at any time using this link:
        {tracking_url}

        If you have any questions or need further assistance, please contact our customer support team.

        Thank you for shopping with us!

        Best regards,
        The Sales Team
        Our Company

        ------------------------------------------
        This is an automated message. Please do not reply directly to this email.
    """
    
    send_email(subject=subject, body=body, recipient_email=recipient_email)
    print(f"Order update confirmation sent to {recipient_email}")

def send_order_issue_email(email, errors):
    error_bullets = "\n".join([f"• {error}" for error in errors])
    
    body = f"""Dear Valued Customer,

        Thank you for your recent order with us. We appreciate your business.

        Unfortunately, we were unable to process your order due to the following issue(s):

        {error_bullets}

        We want to help you complete your purchase successfully. Please review these issues and resubmit your order at your earliest convenience.

        If you need any assistance or have questions, please don't hesitate to contact our customer support team at support@ourcompany.com or call us at (555) 123-4567.

        We apologize for any inconvenience this may have caused and look forward to serving you soon.

        Best regards,
        The Customer Service Team
        Our Company

        ------------------------------------------
        This is an automated message. Please do not reply directly to this email.
    """
    
    send_email(
        subject="Important: Action Required for Your Recent Order",
        body=body,
        recipient_email=email
    )

def send_invoice(order_id):
    try:
        if not order_id:
            print("Error: Order ID is required to send invoice")
            return
        
        orders_collection = db["orders"]
        order = orders_collection.find_one({"_id": ObjectId(order_id)})
        
        if not order:
            print(f"Error: Order with ID {order_id} not found")
            return
        
        invoice_path = generate_invoice(order)
        
        customer_email = order["email"]
        match = re.search(r'<([^<>]+)>', customer_email)
        recipient_email = match.group(1) if match else customer_email
        
        payment_link = create_payment_link(order_id)
        
        subject = f"Invoice for Your Order #{order_id}"
        
        product_list = "\n".join([f"- {item['name']}: {item['quantity']} units" 
                                for item in order['products']])
        
        body = f"""Dear {order.get('name', 'Valued Customer')},

Thank you for your order! We're pleased to inform you that your order has been fulfilled and is ready for processing.

Order Details:
Order ID: {order_id}
Order Date: {order.get('date', '')} at {order.get('time', '')}

Items:
{product_list}

To complete your purchase, please use the payment link below:
{payment_link}

We value your feedback! Once you receive your order, please share your experience:
{FEEDBACK_FORM_LINK}

If you have any questions or need assistance, please don't hesitate to contact our customer support.

Thank you for shopping with us!

Best regards,
The Sales Team
"""
        
        send_email(
            subject=subject,
            body=body,
            recipient_email=recipient_email,
            attachment_path=invoice_path
        )
        
        print(f"Invoice sent successfully to {recipient_email}")
        
        if os.path.exists(invoice_path):
            os.remove(invoice_path)
            
    except Exception as e:
        print(f"Error sending invoice: {e}")
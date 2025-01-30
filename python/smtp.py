import smtplib
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv
load_dotenv()

def send_email(subject, body, sender_email, sender_password, recipient_email):
    # Create the email message
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = sender_email
    msg['To'] = recipient_email

    # Establish a secure connection with Gmail's SMTP server
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            # Login to the email account
            server.login(sender_email, sender_password)
            
            # Send the email
            server.sendmail(sender_email, recipient_email, msg.as_string())
            print("Email sent successfully!")
    except Exception as e:
        print(f"An error occurred: {e}")

# Example usage
sender_email = os.getenv("SENDER_EMAIL")
sender_password = os.getenv("EMAIL_PASSWORD")
recipient_email = os.getenv("RECEIVER_EMAIL")
subject = "Test Email from Python"
body = "This is a test email sent using Python and Gmail SMTP."

# send_email(subject, body, sender_email, sender_password, recipient_email)
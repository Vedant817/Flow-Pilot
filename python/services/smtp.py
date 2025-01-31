import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os
from dotenv import load_dotenv

load_dotenv()

def send_email(subject, body, sender_email, sender_password, recipient_email,attachment_path=None):
    """
    Sends an email with an optional attachment.
    """
    msg = MIMEMultipart()
    msg["From"] = sender_email
    msg["To"] = recipient_email
    msg["Subject"] = subject

    msg.attach(MIMEText(body, "plain"))

    # Attach the PDF invoice
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

    # Send email
    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, recipient_email, msg.as_string())
        server.quit()
        print("Email sent successfully!")
    except Exception as e:
        print(f"Error sending email: {e}")

# Example usage
sender_email = os.getenv("SENDER_EMAIL")
sender_password = os.getenv("EMAIL_PASSWORD")
recipient_email = os.getenv("RECEIVER_EMAIL")
subject = "Test Email from Python"
body = "This is a test email sent using Python and Gmail SMTP."
attachment_path = ""

# send_email(subject, body, sender_email, sender_password, recipient_email,attachment_path)
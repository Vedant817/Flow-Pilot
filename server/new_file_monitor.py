import time
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
import json
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.service_account import Credentials
from email_config.emailContentExtract import extract_email_details
from order_handling import process_order_details, process_order_change
from email_config.email_check import suspicious_email_check
from email_config.email_classification import classify_email
from feedback.feedback_handle import process_complaint
from file_processing import process_attachment
import re

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SPREADSHEET_ID = "1RQCpLaxaP32BWE_cCKBWm0FWD3AvWJO8xVBaGgPQb_g"
RANGE_NAME = "Sheet1!A1:Z1000"

previous_content = []

def get_sheet_data():
    try:
        creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
        service = build("sheets", "v4", credentials=creds)
        
        result = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=SPREADSHEET_ID, range=RANGE_NAME)
            .execute()
        )
        
        rows = result.get("values", [])
        print(f"Retrieved {len(rows)} rows from Google Sheet")
        
        if not rows:
            return []
        
        headers = rows[0]
        content = []
        
        for row in rows[1:]:
            if not row or all(cell == '' for cell in row):
                continue
                
            extended_row = row + [''] * (len(headers) - len(row))
            
            email_data = dict(zip(headers, extended_row))
            content.append(email_data)
        
        return content
        
    except HttpError as error:
        print(f"An HTTP error occurred: {error}")
        return []
    except Exception as e:
        print(f"Error reading the Google Sheet: {e}")
        return []

def compare_changes(new_content):
    global previous_content
    changes = []
    base_timestamp = datetime.now()
    
    prev_content_tuples = [tuple(row.items()) for row in previous_content if isinstance(row, dict)]
    
    print(f"Comparing {len(new_content)} current rows with {len(previous_content)} previous rows")
    
    for index, row in enumerate(new_content):
        if not isinstance(row, dict):
            continue
            
        row_tuple = tuple(row.items())
        
        if row_tuple not in prev_content_tuples:
            row_with_timestamp = row.copy()
            current_time = base_timestamp + timedelta(seconds=index)
            row_with_timestamp['Date'] = current_time.strftime("%Y-%m-%d")
            row_with_timestamp['Time'] = current_time.strftime("%H:%M:%S")
            changes.append(row_with_timestamp)
            
            print("\n=== NEW OR UPDATED ROW DETECTED ===")

    if changes:
        print(f"Found {len(changes)} new or updated entries")
    else:
        print("No new entries detected")
        
    previous_content = new_content.copy()
    return changes

def process_changes(changes):
    changes_file = "changes.json"

    try:
        if changes:
            print("\n========== PROCESSING CHANGES ==========")
            with open(changes_file, 'w') as f:
                json.dump(changes, f, indent=4)

            for i, change in enumerate(changes):
                email = None
                body = None
                date = change.get('Date')
                time = change.get('Time')
                attachment_path = None
                subject = None
                
                if change.get("EmailID"):
                    email_field = change.get("EmailID")
                    email_match = re.search(r'<([^>]+)>', email_field)
                    if email_match:
                        email = email_match.group(1)
                    else:
                        email = email_field
                else:
                    email = change.get("Email")
                
                if change.get("Body"):
                    body = change.get("Body")
                
                if change.get("Subject"):
                    subject = change.get("Subject")
                
                if change.get("AttachmentPath"):
                    attachment_path = change.get("AttachmentPath")
                else:
                    attachment_path = change.get("Attachment")
                
                if not email or not body:
                    print(f"❌ Missing required email data. Email: {email}, Body: {body}")
                    continue
                
                print(f"\nValidating email: {email}")
                email_status = suspicious_email_check(email)
                is_valid, status = email_status

                if is_valid:
                    structured_data = None
                    if attachment_path and os.path.exists(attachment_path):
                        structured_data = process_attachment(attachment_path, body, email, date, time)

                    if structured_data and structured_data.get('orders'):
                        print(json.dumps(structured_data, indent=2))
                        process_order_details(email, date, time, structured_data)
                    else:
                        email_type, email_type_status = classify_email(body)
                        
                        if email_type_status == 200:
                            if email_type == "Order confirmation":
                                order_details = extract_email_details(body)
                                if order_details:
                                    print(json.dumps(order_details, indent=2))
                                    process_order_details(email, date, time, order_details)
                                else:
                                    print("No order details could be extracted from email body")

                            elif email_type == "Change to order":
                                order_details = extract_email_details(body)
                                if order_details:
                                    process_order_change(email, date, time, order_details)
                                else:
                                    print("No order change details could be extracted from email body")

                            elif email_type == "Complaint":
                                process_complaint(email, body, date, time)
                            else:
                                print(f"\nUnknown email type: {email_type}")
                        else:
                            print(f"\nFailed to classify email. Status code: {email_type_status}")
                else:
                    print('\n❌ Email validation failed:')
                    if status == "Suspicious":
                        print("⚠️ Warning: This email is flagged as suspicious.")
                    elif status == "Exception":
                        print("❗ Error: There was an issue validating the email.")
                    else:
                        print("ℹ️ Email is invalid or not recognized.")
                
    except Exception as e:
        print(f"\nERROR processing changes: {e}")
    finally:
        if os.path.exists(changes_file):
            os.remove(changes_file)

def start_monitoring():
    global previous_content
    previous_content = get_sheet_data()
    print(f"Initialized with {len(previous_content)} existing entries")
    
    try:
        cycle_count = 0
        while True:
            cycle_count += 1
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            current_content = get_sheet_data()
            print("\nComparing with previous data...")
            changes = compare_changes(current_content)
            
            if changes:
                print(f"\nDetected {len(changes)} new/updated entries")
                process_changes(changes)
            else:
                print("\nNo changes detected in this cycle")
            
            wait_time = 10 
            print(f"\nWaiting {wait_time} seconds before next check...")
            time.sleep(wait_time)
            
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped by user.")
    except Exception as e:
        error_message = f"Error in monitoring: {str(e)}"
        print(f"\n\nERROR: {error_message}")
        time.sleep(10)
        print("Restarting monitoring...")
        start_monitoring()

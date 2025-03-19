import time
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(_file_), "..", "..")))
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
    """Reads data from the Google Sheet using the Google Sheets API."""
    try:
        # Authenticate using service account
        creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
        service = build("sheets", "v4", credentials=creds)
        
        # Call the Sheets API to get values
        result = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=SPREADSHEET_ID, range=RANGE_NAME)
            .execute()
        )
        
        rows = result.get("values", [])
        print(f"Retrieved {len(rows)} rows from Google Sheet")
        
        if not rows:
            print('No data found in the sheet.')
            return []
        
        # First row contains headers
        headers = rows[0]
        content = []
        
        # Process each row after the header
        for row in rows[1:]:
            # Skip empty rows
            if not row or all(cell == '' for cell in row):
                continue
                
            # Extend row if it's shorter than headers
            extended_row = row + [''] * (len(headers) - len(row))
            
            # Create dictionary from headers and row values
            email_data = dict(zip(headers, extended_row))
            content.append(email_data)
        
        print(f"Processed {len(content)} data rows")
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
    
    # Create a list of tuples from previous content for comparison (matching old file approach)
    prev_content_tuples = [tuple(row.items()) for row in previous_content if isinstance(row, dict)]
    
    print(f"Comparing {len(new_content)} current rows with {len(previous_content)} previous rows")
    
    for index, row in enumerate(new_content):
        if not isinstance(row, dict):
            continue
            
        # Convert to tuple of items for comparison (matching old file approach)
        row_tuple = tuple(row.items())
        
        if row_tuple not in prev_content_tuples:
            row_with_timestamp = row.copy()
            current_time = base_timestamp + timedelta(seconds=index)
            row_with_timestamp['Date'] = current_time.strftime("%Y-%m-%d")
            row_with_timestamp['Time'] = current_time.strftime("%H:%M:%S")
            changes.append(row_with_timestamp)
            
            # Print the new/updated row
            print("\n=== NEW OR UPDATED ROW DETECTED ===")
            for key, value in row.items():
                print(f"  {key}: {value}")
            print("===================================")

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
            print(f"Saved {len(changes)} changes to {changes_file}")

            for i, change in enumerate(changes):
                print(f"\n----- Processing Entry #{i+1}/{len(changes)} -----")
                
                # Print all fields in the entry
                print("Entry details:")
                for key, value in change.items():
                    print(f"  {key}: {value}")
                
                # Format check and extraction
                email = None
                body = None
                date = change.get('Date')
                time = change.get('Time')
                attachment_path = None
                subject = None
                
                # Check if EmailID field contains the email in the format: "Name" <email@domain.com>
                if change.get("EmailID"):
                    email_field = change.get("EmailID")
                    email_match = re.search(r'<([^>]+)>', email_field)
                    if email_match:
                        email = email_match.group(1)
                    else:
                        email = email_field  # Use as is if not in expected format
                else:
                    email = change.get("Email")  # Fallback to Email field
                
                # Extract body from the Body field
                if change.get("Body"):
                    body = change.get("Body")
                
                # Extract subject if available
                if change.get("Subject"):
                    subject = change.get("Subject")
                
                # Extract attachment path
                if change.get("AttachmentPath"):
                    attachment_path = change.get("AttachmentPath")
                else:
                    attachment_path = change.get("Attachment")
                
                # Ensure we have the minimum required data
                if not email or not body:
                    print(f"❌ Missing required email data. Email: {email}, Body: {body}")
                    continue
                
                print(f"\nProcessing with formatted data:")
                print(f"  Email: {email}")
                print(f"  Subject: {subject}")
                print(f"  Body: {body}")
                print(f"  Date: {date}")
                print(f"  Time: {time}")
                print(f"  Attachment: {attachment_path}")
                
                # Continue with email validation and processing
                print(f"\nValidating email: {email}")
                email_status = suspicious_email_check(email)
                is_valid, status = email_status
                print(f"Email validation result: Valid={is_valid}, Status={status}")

                if is_valid:
                    structured_data = None
                    if attachment_path and os.path.exists(attachment_path):
                        print(f"\nProcessing attachment: {attachment_path}")
                        structured_data = process_attachment(attachment_path, body, email, date, time)
                        print(f"Attachment processing result: {'Successful' if structured_data else 'Failed'}")

                    if structured_data and structured_data.get('orders'):
                        print("\nOrder details extracted from attachment:")
                        print(json.dumps(structured_data, indent=2))
                        process_order_details(email, date, time, structured_data)
                        print("Order details processed successfully")
                    else:
                        print("\nProcessing email body only")
                        print("Classifying email...")
                        email_type, email_type_status = classify_email(body)
                        print(f"Email classified as: {email_type} (Status: {email_type_status})")
                        
                        if email_type_status == 200:
                            if email_type == "Order confirmation":
                                print("\nExtracting order details from email body...")
                                order_details = extract_email_details(body)
                                if order_details:
                                    print("Order details extracted:")
                                    print(json.dumps(order_details, indent=2))
                                    process_order_details(email, date, time, order_details)
                                    print("Order details processed successfully")
                                else:
                                    print("No order details could be extracted from email body")

                            elif email_type == "Change to order":
                                print("\nExtracting order change details...")
                                order_details = extract_email_details(body)
                                if order_details:
                                    print("Order change details extracted:")
                                    print(json.dumps(order_details, indent=2))
                                    process_order_change(email, date, time, order_details)
                                    print("Order change processed successfully")
                                else:
                                    print("No order change details could be extracted from email body")

                            elif email_type == "Complaint":
                                print("\nProcessing complaint...")
                                process_complaint(email, body, date, time)
                                print("Complaint processed successfully")
                            else:
                                print(f"\nUnknown email type: {email_type}")
                        else:
                            print(f"\nFailed to classify email. Status code: {email_type_status}")
                else:
                    print('\n❌ Email validation failed:')
                    if status == "Suspicious":
                        print("⚠ Warning: This email is flagged as suspicious.")
                    elif status == "Exception":
                        print("❗ Error: There was an issue validating the email.")
                    else:
                        print("ℹ Email is invalid or not recognized.")
                
                print("\n----- Processing Complete -----")
            
            print("\n========== ALL CHANGES PROCESSED ==========")
    except Exception as e:
        print(f"\nERROR processing changes: {e}")
    finally:
        if os.path.exists(changes_file):
            os.remove(changes_file)
            print(f"Removed temporary file: {changes_file}")

def start_monitoring():
    """Monitors the Google Sheet for changes."""
    print(f"\n{'='*60}")
    print(f"STARTING GOOGLE SHEET MONITORING")
    print(f"Spreadsheet ID: {SPREADSHEET_ID}")
    print(f"Range: {RANGE_NAME}")
    print(f"{'='*60}\n")
    
    # Initialize with current content
    global previous_content
    print("Reading initial sheet data...")
    previous_content = get_sheet_data()
    print(f"Initialized with {len(previous_content)} existing entries")
    
    try:
        cycle_count = 0
        while True:
            cycle_count += 1
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"\n{'='*60}")
            print(f"MONITORING CYCLE #{cycle_count} - {current_time}")
            print(f"{'='*60}")
            
            # Read current content
            print("\nReading current sheet data...")
            current_content = get_sheet_data()
            
            # Compare and find changes
            print("\nComparing with previous data...")
            changes = compare_changes(current_content)
            
            # Process any changes
            if changes:
                print(f"\nDetected {len(changes)} new/updated entries")
                process_changes(changes)
            else:
                print("\nNo changes detected in this cycle")
            
            # Wait before checking again
            wait_time = 10  # seconds
            print(f"\nWaiting {wait_time} seconds before next check...")
            time.sleep(wait_time)
            
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped by user.")
    except Exception as e:
        error_message = f"Error in monitoring: {str(e)}"
        print(f"\n\nERROR: {error_message}")
        # Wait a bit before retrying
        print("Waiting 10 seconds before restarting monitoring...")
        time.sleep(10)
        print("Restarting monitoring...")
        start_monitoring()  # Restart monitoring
import time
import os
import json
from datetime import datetime, timedelta
import google.auth
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.service_account import Credentials
from emailContentExtract import extract_email_details
from order_handling import process_order_details, process_order_change
from email_check import suspicious_email_check
from email_classification import classify_email
from feedback_handle import process_complaint
from file_processing import process_attachment

# Google Sheets configuration
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SPREADSHEET_ID = "1RQCpLaxaP32BWE_cCKBWm0FWD3AvWJO8xVBaGgPQb_g"  # Replace with your Google Sheet ID
RANGE_NAME = "Sheet1!A1:Z1000"  # Adjust the range as needed

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
    
    # Create a set of tuples from previous content for faster comparison
    prev_content_tuples = set()
    for row in previous_content:
        if isinstance(row, dict):
            # Convert to a frozenset of items for hashability
            row_items = frozenset(row.items())
            prev_content_tuples.add(row_items)
    
    print(f"Comparing {len(new_content)} current rows with {len(previous_content)} previous rows")
    
    for index, row in enumerate(new_content):
        if not isinstance(row, dict):
            continue
            
        # Convert to a frozenset of items for comparison
        row_items = frozenset(row.items())
        
        if row_items not in prev_content_tuples:
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
                
                email = change.get("Email")
                body = change.get("Body")
                date = change.get('Date')
                time = change.get('Time')
                attachment_path = change.get('Attachment')

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
                        print("⚠️ Warning: This email is flagged as suspicious.")
                    elif status == "Exception":
                        print("❗ Error: There was an issue validating the email.")
                    else:
                        print("ℹ️ Email is invalid or not recognized.")
                
                print("\n----- Processing Complete -----")
            
            print("\n========== ALL CHANGES PROCESSED ==========")
    except Exception as e:
        print(f"\nERROR processing changes: {e}")
    finally:
        if os.path.exists(changes_file):
            os.remove(changes_file)
            print(f"Removed temporary file: {changes_file}")

def log_to_sheet(message, status="INFO"):
    """Logs messages to a dedicated log worksheet in the same spreadsheet."""
    try:
        creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
        service = build("sheets", "v4", credentials=creds)
        
        # First check if the log sheet exists
        sheet_metadata = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        sheets = sheet_metadata.get('sheets', '')
        log_sheet_exists = False
        log_sheet_id = None
        
        for sheet in sheets:
            if sheet.get("properties", {}).get("title") == "ProcessingLogs":
                log_sheet_exists = True
                log_sheet_id = sheet.get("properties", {}).get("sheetId")
                break
        
        # Create log sheet if it doesn't exist
        if not log_sheet_exists:
            request = {
                "addSheet": {
                    "properties": {
                        "title": "ProcessingLogs",
                        "gridProperties": {
                            "rowCount": 1000,
                            "columnCount": 4
                        }
                    }
                }
            }
            
            result = service.spreadsheets().batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"requests": [request]}
            ).execute()
            
            # Add headers
            header_values = [["Timestamp", "Status", "Message", "Details"]]
            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range="ProcessingLogs!A1:D1",
                valueInputOption="RAW",
                body={"values": header_values}
            ).execute()
            
            # Format headers
            format_request = {
                "repeatCell": {
                    "range": {
                        "sheetId": result.get("replies")[0].get("addSheet").get("properties").get("sheetId"),
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 0,
                        "endColumnIndex": 4
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "textFormat": {
                                "bold": True
                            }
                        }
                    },
                    "fields": "userEnteredFormat.textFormat.bold"
                }
            }
            
            service.spreadsheets().batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"requests": [format_request]}
            ).execute()
            
            print(f"Created new log worksheet: ProcessingLogs")
        
        # Add log entry
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = [[timestamp, status, message, ""]]
        
        # Append the log entry
        service.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range="ProcessingLogs!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": log_entry}
        ).execute()
        
        print(f"Log entry added: [{status}] {message}")
        
    except HttpError as error:
        print(f"HTTP error logging to sheet: {error}")
    except Exception as e:
        print(f"Error logging to sheet: {e}")

def start_monitoring():
    """Monitors the Google Sheet for changes."""
    print(f"\n{'='*60}")
    print(f"STARTING GOOGLE SHEET MONITORING")
    print(f"Spreadsheet ID: {SPREADSHEET_ID}")
    print(f"Range: {RANGE_NAME}")
    print(f"{'='*60}\n")
    
    log_to_sheet("Monitoring started", "INFO")
    
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
                log_to_sheet(f"Detected {len(changes)} new/updated entries", "UPDATE")
                process_changes(changes)
            else:
                print("\nNo changes detected in this cycle")
            
            # Wait before checking again
            wait_time = 20# seconds
            print(f"\nWaiting {wait_time} seconds before next check...")
            time.sleep(wait_time)
            
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped by user.")
        log_to_sheet("Monitoring stopped by user", "INFO")
    except Exception as e:
        error_message = f"Error in monitoring: {str(e)}"
        print(f"\n\nERROR: {error_message}")
        log_to_sheet(error_message, "ERROR")
        # Wait a bit before retrying
        print("Waiting 10 seconds before restarting monitoring...")
        time.sleep(10)
        print("Restarting monitoring...")
        start_monitoring()  # Restart monitoring

if __name__ == "__main__":
    start_monitoring()

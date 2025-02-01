import time
import openpyxl
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import json
import os
from datetime import datetime, timedelta

# Define file paths
EXCEL_FILE_PATH = os.path.abspath(r'D:\Deloitte\Prototype\python\Sample.xlsx')  # Replace with your file path
DIRECTORY_TO_WATCH = os.path.dirname(EXCEL_FILE_PATH)  # Get directory of file
CHANGES_FILE = 'changes.json'  # Path to store JSON updates

# Store previous content
previous_content = []

# Function to read the Excel file and return content as a list of dictionaries, ignoring empty rows
def read_excel_file():
    try:
        wb = openpyxl.load_workbook(EXCEL_FILE_PATH, data_only=True)
        sheet = wb.active
        headers = [cell.value for cell in sheet[1]]  # Read headers

        content = []
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if all(cell is None for cell in row):  # Ignore completely empty rows
                continue
            content.append(dict(zip(headers, row)))

        return content
    
    except Exception as e:
        print(f"Error reading the Excel file: {e}")
        return []

# Function to read existing data from changes.json
def load_existing_data():
    if os.path.exists(CHANGES_FILE):
        try:
            with open(CHANGES_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("Warning: Corrupted JSON file, resetting changes.json.")
    return []

# Function to compare previous content with new content and ignore exact duplicate emails (Email, Subject, Body)
def detect_changes(new_content, existing_data):
    global previous_content  
    changes = []
    timestamp = datetime.now()
    
    # Create a dictionary {email: set of (Subject, Body)}
    seen_entries = {}
    for entry in existing_data:
        email = entry.get("Email", "").strip()
        subject = entry.get("Subject", "").strip()
        body = entry.get("Body", "").strip()

        if email:
            if email not in seen_entries:
                seen_entries[email] = set()
            seen_entries[email].add((subject, body))

    prev_tuples = {tuple(row.items()) for row in previous_content if isinstance(row, dict)}

    for index, row in enumerate(new_content):
        if not isinstance(row, dict) or not any(row.values()):  # Ignore empty rows
            continue

        email = row.get("Email", "").strip() if "Email" in row else None
        subject = row.get("Subject", "").strip() if "Subject" in row else None
        body = row.get("Body", "").strip() if "Body" in row else None

        # if email and subject and body:
        #     # If the same (Email, Subject, Body) exists, print the warning and skip the entry
        #     if email in seen_entries and (subject, body) in seen_entries[email]:
        #         print(f"Duplicate email warning: {email}: Subject '{subject}' with the same Body already exists.")
        #         continue  # Skip this entry as it's a duplicate

        #     # Otherwise, add the new (Subject, Body) entry for that Email
        #     if email not in seen_entries:
        #         seen_entries[email] = set()
        #     seen_entries[email].add((subject, body))

        row_tuple = tuple(row.items())
        if row_tuple not in prev_tuples:  # If the row is new
            
            row['Date'] = timestamp.strftime("%Y-%m-%d")
            row['Time'] = (timestamp + timedelta(seconds=index)).strftime("%H:%M:%S")
            changes.append(row)

    previous_content = new_content[:]  # Update previous content
    return changes  # Return only newly added unique rows


# Function to update changes.json while maintaining unique (Email, Subject, Body)
def update_json(new_changes):
    existing_data = load_existing_data()

    if new_changes:
        existing_data.extend(new_changes)  # Append new changes while keeping previous data
    
        # Ensure only unique (Email, Subject, Body) are stored
        unique_data = []
        unique_entries = {}

        for entry in existing_data:
            email = entry.get("Email", "").strip() if "Email" in entry else None
            subject = entry.get("Subject", "").strip() if "Subject" in entry else None
            body = entry.get("Body", "").strip() if "Body" in entry else None
            entry_tuple = (subject, body)

            if email:
                if email not in unique_entries:
                    unique_entries[email] = set()

                if entry_tuple in unique_entries[email]:  # Skip duplicates
                    continue

                unique_entries[email].add(entry_tuple)
                unique_data.append(entry)
            

        try:
            with open(CHANGES_FILE, 'w') as f:
                json.dump(unique_data, f, indent=4)
            print("Updated JSON with new unique content.")
        except Exception as e:
            print(f"Error writing JSON file: {e}")

# Function to handle modifications
def process_file_changes():
    new_content = read_excel_file()
    existing_data = load_existing_data()
    new_changes = detect_changes(new_content, existing_data)

    if new_changes:
        update_json(new_changes)  

# Event handler for file modifications
class FileModifiedHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path == EXCEL_FILE_PATH:
            print(f"File modified: {EXCEL_FILE_PATH}")
            process_file_changes()

# Start monitoring
if __name__ == "__main__":
    event_handler = FileModifiedHandler()
    observer = Observer()
    observer.schedule(event_handler, DIRECTORY_TO_WATCH, recursive=False)

    print(f"Monitoring changes in {EXCEL_FILE_PATH}...")

    try:
        observer.start()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("Stopped monitoring.")

    observer.join()

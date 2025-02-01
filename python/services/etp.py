import time
import openpyxl
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import subprocess
import json
import os
from datetime import datetime, timedelta

# Define the file path and the directory to watch
excel_file_path = os.path.abspath(r'D:\Deloitte\Prototype\RPA\Order.xlsx')  # Replace with your file path
directory_to_watch = os.path.dirname(excel_file_path)  # Get directory of file

# Initialize previous content as a list of tuples
previous_content = []

# Function to read the Excel file and return content as a list of dictionaries
def read_excel_file():
    content = []
    try:
        wb = openpyxl.load_workbook(excel_file_path)
        sheet = wb.active

        # Assuming first row contains headers
        headers = [cell.value for cell in sheet[1]]  # Read column names
        
        for row in sheet.iter_rows(min_row=2, values_only=True):  # Skip headers
            if all(cell is None for cell in row):  # Skip empty rows
                continue

            if isinstance(row, tuple):  # Ensure row is not a list
                email_data = dict(zip(headers, row))  # Convert row to dictionary
                content.append(email_data)

    except Exception as e:
        print(f"Error reading the Excel file: {e}")
    
    return content

# Function to compare previous content with the new content
def compare_changes(new_content):
    global previous_content  # Declare as global to modify
    
    changes = []
    base_timestamp = datetime.now()  # Get current timestamp

    # Convert previous content to a list of tuples (hashable for comparison)
    prev_content_tuples = [tuple(row.items()) for row in previous_content if isinstance(row, dict)]  # Ensure row is dict

    for index, row in enumerate(new_content):
        if not isinstance(row, dict):  # Ensure row is a dictionary before processing
            continue  

        row_tuple = tuple(row.items())  # Convert new row to a tuple

        if row_tuple not in prev_content_tuples:  # Check if row is new
            row_with_timestamp = row.copy()
            current_time = base_timestamp + timedelta(seconds=index)  # Increment time slightly
            
            # Add separate date and time fields
            row_with_timestamp['Date'] = current_time.strftime("%Y-%m-%d")
            row_with_timestamp['Time'] = current_time.strftime("%H:%M:%S")
            
            changes.append(row_with_timestamp)

    # Update previous content with new content (convert to tuples)
    previous_content = new_content.copy()

    return changes

# Function to handle modified part of the file and trigger the second script
def handle_modified_file():
    new_content = read_excel_file()
    changes = compare_changes(new_content)
    
    if changes:
        print("Detected changes in the file:")
        for change in changes:
            print(change)  # Print new rows
        
        # Save the changes as JSON to pass to the second script
        with open('changes.json', 'w') as f:
            json.dump(changes, f, indent=4)  # Pretty print JSON
        
        # Call the second Python script using subprocess
        # subprocess.run([r'D:\Deloitte\Prototype\python\venv\Scripts\python.exe', r'D:\Deloitte\Prototype\python\ai\jamba.py'])

    else:
        print("No changes detected.")

# Create an event handler that responds to file modifications
class ExcelFileHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path == excel_file_path:
            print(f"Detected change in file: {excel_file_path}")
            handle_modified_file()

# Set up the observer to watch for file modifications
event_handler = ExcelFileHandler()
observer = Observer()
observer.schedule(event_handler, directory_to_watch, recursive=False)

# Start the observer
observer.start()
print(f"Monitoring changes in {excel_file_path}...")

# Run the monitoring loop
try:
    while True:
        time.sleep(1)  # Keeps the script running and monitoring for changes
except KeyboardInterrupt:
    observer.stop()
    print("Stopped monitoring.")

# Stop the observer when done
observer.join()
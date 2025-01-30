import time
import pandas as pd
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Define the file path and the directory to watch
excel_file_path = r'D:\Deloitte\Prototype\Sample.xlsx'  # Replace with your file path
directory_to_watch = r'D:\Deloitte\Prototype'  # Replace with the directory of the file

# Function to read the content of the Excel file
def read_excel_file():
    try:
        df = pd.read_excel(excel_file_path)
        print("File content:")
        print(df.head())  # Print the first few rows of the Excel file
    except Exception as e:
        print(f"Error reading the Excel file: {e}")

# Create an event handler that responds to file modifications
class ExcelFileHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path == excel_file_path:
            print(f"Detected change in file: {excel_file_path}")
            read_excel_file()

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


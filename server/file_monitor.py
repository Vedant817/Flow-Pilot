import time
import openpyxl
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import threading

#? Define the file path and the directory to watch
excel_file_path = os.path.abspath(r'C:\Users\vedan\Downloads\EmailAutomation\server\Sample.xlsx')
directory_to_watch = os.path.dirname(excel_file_path)

# Function to read the Excel file and return content as a list of dictionaries
def read_excel_file():
    content = []
    try:
        wb = openpyxl.load_workbook(excel_file_path)
        sheet = wb.active

        headers = [cell.value for cell in sheet[1]]
        
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if isinstance(row, tuple):
                email_data = dict(zip(headers, row)) 
                content.append(email_data)

        print("Read Excel Content:", content)

    except Exception as e:
        print(f"Error reading the Excel file: {e}")


# Function to start monitoring
def start_monitoring():
    class ExcelFileHandler(FileSystemEventHandler):
        def on_modified(self, event):
            if event.src_path == excel_file_path:
                print(f"Detected update in file: {excel_file_path}")
                read_excel_file()
    
    event_handler = ExcelFileHandler()
    observer = Observer()
    observer.schedule(event_handler, directory_to_watch, recursive=False)
    observer.start()
    print(f"Monitoring updates in {excel_file_path}...")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("Stopped monitoring.")
    observer.join()

import threading
import requests
import time

def call_routes():
    time.sleep(300)  # Wait for 5 minutes (300 seconds)
    
    # Call refresh-data route
    try:
        response = requests.post("http://127.0.0.1:5000/refresh-data")
        print("✅ /refresh-data called:", response.json())
    except Exception as e:
        print("Error calling /refresh-data:", e)
    
    # Call end-session route
    try:
        response = requests.post("http://127.0.0.1:5000/end-session")
        print("✅ /end-session called:", response.json())
    except Exception as e:
        print("Error calling /end-session:", e)

# Start the thread when the app starts
thread = threading.Thread(target=call_routes, daemon=True)
thread.start()

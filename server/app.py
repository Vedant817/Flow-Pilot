from flask import Flask, request, jsonify # type: ignore
import threading
from file_monitor import start_monitoring
from dbConfig import connect_db
from feedback_handle import process_feedback

db = connect_db()

app = Flask(__name__)

def start_monitoring_thread():
    if not any(thread.name == "FileMonitorThread" for thread in threading.enumerate()):
        thread = threading.Thread(target=start_monitoring, daemon=True, name="FileMonitorThread")
        thread.start()

start_monitoring_thread()

@app.route('/')
def index():
    return 'File Monitoring is Already Running!', 200

@app.route('/get-feedback')
def feedback():
    try:
        response = process_feedback()
        return jsonify(response[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host = '0.0.0.0', debug=True)
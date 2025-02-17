from flask import Flask, jsonify, request # type: ignore
import threading
from file_monitor import start_monitoring
from dbConfig import connect_db
from feedback_handle import fetch_feedback, store_feedback
from chatbot import ask_bot

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
def get_feedback():
    try:
        feedback_data = fetch_feedback()
        response = store_feedback(feedback_data)
        return jsonify(response), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/chatbot')
def chat():
    query = request.args.get('query')
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400
    
    response = ask_bot(query)
    print(response)
    return jsonify({"response": response})

if __name__ == '__main__':
    app.run(host = '0.0.0.0', debug=True)
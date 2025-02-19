from flask import Flask, jsonify, request # type: ignore
import threading
from file_monitor import start_monitoring
from dbConfig import connect_db
from feedback_handle import fetch_feedback, store_feedback
from chatbot import ask_bot
from flask_cors import CORS

db = connect_db()

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*"
    }
})

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

@app.route('/chatbot', methods=['POST'])
def chat():
    query = request.args.get('query')
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400
    
    response = ask_bot(query)
    return jsonify({"response": response})

@app.route('/get-inventory')
def get_inventory():
    try:
        inventory_collection = db['inventory']
        inventory_items = list(inventory_collection.find({}, {'_id': 0}))
        print(inventory_items)
        return jsonify(inventory_items), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host = '0.0.0.0', debug=True)
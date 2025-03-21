# chatbot_app.py
from flask import Flask, jsonify, request, session
import threading
import uuid
import os
from flask_cors import CORS
from dotenv import load_dotenv
from chatbot import ask_bot, refresh_data_and_update_vector_store, store_chat_history, get_chat_history
from error_handle import handle_exception
from apscheduler.schedulers.background import BackgroundScheduler
import json

load_dotenv()
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")

CORS(app, resources={
    r"/*": {
        "origins": "*"
    }
})

@app.before_request
def before_request():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())

@app.route('/')
def index():
    return 'Chatbot Service is Running!', 200

@app.route('/chatbot', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({"error": "Query parameter is required"}), 400

        query = data['query']
        
        session_id = session.get('session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
            session['session_id'] = session_id
        print('Query:', query)
        print('Session ID:', session_id)
        response_data = ask_bot(query, session_id)
        response_text = response_data.get('response', '')
        
        if response_text:
            store_chat_history(session_id, query, response_text)
        print('Response:', response_text)
        return jsonify({"response": response_text, "session_id": session_id})
    except Exception as e:
        app.logger.error(f"Error in chatbot endpoint: {str(e)}")
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

@app.route('/chat-history', methods=['GET'])
def get_session_chat_history():
    try:
        session_id = session.get('session_id')
        if not session_id:
            return jsonify({"error": "No active session"}), 400
            
        limit = int(request.args.get("limit", 10))
        
        history = get_chat_history(session_id, limit)
        
        return jsonify({"history": history, "session_id": session_id})
    except Exception as e:
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

@app.route('/end-session', methods=['POST'])
def end_session():
    try:
        session_id = session.get('session_id')
        if not session_id:
            return jsonify({"error": "No active session"}), 400
        
        session.pop('session_id', None)
        
        return jsonify({"message": "Session ended"})
    except Exception as e:
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

@app.route('/refresh-data', methods=['POST'])
def refresh_data():
    try:
        refresh_data_and_update_vector_store()
        return jsonify({"message": "Data refreshed and vector store updated."})
    except Exception as e:
        handle_exception(e)
        return jsonify({"error": str(e)}), 500

def scheduled_refresh():
    scheduler = BackgroundScheduler()
    scheduler.add_job(refresh_data_and_update_vector_store, 'interval', hours=1)
    scheduler.start()

if __name__ == '__main__':
    scheduled_refresh()
    app.run(host='0.0.0.0', port=5001, debug=True)

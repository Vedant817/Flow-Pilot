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
import atexit

load_dotenv()
app = Flask(_name_)  # Fixed underscore syntax
app.secret_key = os.getenv("FLASK_SECRET_KEY", "default-secret-key")  # Added default value

CORS(app, resources={
    r"/*": {
        "origins": "*"
    }
})

# Initialize scheduler outside of function to make it accessible globally
scheduler = BackgroundScheduler()

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
        
        # Added error handling for ask_bot
        try:
            response_data = ask_bot(query, session_id)
            response_text = response_data.get('response', '')
        except Exception as e:
            app.logger.error(f"Error in ask_bot: {str(e)}")
            return jsonify({"error": f"Failed to process query: {str(e)}"}), 500
        
        if response_text:
            try:
                store_chat_history(session_id, query, response_text)
            except Exception as e:
                app.logger.warning(f"Failed to store chat history: {str(e)}")
                # Continue execution even if storing history fails
                
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

def setup_scheduled_refresh():
    """Set up the scheduled data refresh task"""
    try:
        # Use the global scheduler
        global scheduler
        scheduler.add_job(
            func=refresh_data_and_update_vector_store, 
            trigger='interval', 
            hours=1,
            id='refresh_data_job',
            replace_existing=True
        )
        scheduler.start()
        app.logger.info("Scheduled data refresh job started")
        
        # Register shutdown function to properly clean up scheduler
        atexit.register(lambda: scheduler.shutdown(wait=False))
    except Exception as e:
        app.logger.error(f"Failed to set up scheduler: {str(e)}")

if __name__ == '__main__':
    # Initialize data before starting the server
    try:
        refresh_data_and_update_vector_store()
        app.logger.info("Initial data refresh completed")
    except Exception as e:
        app.logger.error(f"Initial data refresh failed: {str(e)}")
    
    # Set up scheduled refresh
    setup_scheduled_refresh()
    
    # Run the Flask app with increased timeout
    from werkzeug.serving import run_simple
    run_simple('0.0.0.0', 5001, app, use_reloader=True, use_debugger=True, threaded=True, request_handler=None)

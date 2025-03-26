# chatbot_app.py
from flask import Flask, jsonify, request, session
import uuid
import os
from flask_cors import CORS
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_chroma import Chroma
from langchain.schema import Document
from google.cloud import aiplatform
from langchain_google_vertexai import VertexAIEmbeddings
import pandas as pd
from config.gemini_config import gemini_model
from langchain.text_splitter import RecursiveCharacterTextSplitter
from config.dbConfig import db
import hashlib
import pickle

load_dotenv()
inventory_collection = db["inventory"]
feedback_collection = db["feedback"]
orders_collection = db["orders"]
customers_collection = db["customers"]
chat_history_collection = db["chat_history"]

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\Users\vedan\Downloads\EmailAutomation\server\fresh-airfoil-445517-q1-4e804f7d94e2.json"
aiplatform.init(project=PROJECT_ID, location="us-central1")
embeddings = VertexAIEmbeddings(model="text-embedding-004", project=PROJECT_ID)

def load_collection_data(collection):
    try:
        return list(collection.find({}, {"_id": 0}))
    except Exception as e:
        print(f"Error loading from collection: {e}")
        return []

def store_chat_history(session_id, query, response):
    """Store chat interactions in MongoDB using session ID"""
    chat_history_collection.insert_one({
        "session_id": session_id,
        "query": query,
        "response": response,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

def get_chat_history(session_id, limit=10):
    """Retrieve chat history for a specific session"""
    history = list(chat_history_collection.find(
        {"session_id": session_id}, 
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit))
    
    return history

def process_pdf(pdf_path):
    print("\n📌 Processing PDF:", pdf_path)
    
    mod_time = os.path.getmtime(pdf_path)
    cache_key = f"{pdf_path}_{mod_time}"
    cache_file = f"pdf_cache_{hashlib.md5(cache_key.encode()).hexdigest()}.pkl"
    
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'rb') as f:
                docs = pickle.load(f)
                print("✅ Loaded PDF from cache.")
                return docs
        except Exception as e:
            print(f"Cache loading failed: {e}")

    try:
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=300,
            chunk_overlap=150,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
            keep_separator=True
        )
        pdf_texts = text_splitter.split_documents(documents)

        docs = []
        for i, doc in enumerate(pdf_texts):
            metadata = {
                "id": f"pdf_chunk_{i}",
                "source": "User Manual",
                "page": doc.metadata.get("page", 0),
                "section": extract_section_title(doc.page_content),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "priority": "medium",  # Prioritize manual content
                "content_type": "documentation"
            }
            docs.append(Document(
                page_content=doc.page_content,
                metadata=metadata
            ))

        with open(cache_file, 'wb') as f:
            pickle.dump(docs, f)
        
        print(f"✅ Added {len(docs)} new documents to vector store.")
        return docs

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

if __name__ == '__main__':
    # Initialize the database and vector store on startup
    # refresh_data_and_update_vector_store()
    app.run(host='0.0.0.0', port=5002, debug=True)

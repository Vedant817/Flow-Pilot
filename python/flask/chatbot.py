import os
import datetime
import shutil
import time
from dotenv import load_dotenv
from config.dbConfig import db
from config.gemini_config import gemini_model
import pandas as pd
from langchain_community.document_loaders import PyPDFLoader, TextLoader, DirectoryLoader
from langchain_chroma import Chroma
from langchain.schema import Document
from google.cloud import aiplatform
from langchain_google_vertexai import VertexAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

load_dotenv()
inventory_collection = db["inventory"]
feedback_collection = db["feedback"]
orders_collection = db["orders"]
customers_collection = db["customers"]
DOCUMENT_PATHS = [
    r"C:\Users\vedan\Downloads\EmailAutomation\server\attachments\User Mannual.pdf"
]
VECTOR_STORE_DIR = "./chroma_langchain_db"
vector_store = None

PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\Users\vedan\Downloads\EmailAutomation\server\fresh-airfoil-445517-q1-0df53973cc7e.json"
aiplatform.init(project=PROJECT_ID, location="us-central1")
embeddings = VertexAIEmbeddings(model="text-embedding-004", project=PROJECT_ID)

def load_documents_from_paths(file_paths):
    documents = []
    
    for file_path in file_paths:
        if not os.path.exists(file_path):
            print(f"Warning: File {file_path} does not exist")
            continue
        try:
            file_name = os.path.basename(file_path)
            file_ext = os.path.splitext(file_name)[1].lower()
            
            if file_ext == '.pdf':
                loader = PyPDFLoader(file_path)
                docs = loader.load()
                documents.extend(docs)
                print(f"Loaded PDF: {file_name}")
                
            elif file_ext in ['.txt', '.md', '.py', '.js', '.html', '.css']:
                loader = TextLoader(file_path, encoding='utf-8')
                docs = loader.load()
                documents.extend(docs)
                print(f"Loaded text file: {file_name}")
                
            else:
                print(f"Unsupported file type: {file_ext} for file {file_name}")
        except Exception as e:
            print(f"Error loading file {file_path}: {e}")
    
    return documents

def load_collection_data(collection):
    try:
        return list(collection.find({}, {"_id": 0}))
    except Exception as e:
        print(f"Error loading from collection: {e}")
        return []

def get_all_data():
    return {
        "customers": load_collection_data(customers_collection),
        "inventory": load_collection_data(inventory_collection),
        "orders": load_collection_data(orders_collection),
        "feedback": load_collection_data(feedback_collection)
    }

def load_pdf(file_path):
    loader = PyPDFLoader(file_path)
    pages = loader.load()
    return [page.page_content for page in pages]

def build_records_from_collection(data, collection_name):
    records = []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    
    for idx, record in enumerate(data):
        text = str(record)
        chunks = text_splitter.split_text(text)
        
        for chunk_idx, chunk in enumerate(chunks):
            if not chunk or chunk.strip() == "":
                continue
                
            records.append({
                "id": f"{collection_name}_{idx}_chunk_{chunk_idx}",
                "text": chunk,
                "source": collection_name,
                "record_type": collection_name,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })
    
    return records

def build_documents(records):
    docs = []
    
    for rec in records:
        metadata = {
            "id": rec["id"],
            "source": rec["source"],
            "record_type": rec.get("record_type", "general"),
            "timestamp": rec["timestamp"],
            "priority": "high" if rec["source"] in ["pdf", "app_docs", "technical_docs"] else "normal"
        }
        docs.append(Document(page_content=rec["text"], metadata=metadata))
    
    return docs

def process_document_with_metadata(doc, idx, source_type, record_type):
    doc.metadata.update({
        "id": f"{source_type}_doc_{idx}",
        "source": source_type,
        "record_type": record_type,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "priority": "high"
    })
    return doc

def refresh_data_and_update_vector_store():
    global vector_store

    print("🔄 Clearing existing vector store...")
    if os.path.exists(VECTOR_STORE_DIR):
        shutil.rmtree(VECTOR_STORE_DIR)

    print("📥 Loading data from MongoDB...")
    data = get_all_data()
    
    print("📂 Loading documents from file paths...")
    file_documents = load_documents_from_paths(DOCUMENT_PATHS)
    
    processed_file_docs = []
    for idx, doc in enumerate(file_documents):
        # Skip documents with empty content
        if not doc.page_content or doc.page_content.strip() == "":
            print(f"Skipping empty document at index {idx}")
            continue
            
        file_path = doc.metadata.get("source", "")
        if "app_documentation" in file_path:
            processed_doc = process_document_with_metadata(doc, idx, "app_docs", "application_documentation")
        else:
            processed_doc = process_document_with_metadata(doc, idx, "pdf", "technical_docs")
        processed_file_docs.append(processed_doc)

    all_records = (
        build_records_from_collection(data["customers"], "customers") +
        build_records_from_collection(data["inventory"], "inventory") +
        build_records_from_collection(data["orders"], "orders") +
        build_records_from_collection(data["feedback"], "feedback")
    )
    
    db_documents = build_documents(all_records)
    filtered_db_documents = [doc for doc in db_documents if doc.page_content and doc.page_content.strip() != ""]
    
    all_documents = filtered_db_documents + processed_file_docs
    
    if not all_documents:
        print("No valid documents to add to vector store")
        return None

    print(f"📊 Total documents to add: {len(all_documents)}")

    print("🆕 Reinitializing vector store...")
    vector_store = Chroma(
        collection_name="customer",
        embedding_function=embeddings,
        persist_directory=VECTOR_STORE_DIR,
    )

    print("📌 Adding new documents to vector store...")
    vector_store.add_documents(all_documents)
    print("✅ Vector store updated successfully.")
    return vector_store

def retrieve_similar_docs(query, k=100):
    global vector_store
    
    if not vector_store:
        print("Vector store not initialized, initializing now...")
        vector_store = refresh_data_and_update_vector_store()
    
    try:
        results = vector_store.similarity_search(query, k=k)
        
        sorted_results = sorted(results, key=lambda doc: (
            doc.metadata.get("priority", "normal") == "high",
            doc.metadata.get("timestamp", "")
        ), reverse=True)
        
        return sorted_results[:k]
    except Exception as e:
        print(f"Error retrieving similar docs: {e}")
        return []

def ask_bot(query):
    relevant_docs = retrieve_similar_docs(query, k=100)
    
    context_parts = []
    for doc in relevant_docs:
        source_type = doc.metadata.get("source", "unknown")
        context_parts.append(f"[{source_type.upper()}]\n{doc.page_content}")
    
    context = "\n\n".join(context_parts)
    
    prompt = f"""
You are a knowledgeable AI assistant for an e-commerce application.
Use the following context to answer the query accurately.
If the query is about how to use the application, provide step-by-step instructions.
If the query is about database or technical details, provide precise technical information.
If the context does not provide enough information, indicate that and suggest what information might help.

Today's date: {datetime.datetime.now().strftime('%B %d, %Y')}

Context:
{context}

Query:
{query}

Answer:
"""
    try:
        response = gemini_model.generate_content(prompt)
        
        if hasattr(response, "text"):
            response_text = response.text.strip()
            
            return {"response": response_text}
        else:
            return {"error": "Invalid response format from Google Vertex AI"}
    except Exception as e:
        print(f"Error generating response: {e}")
        return {"error": f"Failed to generate response: {str(e)}"}

def scheduled_refresh():
    while True:
        try:
            print("Performing scheduled refresh of vector store...")
            refresh_data_and_update_vector_store()
            print("Scheduled refresh completed")
        except Exception as e:
            print(f"Error in scheduled refresh: {e}")
        
        time.sleep(3600)

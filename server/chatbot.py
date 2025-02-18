import os
import datetime
from dbConfig import connect_db
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_chroma import Chroma
from langchain.schema import Document
from google.cloud import aiplatform
from langchain_google_vertexai import VertexAIEmbeddings
import pandas as pd
from gemini_config import gemini_model

load_dotenv()
db = connect_db()
inventory_collection = db["inventory"]
feedback_collection = db["feedback"]
orders_collection = db["orders"]
customers_collection = db["customers"]

PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\Users\vedan\Downloads\EmailAutomation\server\fresh-airfoil-445517-q1-0df53973cc7e.json"
aiplatform.init(project=PROJECT_ID, location="us-central1")
embeddings = VertexAIEmbeddings(model="text-embedding-004", project=PROJECT_ID)

customers = list(customers_collection.find({}, {"_id": 0}))
inventory = list(inventory_collection.find({}, {"_id": 0}))
orders = list(orders_collection.find({}, {"_id": 0}))
feedback = list(feedback_collection.find({}, {"_id": 0}))

df = pd.DataFrame(customers + inventory + orders + feedback)

def load_pdf(file_path):
    loader = PyPDFLoader(file_path)
    pages = loader.load()
    return [page.page_content for page in pages]

pdf_texts = load_pdf(r"C:\Users\vedan\Downloads\EmailAutomation\server\attachments\business report.pdf")

def build_records():
    records = []
    
    for idx, record in df.iterrows():
        rec = {
            "id": f"record_{idx}",
            "text": str(record.to_dict()),
            "source": "database",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        records.append(rec)
    
    for idx, text in enumerate(pdf_texts):
        rec = {
            "id": f"pdf_{idx}",
            "text": text,
            "source": "pdf",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        records.append(rec)
    return records

all_records = build_records()

def build_documents(records):
    docs = []
    for rec in records:
        # Here you can also add logic to chunk long texts if necessary
        docs.append(Document(
            page_content=rec["text"],
            metadata={
                "id": rec["id"],
                "source": rec["source"],
                "timestamp": rec["timestamp"]
            }
        ))
    return docs

docs = build_documents(all_records)

vector_store = Chroma(
    collection_name="customer",
    embedding_function=embeddings,
    persist_directory="./chroma_langchain_db",
)

def upsert_documents(new_docs):
    """
    Upsert documents into the vector store. This function assumes that your vector
    store library supports an upsert method. If not, you may need to implement logic
    to check for existing docs and update them accordingly.
    """
    try:
        vector_store.add_documents(new_docs)
    except Exception as e:
        print("Error during upsert:", e)

upsert_documents(docs)

def retrieve_similar_docs(query, k=5):
    if not vector_store:
        return []
    return vector_store.similarity_search(query, k=k)

def ask_bot(query):
    relevant_docs = retrieve_similar_docs(query, k=5)
    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    
    prompt = f"""
You are a knowledgeable and precise AI assistant.
Use the following context to answer the query accurately.
If the context does not provide enough information, indicate that and ask for clarification.

Context:
{context}

Query:
{query}

Answer:
"""
    response = gemini_model.generate_content(prompt)
    
    if hasattr(response, "text"):
        return {"response": response.text.strip()}
    else:
        return {"error": "Invalid response format from Google Vertex AI"}
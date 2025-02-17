import os
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

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\Users\vedan\Downloads\EmailAutomation\server\fresh-airfoil-445517-q1-0df53973cc7e.json"

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
all_texts = df.to_dict(orient="records") + [{"text": text} for text in pdf_texts]

PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
aiplatform.init(project=PROJECT_ID, location="us-central1")

embeddings = VertexAIEmbeddings(model="text-embedding-004", project=PROJECT_ID)
docs = [Document(page_content=record.get("text", str(record))) for record in all_texts]

vector_store = Chroma(
    collection_name="customer",
    embedding_function=embeddings,
    persist_directory="./chroma_langchain_db",
)
vector_store.add_documents(docs)

def retrieve_similar_docs(query):
    if not vector_store:
        return []
    return vector_store.similarity_search(query, k=5)

def ask_bot(query):
    relevant_docs = retrieve_similar_docs(query)

    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    prompt = f"""
    You are a helpful AI assistant. Answer the query based on the provided context.

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


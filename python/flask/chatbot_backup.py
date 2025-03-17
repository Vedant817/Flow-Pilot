import os
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from google.cloud import aiplatform
from langchain_google_vertexai import VertexAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain.schema import Document
import numpy as np
import faiss
from langchain.storage import InMemoryStore
from langchain.storage._lc_store import LocalIndexStore

# ✅ Load environment variables
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"D:\Deloitte\Prototype\python\services\fresh-airfoil-445517-q1-0df53973cc7e.json"
PROJECT_ID = "your-google-cloud-project-id"
LOCATION = "us-central1"

# ✅ Initialize Google Cloud Vertex AI
aiplatform.init(project=PROJECT_ID, location=LOCATION)
embeddings = VertexAIEmbeddings(model="text-embedding-004", project=PROJECT_ID)

# ✅ Flask App Initialization
app = Flask(__name__)

# ✅ FAISS Vector Store Setup
index = faiss.IndexFlatL2(768)  # Adjust for your embedding dimension
docstore = InMemoryStore()  # In-memory storage for document contents
index_to_docstore_id = LocalIndexStore()  # Mapping of FAISS indices to document IDs

vector_store = FAISS(
    embedding_function=embeddings,
    index=index,
    docstore=docstore,
    index_to_docstore_id=index_to_docstore_id
)

# ✅ Process PDF and Extract Text
def process_pdf(pdf_path):
    print("\n📌 Processing PDF:", pdf_path)
    try:
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
        pdf_texts = text_splitter.split_documents(documents)

        docs = []
        for i, doc in enumerate(pdf_texts):
            metadata = {
                "id": f"pdf_chunk_{i}",
                "source": "User Manual",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "priority": "high"
            }
            docs.append(Document(page_content=doc.page_content, metadata=metadata))

        return docs
    except Exception as e:
        print("❌ Error processing PDF:", e)
        return []

# ✅ Store Documents in FAISS
def upsert_documents(new_docs):
    try:
        new_texts = [doc.page_content for doc in new_docs]
        new_embeddings = embeddings.embed_documents(new_texts)

        # Convert to FAISS-compatible format
        new_embeddings_np = np.array(new_embeddings).astype("float32")
        vector_store.index.add(new_embeddings_np)

        # Store documents in docstore
        for i, doc in enumerate(new_docs):
            doc_id = f"doc_{i}"
            vector_store.docstore.mset({doc_id: doc})
            vector_store.index_to_docstore_id.mset({i: doc_id})

        print(f"✅ Added {len(new_docs)} new documents to FAISS memory.")
    except Exception as e:
        print("❌ Error during FAISS upsert:", e)

# ✅ Retrieve Similar Documents
def retrieve_similar_docs(query, k=5):
    try:
        query_embedding = embeddings.embed_query(query)
        query_embedding_np = np.array([query_embedding]).astype("float32")

        D, I = vector_store.index.search(query_embedding_np, k)  # FAISS search
        print("\n🔍 FAISS Retrieved Indices:", I)

        retrieved_docs = []
        for idx in I[0]:
            doc_id = vector_store.index_to_docstore_id.get(str(idx))
            if doc_id:
                retrieved_docs.append(vector_store.docstore.get(doc_id))

        return retrieved_docs
    except Exception as e:
        print("❌ Error in FAISS search:", e)
        return []

# ✅ API Route to Refresh Data and Store in FAISS
@app.route("/refresh-data", methods=["POST"])
def refresh_data():
    pdf_docs = process_pdf(r"D:\Deloitte\Prototype\python\attachments\User Mannual.pdf")  # Update path
    upsert_documents(pdf_docs)
    return jsonify({"message": "Data refreshed and stored in FAISS."})

# ✅ API Route for Searching
@app.route("/search", methods=["POST"])
def search():
    query = request.json.get("query", "")
    results = retrieve_similar_docs(query)
    return jsonify({"results": [doc.page_content for doc in results]})

# ✅ Run the Flask App
if __name__ == "__main__":
    app.run(debug=True)

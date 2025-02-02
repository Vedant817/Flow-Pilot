from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')

DATABASE_NAME = "store_db"
collections = ["orders", "inventory"]

def connect_db():
    """Establishes a connection to the MongoDB database and returns the database instance."""
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[DATABASE_NAME]
    
    existing_collections = db.list_collection_names()
    for collection in collections:
        if collection not in existing_collections:
            db.create_collection(collection)
            print(f"Collection '{collection}' created")
    
    print("Database connected")
    return db
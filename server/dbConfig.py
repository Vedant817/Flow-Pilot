from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')

DATABASE_NAME = "store_db"
collections = ["orders", "inventory"]

sample_inventory = [
    {"item": "iPhone", "quantity": 10, "price": 999},
    {"item": "Samsung", "quantity": 15, "price": 799},
    {"item": "MacBook", "quantity": 5, "price": 1299}
]

def connect_db():
    """Establishes a connection to the MongoDB database and returns the database instance."""
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[DATABASE_NAME]
    
    existing_collections = db.list_collection_names()
    for collection in collections:
        if collection not in existing_collections:
            db.create_collection(collection)

    inventory_collection = db['inventory']
    if inventory_collection.count_documents({}) == 0:
        inventory_collection.insert_many(sample_inventory)
    
    print("Database connected")
    return db
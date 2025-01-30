from pymongo import MongoClient
import os
from dotenv import load_dotenv
load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')
DATABASE_NAME = "store_db"
COLLECTION_NAME = "inventory"

mongo_client = MongoClient(MONGO_URI)
db = mongo_client[DATABASE_NAME]
inventory_collection = db[COLLECTION_NAME]
order_collection = db["orders"]

dummy_inventory = [
    {"product": "iPhone 15", "quantity": 5},
    {"product": "MacBook Pro", "quantity": 2},
    {"product": "iPad Air", "quantity": 10},
]

dummy_orders = [
    {"product": "iPhone 15", "quantity": 3},
    {"product": "MacBook Pro", "quantity": 2},
    {"product": "iPad Air", "quantity": 5},
]

# inventory_collection.insert_many(dummy_inventory)


# ordder file
from ai21 import AI21Client
from ai21.models.chat import UserMessage
import json
from config.dbConfig import db
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from email_config.send_emails import send_acknowledgment, send_order_update_confirmation, send_order_issue_email
from config.gemini_config import gemini_model
import re
from pymongo import DESCENDING
from error_handle import handle_exception

load_dotenv()
API_KEY = os.getenv("AI21KEY")

client = AI21Client(api_key=API_KEY)
order_collection = db['orders']
inventory_collection = db['inventory']
customers_collection = db['customers']

def fetch_inventory_items():
    inventory_items = inventory_collection.find({}, {"_id": 0, "name": 1})
    return {item["name"] for item in inventory_items}

def correct_product_names(order_details, inventory_items):
    try:
        inventory_list = "\n".join(inventory_items)
        orders_list = "\n".join([f"- {order['product']}" for order in order_details])
        
        prompt = f"""
        Here is our inventory list:
        {inventory_list}

        And here are the ordered products:
        {orders_list}

        For each ordered product, find the closest matching product from our inventory.
        Return only the corrected product names, one per line.
        """

        response = gemini_model.generate_content(prompt)
        ai_response = response.text.strip()

        corrected_product_names = [name.lstrip("- ").strip() for name in ai_response.split("\n") if name.strip()]

        corrected_orders = []
        for i, order in enumerate(order_details):
            if i < len(corrected_product_names):
                corrected_orders.append({
                    "product": corrected_product_names[i],
                    "quantity": order["quantity"]
                })
            else:
                corrected_orders.append(order)

    except Exception as e:
        handle_exception(e)
        print(f"Error correcting product names: {e}")
        corrected_orders = order_details

    print('Corrected Orders:', corrected_orders)
    return corrected_orders

def validate_order_details_ai(order_details):
    prompt = f"""
    You are an AI assistant validating order details.
    Your task is to check if the order contains incomplete, incorrect, or unclear details.

    **Validation Criteria:**
    - Ensure that each item has a product name and quantity.
    - The price is not required.
    - If any required detail is missing or unclear, list it as an error.

    **Order Details:**
    {json.dumps(order_details, indent=2)}

    **Expected JSON Output (Strict Format, No Explanation):**
    {{
        "valid": true/false,
        "errors": ["Missing quantity for product X"]
    }}
    """

    try:
        response = gemini_model.generate_content(prompt)
        ai_response = response.text.strip()

        clean_response = re.sub(r"```json|```", "", ai_response).strip()

        try:
            validation_result = json.loads(clean_response)
            return validation_result.get("valid", False), validation_result.get("errors", [])
        except json.JSONDecodeError as e:
            return False, [f"Invalid AI response format. JSON Parsing Error: {str(e)}"]

    except Exception as e:
        return False, [f"System error while validating order: {str(e)}"]

def extract_order_details_ai(email_text):
    messages = [
        UserMessage(
            content=f"""
            You are an AI assistant extracting order details from an email.
            Extract and return only in JSON format:

            **Email:**
            "{email_text}"

            **Expected JSON Output:**
            {{
                "orders": [
                    {{"product": "Product Name", "quantity": Number}}
                ]
            }}
            """
        )
    ]
    try:
        response = client.chat.completions.create(
            model="jamba-1.5-large",
            messages=messages,
            top_p=1.0
        )
        result = response.model_dump()
        
        if "choices" in result and result["choices"]:
            content_str = result["choices"][0]["message"]["content"]
            extracted_orders = json.loads(content_str)
            return extracted_orders.get("orders", [])
        else:
            print("Error: No choices found in API response.")
            return []
    except Exception as e:
        handle_exception(e)
        print(f"Error extracting order details: {e}")
        return []

def check_inventory(order_details):
    for order in order_details:
        product = order["product"]
        quantity = order["quantity"]

        inventory_item = inventory_collection.find_one({"name": product})
        if not inventory_item or inventory_item["quantity"] < quantity:
            return False

    return True

def get_customer_from_db(email):
    return customers_collection.find_one({"email": email})

def add_orders_to_collection(email, date, time, customer_details, order_details):
    try:
        inventory_items = fetch_inventory_items()
        corrected_orders = correct_product_names(order_details, inventory_items)
        unknown_products = [
            order["product"] for order in corrected_orders if order["product"] not in inventory_items
        ]

        if unknown_products:
            print('Unknown products found. Order not added.')
            return None
        
        try:
            order_datetime = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M:%S")
            five_mins_ago = order_datetime - timedelta(minutes=5)
        except ValueError as e:
            handle_exception(e)
            print(f"Error parsing date and time: {e}")
            return None

        try:
            existing_order = order_collection.find_one({
                "email": email,
                "$and": [
                    {"date": date},
                    {
                        "$or": [
                            {"time": {"$gte": five_mins_ago.strftime("%H:%M:%S"), 
                                        "$lte": order_datetime.strftime("%H:%M:%S")}},
                            {"time": {"$gte": "23:55:00"}} 
                        ]
                    }
                ],
                "products": {
                    "$size": len(corrected_orders),
                    "$all": [
                        {"$elemMatch": {
                            "name": item["product"],
                            "quantity": item["quantity"]
                        }} for item in corrected_orders
                    ]
                }
            })

            if existing_order:
                send_order_issue_email(email, [" A duplicate order was detected within the last few minutes. Please confirm if this was an accidental duplicate order if you intended to reorder it."])
                return None
        except Exception as e:
            print(f"Error checking for duplicate order: {e}")
            handle_exception(e)
            return None

        try:
            can_fulfill = check_inventory(order_details=corrected_orders)
            if not can_fulfill:
                formatted_entry = {
                    "name": customer_details['name'],
                    "phone": customer_details['phone'],
                    "email": email,
                    "date": date,
                    "time": time,
                    "products": [{"name": item["product"], "quantity": item["quantity"]} for item in corrected_orders],
                    "status": "pending inventory",
                    "orderLink": ""
                }
                
                result = order_collection.insert_one(formatted_entry)
                order_id = str(result.inserted_id)
                
                order_collection.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {"orderLink": f"http://localhost:3000/track-order/{order_id}"}}
                )
                
                print("Order added with pending inventory status.")
                send_acknowledgment(formatted_entry, message="Some items are currently out of stock, which may delay your order. Would you still like to proceed or cancel it?", customer_subject="Query Mail")
                return order_id
        except Exception as e:
            print(f"Error checking inventory or adding pending order: {e}")
            handle_exception(e)
            return None

        try:
            formatted_entry = {
                "name": customer_details['name'],
                "phone": customer_details['phone'],
                "email": email,
                "date": date,
                "time": time,
                "products": [{"name": item["product"], "quantity": item["quantity"]} for item in corrected_orders],
                "status": "pending fulfillment",
                "orderLink": ""
            }
            
            result = order_collection.insert_one(formatted_entry)
            order_id = str(result.inserted_id)
            
            order_collection.update_one(
                {"_id": result.inserted_id},
                {"$set": {"orderLink": f"http://localhost:3000/track-order/{order_id}"}}
            )
            
            for item in corrected_orders:
                inventory_collection.update_one(
                    {"item": item["product"]},
                    {"$inc": {"quantity": -item["quantity"]}}
                )
            
            print('Order added and inventory updated.')
            send_acknowledgment(formatted_entry)
            return order_id
        except Exception as e:
            print(f"Error adding order or updating inventory: {e}")
            handle_exception(e)
            # If we've gotten this far but failed, try to rollback any inventory changes
            try:
                if 'result' in locals() and result and result.inserted_id:
                    order_collection.delete_one({"_id": result.inserted_id})
                    print("Rolled back order insertion due to error.")
            except Exception as rollback_error:
                print(f"Error during rollback: {rollback_error}")
                handle_exception(e)
            return None
            
    except Exception as e:
        print(f"Unexpected error in add_orders_to_collection: {e}")
        handle_exception(e)
        return None

def validate_customer_details_ai(email, customer_details):
    """
    Use AI to validate if all required customer details are present.
    Returns a tuple of (is_valid, missing_fields, customer_details)
    """
    try:
        # If customer_details is None, create an empty dict to avoid errors
        if not customer_details:
            customer_details = {}
            
        prompt = f"""
        You are an AI assistant validating customer details for an order.
        Your task is to check if all required customer information is present.

        **Validation Criteria:**
        - Required fields: name, email, phone, address
        - Each field should have a non-empty value
        - If any required field is missing or empty, list it as a missing field

        **Customer Details:**
        {json.dumps(customer_details, indent=2)}

        **Expected JSON Output (Strict Format, No Explanation):**
        {{
            "valid": true/false,
            "missing_fields": ["field1", "field2"]
        }}
        """

        response = gemini_model.generate_content(prompt)
        ai_response = response.text.strip()

        clean_response = re.sub(r"``````", "", ai_response).strip()

        try:
            validation_result = json.loads(clean_response)
            return validation_result.get("valid", False), validation_result.get("missing_fields", []), customer_details
        except json.JSONDecodeError as e:
            return False, ["Error validating customer details"], customer_details

    except Exception as e:
        handle_exception(e)
        print(f"Error validating customer details: {e}")
        return False, ["System error while validating customer details"], customer_details

def process_order_details(email, date, time, order_details):
    customer_details = order_details.get("customer", None)
    print('Customer Details: ', customer_details)
    orders = order_details.get("orders", None)

    if not orders:
        print("No order details found in email.")
        send_order_issue_email(email, ["No order details were found in your email. Please send a valid order."])
        return

    is_valid, errors = validate_order_details_ai(orders)
    if not is_valid:
        # print("Order details are invalid. Sending issue email.")
        # send_order_issue_email(email, errors)
        return

    existing_customer = get_customer_from_db(email)
    customer_id = None

    # Check if customer exists in database
    if not existing_customer:
        # Validate customer details using AI
        is_valid, missing_fields, customer_details = validate_customer_details_ai(email, customer_details)
        
        if not is_valid:
            # print(f"Incomplete customer details: {missing_fields}")
            error_message = [
                f"We could not find your details in our system, and the following information is missing: {', '.join(missing_fields)}. "
                f"Please provide your complete details (name, email, phone, and address) to process your order."
            ]
            send_order_issue_email(email, error_message)
            return
        
        # Create new customer if all details are valid
        new_customer = {
            "name": customer_details["name"],
            "email": customer_details["email"],
            "phone": customer_details["phone"],
            "address": customer_details["address"],
            "past_orders": [],
            "created_at": datetime.utcnow()
        }
        result = customers_collection.insert_one(new_customer)
        customer_id = result.inserted_id
        print("New customer created successfully.")
    else:
        customer_id = existing_customer["_id"]
        
        # If customer exists but some details are missing in the current order
        if not customer_details:
            customer_details = {
                "name": existing_customer.get("name", ""),
                "email": existing_customer.get("email", ""),
                "phone": existing_customer.get("phone", ""),
                "address": existing_customer.get("address", "")
            }
        else:
            # Validate if the provided customer details are complete
            is_valid, missing_fields, customer_details = validate_customer_details_ai(email, customer_details)
            
            if not is_valid:
                # Fill in missing fields from existing customer record  
                for field in missing_fields:
                    if field in existing_customer and existing_customer[field]:
                        customer_details[field] = existing_customer[field]
                
                # Check if any fields are still missing
                is_valid, still_missing, _ = validate_customer_details_ai(email, customer_details)
                if not is_valid:
                    print(f"Still missing customer details: {still_missing}")
                    error_message = [
                        f"Your order is missing the following information: name, phone and address. "
                        f"Please provide these details to complete your order."
                    ]
                    send_order_issue_email(email, error_message)
                    return

    order_id = add_orders_to_collection(email, date, time, customer_details, orders)
    
    if order_id:
        # Update to include more order details in past_orders
        order_summary = {
            "order_id": order_id,
            "date": date,
            "time": time,
            "products": orders,
            "status": "pending fulfillment"
        }
        
        customers_collection.update_one(
            {"_id": customer_id},
            {"$push": {"past_orders": order_summary}}
        )
        print(f"Order {order_id} processed successfully.")
    else:
        print("Order processing failed.")

def process_order_change(email, date, time, order_details):
    print('Processing order change...')
    try:
        
        latest_order = order_collection.find_one({"email": email}, sort=[("date", DESCENDING), ("time", DESCENDING)])
        if not latest_order:
            process_order_details(email, date, time, order_details)
            return

        if latest_order.get("status") not in ["pending fulfillment", "partially fulfilled"]:
            process_order_details(email, date, time, order_details)
            return
        
        previous_order = {
            "_id": latest_order["_id"],
            "products": latest_order["products"].copy(),
            "date": latest_order["date"],
            "time": latest_order["time"]
        }
        
        updated_products = get_ai_order_updates(latest_order, order_details)
        
        order_collection.update_one(
            {"_id": latest_order["_id"]},
            {"$set": {"products": updated_products}}
        )
        
        updated_order = order_collection.find_one({"_id": latest_order["_id"]})
        send_order_update_confirmation(email, latest_order=updated_order, previous_order=previous_order)
    
    except Exception as e:
        handle_exception(e)
        print(f"Error updating order: {e}")
        send_order_issue_email(email, ["An error occurred while updating your order."])

def get_ai_order_updates(previous_order, new_order_details):
    """
    Use AI to intelligently merge the previous order with the new order details.
    Handles cases of adding new items, modifying quantities, and removing items.
    """
    try:
        previous_products = previous_order.get("products", [])
        previous_products_formatted = json.dumps(previous_products, indent=2)
        
        new_products = new_order_details.get("orders", [])
        new_products_formatted = json.dumps(new_products, indent=2)
        
        prompt = f"""
        You are an AI assistant helping with order updates.
        
        PREVIOUS ORDER:
        {previous_products_formatted}
        
        REQUESTED CHANGES:
        {new_products_formatted}
        
        Analyze these changes and determine the appropriate action for each item:
        1. If an item in the requested changes already exists in the previous order, update its quantity accordingly.
        2. If an item in the requested changes doesn't exist in the previous order, add it as a new item.
        3. If the requested changes specify a quantity of 0 for an existing item, remove it from the order.
        4. If an item in the previous order isn't mentioned in the requested changes, keep it unchanged.
        
        Return ONLY a valid JSON array of the updated products in this exact format:
        [
            {{"name": "Product Name", "quantity": Number}}
        ]
        """
        
        response = gemini_model.generate_content(prompt)
        ai_response = response.text.strip()
        
        clean_response = re.sub(r"``````", "", ai_response).strip()
        
        try:
            updated_products = json.loads(clean_response)
            return updated_products
        except json.JSONDecodeError as e:
            print(f"Error parsing AI response: {e}")
            return merge_orders_fallback(previous_order, new_order_details)
            
    except Exception as e:
        print(f"Error in AI order update: {e}")
        handle_exception(e)
        return merge_orders_fallback(previous_order, new_order_details)

def merge_orders_fallback(previous_order, new_order_details):
    existing_products = {item["name"]: item["quantity"] for item in previous_order.get("products", [])}
    
    for new_item in new_order_details.get("orders", []):
        product_name = new_item["product"]
        quantity = new_item["quantity"]
        
        if quantity == 0 and product_name in existing_products:
            del existing_products[product_name]
        elif product_name in existing_products:
            existing_products[product_name] = quantity
        else:
            existing_products[product_name] = quantity

    return [{"name": name, "quantity": qty} for name, qty in existing_products.items()]

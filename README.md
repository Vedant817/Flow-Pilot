# 🚀 Automatic Order Processing System  

## 📌 Overview  
The **Automatic Order Processing System** provides a centralized dashboard for managing orders, inventory, analytics, errors, feedback, and chatbot interactions. It streamlines order tracking, inventory management, analytics monitoring, error logging, and customer interactions through a user-friendly interface.  

## 🔥 Features  
- **Order Management**: Track, search, and manage orders efficiently.  
- **Inventory Control**: Monitor stock levels, predict demand, and adjust prices dynamically.  
- **Analytics Dashboard**: Gain insights into sales, customer trends, and product performance.  
- **Error Logs**: Identify and troubleshoot system and customer-related errors.  
- **Feedback Monitoring**: Analyze customer sentiments for service improvements.  
- **AI-Powered Chatbot**: Retrieve order, inventory, and analytics data via a chatbot interface.  

## 📂 Dashboard Sections  

### 📦 Orders Tab  
- **Order Tracking & Management**: View order details, statuses (Fulfilled, Pending, Canceled).  
- **Search & Filtering**: Search by Order ID or Customer Name.  
- **Order Status Monitoring**: Update order statuses as needed.  
- **Pagination Support**: Navigate through large datasets with ease.  

### 📊 Inventory Tab  
- **Product Details**: Track inventory with key attributes (Product ID, Name, Price, Quantity, Supplier, etc.).  
- **Stock Management**: View total products, low-stock alerts, and inventory value.  
- **Forecasting & Dynamic Pricing**: Predict demand and adjust prices accordingly.  
- **Deadstock Analysis**: Identify slow-moving or obsolete products.  

### 📈 Analytics Tab  
- **Customer Insights**: Analyze order trends, top spenders, and frequent buyers.  
- **Product Performance**: View best/worst selling products and revenue trends.  
- **Feedback Sentiment Analysis**: Monitor customer satisfaction via pie charts.  

### 💬 Feedback Tab  
- **Review Categorization**: Automatically classify reviews as Positive, Neutral, or Negative.  
- **Search & Filter Reviews**: Search by email, content, or sentiment.  
- **Customer Sentiment Trends**: Track changes in customer satisfaction.  

### ⚠️ Errors Tab  
- **System & Customer Errors**: Categorize errors based on source and severity.  
- **Search & Filter**: Find specific errors for debugging.  
- **Error Log Analysis**: Track timestamps, severity levels (Critical, Medium, Low).  

### 🤖 Chatbot Tab  
- **AI-Powered Assistance**: Retrieve order, inventory, and analytics information.  
- **Instant Responses & Voice Input**: Query data using text or voice commands.  
- **Chat History & Clear Chat**: Maintain recent interactions for reference.  
 
## 🛠️ Installation  

Follow these steps to set up and run the **Automatic Order Processing System** locally:  

### 1️⃣ Clone the Repository  
```bash
git clone https://github.com/KumarShresth7/EmailAutomation.git
cd EmailAutomation
```
### 2️⃣ Frontend  
```bash
cd frontend
npm install --force
npm run dev
```
### 3️⃣ Server
```bash 
cd ../server
python -m venv venv
source venv/bin/activate
venv\Scripts\activate
pip install -r requirements.txt
python main.py
python chatbot.py
```
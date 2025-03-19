from fpdf import FPDF
import datetime

def generate_invoice(order):
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    pdf.set_font("Arial", style="B", size=16)
    pdf.cell(200, 10, "INVOICE", ln=True, align="C")
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, "Your Company Name", ln=True, align="C")
    pdf.cell(200, 10, "123 Business Street, City, Country", ln=True, align="C")
    pdf.cell(200, 10, "Email: sales@yourcompany.com | Phone: (123) 456-7890", ln=True, align="C")
    
    pdf.ln(10)
    
    pdf.set_font("Arial", style="B", size=12)
    pdf.cell(100, 10, "INVOICE DETAILS:", ln=True)
    pdf.set_font("Arial", size=10)
    pdf.cell(30, 10, "Invoice #:", 0)
    pdf.cell(70, 10, str(order.get("_id", "")), ln=True)
    pdf.cell(30, 10, "Date:", 0)
    pdf.cell(70, 10, order.get("date", ""), ln=True)
    pdf.cell(30, 10, "Time:", 0)
    pdf.cell(70, 10, order.get("time", ""), ln=True)
    
    pdf.ln(5)
    pdf.set_font("Arial", style="B", size=12)
    pdf.cell(100, 10, "BILL TO:", ln=True)
    pdf.set_font("Arial", size=10)
    pdf.cell(30, 10, "Name:", 0)
    pdf.cell(70, 10, order.get("name", ""), ln=True)
    pdf.cell(30, 10, "Email:", 0)
    pdf.cell(70, 10, order.get("email", ""), ln=True)
    pdf.cell(30, 10, "Phone:", 0)
    pdf.cell(70, 10, order.get("phone", ""), ln=True)
    
    pdf.ln(10)
    
    pdf.set_font("Arial", style="B", size=10)
    pdf.cell(80, 10, "Product", border=1)
    pdf.cell(30, 10, "Quantity", border=1, align="C")
    pdf.cell(40, 10, "Unit Price", border=1, align="C")
    pdf.cell(40, 10, "Total", border=1, align="C", ln=True)
    
    pdf.set_font("Arial", size=10)
    total_amount = 0
    
    price_map = {
        "Samsung Galaxy Watch 6": 19999.00,
        "iPhone 15 Pro": 109900.00,
        "Sony WH-1000XM5": 31990.00
    }
    
    usd_conversion_rate = 83.0
    
    for item in order.get("products", []):
        product_name = item.get("name", "")
        quantity = item.get("quantity", 0)
        
        inr_price = price_map.get(product_name, 0)
        if item.get("price"):
            price = item.get("price")
        else:
            price = round(inr_price / usd_conversion_rate, 2)
            
        item_total = quantity * price
        total_amount += item_total
        
        pdf.cell(80, 10, product_name, border=1)
        pdf.cell(30, 10, str(quantity), border=1, align="C")
        pdf.cell(40, 10, f"Rs.{price:.2f}", border=1, align="C")
        pdf.cell(40, 10, f"Rs.{item_total:.2f}", border=1, align="C", ln=True)
    
    pdf.set_font("Arial", style="B", size=10)
    pdf.cell(150, 10, "Total Amount:", border=1, align="R")
    pdf.cell(40, 10, f"Rs.{total_amount:.2f}", border=1, align="C", ln=True)
    
    pdf.ln(10)
    
    pdf.set_font("Arial", style="B", size=10)
    pdf.cell(200, 10, "Payment Information:", ln=True)
    pdf.set_font("Arial", size=10)
    pdf.multi_cell(190, 10, "Please use the payment link provided in the email to complete your payment.")
    
    pdf.ln(5)
    pdf.set_font("Arial", style="B", size=10)
    pdf.cell(200, 10, "Notes:", ln=True)
    pdf.set_font("Arial", size=10)
    pdf.multi_cell(190, 10, "Thank you for your business! If you have any questions about this invoice, please contact our customer support.")
    
    order_id = str(order.get("_id", ""))
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    invoice_path = f"invoice_{order_id}_{timestamp}.pdf"
    pdf.output(invoice_path)
    
    return invoice_path

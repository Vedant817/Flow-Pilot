from fpdf import FPDF
import datetime

def generate_invoice(order):
    """
    Generates a PDF invoice for the given order.
    """
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Title
    pdf.set_font("Arial", style="B", size=16)
    pdf.cell(200, 10, "Invoice", ln=True, align="C")

    # Order & Customer Details
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, f"Date: {order['date']}", ln=True)
    pdf.cell(200, 10, f"Time: {order['time']}", ln=True)
    pdf.cell(200, 10, f"Customer Email: {order['email']}", ln=True)
    pdf.cell(200, 10, f"Order Status: {'Fulfilled' if order['can_fulfill'] else 'Not Fulfilled'}", ln=True)

    pdf.ln(10)  # Space before table

    # Table Headers
    pdf.set_font("Arial", style="B", size=12)
    pdf.cell(80, 10, "Product", border=1)
    pdf.cell(40, 10, "Quantity", border=1, ln=True)

    # Table Data
    pdf.set_font("Arial", size=12)
    for item in order["products"]:
        pdf.cell(80, 10, item["product"], border=1)
        pdf.cell(40, 10, str(item["quantity"]), border=1, ln=True)
    
    pdf.ln(10)  # Space before closing message
    pdf.cell(200, 10, "Thank you for your order!", ln=True, align="C")

    # Save invoice PDF
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    invoice_path = f"invoice_{order['email'].split('@')[0]}_{timestamp}.pdf"
    pdf.output(invoice_path)
    
    return invoice_path
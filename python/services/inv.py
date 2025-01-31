from fpdf import FPDF
import datetime

def generate_invoice(orders, recipient_email):
    """
    Generates a PDF invoice for the order.
    """
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Title
    pdf.set_font("Arial", style="B", size=16)
    pdf.cell(200, 10, "Invoice", ln=True, align="C")
    
    # Invoice Details
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, f"Date: {datetime.datetime.now().strftime('%Y-%m-%d')}", ln=True)
    pdf.cell(200, 10, f"Customer Email: {recipient_email}", ln=True)
    
    pdf.ln(10)  # Space before table

    # Table Headers
    pdf.set_font("Arial", style="B", size=12)
    pdf.cell(80, 10, "Product", border=1)
    pdf.cell(40, 10, "Quantity", border=1, ln=True)

    # Table Data
    pdf.set_font("Arial", size=12)
    for order in orders:
        pdf.cell(80, 10, order["product"], border=1)
        pdf.cell(40, 10, str(order["quantity"]), border=1, ln=True)
    
    pdf.ln(10)  # Space before closing
    pdf.cell(200, 10, "Thank you for your order!", ln=True, align="C")

    # Save invoice PDF
    invoice_path = f"invoice_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    pdf.output(invoice_path)
    
    return invoice_path

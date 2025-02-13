import dns.resolver
import re

def is_email_phishy(email, message):
    """Check if an email looks phishy based on various criteria."""
    
    phishing_keywords = ["urgent", "verify your account", "password", "login", "click here"]
    suspicious_url_pattern = re.compile(r'https?://\d+\.\d+\.\d+\.\d+')

    try:
        domain = email.split('@')[1]
        
        # Check if the domain has MX records
        try:
            answers = dns.resolver.resolve(domain, 'MX')
            has_mx_record = bool(answers)
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.Timeout):
            has_mx_record = False

        # Check for phishing keywords in the message
        keyword_alert = any(keyword in message.lower() for keyword in phishing_keywords)

        # Check for suspicious URLs (IP-based links)
        suspicious_url_alert = bool(suspicious_url_pattern.search(message))

        # Determine phishing risk
        if not has_mx_record:
            return {"status": "Phishy", "reason": "Invalid email domain (no MX record found)"}
        elif keyword_alert:
            return {"status": "Phishy", "reason": "Contains phishing keywords"}
        elif suspicious_url_alert:
            return {"status": "Phishy", "reason": "Contains suspicious URLs"}
        else:
            return {"status": "Safe", "reason": "No phishing indicators detected"}

    except IndexError:
        return {"status": "Invalid", "reason": "Invalid email format"}

# Example usage:
email = "test@dyghjfgvfhiufh.com"
message = "I want to order 5 iPhones and 2 MACBooks"
result = is_email_phishy(email, message)
print(result)

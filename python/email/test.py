import requests

# Replace with your values
CLIENT_ID = "373768242257-jjaifs7slbeds8afr07f1q8pptm2bmva.apps.googleusercontent.com"
CLIENT_SECRET = "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"
AUTHORIZATION_CODE = "4/0ASVgi3LwzNOie_L6S0qdGkMY9rmDOrZ3pAm56E7CmMDYJZMFmgh_NkaWiQ6Ja11T-5Mpyg"
REDIRECT_URI = "http://localhost"

# Prepare data for the POST request
data = {
    "code": AUTHORIZATION_CODE,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri": REDIRECT_URI,
    "grant_type": "authorization_code"
}

# Make the POST request to exchange the code for tokens
response = requests.post("https://oauth2.googleapis.com/token", data=data)

# Parse the response
tokens = response.json()

# Access token and refresh token
access_token = tokens.get("access_token")
refresh_token = tokens.get("refresh_token")

print("Access Token:", access_token)
print("Refresh Token:", refresh_token)

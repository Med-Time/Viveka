import requests
import os
import dotenv
# from tomlkit import key

# Ensure env vars are loaded if this is run in isolation
dotenv.load_dotenv()

def search_google_images(query):
    api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
    cx = os.getenv("GOOGLE_CX")
    
    if not api_key or not cx:
        print("❌ CONFIG ERROR: Missing GOOGLE_SEARCH_API_KEY or GOOGLE_CX in .env")
        return None

    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "q": query,
        "cx": cx,
        "searchType": "image",
        "num": 1,
        "key": api_key,
        "safe": "active"
    }
    
    try:
        res = requests.get(url, params=params)
        
        # --- DEBUGGING BLOCK ---
        if res.status_code != 200:
            print(f"\n⚠️ GOOGLE API ERROR: {res.status_code}")
            print(f"   Response: {res.text}\n")
            return None
        # -----------------------

        data = res.json()
        if "items" in data:
            return data["items"][0]["link"]
        else:
            print(f"⚠️ GOOGLE: No items found for '{query}'.")
            return None
            
    except Exception as e:
        print(f"❌ NETWORK ERROR: {e}")
        return None
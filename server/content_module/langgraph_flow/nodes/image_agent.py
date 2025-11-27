import re
import logging
from ...core.image_search import search_google_images

# Setup logger for terminal visibility
logger = logging.getLogger("uvicorn.error")

def fetch_images_node(state):
    """
    Node that scans generated content for image placeholders
    and replaces them with actual image URLs from Google Search.
    """
    print("\n\n==================================================")
    print("📸 IMAGE FETCHING NODE STARTED")
    print("==================================================")
    
    # 1. Access the content
    generated_content = state.generated_content 
    
    # DEBUG: Print exactly what type we are dealing with
    print(f"📊 Content Type: {type(generated_content)}")

    if not generated_content:
        print("⚠️ No content found in state to process.")
        return {"generated_content": generated_content}

    # --- HELPER: Normalize input to a list ---
    items_to_process = []
    
    if isinstance(generated_content, list):
        items_to_process = generated_content
    else:
        # If it's a single object (String or Pydantic Model), wrap it in a list
        items_to_process = [generated_content]

    # --- PROCESSING LOOP ---
    print(f"📝 Processing {len(items_to_process)} item(s)...")

    for i, item in enumerate(items_to_process):
        print(f"\n  --- Item {i+1} Analysis ---")
        
        # Extract text dynamically
        original_text = ""
        is_pydantic = hasattr(item, "content")
        is_dict = isinstance(item, dict) and "content" in item
        is_str = isinstance(item, str)

        if is_pydantic:
            original_text = item.content
        elif is_dict:
            original_text = item["content"]
        elif is_str:
            original_text = item
        else:
            print(f"    ⚠️ skipping unknown item type: {type(item)}")
            continue

        # VERBOSE: Print a snippet of the text to PROVE the LLM generated tags
        print(f"    🔎 Text Snippet: {original_text[:100]}...")
        if "<<IMAGE_SEARCH" in original_text:
            print("    ✅ TAG FOUND IN RAW TEXT!")
        else:
            print("    ❌ NO TAGS found in raw text.")

        # Process
        updated_text = process_text_for_images(original_text)
        
        # Save back
        if is_pydantic:
            item.content = updated_text
        elif is_dict:
            item["content"] = updated_text
        elif is_str:
            # If it was a single string, we update the state directly
            # (Note: This assumes generated_content was a string variable)
            if len(items_to_process) == 1:
                generated_content = updated_text

    # Handle the single string return case
    if isinstance(generated_content, str):
         state.generated_content = generated_content

    print("==================================================")
    print("✅ IMAGE FETCHING COMPLETE")
    print("==================================================\n\n")
        
    return {"generated_content": generated_content}

def process_text_for_images(text: str) -> str:
    """
    Helper to find tags and replace them.
    """
    if not text: 
        return ""

    # Robust Regex: Handles optional spaces around colon
    pattern = r"<<\s*IMAGE_SEARCH\s*:\s*(.*?)\s*>>"
    
    matches = re.findall(pattern, text, re.IGNORECASE)
    
    if not matches:
        return text

    print(f"    🚀 Processing {len(matches)} tags...")
    
    for query in matches:
        query = query.strip()
        print(f"       🌍 API CALL: Searching Google for '{query}'...")
        
        image_url = search_google_images(query)
        
        if image_url:
            print(f"          🎉 SUCCESS: {image_url}")
            # Reconstruct regex for safe replacement
            specific_pattern = re.compile(r"<<\s*IMAGE_SEARCH\s*:\s*" + re.escape(query) + r"\s*>>", re.IGNORECASE)
            markdown_img = f"\n\n![{query}]({image_url})\n\n"
            text = specific_pattern.sub(markdown_img, text)
        else:
            print(f"          ❌ FAILED: No image found (Removing tag)")
            specific_pattern = re.compile(r"<<\s*IMAGE_SEARCH\s*:\s*" + re.escape(query) + r"\s*>>", re.IGNORECASE)
            text = specific_pattern.sub("", text)
            
    return text
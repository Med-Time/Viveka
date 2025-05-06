import json
import os

# Input and output directories
input_dir = "C:/Users/sk984/OneDrive/Documents/qdrant/Parsed_Subjects"  # Parsed JSONs from unstructured.py
output_dir = "C:/Users/sk984/OneDrive/Documents/qdrant/Chunked_Subjects"
os.makedirs(output_dir, exist_ok=True)

# Recursively process each parsed JSON file
for root, dirs, files in os.walk(input_dir):
    for filename in files:
        if filename.endswith(".json"):
            file_path = os.path.join(root, filename)
            print(f"Processing file: {file_path}")

            # Load the parsed JSON
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            sections = []
            current_section = None
            paragraph_buffer = []

            # Iterate through elements
            for element in data:
                # Skip images and non-text elements
                if element['type'] not in ['Title', 'NarrativeText', 'List']:
                     continue


                if element['type'] == 'Title':
                    # Save current section if exists
                    if current_section:
                        # Flush any buffered paragraphs
                        if paragraph_buffer:
                            current_section['content'].append(' '.join(paragraph_buffer))
                            paragraph_buffer = []
                        sections.append(current_section)
                    current_section = {
                        'section_title': element['text'].strip(),
                        'content': [],
                        'page_number': element.get('metadata', {}).get('page_number', None)
                    }
                elif element['type'] in ['NarrativeText', 'List']:
                    paragraph = element['text'].strip()
                    if paragraph:
                        paragraph_buffer.append(paragraph)
                        # Flush if buffer is large (to avoid huge chunks)
                        if len(' '.join(paragraph_buffer)) > 1000:  # You can tune this limit
                            current_section['content'].append(' '.join(paragraph_buffer))
                            paragraph_buffer = []


            # Append last section
            if current_section:
                if paragraph_buffer:
                    current_section['content'].append(' '.join(paragraph_buffer))
                sections.append(current_section)

            # Save chunks preserving subject structure
            relative_path = os.path.relpath(root, input_dir)
            subject_output_dir = os.path.join(output_dir, relative_path)
            os.makedirs(subject_output_dir, exist_ok=True)

            output_file = os.path.join(subject_output_dir, f"{os.path.splitext(filename)[0]}_chunk.json")
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(sections, f, indent=4, ensure_ascii=False)

            print(f"✅ Chunked data saved to: {output_file}")

print("🎯 All JSONs processed and chunked subject-wise!")

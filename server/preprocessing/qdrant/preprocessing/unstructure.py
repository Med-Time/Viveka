from unstructured.partition.api import partition_via_api
from unstructured.staging.base import elements_to_json
import os
from dotenv import load_dotenv

# Set up API credentials
os.environ["UNSTRUCTURED_API_KEY"] = os.getenv("api_key_unstructure")
os.environ["UNSTRUCTURED_API_URL"] = "https://api.unstructuredapp.io/general/v0/general"

# Input and output directories
input_path = "C:/Users/sk984/OneDrive/Documents/qdrant/Subjects"  # Multiple subjects will be subfolders
output_dir = "C:/Users/sk984/OneDrive/Documents/qdrant/Parsed_Subjects"

# Ensure the output directory exists
os.makedirs(output_dir, exist_ok=True)

# Recursively process each PDF file in input_path
for root, dirs, files in os.walk(input_path):
    for filename in files:
        if filename.endswith(".pdf"):  # Process only PDFs
            file_path = os.path.join(root, filename)
            print(f"Processing file: {file_path}")

            # Partition the PDF using Unstructured API
            elements = partition_via_api(
                filename=file_path,
                api_key=os.environ["UNSTRUCTURED_API_KEY"],
                api_url=os.environ["UNSTRUCTURED_API_URL"],
                strategy="hi_res",
                additional_partition_args={
                    "split_pdf_page": True,
                    "split_pdf_allow_failed": True,
                    "split_pdf_concurrency_level": 15,
                },
            )

            # Save output keeping folder structure (subject-wise)
            relative_path = os.path.relpath(root, input_path)
            subject_output_dir = os.path.join(output_dir, relative_path)
            os.makedirs(subject_output_dir, exist_ok=True)

            output_file = os.path.join(subject_output_dir, f"{os.path.splitext(filename)[0]}.json")
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(elements_to_json(elements))

            print(f"Saved partitioned data to: {output_file}")

print("✅ All PDFs processed and saved subject-wise!")

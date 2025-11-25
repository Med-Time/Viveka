# server/Dockerfile

# Use Python 3.10
FROM python:3.10

# Set working directory
WORKDIR /app

# Copy requirements first to cache dependencies
COPY requirements.txt .

# Install dependencies (this will take time due to torch)
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the server code
COPY . .

# Create a non-root user (Security best practice for HF Spaces)
RUN useradd -m -u 1000 user
USER user

# Expose port 7860 (Hugging Face Spaces default port)
EXPOSE 7860

# Command to run the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
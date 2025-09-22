# Use Python 3.11 slim image (required for PyMuPDF compatibility)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY server/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('averaged_perceptron_tagger')"

# Copy server code
COPY server/ .

# Create necessary directories
RUN mkdir -p uploads/resumes uploads/temp uploads/parsed uploads/jobs uploads/comparisons data/rankings

# Expose port 8000 (default port for local development)
EXPOSE 8000

# Run the application using the PORT environment variable provided by Render
# For local development, you can set PORT environment variable or it will default to 8000 in the application code
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
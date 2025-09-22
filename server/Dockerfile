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

# Expose port (Render will dynamically assign via PORT environment variable)
EXPOSE 8000

# Run the application using PORT environment variable provided by Render
# If PORT is not set, default to 8000 for local development
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
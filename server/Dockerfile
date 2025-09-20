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

# Install spaCy English model
RUN python -m spacy download en_core_web_sm

# Copy server code
COPY server/ .

# Create necessary directories
RUN mkdir -p uploads/resumes uploads/temp uploads/parsed uploads/jobs uploads/comparisons data/rankings

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
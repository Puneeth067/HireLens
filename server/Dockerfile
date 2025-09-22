# Use a more recent and secure Python base image
FROM python:3.11.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies with security updates
RUN apt-get update && apt-get install -y \
    gcc \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY server/requirements.txt .

# Upgrade pip to latest version for security
RUN pip install --upgrade pip

# Install Python dependencies with security considerations
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('averaged_perceptron_tagger')"

# Download spaCy model
RUN python -c "import spacy; spacy.cli.download('en_core_web_sm')"

# Copy server code
COPY server/ .

# Create necessary directories with proper permissions
RUN mkdir -p uploads/resumes uploads/temp uploads/parsed uploads/jobs uploads/comparisons data/rankings

# Set proper ownership and permissions
RUN chown -R nobody:nogroup /app
USER nobody

# Expose port (Render will dynamically assign)
EXPOSE $PORT

# Run the application using the PORT environment variable provided by Render
# For local development, you can set PORT environment variable or it will default to 8000 in the application code
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
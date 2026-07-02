FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy uv binary from the official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy requirements and install
COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

# Download SpaCy language model
RUN python -m spacy download en_core_web_sm

# Copy inference files
COPY inference.py .

# SageMaker Serverless container contract port
EXPOSE 8080

# Run FastAPI uvicorn server
ENTRYPOINT ["uvicorn", "inference:app", "--host", "0.0.0.0", "--port", "8080"]

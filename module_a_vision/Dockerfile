FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and other heavy libs
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose Vision API port
EXPOSE 8001

# Command is overridden in docker-compose, but provide default
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8001"]

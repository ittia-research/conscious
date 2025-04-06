# FastAPI backend for production

FROM python:3.11-slim-bookworm

WORKDIR /app

# Install dependencies
COPY requirements.txt /tmp
RUN cd /tmp \
    && pip install --no-cache-dir -r requirements.txt \
    && rm -f requirements.txt

# Copy app files and ensure ownership is set to the non-root user
COPY . /app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

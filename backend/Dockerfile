FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN addgroup --system appgroup && adduser --system --group appuser

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# We'll copy the actual code later, creating an empty dir for now just to succeed build
RUN mkdir -p /app/app /app/alembic && touch /app/alembic.ini

COPY . /app

# Ensure writable media and reports directory for appuser
RUN mkdir -p /app/media /app/reports && chown -R appuser:appgroup /app/media /app/reports

# Code remains owned by root:root (Read-only) per mandate, except storage folders
RUN chmod +x /app/entrypoint.sh

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]

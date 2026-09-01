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

# Code remains owned by root:root (Read-only) per mandate
RUN chmod +x /app/entrypoint.sh

USER appuser

ENTRYPOINT ["/app/entrypoint.sh"]

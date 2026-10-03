"""OpenTelemetry configuration for distributed tracing."""

import os
from typing import Optional

from opentelemetry import trace
from opentelemetry.propagate import extract
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace.export import ConsoleSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor
from fastapi import FastAPI, Request
from fastapi.responses import Response

from app.core.config import settings


def init_telemetry(app: Optional[FastAPI] = None) -> TracerProvider:
    """
    Initialize OpenTelemetry TracerProvider with OTLP exporter.

    Args:
        app: Optional FastAPI app for automatic instrumentation

    Returns:
        Configured TracerProvider
    """
    # Create resource with service name
    resource = Resource.create({
        SERVICE_NAME: "ecommerce-backend",
        "service.version": "1.0.0",
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    })

    # Create TracerProvider
    tracer_provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(tracer_provider)

    # Configure OTLP exporter
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    environment = os.getenv("ENVIRONMENT", "development").lower()

    if otlp_endpoint and environment not in ("development", "local", "test"):
        # Production/Staging: Use secure OTLP exporter with TLS
        # Requires OTEL_EXPORTER_OTLP_CERTIFICATE and OTEL_EXPORTER_OTLP_CLIENT_KEY env vars
        cert_path = os.getenv("OTEL_EXPORTER_OTLP_CERTIFICATE")
        key_path = os.getenv("OTEL_EXPORTER_OTLP_CLIENT_KEY")

        if cert_path and key_path:
            # Use mTLS with client certificate
            otlp_exporter = OTLPSpanExporter(
                endpoint=otlp_endpoint,
                insecure=False,
                certificate_file=cert_path,
                client_key_file=key_path,
            )
        else:
            # Use system CA certificates (standard TLS)
            otlp_exporter = OTLPSpanExporter(
                endpoint=otlp_endpoint,
                insecure=False,
            )
        span_processor = BatchSpanProcessor(otlp_exporter)
        tracer_provider.add_span_processor(span_processor)
    else:
        # Development/Local: Use console exporter for visibility without Tempo
        # For local testing with insecure endpoint, set OTEL_EXPORTER_OTLP_INSECURE=true
        if otlp_endpoint and os.getenv("OTEL_EXPORTER_OTLP_INSECURE", "false").lower() == "true":
            # Allow insecure for local development only
            otlp_exporter = OTLPSpanExporter(
                endpoint=otlp_endpoint,
                insecure=True,
            )
            span_processor = BatchSpanProcessor(otlp_exporter)
            tracer_provider.add_span_processor(span_processor)
        else:
            console_exporter = ConsoleSpanExporter()
            span_processor = SimpleSpanProcessor(console_exporter)
            tracer_provider.add_span_processor(span_processor)

    # Auto-instrument FastAPI if app provided
    if app:
        FastAPIInstrumentor.instrument_app(
            app,
            tracer_provider=tracer_provider,
            excluded_urls="health,metrics,docs,openapi",
        )

    # Auto-instrument SQLAlchemy
    SQLAlchemyInstrumentor().instrument(
        tracer_provider=tracer_provider,
        enable_commenter=False,  # Disabled to prevent potential SQL injection in logs
    )

    # Auto-instrument Redis
    RedisInstrumentor().instrument(tracer_provider=tracer_provider)

    # Auto-instrument HTTPX
    HTTPXClientInstrumentor().instrument(tracer_provider=tracer_provider)

    return tracer_provider


async def tracing_middleware(request: Request, call_next):
    """
    Custom middleware to add trace ID to response headers and log context.
    """
    tracer = trace.get_tracer(__name__)

    # Get or create trace context from incoming headers
    carrier = {"traceparent": request.headers.get("traceparent", "")}
    ctx = extract(carrier) if carrier["traceparent"] else None

    with tracer.start_as_current_span(
        f"{request.method} {request.url.path}",
        context=ctx,
        attributes={
            "http.method": request.method,
            "http.url": str(request.url),
            "http.route": request.url.path,
        },
    ) as span:
        # Add trace ID to response headers
        trace_id = format(span.get_span_context().trace_id, "032x")

        response = await call_next(request)

        # Add trace context to response
        response.headers["X-Trace-ID"] = trace_id
        if span.get_span_context().span_id:
            response.headers["X-Span-ID"] = format(span.get_span_context().span_id, "016x")

        # Record HTTP status
        span.set_attribute("http.status_code", response.status_code)

        return response


def get_tracer(name: str = "ecommerce-backend") -> trace.Tracer:
    """Get a tracer instance."""
    return trace.get_tracer(name)


def add_span_attributes(attributes: dict):
    """Add attributes to the current span."""
    span = trace.get_current_span()
    if span:
        for key, value in attributes.items():
            span.set_attribute(key, value)


def record_exception(exc: Exception):
    """Record an exception in the current span."""
    span = trace.get_current_span()
    if span:
        span.record_exception(exc)
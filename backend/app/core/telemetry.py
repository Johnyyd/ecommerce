"""OpenTelemetry configuration for distributed tracing."""

import os
from typing import Optional

from opentelemetry import trace
from opentelemetry.propagate import extract
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
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
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://tempo:4317")
    
    # Use gRPC exporter for Tempo
    otlp_exporter = OTLPSpanExporter(
        endpoint=otlp_endpoint,
        insecure=True,
    )

    # Add batch span processor
    span_processor = BatchSpanProcessor(otlp_exporter)
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
        enable_commenter=True,
        commenter_options={
            "db_driver": True,
            "db_framework": True,
            "db_statement": True,
        }
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

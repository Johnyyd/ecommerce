"""
Unit tests for OpenTelemetry configuration.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from app.core.telemetry import init_telemetry, tracing_middleware, get_tracer


def test_init_telemetry():
    """Test that telemetry initialization returns a TracerProvider."""
    import os

    # Set OTLP endpoint and environment to production to ensure secure OTLP exporter is used
    os.environ['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://tempo:4317'
    os.environ['ENVIRONMENT'] = 'production'
    os.environ['OTEL_EXPORTER_OTLP_CERTIFICATE'] = '/path/to/cert.pem'
    os.environ['OTEL_EXPORTER_OTLP_CLIENT_KEY'] = '/path/to/key.pem'

    with patch('opentelemetry.sdk.resources.Resource.create'), \
         patch('app.core.telemetry.TracerProvider') as mock_tracer_provider, \
         patch('app.core.telemetry.OTLPSpanExporter') as mock_otlp_exporter, \
         patch('app.core.telemetry.BatchSpanProcessor') as mock_batch_processor, \
         patch('opentelemetry.instrumentation.fastapi.FastAPIInstrumentor'), \
         patch('opentelemetry.instrumentation.sqlalchemy.SQLAlchemyInstrumentor'), \
         patch('opentelemetry.instrumentation.redis.RedisInstrumentor'), \
         patch('opentelemetry.instrumentation.httpx.HTTPXClientInstrumentor'):

        # Mock the tracer provider instance
        mock_provider_instance = MagicMock()
        mock_tracer_provider.return_value = mock_provider_instance

        # Mock the batch processor
        mock_batch_processor_instance = MagicMock()
        mock_batch_processor.return_value = mock_batch_processor_instance

        # Mock the exporter
        mock_exporter_instance = MagicMock()
        mock_otlp_exporter.return_value = mock_exporter_instance

        # Mock the default values for BatchSpanProcessor
        type(mock_batch_processor)._default_schedule_delay_millis = MagicMock(return_value=5000)
        type(mock_batch_processor)._default_max_export_batch_size = MagicMock(return_value=512)
        type(mock_batch_processor)._default_export_timeout_millis = MagicMock(return_value=30000)
        type(mock_batch_processor)._default_max_queue_size = MagicMock(return_value=2048)

        # Initialize telemetry
        provider = init_telemetry()

        # Assertions
        assert provider == mock_provider_instance
        mock_tracer_provider.assert_called_once()
        mock_batch_processor.assert_called_once_with(mock_exporter_instance)


def test_init_telemetry_with_app():
    """Test telemetry initialization with FastAPI app."""
    import os

    # Set OTLP endpoint and environment to production to ensure secure OTLP exporter is used
    os.environ['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://tempo:4317'
    os.environ['ENVIRONMENT'] = 'production'
    os.environ['OTEL_EXPORTER_OTLP_CERTIFICATE'] = '/path/to/cert.pem'
    os.environ['OTEL_EXPORTER_OTLP_CLIENT_KEY'] = '/path/to/key.pem'

    app = FastAPI()

    with patch('opentelemetry.sdk.resources.Resource.create'), \
         patch('app.core.telemetry.TracerProvider') as mock_tracer_provider, \
         patch('app.core.telemetry.OTLPSpanExporter') as mock_otlp_exporter, \
         patch('app.core.telemetry.BatchSpanProcessor') as mock_batch_processor, \
         patch('opentelemetry.instrumentation.fastapi.FastAPIInstrumentor.instrument_app') as mock_fastapi_instrument, \
         patch('opentelemetry.instrumentation.sqlalchemy.SQLAlchemyInstrumentor'), \
         patch('opentelemetry.instrumentation.redis.RedisInstrumentor'), \
         patch('opentelemetry.instrumentation.httpx.HTTPXClientInstrumentor'):

        # Mock the tracer provider instance
        mock_provider_instance = MagicMock()
        mock_tracer_provider.return_value = mock_provider_instance

        # Mock the batch processor
        mock_batch_processor_instance = MagicMock()
        mock_batch_processor.return_value = mock_batch_processor_instance

        # Mock the exporter
        mock_exporter_instance = MagicMock()
        mock_otlp_exporter.return_value = mock_exporter_instance

        # Mock the default values for BatchSpanProcessor
        type(mock_batch_processor)._default_schedule_delay_millis = MagicMock(return_value=5000)
        type(mock_batch_processor)._default_max_export_batch_size = MagicMock(return_value=512)
        type(mock_batch_processor)._default_export_timeout_millis = MagicMock(return_value=30000)
        type(mock_batch_processor)._default_max_queue_size = MagicMock(return_value=2048)

        # Initialize telemetry with app
        provider = init_telemetry(app)

        # Assertions
        assert provider == mock_provider_instance
        mock_fastapi_instrument.assert_called_once_with(
            app,
            tracer_provider=mock_provider_instance,
            excluded_urls="health,metrics,docs,openapi",
        )
        mock_batch_processor.assert_called_once_with(mock_exporter_instance)


def test_get_tracer():
    """Test getting a tracer instance."""
    with patch('opentelemetry.trace.get_tracer') as mock_get_tracer:
        mock_tracer = MagicMock()
        mock_get_tracer.return_value = mock_tracer

        tracer = get_tracer("test-service")

        assert tracer == mock_tracer
        mock_get_tracer.assert_called_once_with("test-service")


@pytest.mark.asyncio
async def test_tracing_middleware():
    """Test the tracing middleware adds trace headers."""
    from starlette.requests import Request
    from starlette.responses import Response

    with patch('opentelemetry.trace.get_tracer') as mock_get_tracer, \
         patch('opentelemetry.trace.get_current_span') as mock_get_current_span:

        # Mock tracer and span
        mock_tracer = MagicMock()
        mock_span = MagicMock()
        mock_span.get_span_context.return_value.trace_id = 123456789
        mock_span.get_span_context.return_value.span_id = 987654321

        mock_get_tracer.return_value.start_as_current_span.return_value.__enter__.return_value = mock_span
        mock_get_current_span.return_value.get_span_context.return_value = None

        # Create mock request and call_next
        request = MagicMock(spec=Request)
        request.method = "GET"
        request.url.path = "/test"
        request.headers = {"traceparent": "test-trace-parent"}

        async def call_next(req):
            return Response(status_code=200)

        # Execute middleware
        response = await tracing_middleware(request, call_next)

        # Assertions
        assert response.status_code == 200
        assert response.headers["X-Trace-ID"] == format(123456789, "032x")
        assert response.headers["X-Span-ID"] == format(987654321, "016x")
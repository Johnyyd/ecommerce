# 📝 OpenTelemetry Backend Integration

This guide covers integrating **OpenTelemetry** with the FastAPI backend for distributed tracing.

---

## 📋 Overview

**OpenTelemetry** is a collection of tools, APIs, and SDKs used to instrument, generate, collect, and export telemetry data (metrics, logs, and traces) for your cloud-native software.

### Key Components

| Component | Description |
|-----------|-------------|
| **OpenTelemetry SDK** | Python SDK for instrumentation |
| **FastAPI Instrumentation** | Auto-instrumentation for FastAPI |
| **SQLAlchemy Instrumentation** | DB trace instrumentation |
| **Redis Instrumentation** | Redis trace instrumentation |

---

## 📦 Dependencies

### Install OpenTelemetry Packages

Update `backend/requirements.txt`:

```txt
# OpenTelemetry
opentelemetry-api==1.21.0
opentelemetry-sdk==1.21.0
opentelemetry-instrumentation-fastapi==0.42b0
opentelemetry-instrumentation-sqlalchemy==0.42b0
opentelemetry-instrumentation-redis==0.42b0
opentelemetry-exporter-otlp==1.21.0
```

---

## 🏗️ Configuration

### Create Telemetry Module (`backend/app/core/telemetry.py`)

```python
"""
OpenTelemetry configuration for FastAPI backend
"""
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
import os


def setup_tracing(app):
    """
    Setup OpenTelemetry tracing for FastAPI application
    
    Args:
        app: FastAPI application instance
    """
    service_name = os.getenv("SERVICE_NAME", "ecommerce-backend")
    tempo_endpoint = os.getenv(
        "TEMPO_ENDPOINT",
        "http://tempo.observability.svc.cluster.local:3100"
    )
    
    # Create resource with service name and other attributes
    resource = Resource.create({
        "service.name": service_name,
        "service.version": "1.0.0",
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    })
    
    # Create tracer provider
    provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(provider)
    
    # Create OTLP exporter
    exporter = OTLPSpanExporter(
        endpoint=f"{tempo_endpoint}/otlp/v1/traces",
        headers={
            "content-type": "application/x-protobuf"
        }
    )
    
    # Add batch span processor
    span_processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(span_processor)
    
    # Instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)
    
    # Instrument SQLAlchemy (will be configured in database setup)
    # SQLAlchemyInstrumentor.instrument()
    
    # Instrument Redis (will be configured when Redis client is created)
    # RedisInstrumentor.instrument()
    
    print(f"✅ OpenTelemetry tracing configured for {service_name}")
    print(f"📡 Traces exported to: {tempo_endpoint}")
    
    return provider


def instrument_sqlalchemy(engine):
    """Instrument SQLAlchemy engine for tracing"""
    SQLAlchemyInstrumentor.instrument(engine=engine)
    print("✅ SQLAlchemy instrumentation enabled")


def instrument_redis():
    """Instrument Redis client for tracing"""
    RedisInstrumentor.instrument()
    print("✅ Redis instrumentation enabled")
```

---

## 🔧 Application Integration

### Update Main Application (`backend/app/main.py`)

```python
from fastapi import FastAPI
from app.core.telemetry import setup_tracing, instrument_sqlalchemy
from app.core.config import settings
from app.core.database import engine

app = FastAPI(
    title="E-Commerce Platform API",
    version="1.0.0",
    description="Enterprise Premium E-Commerce Platform"
)

# Setup OpenTelemetry tracing
setup_tracing(app)

# Instrument SQLAlchemy with the existing engine
instrument_sqlalchemy(engine)

# ... rest of your app configuration
```

### Update Environment Variables

Add to `.env`:

```env
# OpenTelemetry Configuration
SERVICE_NAME=ecommerce-backend
TEMPO_ENDPOINT=http://tempo.observability.svc.cluster.local:3100
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo.observability.svc.cluster.local:4317
OTEL_SERVICE_NAME=ecommerce-backend
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

---

## 📊 Custom Spans

### Adding Custom Spans

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

async def process_order(order_id: int):
    with tracer.start_as_current_span("process_order") as span:
        span.set_attribute("order.id", order_id)
        
        # Business logic
        with tracer.start_as_current_span("validate_order") as span:
            span.set_attribute("validation.type", "payment")
        
        with tracer.start_as_current_span("create_invoice") as span:
            span.set_attribute("invoice.total", 1000.00)
        
        return {"status": "processed"}
```

### Setting Attributes and Events

```python
with tracer.start_as_current_span("fetch_product") as span:
    span.set_attribute("product.id", product_id)
    span.set_attribute("http.method", "GET")
    
    try:
        product = await get_product(product_id)
        span.set_attribute("db.rows_returned", 1)
        span.add_event("product.fetched", {"product.id": product_id})
    except Exception as e:
        span.record_exception(e)
        span.set_attribute("error", True)
        raise
```

---

## 🎯 Instrumentation Examples

### FastAPI Endpoints (Auto-instrumented)

```python
from fastapi import APIRouter
from app.core.database import get_db
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/products/{product_id}")
async def get_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    # Automatically creates spans for:
    # 1. HTTP request (FastAPI)
    # 2. Database query (SQLAlchemy)
    product = db.query(Product).filter(Product.id == product_id).first()
    return product
```

### Redis Operations (Auto-instrumented)

```python
import redis
from redis import Redis

# After instrumentation
redis_client = Redis(host='redis-host', port=6379)

# Automatically creates spans for Redis commands
def get_cached_product(product_id: int):
    cache_key = f"product:{product_id}"
    cached_data = redis_client.get(cache_key)
    return cached_data
```

---

## ✅ Validation

### Test Trace Export

```python
# Test script
import requests
import time

def test_trace():
    # Make request to API
    response = requests.get(
        "http://localhost:8000/api/v1/products/search?q=phone"
    )
    
    # Wait for trace to be exported
    time.sleep(2)
    
    # Check Tempo
    print("✅ Request completed, trace should be in Tempo")

if __name__ == "__main__":
    test_trace()
```

### Verify in Grafana

1. Make request to API endpoint
2. Open Grafana → Explore
3. Select Tempo datasource
4. Search for recent traces
5. Verify spans for FastAPI, SQLAlchemy, Redis

---

## 🔧 Configuration Options

### Sampling

```python
from opentelemetry.sdk.trace.samplers import TraceIdRatioBased

# Sample 10% of traces in production
sampler = TraceIdRatioBased(0.1)
provider = TracerProvider(
    resource=resource,
    sampler=sampler
)
```

### Batch Exporter Configuration

```python
from opentelemetry.sdk.trace.export import BatchSpanProcessor

span_processor = BatchSpanProcessor(
    exporter,
    schedule_delay_millis=5000,  # Send every 5s
    max_export_batch_size=512,   # Max spans per batch
    max_queue_size=2048,         # Max queued spans
)
```

---

## 🛠️ Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| No traces appearing | Check Tempo endpoint connectivity |
| Missing spans | Verify instrumentation is loaded |
| High latency | Increase batch size, reduce sampling rate |
| Export errors | Check network policies, Tempo health |

See [Tempo Trace Analysis Runbook](../runbooks/tempo-trace-analysis.md)

---

## 📚 References

- [OpenTelemetry Python Docs](https://opentelemetry.io/docs/instrumentation/python/)
- [OpenTelemetry FastAPI Instrumentation](https://opentelemetry.io/docs/instrumentation/python/fastapi/)
- [OpenTelemetry Exporters](https://opentelemetry.io/docs/specs/otel/exporters/otlp/)

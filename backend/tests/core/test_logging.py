import json
import logging
from io import StringIO
from app.core.logging import setup_logging, RedactingFormatter

def test_log_redaction_middleware():
    log_stream = StringIO()
    logger = logging.getLogger("test_logger")
    logger.setLevel(logging.INFO)
    
    # Configure the formatter and handler
    handler = logging.StreamHandler(log_stream)
    formatter = RedactingFormatter(
        fmt='{"message": "%(message)s"}'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Log a message containing sensitive data
    sensitive_payload = {
        "user_id": 123,
        "password": "my_super_secret_password",
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "credit_card": "4111-1111-1111-1111"
    }
    
    logger.info(json.dumps(sensitive_payload))
    
    # Flush and check the log output
    handler.flush()
    log_output = log_stream.getvalue()
    
    # Verify redaction
    assert "my_super_secret_password" not in log_output
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." not in log_output
    assert "4111-1111-1111-1111" not in log_output
    assert "***REDACTED***" in log_output

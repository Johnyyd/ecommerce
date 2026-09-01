import logging
import re

class RedactingFormatter(logging.Formatter):
    def __init__(self, fmt=None, datefmt=None, style='%', validate=True, *, defaults=None):
        super().__init__(fmt, datefmt, style, validate) # Removing defaults=defaults for python 3.9 compatibility just in case, though we are 3.12.
        self.patterns_to_redact = [
            (re.compile(r'"password"\s*:\s*"[^"]+"'), '"password": "***REDACTED***"'),
            (re.compile(r'"token"\s*:\s*"[^"]+"'), '"token": "***REDACTED***"'),
            (re.compile(r'"credit_card"\s*:\s*"[^"]+"'), '"credit_card": "***REDACTED***"')
        ]

    def format(self, record):
        message = super().format(record)
        for pattern, replacement in self.patterns_to_redact:
            message = pattern.sub(replacement, message)
        return message

def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    handler = logging.StreamHandler()
    formatter = RedactingFormatter(
        fmt='{"level": "%(levelname)s", "message": %(message)s}'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

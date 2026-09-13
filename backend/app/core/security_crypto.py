import hmac
import hashlib
from typing import Dict, Any

def create_signature_string(data: Dict[str, Any]) -> str:
    """
    Sort keys alphabetically and format as key1=val1&key2=val2...
    Excludes keys with None values or empty string or 'signature'.
    Nested dictionaries or lists are serialized or skipped according to PayOS specification.
    """
    sorted_keys = sorted(data.keys())
    parts = []
    for k in sorted_keys:
        if k in ("signature", "signature_hash"):
            continue
        v = data[k]
        if v is None:
            continue
        # Convert boolean to lowercase string according to JSON/PayOS standard
        if isinstance(v, bool):
            v_str = "true" if v else "false"
        else:
            v_str = str(v)
        parts.append(f"{k}={v_str}")
    return "&".join(parts)

def generate_payos_signature(data: Dict[str, Any], checksum_key: str) -> str:
    """
    Computes HMAC-SHA256 signature for PayOS data dictionary.
    """
    sign_str = create_signature_string(data)
    signature = hmac.new(
        checksum_key.encode("utf-8"),
        sign_str.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return signature

def verify_payos_signature(data: Dict[str, Any], received_signature: str, checksum_key: str) -> bool:
    """
    Verifies HMAC-SHA256 signature in constant time using hmac.compare_digest
    to prevent timing side-channel attacks (OWASP Top 10 A04/A07).
    """
    if not received_signature or not checksum_key:
        return False
    expected_signature = generate_payos_signature(data, checksum_key)
    return hmac.compare_digest(expected_signature.lower(), received_signature.lower())

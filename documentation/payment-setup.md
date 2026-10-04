# PayOS Payment Gateway Setup Guide

This guide covers configuring PayOS for both sandbox (development/testing) and production environments.

## Overview

The platform integrates with **PayOS** (Vietnam's NAPAS 247 standard payment gateway) for:
- Dynamic VietQR code generation per order
- Secure webhook processing with HMAC-SHA256 signature verification
- Automatic payment status synchronization

## Prerequisites

1. **PayOS Merchant Account** - Register at [PayOS Merchant Dashboard](https://merchants.payos.vn)
2. **Business Verification** - Complete KYC for production access
3. **SSL Certificate** - Required for webhook endpoints in production

---

## Sandbox Environment Setup

### 1. Create Sandbox Account

1. Go to [PayOS Sandbox Dashboard](https://merchants-sandbox.payos.vn)
2. Register with test credentials
3. No KYC required for sandbox

### 2. Get Sandbox Credentials

After registration, you'll receive:
- **Client ID** (e.g., `PAYOS_CLIENT_ID=123456`)
- **API Key** (e.g., `PAYOS_API_KEY=sk_test_xxxxxxxxxxxx`)
- **Checksum Key** (e.g., `PAYOS_CHECKSUM_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### 3. Configure Environment Variables

Add to your `.env` file:

```bash
# PayOS Sandbox Configuration
PAYOS_CLIENT_ID=your_sandbox_client_id
PAYOS_API_KEY=your_sandbox_api_key
PAYOS_CHECKSUM_KEY=your_sandbox_checksum_key

# Environment
ENVIRONMENT=development
```

### 4. Webhook Configuration (Sandbox)

In the PayOS Sandbox Dashboard:
1. Navigate to **Settings → Webhook**
2. Add webhook URL: `https://your-domain.com/api/v1/payments/webhook`
3. Select events: `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_CANCELLED`

> **Note for Local Development**: Use [ngrok](https://ngrok.com/) or [Tailscale](https://tailscale.com/) to expose your local server:
> ```bash
> ngrok http 8000
> # Use the HTTPS URL provided (e.g., https://abc123.ngrok.io/api/v1/payments/webhook)
> ```

---

## Production Environment Setup

### 1. Complete Business Verification

1. Log in to [PayOS Production Dashboard](https://merchants.payos.vn)
2. Complete business registration and KYC
3. Wait for approval (typically 1-3 business days)

### 2. Get Production Credentials

After approval, you'll receive production credentials:
- **Client ID** (different from sandbox)
- **API Key** (format: `sk_live_xxxxxxxxxxxx`)
- **Checksum Key** (different from sandbox)

### 3. Configure Production Environment Variables

```bash
# PayOS Production Configuration
PAYOS_CLIENT_ID=your_production_client_id
PAYOS_API_KEY=your_production_api_key
PAYOS_CHECKSUM_KEY=your_production_checksum_key

# Environment
ENVIRONMENT=production
```

### 4. Webhook Configuration (Production)

In the PayOS Production Dashboard:
1. Navigate to **Settings → Webhook**
2. Add webhook URL: `https://your-production-domain.com/api/v1/payments/webhook`
3. Select events: `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_CANCELLED`
4. **Important**: Ensure your domain has valid SSL certificate

---

## VietQR Bank Configuration

The platform supports dynamic VietQR generation. Configure your bank details in `.env`:

```bash
# VietQR Bank Details (Required for dynamic QR generation)
VIETQR_BANK_ID=vietinbank        # Bank code (e.g., vietinbank, vietcombank, bidv, etc.)
VIETQR_BANK_NAME=VietinBank      # Display name
VIETQR_ACCOUNT_NO=1234567890     # Your bank account number
VIETQR_ACCOUNT_NAME=YOUR NAME    # Account holder name (must match bank records)
```

### Supported Banks (NAPAS 247)

| Bank Code | Bank Name |
|-----------|-----------|
| `vietinbank` | VietinBank |
| `vietcombank` | Vietcombank |
| `bidv` | BIDV |
| `techcombank` | Techcombank |
| `mb` | MBBank |
| `acb` | ACB |
| `vpbank` | VPBank |
| `tpbank` | TPBank |
| `sacombank` | Sacombank |
| `hdbank` | HDBank |

Full list available at [NAPAS Bank Directory](https://napas.com.vn).

---

## Testing Payments

### Sandbox Test Cards

Use these test card numbers in sandbox mode:

| Scenario | Card Number | Expiry | CVV | OTP |
|----------|-------------|--------|-----|-----|
| Success | `9704198526191432198` | Any future | Any | `123456` |
| Insufficient Funds | `9704198526191432199` | Any future | Any | `123456` |
| Expired Card | `9704198526191432200` | Past date | Any | `123456` |

### Test Flow

1. Create order via API: `POST /api/v1/orders/`
2. Create payment link: `POST /api/v1/payments/create`
3. Open returned `checkout_url` in browser
4. Complete payment with test card
5. Webhook automatically updates order status
6. Check status: `GET /api/v1/payments/{order_id}/status`

---

## Webhook Security

### Signature Verification

All webhooks are verified using HMAC-SHA256:

```python
# Backend verification (automatic)
from app.core.security_crypto import verify_payos_signature

is_valid = verify_payos_signature(
    data=webhook_payload,
    received_signature=signature_header,
    checksum_key=settings.PAYOS_CHECKSUM_KEY
)
```

### Payload Structure

```json
{
  "code": "00",
  "desc": "Success",
  "data": {
    "orderCode": 12345678,
    "amount": 100000,
    "description": "DH12345678",
    "accountNumber": "1234567890",
    "reference": "PAYOS_REF_123",
    "transactionDateTime": "2024-01-15 10:30:00",
    "currency": "VND",
    "paymentLinkId": "PAYOS_LINK_123",
    "counterAccountBankId": "970419",
    "counterAccountBankName": "VietinBank",
    "counterAccountName": "TEST USER",
    "counterAccountNumber": "9704198526191432198",
    "virtualAccountName": "VietinBank",
    "virtualAccountNumber": "9704198526191432198"
  },
  "signature": "hmac_sha256_signature_here"
}
```

---

## Kubernetes Deployment

### 1. Create Secrets

```bash
# Create Kubernetes secrets from .env
kubectl create secret generic app-secrets \
  --from-literal=PAYOS_CLIENT_ID=your_client_id \
  --from-literal=PAYOS_API_KEY=your_api_key \
  --from-literal=PAYOS_CHECKSUM_KEY=your_checksum_key \
  --from-literal=VIETQR_BANK_ID=vietinbank \
  --from-literal=VIETQR_BANK_NAME=VietinBank \
  --from-literal=VIETQR_ACCOUNT_NO=1234567890 \
  --from-literal=VIETQR_ACCOUNT_NAME="YOUR NAME"
```

### 2. Configure Helm Values

In `helm/ecommerce/values.yaml`:

```yaml
# PayOS is configured via app-secrets secret
# Ensure the secret exists in the namespace
```

### 3. Ingress Configuration

Ensure webhook endpoint is accessible:

```yaml
# ingress.yaml already routes /api/v1/payments/webhook to backend
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `Invalid HMAC signature` | Wrong checksum key | Verify `PAYOS_CHECKSUM_KEY` matches dashboard |
| `Webhook not received` | Firewall/Network | Check ingress, firewall, SSL certificate |
| `Payment link expired` | Timeout | Links expire after 15 min; regenerate if needed |
| `Order code collision` | Duplicate order codes | System uses SHA256(UUID) - extremely unlikely |

### Debug Webhook

Check webhook processing in logs:
```bash
# Docker Compose
docker-compose logs backend | grep -i webhook

# Kubernetes
kubectl logs deployment/backend -n default | grep -i webhook
```

### Test Webhook Locally

```bash
# Using curl to simulate PayOS webhook
curl -X POST http://localhost:8000/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"code":"00","desc":"Success","data":{"orderCode":12345678,"amount":100000,"description":"DH12345678","accountNumber":"1234567890","reference":"TEST_REF","transactionDateTime":"2024-01-15 10:30:00","currency":"VND","paymentLinkId":"TEST_LINK","counterAccountBankId":"970419","counterAccountBankName":"VietinBank","counterAccountName":"TEST","counterAccountNumber":"9704198526191432198","virtualAccountName":"VietinBank","virtualAccountNumber":"9704198526191432198"},"signature":"test_signature"}'
```

> **Note**: This will fail signature verification in production (as expected).

---

## API Reference

### Create Payment Link
```http
POST /api/v1/payments/create
Content-Type: application/json

{
  "order_id": "uuid-of-order",
  "provider": "PAYOS"
}
```

**Response:**
```json
{
  "order_id": "uuid",
  "order_code": 12345678,
  "amount": 100000,
  "currency": "VND",
  "qr_code_url": "https://api.vietqr.io/image/...",
  "checkout_url": "https://pay.payos.vn/web/...",
  "payment_link_id": "PAYOS_LINK_123",
  "expires_at": "2024-01-15T10:45:00Z",
  "account_number": "1234567890",
  "account_name": "YOUR NAME",
  "bank_name": "VietinBank",
  "description": "DH12345678",
  "transfer_memo": "DH12345678",
  "bank_account_number": "1234567890"
}
```

### Check Payment Status
```http
GET /api/v1/payments/{order_id}/status
```

### Webhook Endpoint
```http
POST /api/v1/payments/webhook
Content-Type: application/json
```

---

## Security Best Practices

1. **Never commit credentials** to version control
2. **Rotate keys periodically** (quarterly recommended)
3. **Use different credentials** for sandbox and production
4. **Monitor webhook failures** in Grafana/Prometheus
5. **Implement idempotency** - webhooks may be delivered multiple times
6. **Validate amounts** - always verify payment amount matches order amount

---

## Support Resources

- [PayOS Developer Documentation](https://payos.vn/docs)
- [PayOS API Reference](https://api-merchant.payos.vn/docs)
- [NAPAS 247 Standard](https://napas.com.vn)
- [VietQR Specification](https://vietqr.vn)

---

*Last updated: 2024-01-15*
import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib

from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)

REDIS_SANDBOX_EMAILS_KEY = "email:outbox:sandbox"

def generate_welcome_html(username: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; margin: 0; padding: 32px 16px; color: #111827; }}
        .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 40px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .badge {{ display: inline-block; background: #111827; color: #ffffff; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 24px; }}
        h1 {{ font-size: 24px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -0.02em; }}
        p {{ font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 20px 0; }}
        .btn {{ display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 600; margin-top: 12px; }}
        .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">Welcome</span>
        <h1>Welcome to E-Commerce, {username}!</h1>
        <p>Your premium account has been created successfully. Explore our exclusive collections with 24/7 instant bank payments, high-speed fulfillment, and authentic verified reviews.</p>
        <p>If you have any questions or need assistance, our customer support concierge is ready to assist you anytime.</p>
        <a href="{settings.FRONTEND_URL}" class="btn">Explore Storefront &rarr;</a>
        <div class="footer">
          &copy; {datetime.now(timezone.utc).year} Enterprise E-Commerce Platform. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

def generate_invoice_html(context: Dict[str, Any]) -> str:
    order_id = str(context.get("order_id", "N/A"))
    total_amount = context.get("total_amount", 0.0)
    payment_method = context.get("payment_method", "N/A")
    items = context.get("items", [])
    
    rows = ""
    for item in items:
        qty = item.get("quantity", 1)
        price = float(item.get("unit_price", 0.0))
        item_total = qty * price
        rows += f"""
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #111827;">
            {item.get('name', 'Product Item')} <span style="color: #9ca3af; font-size: 12px;">x{qty}</span>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; font-weight: 600; text-align: right; color: #111827;">
            ${item_total:.2f}
          </td>
        </tr>
        """
        
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; margin: 0; padding: 32px 16px; color: #111827; }}
        .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 40px; border: 1px solid #e5e7eb; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }}
        .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 24px; margin-bottom: 24px; }}
        .title {{ font-size: 20px; font-weight: 700; margin: 0; }}
        .order-id {{ font-family: monospace; font-size: 13px; color: #6b7280; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; }}
        .total-box {{ background: #f9fafb; border-radius: 16px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }}
        .total-label {{ font-size: 14px; color: #4b5563; }}
        .total-val {{ font-size: 24px; font-weight: 700; color: #111827; }}
        .meta {{ font-size: 12px; color: #6b7280; margin-bottom: 6px; }}
        .footer {{ margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div style="margin-bottom: 20px;">
          <span style="background: #ecfdf5; color: #059669; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">Confirmed &amp; Processing</span>
          <h1 style="font-size: 22px; font-weight: 700; margin: 12px 0 4px 0;">Order Receipt #{order_id[:8]}</h1>
          <p class="order-id">Full Order ID: {order_id}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; font-size: 11px; text-transform: uppercase; color: #9ca3af; padding-bottom: 8px;">Item Description</th>
              <th style="text-align: right; font-size: 11px; text-transform: uppercase; color: #9ca3af; padding-bottom: 8px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>

        <div style="background: #f9fafb; border-radius: 16px; padding: 18px 24px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 13px; color: #6b7280;">Payment Method</span>
            <span style="font-size: 13px; font-weight: 600; color: #111827;">{payment_method}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid #e5e7eb; padding-top: 12px;">
            <span style="font-size: 14px; font-weight: 600; color: #111827;">Total Paid Amount</span>
            <span style="font-size: 22px; font-weight: 800; color: #111827;">${float(total_amount):.2f}</span>
          </div>
        </div>

        <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
          Thank you for choosing our platform. You can monitor live fulfillment and shipping progress directly from your profile order history.
        </p>

        <div class="footer">
          &copy; {datetime.now(timezone.utc).year} Enterprise E-Commerce Platform. Thank you for your business.
        </div>
      </div>
    </body>
    </html>
    """

def generate_password_reset_html(username: str, token: str) -> str:
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; margin: 0; padding: 32px 16px; color: #111827; }}
        .card {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 40px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        h1 {{ font-size: 22px; font-weight: 700; margin: 0 0 14px 0; color: #111827; }}
        p {{ font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 18px 0; }}
        .token-box {{ background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 12px; padding: 14px; text-align: center; font-family: monospace; font-size: 18px; font-weight: 700; letter-spacing: 0.1em; color: #111827; margin-bottom: 24px; }}
        .btn {{ display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 600; }}
        .footer {{ margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Password Reset Request</h1>
        <p>Hello {username},</p>
        <p>We received a request to reset the password associated with your account. Use the security verification token below to proceed. This token expires in <strong>15 minutes</strong>.</p>
        <div class="token-box">{token}</div>
        <p>Alternatively, click the secure button below to set a new password:</p>
        <a href="{reset_link}" class="btn">Reset Password &rarr;</a>
        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          If you did not request this password reset, please ignore this email or contact security immediately.
        </p>
        <div class="footer">
          &copy; {datetime.now(timezone.utc).year} Enterprise Security Center.
        </div>
      </div>
    </body>
    </html>
    """

async def record_sandbox_email(recipient: str, subject: str, template: str, context: Dict[str, Any], html_body: str = "") -> Dict[str, Any]:
    """Store sent transactional email in Redis for sandbox debugging and verification."""
    redis = get_redis_client()
    email_record = {
        "id": f"mail_{uuid4().hex[:10]}",
        "recipient": recipient,
        "subject": subject,
        "template": template,
        "context": context,
        "html_body": html_body,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "delivery_mode": "SANDBOX" if not settings.SMTP_HOST else "SMTP"
    }
    try:
        # Push to sandbox list, trim to keep last 100
        await redis.lpush(REDIS_SANDBOX_EMAILS_KEY, json.dumps(email_record))
        await redis.ltrim(REDIS_SANDBOX_EMAILS_KEY, 0, 99)
    except Exception as e:
        logger.warning(f"Could not write email to Redis sandbox: {e}")
    return email_record

async def send_email(recipient: str, subject: str, template: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main email dispatching routine:
    1. Compiles the HTML template.
    2. Sends via SMTP if configured.
    3. Records in sandbox outbox for audit & testing.
    """
    html_body = ""
    if template == "welcome":
        html_body = generate_welcome_html(context.get("username", "Customer"))
    elif template == "order_invoice":
        html_body = generate_invoice_html(context)
    elif template == "password_reset":
        html_body = generate_password_reset_html(context.get("username", "Customer"), context.get("token", "N/A"))
    else:
        html_body = f"<p>{context.get('message', subject)}</p>"

    # 1. Attempt live SMTP if credentials provided
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            message = MIMEMultipart("alternative")
            message["From"] = settings.EMAIL_FROM
            message["To"] = recipient
            message["Subject"] = subject
            message.attach(MIMEText(html_body, "html"))
            
            await aiosmtplib.send(
                message,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                use_tls=True if settings.SMTP_PORT == 465 else False,
                start_tls=True if settings.SMTP_PORT == 587 else False
            )
            logger.info(f"Email successfully delivered to {recipient} via SMTP")
        except Exception as e:
            logger.error(f"Failed to send email via SMTP to {recipient}: {e}")

    # 2. Always record in sandbox list
    record = await record_sandbox_email(recipient, subject, template, context, html_body)
    return record

async def get_sandbox_outbox(limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve recent sandbox emails for testing and admin inspection."""
    redis = get_redis_client()
    try:
        raw_items = await redis.lrange(REDIS_SANDBOX_EMAILS_KEY, 0, limit - 1)
        return [json.loads(item) for item in raw_items]
    except Exception as e:
        logger.warning(f"Failed to fetch sandbox emails: {e}")
        return []

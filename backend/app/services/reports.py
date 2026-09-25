import os
import re
import csv
import json
import base64
import logging
from typing import Dict, Any, Optional
from pathlib import Path
from datetime import datetime, timezone
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.core.redis import get_redis_client
from app.models.order import Order

logger = logging.getLogger(__name__)

def get_reports_dir() -> Path:
    """Ensure report storage directory exists and return Path object."""
    rep_path = Path(settings.REPORTS_DIR)
    try:
        rep_path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        logger.warning("Could not create reports directory: %s", e)
    return rep_path

async def update_report_meta(job_id: str, updates: Dict[str, Any]):
    """Update Redis job metadata."""
    redis = get_redis_client()
    key = f"reports:meta:{job_id}"
    raw = await redis.get(key)
    if raw:
        meta = json.loads(raw)
        meta.update(updates)
        await redis.set(key, json.dumps(meta), ex=86400)

async def build_sales_report(
    job_id: str,
    report_type: str,
    date_from: Optional[str],
    date_to: Optional[str],
    format_type: str,
    user_id: str
) -> Dict[str, Any]:
    """
    Executes database query for orders, aggregates revenue metrics,
    and produces a styled Excel or CSV document without blocking HTTP threads.
    """
    rep_dir = get_reports_dir()
    await update_report_meta(job_id, {"status": "PROCESSING", "progress": 30})

    async with AsyncSessionLocal() as session:
        stmt = select(Order).options(selectinload(Order.items), selectinload(Order.payment)).order_by(Order.created_at.desc())
        
        # Apply date filters if valid ISO strings
        if date_from:
            try:
                dt_from = datetime.fromisoformat(date_from)
                stmt = stmt.where(Order.created_at >= dt_from)
            except (ValueError, TypeError) as err:
                logger.warning("Could not parse date_from filter '%s': %s", date_from, err)
        if date_to:
            try:
                dt_to = datetime.fromisoformat(date_to)
                stmt = stmt.where(Order.created_at <= dt_to)
            except (ValueError, TypeError) as err:
                logger.warning("Could not parse date_to filter '%s': %s", date_to, err)

        result = await session.execute(stmt)
        orders = list(result.scalars().all())

    await update_report_meta(job_id, {"progress": 70})

    # Aggregations
    total_orders = len(orders)
    total_revenue = sum(float(o.total_amount) for o in orders if o.status != "CANCELLED")
    paid_orders = sum(1 for o in orders if o.payment and o.payment.status in ["PAID", "SUCCESS"])
    aov = (total_revenue / total_orders) if total_orders > 0 else 0.0
    rep_dir = get_reports_dir().resolve()
    safe_format = "xlsx" if str(format_type).lower() == "xlsx" else "csv"
    safe_job_id = re.sub(r"[^a-zA-Z0-9_\-]", "", str(job_id))
    if not safe_job_id:
        safe_job_id = "report"

    now_utc = datetime.now(timezone.utc)
    filename = f"{safe_job_id}_{now_utc.strftime('%Y%m%d_%H%M%S')}.{safe_format}"
    file_path = (rep_dir / filename).resolve()
    if os.path.commonpath([str(file_path), str(rep_dir)]) != str(rep_dir):
        raise ValueError("Invalid file path: path traversal detected")

    if safe_format == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Executive Sales Report"

        # Styles
        title_font = Font(name="Arial", size=16, bold=True, color="111827")
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="111827", end_color="111827", fill_type="solid")
        card_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
        card_font = Font(name="Arial", size=10, bold=True, color="4B5563")
        val_font = Font(name="Arial", size=14, bold=True, color="111827")
        thin_border = Border(bottom=Side(style='thin', color='E5E7EB'))

        # Title
        ws["A1"] = "ENTERPRISE E-COMMERCE PLATFORM"
        ws["A1"].font = Font(name="Arial", size=10, bold=True, color="9CA3AF")
        ws["A2"] = "Sales & Executive Revenue Report"
        ws["A2"].font = title_font
        ws["A3"] = f"Generated at: {now_utc.strftime('%Y-%m-%d %H:%M UTC')} | Scope: {report_type.upper()}"
        ws["A3"].font = Font(name="Arial", size=9, color="6B7280")

        # Summary Metric Cards (Row 5-6)
        metrics = [
            ("TOTAL ORDERS", f"{total_orders:,}", "A", "B"),
            ("GROSS REVENUE", f"${total_revenue:,.2f}", "C", "D"),
            ("AVG ORDER VALUE", f"${aov:,.2f}", "E", "F"),
            ("PAID ORDERS", f"{paid_orders:,}", "G", "H"),
        ]
        for label, val, c1, c2 in metrics:
            ws[f"{c1}5"] = label
            ws[f"{c1}5"].font = card_font
            ws[f"{c1}5"].fill = card_fill
            ws[f"{c1}6"] = val
            ws[f"{c1}6"].font = val_font
            ws[f"{c1}6"].fill = card_fill

        # Data Table Headers (Row 8)
        headers = [
            "Order ID", "Date Created", "Status", "Payment Method",
            "Payment Status", "Items Count", "Total Amount ($)"
        ]
        for col_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=8, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center" if "Status" in h or "Count" in h else "left")

        # Data Rows
        current_row = 9
        for o in orders:
            ws.cell(row=current_row, column=1, value=str(o.id)).border = thin_border
            ws.cell(row=current_row, column=2, value=o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else "").border = thin_border
            ws.cell(row=current_row, column=3, value=o.status).border = thin_border
            ws.cell(row=current_row, column=4, value=o.payment_method).border = thin_border
            ws.cell(row=current_row, column=5, value=o.payment.status if o.payment else "UNPAID").border = thin_border
            ws.cell(row=current_row, column=6, value=sum(it.quantity for it in o.items)).border = thin_border
            
            amt_cell = ws.cell(row=current_row, column=7, value=float(o.total_amount))
            amt_cell.number_format = '$#,##0.00'
            amt_cell.font = Font(bold=True)
            amt_cell.border = thin_border
            current_row += 1

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

        wb.save(file_path)

    else:
        # Standard CSV format
        with open(file_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Order ID", "Date Created", "Status", "Payment Method", "Payment Status", "Items Count", "Total Amount"])
            for o in orders:
                writer.writerow([
                    str(o.id),
                    o.created_at.strftime("%Y-%m-%d %H:%M:%S") if o.created_at else "",
                    o.status,
                    o.payment_method,
                    o.payment.status if o.payment else "UNPAID",
                    sum(it.quantity for it in o.items),
                    f"{float(o.total_amount):.2f}"
                ])

    try:
        with open(file_path, "rb") as f:
            report_bytes = f.read()
        b64_data = base64.b64encode(report_bytes).decode("ascii")
        redis = get_redis_client()
        await redis.set(f"reports:data:{job_id}", b64_data, ex=86400)
    except Exception as err:
        logger.warning(f"Could not cache report artifact in Redis: {err}")

    download_url = f"/api/v1/reports/{job_id}/download"
    completion_meta = {
        "status": "COMPLETED",
        "progress": 100,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "download_url": download_url,
        "file_name": filename,
        "file_path": str(file_path),
        "total_records": total_orders,
        "total_revenue": total_revenue,
        "average_order_value": aov
    }
    await update_report_meta(job_id, completion_meta)
    return completion_meta

async def generate_sales_report_task(
    ctx: Any,
    job_id: str,
    report_type: str,
    date_from: Optional[str],
    date_to: Optional[str],
    format_type: str,
    user_id: str
) -> Dict[str, Any]:
    """ARQ Worker background task for asynchronous report generation."""
    logger.info(f"Worker generating {format_type} report {job_id}...")
    try:
        res = await build_sales_report(job_id, report_type, date_from, date_to, format_type, user_id)
        logger.info(f"Worker completed report {job_id}")
        return res
    except Exception as e:
        logger.error(f"Worker failed report {job_id}: {e}", exc_info=True)
        await update_report_meta(job_id, {"status": "FAILED", "error": str(e)})
        raise

async def generate_report_inline(
    job_id: str,
    report_type: str,
    date_from: Optional[str],
    date_to: Optional[str],
    format_type: str,
    user_id: str
) -> Dict[str, Any]:
    """Inline asynchronous fallback routine."""
    try:
        return await build_sales_report(job_id, report_type, date_from, date_to, format_type, user_id)
    except Exception as e:
        logger.error(f"Inline report generation failed for {job_id}: {e}")
        await update_report_meta(job_id, {"status": "FAILED", "error": str(e)})
        return {"status": "FAILED", "error": str(e)}

from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.voucher import Voucher
from app.schemas.voucher import VoucherCreate, VoucherUpdate, VoucherValidateResponse

class VoucherRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_multi(self, skip: int = 0, limit: int = 100) -> List[Voucher]:
        stmt = select(Voucher).where(Voucher.deleted_at.is_(None)).order_by(Voucher.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, voucher_id: UUID) -> Optional[Voucher]:
        stmt = select(Voucher).where(Voucher.id == voucher_id, Voucher.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_code(self, code: str) -> Optional[Voucher]:
        stmt = select(Voucher).where(Voucher.code == code.strip().upper(), Voucher.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(self, voucher_in: VoucherCreate) -> Voucher:
        voucher = Voucher(
            code=voucher_in.code.strip().upper(),
            discount_type=voucher_in.discount_type.upper(),
            discount_value=voucher_in.discount_value,
            min_order_amount=voucher_in.min_order_amount,
            max_discount_amount=voucher_in.max_discount_amount,
            usage_limit=voucher_in.usage_limit,
            valid_from=voucher_in.valid_from,
            valid_until=voucher_in.valid_until,
            is_active=voucher_in.is_active
        )
        self.session.add(voucher)
        await self.session.commit()
        await self.session.refresh(voucher)
        return voucher

    async def update(self, voucher: Voucher, voucher_in: VoucherUpdate) -> Voucher:
        update_data = voucher_in.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"]:
            update_data["code"] = update_data["code"].strip().upper()
        if "discount_type" in update_data and update_data["discount_type"]:
            update_data["discount_type"] = update_data["discount_type"].upper()
            
        for field, value in update_data.items():
            setattr(voucher, field, value)
        self.session.add(voucher)
        await self.session.commit()
        await self.session.refresh(voucher)
        return voucher

    async def delete(self, voucher: Voucher) -> None:
        await self.session.delete(voucher)
        await self.session.commit()

    async def validate_voucher(self, code: str, order_amount: float) -> VoucherValidateResponse:
        voucher = await self.get_by_code(code)
        if not voucher:
            return VoucherValidateResponse(is_valid=False, message="Mã voucher không tồn tại")
        
        if not voucher.is_active:
            return VoucherValidateResponse(is_valid=False, message="Mã voucher đã bị vô hiệu hóa")

        now = datetime.now(timezone.utc)
        if voucher.valid_from and voucher.valid_from > now:
            return VoucherValidateResponse(is_valid=False, message="Mã voucher chưa đến thời gian áp dụng")
            
        if voucher.valid_until and voucher.valid_until < now:
            return VoucherValidateResponse(is_valid=False, message="Mã voucher đã hết hạn sử dụng")

        if voucher.usage_limit is not None and voucher.times_used >= voucher.usage_limit:
            return VoucherValidateResponse(is_valid=False, message="Mã voucher đã hết lượt sử dụng")

        if order_amount < float(voucher.min_order_amount):
            return VoucherValidateResponse(
                is_valid=False, 
                message=f"Đơn hàng chưa đạt giá trị tối thiểu ${float(voucher.min_order_amount):.2f}"
            )

        # Calculate discount
        if voucher.discount_type == "PERCENTAGE":
            discount = order_amount * (float(voucher.discount_value) / 100.0)
            if voucher.max_discount_amount is not None:
                discount = min(discount, float(voucher.max_discount_amount))
        else: # FIXED
            discount = float(voucher.discount_value)

        discount = min(discount, order_amount)
        final_amount = max(0.0, order_amount - discount)

        return VoucherValidateResponse(
            is_valid=True,
            message="Áp dụng mã giảm giá thành công",
            discount_amount=round(discount, 2),
            final_amount=round(final_amount, 2),
            code=voucher.code
        )

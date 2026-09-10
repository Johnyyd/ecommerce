from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.core.db import get_db_session
from app.models.user import User
from app.schemas.voucher import (
    VoucherCreate, 
    VoucherUpdate, 
    VoucherResponse, 
    VoucherValidateRequest, 
    VoucherValidateResponse
)
from app.crud.voucher import VoucherRepository
from app.api.deps import get_current_staff

router = APIRouter()

def get_voucher_repo(session: AsyncSession = Depends(get_db_session)) -> VoucherRepository:
    return VoucherRepository(session)

@router.get("/", response_model=List[VoucherResponse])
async def list_vouchers(
    skip: int = 0,
    limit: int = 100,
    current_staff: User = Depends(get_current_staff),
    repo: VoucherRepository = Depends(get_voucher_repo)
):
    return await repo.get_multi(skip=skip, limit=limit)

@router.post("/", response_model=VoucherResponse, status_code=status.HTTP_201_CREATED)
async def create_voucher(
    voucher_in: VoucherCreate,
    current_staff: User = Depends(get_current_staff),
    repo: VoucherRepository = Depends(get_voucher_repo)
):
    existing = await repo.get_by_code(voucher_in.code)
    if existing:
        raise HTTPException(status_code=400, detail="Voucher code already exists")
    return await repo.create(voucher_in)

@router.patch("/{id}", response_model=VoucherResponse)
async def update_voucher(
    id: UUID,
    voucher_in: VoucherUpdate,
    current_staff: User = Depends(get_current_staff),
    repo: VoucherRepository = Depends(get_voucher_repo)
):
    voucher = await repo.get_by_id(id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return await repo.update(voucher, voucher_in)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voucher(
    id: UUID,
    current_staff: User = Depends(get_current_staff),
    repo: VoucherRepository = Depends(get_voucher_repo)
):
    voucher = await repo.get_by_id(id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    await repo.delete(voucher)
    return None

@router.post("/validate", response_model=VoucherValidateResponse)
async def validate_voucher(
    req: VoucherValidateRequest,
    repo: VoucherRepository = Depends(get_voucher_repo)
):
    return await repo.validate_voucher(code=req.code, order_amount=req.order_amount)

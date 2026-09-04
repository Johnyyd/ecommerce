from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.core.db import get_db_session
from app.models.user import User
from app.models.address import Address
from app.schemas.address import AddressCreate, AddressUpdate, AddressResponse

router = APIRouter()

@router.get("/", response_model=List[AddressResponse])
async def read_addresses(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Retrieve addresses for the current user.
    """
    stmt = select(Address).where(Address.user_id == current_user.id)
    result = await db.execute(stmt)
    addresses = result.scalars().all()
    return addresses

@router.post("/", response_model=AddressResponse)
async def create_address(
    *,
    db: AsyncSession = Depends(get_db_session),
    address_in: AddressCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Create new address.
    """
    # If this is the first address or is_default is true, set others to not default
    if address_in.is_default:
        stmt = select(Address).where(Address.user_id == current_user.id, Address.is_default == True)
        result = await db.execute(stmt)
        old_default = result.scalars().first()
        if old_default:
            old_default.is_default = False
            db.add(old_default)

    address = Address(
        user_id=current_user.id,
        **address_in.model_dump()
    )
    db.add(address)
    await db.commit()
    await db.refresh(address)
    return address

@router.put("/{id}", response_model=AddressResponse)
async def update_address(
    *,
    db: AsyncSession = Depends(get_db_session),
    id: UUID,
    address_in: AddressUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Update an address.
    """
    stmt = select(Address).where(Address.id == id, Address.user_id == current_user.id)
    result = await db.execute(stmt)
    address = result.scalars().first()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    if address_in.is_default and not address.is_default:
        # unset previous default
        stmt = select(Address).where(Address.user_id == current_user.id, Address.is_default == True)
        result = await db.execute(stmt)
        old_default = result.scalars().first()
        if old_default:
            old_default.is_default = False
            db.add(old_default)

    update_data = address_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(address, field, value)

    db.add(address)
    await db.commit()
    await db.refresh(address)
    return address

@router.delete("/{id}", response_model=AddressResponse)
async def delete_address(
    *,
    db: AsyncSession = Depends(get_db_session),
    id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Delete an address.
    """
    stmt = select(Address).where(Address.id == id, Address.user_id == current_user.id)
    result = await db.execute(stmt)
    address = result.scalars().first()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    await db.delete(address)
    await db.commit()
    return address

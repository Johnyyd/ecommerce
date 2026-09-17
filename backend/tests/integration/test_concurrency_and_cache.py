import pytest
from uuid import UUID
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.schemas.order import OrderCreate, OrderItemCreate
from app.crud.order import OrderRepository
from app.crud.product import ProductRepository
from app.core.utils import generate_uuidv7

def make_fake_result(item):
    res = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.first.return_value = item
    res.scalars.return_value = scalars_mock
    return res

@pytest.mark.asyncio
async def test_order_deduplicates_duplicate_product_ids():
    """Verify that multiple items with same product_id in one order are merged properly."""
    session = AsyncMock(spec=AsyncSession)
    repo = OrderRepository(session)
    
    prod_id = generate_uuidv7()
    mock_product = Product(
        id=prod_id,
        name="Test Item",
        price=10.0,
        stock_quantity=5,
        version=1
    )
    
    with patch.object(ProductRepository, "get_by_id_for_update", new_callable=AsyncMock) as mock_lock, \
         patch("app.services.cache_invalidation.invalidate_product_caches", new_callable=AsyncMock) as mock_invalidate, \
         patch("app.services.payment.PaymentService.generate_payment_url", return_value="http://pay.url"):
        
        mock_lock.return_value = mock_product
        
        order_in = OrderCreate(
            items=[
                OrderItemCreate(product_id=prod_id, quantity=2),
                OrderItemCreate(product_id=prod_id, quantity=1),
            ],
            address_id=generate_uuidv7(),
            payment_method="COD"
        )
        
        fake_order = Order(
            id=generate_uuidv7(),
            user_id=generate_uuidv7(),
            address_id=order_in.address_id,
            payment_method="COD",
            total_amount=30.0,
            status="PENDING",
            items=[],
            payment=None
        )
        session.execute.return_value = make_fake_result(fake_order)

        order = await repo.create_order_with_transaction(generate_uuidv7(), order_in)
        
        # Product should be locked once with merged quantity 3 deducted
        assert mock_lock.call_count == 1
        assert mock_product.stock_quantity == 2  # 5 - (2 + 1) = 2
        mock_invalidate.assert_called_once_with([prod_id])

@pytest.mark.asyncio
async def test_insufficient_stock_raises_value_error():
    """Verify that trying to buy more than available stock raises ValueError."""
    session = AsyncMock(spec=AsyncSession)
    repo = OrderRepository(session)
    
    prod_id = generate_uuidv7()
    mock_product = Product(
        id=prod_id,
        name="Scarce Item",
        price=50.0,
        stock_quantity=1,
        version=1
    )
    
    with patch.object(ProductRepository, "get_by_id_for_update", new_callable=AsyncMock) as mock_lock:
        mock_lock.return_value = mock_product
        
        order_in = OrderCreate(
            items=[OrderItemCreate(product_id=prod_id, quantity=5)],
            address_id=generate_uuidv7(),
            payment_method="COD"
        )
        
        with pytest.raises(ValueError, match="Insufficient stock for product Scarce Item"):
            await repo.create_order_with_transaction(generate_uuidv7(), order_in)
            
        assert mock_product.stock_quantity == 1  # Unchanged

@pytest.mark.asyncio
async def test_order_cancel_restores_stock_and_invalidates_cache():
    """Verify cancel_order restores stock and calls cache invalidation."""
    session = AsyncMock(spec=AsyncSession)
    repo = OrderRepository(session)
    
    prod_id = generate_uuidv7()
    mock_product = Product(
        id=prod_id,
        name="Returnable Item",
        price=20.0,
        stock_quantity=3,
        version=1
    )
    
    order_id = generate_uuidv7()
    user_id = generate_uuidv7()
    mock_order = Order(
        id=order_id,
        user_id=user_id,
        address_id=generate_uuidv7(),
        payment_method="COD",
        total_amount=40.0,
        status="PENDING",
        items=[OrderItem(product_id=prod_id, quantity=2, unit_price=20.0)],
        payment=None
    )
    
    with patch.object(ProductRepository, "get_by_id_for_update", new_callable=AsyncMock) as mock_lock, \
         patch("app.services.cache_invalidation.invalidate_product_caches", new_callable=AsyncMock) as mock_invalidate:
        
        mock_lock.return_value = mock_product
        session.execute.return_value = make_fake_result(mock_order)

        res = await repo.cancel_order(order_id, user_id)
        
        assert res.status == "CANCELLED"
        assert mock_product.stock_quantity == 5  # 3 + 2 = 5
        mock_invalidate.assert_called_once_with([prod_id])

@pytest.mark.asyncio
async def test_admin_cancel_status_restores_stock_and_invalidates_cache():
    """Verify admin_update_status to CANCELLED restores stock and calls cache invalidation."""
    session = AsyncMock(spec=AsyncSession)
    repo = OrderRepository(session)
    
    prod_id = generate_uuidv7()
    mock_product = Product(
        id=prod_id,
        name="Admin Managed Item",
        price=15.0,
        stock_quantity=10,
        version=1
    )
    
    order_id = generate_uuidv7()
    mock_order = Order(
        id=order_id,
        user_id=generate_uuidv7(),
        address_id=generate_uuidv7(),
        payment_method="COD",
        total_amount=30.0,
        status="PROCESSING",
        items=[OrderItem(product_id=prod_id, quantity=2, unit_price=15.0)],
        payment=None
    )
    
    with patch.object(ProductRepository, "get_by_id_for_update", new_callable=AsyncMock) as mock_lock, \
         patch("app.services.cache_invalidation.invalidate_product_caches", new_callable=AsyncMock) as mock_invalidate:
        
        mock_lock.return_value = mock_product
        session.execute.return_value = make_fake_result(mock_order)

        res = await repo.admin_update_status(order_id, "CANCELLED")
        
        assert res.status == "CANCELLED"
        assert mock_product.stock_quantity == 12  # 10 + 2 = 12
        mock_invalidate.assert_called_once_with([prod_id])

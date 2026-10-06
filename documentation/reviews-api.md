# Review System API Documentation

This document describes the API endpoints for the Verified Buyer Review System.

## Overview

The review system implements **Verified Buyer Reviews** - only customers who have purchased and received a product can leave reviews. This prevents fake reviews and ensures authenticity.

### Key Features

- **Verified Purchase Validation**: Only users with `DELIVERED` orders can review
- **Rating Distribution**: Automatic calculation of average rating and distribution
- **Admin Moderation**: Approve/reject/flag reviews with moderation notes
- **BOLA/IDOR Protection**: Users can only delete their own reviews
- **Rating Summary**: Product-level aggregated statistics

---

## Endpoints

### Public Endpoints

#### Get Product Reviews & Rating Summary

```http
GET /api/v1/reviews/product/{product_id}
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | UUID | Yes | Product UUID |

**Response (200 OK):**
```json
{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "average_rating": 4.5,
  "total_reviews": 42,
  "rating_distribution": {
    "5": 25,
    "4": 10,
    "3": 5,
    "2": 1,
    "1": 1
  },
  "reviews": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "user_id": "uuid",
      "username": "customer123",
      "order_id": "uuid",
      "rating": 5,
      "comment": "Excellent product, fast delivery!",
      "is_verified_purchase": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Rating Distribution Format:**
- Keys: Rating values (1-5) as strings
- Values: Count of reviews for each rating
- Used for rendering star distribution bars in UI

---

### Authenticated User Endpoints

#### Create Review (Verified Buyers Only)

```http
POST /api/v1/reviews/
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "order_id": "550e8400-e29b-41d4-a716-446655440001",
  "rating": 5,
  "comment": "Excellent product, fast delivery!"
}
```

**Validation Rules:**
| Field | Required | Validation |
|-------|----------|------------|
| `product_id` | Yes | Valid UUID, product must exist |
| `order_id` | Yes | Valid UUID, order must belong to user, status = `DELIVERED` |
| `rating` | Yes | Integer 1-5 |
| `comment` | No | Max 2000 characters |

**Business Logic Validation:**
1. User must be authenticated
2. Order must belong to the current user
3. Order status must be `DELIVERED` (not `PENDING`, `SHIPPED`, `CANCELLED`)
4. Order must contain the product being reviewed
5. User cannot review the same product for the same order twice

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "550e8400-e29b-41d4-a716-446655440003",
  "username": "customer123",
  "order_id": "550e8400-e29b-41d4-a716-446655440001",
  "rating": 5,
  "comment": "Excellent product, fast delivery!",
  "is_verified_purchase": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
| Status | Code | Message |
|--------|------|---------|
| 403 | `FORBIDDEN` | "Only verified buyers who received the product can review" |
| 400 | `BAD_REQUEST` | "You have already reviewed this product for this order" |
| 404 | `NOT_FOUND` | "Order not found" or "Product not found" |

#### Delete Own Review

```http
DELETE /api/v1/reviews/{review_id}
Authorization: Bearer <access_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `review_id` | UUID | Yes | Review UUID |

**Authorization:**
- User can delete their own review
- Admin/Manager can delete any review

**Response (200 OK):**
```json
{
  "message": "Review deleted successfully"
}
```

**Error Responses:**
| Status | Code | Message |
|--------|------|---------|
| 403 | `FORBIDDEN` | "You can only delete your own reviews" |
| 404 | `NOT_FOUND` | "Review not found" |

---

### Admin/Manager Endpoints (Staff Only)

#### List All Reviews (Admin)

```http
GET /api/v1/reviews/admin/all
Authorization: Bearer <staff_access_token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `product_id` | UUID | No | - | Filter by product |
| `rating` | Integer | No | - | Filter by rating (1-5) |
| `moderation_status` | String | No | - | Filter: `pending`, `approved`, `rejected`, `flagged` |
| `skip` | Integer | No | 0 | Pagination offset |
| `limit` | Integer | No | 100 | Page size (max 100) |

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "product_id": "uuid",
    "product_name": "iPhone 15 Pro",
    "user_id": "uuid",
    "username": "customer123",
    "user_email": "customer@example.com",
    "order_id": "uuid",
    "rating": 5,
    "comment": "Excellent product!",
    "is_verified_purchase": true,
    "is_approved": true,
    "moderation_status": "approved",
    "moderated_by": "uuid",
    "moderated_at": "2024-01-15T11:00:00Z",
    "moderation_note": "Approved - verified purchase",
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

#### Moderate Review (Admin)

```http
PATCH /api/v1/reviews/admin/{review_id}/moderate
Content-Type: application/json
Authorization: Bearer <staff_access_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `review_id` | UUID | Yes | Review UUID |

**Request Body:**
```json
{
  "action": "approve",
  "moderation_note": "Verified purchase, legitimate review"
}
```

**Actions:**
| Action | Description |
|--------|-------------|
| `approve` | Mark review as approved and visible |
| `reject` | Mark review as rejected (hidden from public) |
| `flag` | Flag for further investigation |

**Response (200 OK):**
```json
{
  "id": "uuid",
  "product_id": "uuid",
  "product_name": "iPhone 15 Pro",
  "user_id": "uuid",
  "username": "customer123",
  "user_email": "customer@example.com",
  "order_id": "uuid",
  "rating": 5,
  "comment": "Excellent product!",
  "is_verified_purchase": true,
  "is_approved": true,
  "moderation_status": "approved",
  "moderated_by": "uuid",
  "moderated_at": "2024-01-15T11:00:00Z",
  "moderation_note": "Verified purchase, legitimate review",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
| Status | Code | Message |
|--------|------|---------|
| 400 | `BAD_REQUEST` | "Invalid action. Must be one of: approve, reject, flag" |
| 403 | `FORBIDDEN` | "Insufficient permissions" |
| 404 | `NOT_FOUND` | "Review not found" |

---

## Data Models

### ReviewCreate (Request)
```json
{
  "product_id": "uuid",
  "order_id": "uuid",
  "rating": 5,
  "comment": "string (optional, max 2000 chars)"
}
```

### ReviewResponse
```json
{
  "id": "uuid",
  "product_id": "uuid",
  "user_id": "uuid",
  "username": "string",
  "order_id": "uuid",
  "rating": 5,
  "comment": "string",
  "is_verified_purchase": true,
  "created_at": "datetime"
}
```

### ProductReviewSummary
```json
{
  "product_id": "uuid",
  "average_rating": 4.5,
  "total_reviews": 42,
  "rating_distribution": {
    "5": 25,
    "4": 10,
    "3": 5,
    "2": 1,
    "1": 1
  },
  "reviews": [ReviewResponse]
}
```

### AdminReviewResponse
```json
{
  "id": "uuid",
  "product_id": "uuid",
  "product_name": "string",
  "user_id": "uuid",
  "username": "string",
  "user_email": "string",
  "order_id": "uuid",
  "rating": 5,
  "comment": "string",
  "is_verified_purchase": true,
  "is_approved": true,
  "moderation_status": "approved",
  "moderated_by": "uuid",
  "moderated_at": "datetime",
  "moderation_note": "string",
  "created_at": "datetime"
}
```

### ReviewModerateRequest
```json
{
  "action": "approve|reject|flag",
  "moderation_note": "string (optional)"
}
```

---

## Moderation Status Values

| Status | Description | Public Visibility |
|--------|-------------|-------------------|
| `pending` | Awaiting moderation | Hidden |
| `approved` | Approved by moderator | Visible |
| `rejected` | Rejected by moderator | Hidden |
| `flagged` | Flagged for review | Hidden |

---

## Verified Purchase Logic

The system enforces verified purchases through the following checks:

```python
# Simplified logic from ReviewRepository.create_verified_review()
async def create_verified_review(self, user_id: UUID, review_in: ReviewCreate):
    # 1. Check order exists and belongs to user
    order = await self.get_order(review_in.order_id, user_id)
    if not order:
        raise ValueError("Order not found")
    
    # 2. Check order status is DELIVERED
    if order.status != OrderStatus.DELIVERED:
        raise PermissionError("Only verified buyers who received the product can review")
    
    # 3. Check order contains the product
    if not any(item.product_id == review_in.product_id for item in order.items):
        raise ValueError("Product not in this order")
    
    # 4. Check duplicate review
    existing = await self.get_user_review_for_order(user_id, review_in.product_id, review_in.order_id)
    if existing:
        raise ValueError("You have already reviewed this product for this order")
    
    # 5. Create review with is_verified_purchase=True
    review = Review(
        user_id=user_id,
        product_id=review_in.product_id,
        order_id=review_in.order_id,
        rating=review_in.rating,
        comment=review_in.comment,
        is_verified_purchase=True,
        moderation_status=ModerationStatus.PENDING
    )
```

---

## Security Features

### BOLA/IDOR Protection
- Users can only access/modify their own reviews
- Admin endpoints require `staff` role (manager or admin)
- Order ownership verified before allowing review creation

### Rate Limiting
- Review creation: 10 requests/minute per user
- Admin listing: 100 requests/minute

### Input Validation
- Rating: Integer 1-5
- Comment: Max 2000 characters, sanitized
- UUID validation on all ID parameters

---

## Testing Examples

### Create Review (cURL)

```bash
# 1. Login to get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "customer", "password": "Customer123456@"}' | jq -r .access_token)

# 2. Create review (must have delivered order)
curl -X POST http://localhost:8000/api/v1/reviews/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "order_id": "550e8400-e29b-41d4-a716-446655440001",
    "rating": 5,
    "comment": "Excellent product, fast delivery!"
  }'
```

### Get Product Reviews

```bash
curl http://localhost:8000/api/v1/reviews/product/550e8400-e29b-41d4-a716-446655440000
```

### Admin Moderate Review

```bash
# Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin123456@"}' | jq -r .access_token)

# Approve review
curl -X PATCH http://localhost:8000/api/v1/reviews/admin/REVIEW_UUID/moderate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "moderation_note": "Verified purchase"}'
```

---

## Integration with Frontend

### Product Detail Page
- Fetches `GET /api/v1/reviews/product/{product_id}` on mount
- Displays average rating, distribution bars, and review list
- Shows "Verified Purchase" badge for `is_verified_purchase: true`

### Review Form
- Only shown if user has `DELIVERED` order containing the product
- Validates on client-side before submission
- On success, refreshes review list

### Admin Panel (Tab: Reviews)
- Lists all reviews with filtering
- Inline moderation actions (approve/reject/flag)
- Shows user email and order reference for verification

---

## Related Documentation

- [Payment Gateway Setup](../payment-setup.md) - Order completion flow
- [Order System API](../README.md#orders) - Order statuses
- [Admin Portal](../README.md#admin-portal) - Admin review management

---

*Last updated: 2024-01-15*
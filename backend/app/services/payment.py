from uuid import UUID

class PaymentService:
    @staticmethod
    def generate_payment_url(order_id: UUID, amount: float, method: str) -> str:
        """
        Mock generating payment URL for VNPay and MoMo.
        In a real app, this would use secret keys and hashing to generate a secure URL.
        """
        # We redirect to a mock frontend route /payment
        # The frontend will hit the backend webhook directly from that page to simulate the payment gateway.
        
        base_url = "http://localhost/payment"  # Frontend route for mock gateway
        
        if method == "VNPAY":
            return f"{base_url}?order_id={str(order_id)}&amount={amount}&method=VNPAY&mock_secret=mock_secret_123"
        elif method == "MOMO":
            return f"{base_url}?order_id={str(order_id)}&amount={amount}&method=MOMO&mock_secret=mock_secret_123"
        
        # COD has no payment URL
        return ""

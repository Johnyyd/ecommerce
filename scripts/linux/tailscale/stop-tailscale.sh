#!/bin/bash
cd "$(dirname "$0")/../../.."

# scripts/linux/tailscale/stop-tailscale.sh - Stop Tailscale Serve proxying

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}        DỪNG DỊCH VỤ TAILSCALE SERVE                   ${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo ""

if ! command -v tailscale &> /dev/null; then
    echo -e "${RED}Tailscale chưa được cài đặt.${NC}"
    exit 0
fi

echo "Đang tắt chuyển tiếp cổng 80 và 3000..."
tailscale serve --tcp=80 off 2>/dev/null || true
tailscale serve --tcp=3000 off 2>/dev/null || true

echo -e "${GREEN}✓ Đã đóng các cổng Tailscale Serve thành công.${NC}"
echo "Trạng thái hiện tại:"
tailscale serve status 2>/dev/null || true
echo ""

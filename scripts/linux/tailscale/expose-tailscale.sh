#!/bin/bash
cd "$(dirname "$0")/../../.."

# scripts/linux/tailscale/expose-tailscale.sh - Expose Frontend and Grafana over Tailscale

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}       TAILSCALE REMOTE ACCESS INTEGRATION             ${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo ""

# 1. Check if Tailscale CLI is available
echo -e "${CYAN}[1/3] Kiểm tra cài đặt và trạng thái Tailscale...${NC}"
if ! command -v tailscale &> /dev/null; then
    echo -e "${RED}Lỗi: Chưa tìm thấy Tailscale trên máy.${NC}"
    echo -e "Vui lòng cài đặt Tailscale: ${YELLOW}curl -fsSL https://tailscale.com/install.sh | sh${NC}"
    echo -e "Sau đó đăng nhập: ${YELLOW}sudo tailscale up${NC}"
    exit 1
fi

# Check if Tailscale is logged in and active
if ! tailscale status &> /dev/null; then
    echo -e "${RED}Lỗi: Tailscale daemon chưa kết nối hoặc chưa đăng nhập.${NC}"
    echo -e "Hãy chạy lệnh: ${YELLOW}sudo tailscale up${NC} để đăng nhập vào tailnet của bạn."
    exit 1
fi

TS_IP=$(tailscale ip -4 2>/dev/null | tail -n 1)
TS_DNS=$(tailscale status --self --json 2>/dev/null | grep -i '"DNSName":' | head -n 1 | awk -F'"' '{print $4}' | sed 's/\.$//' || echo "")

if [ -z "$TS_IP" ]; then
    echo -e "${RED}Lỗi: Không lấy được địa chỉ IPv4 Tailscale.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Tailscale đang hoạt động!${NC}"
echo -e "  - Tailscale IP: ${YELLOW}${TS_IP}${NC}"
if [ -n "$TS_DNS" ]; then
    echo -e "  - MagicDNS:     ${YELLOW}${TS_DNS}${NC}"
fi
echo ""

# 2. Detect Running Environment (Kubernetes vs Docker Compose)
echo -e "${CYAN}[2/3] Phát hiện môi trường dịch vụ đang chạy...${NC}"
FE_TARGET=""
GRAFANA_TARGET=""

# Check if Minikube is active
if command -v minikube &> /dev/null && minikube status &> /dev/null; then
    MINIKUBE_IP=$(minikube ip 2>/dev/null || echo "192.168.49.2")
    echo -e "Phát hiện môi trường ${GREEN}Kubernetes (Minikube)${NC} tại IP: ${MINIKUBE_IP}"
    
    # Ingress exposes port 80 for frontend and /api for backend
    FE_TARGET="${MINIKUBE_IP}:80"
    
    # Find Grafana NodePort if available, default to 30511
    GRAFANA_PORT="3000"
    if command -v kubectl &> /dev/null; then
        NODE_PORT=$(kubectl get svc grafana -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || true)
        if [ -n "$NODE_PORT" ]; then
            GRAFANA_PORT="$NODE_PORT"
        fi
    fi
    GRAFANA_TARGET="${MINIKUBE_IP}:${GRAFANA_PORT}"

elif docker ps 2>/dev/null | grep -q "ecommerce-frontend"; then
    echo -e "Phát hiện môi trường ${GREEN}Docker Compose${NC}."
    FE_TARGET="127.0.0.1:80"
    GRAFANA_TARGET="127.0.0.1:3000"
else
    # Fallback default
    echo -e "${YELLOW}Không tìm thấy container đang chạy. Sử dụng cấu hình mặc định (localhost)...${NC}"
    FE_TARGET="127.0.0.1:80"
    GRAFANA_TARGET="127.0.0.1:3000"
fi

echo -e "  - Đích chuyển tiếp Frontend: ${CYAN}tcp://${FE_TARGET}${NC}"
echo -e "  - Đích chuyển tiếp Grafana:  ${CYAN}tcp://${GRAFANA_TARGET}${NC}"
echo ""

# 3. Configure Tailscale Serve (TCP mode for full protocol & raw IP compatibility)
echo -e "${CYAN}[3/3] Kích hoạt Tailscale Serve TCP Forwarding...${NC}"

# Stop old mappings if present
tailscale serve --tcp=80 off 2>/dev/null || true
tailscale serve --tcp=3000 off 2>/dev/null || true

# Start TCP forwarding
tailscale serve --bg --tcp 80 "tcp://${FE_TARGET}" > /dev/null
tailscale serve --bg --tcp 3000 "tcp://${GRAFANA_TARGET}" > /dev/null

echo -e "${GREEN}✓ Đã cấu hình Tailscale Serve thành công!${NC}"
echo ""
echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}        ĐỊA CHỈ TRUY CẬP TỪ MÁY KHÁC / ĐIỆN THOẠI      ${NC}"
echo -e "${GREEN}=======================================================${NC}"
echo ""
echo -e "Từ bất kỳ thiết bị nào (điện thoại, laptop, PC) kết nối cùng tài khoản Tailscale:"
echo ""
echo -e "🌐 ${YELLOW}Frontend (Cửa hàng E-Commerce):${NC}"
echo -e "   • Theo IP:        ${CYAN}http://${TS_IP}${NC}"
if [ -n "$TS_DNS" ]; then
    echo -e "   • Theo MagicDNS:  ${CYAN}http://${TS_DNS}${NC}"
fi
echo ""
echo -e "📊 ${YELLOW}Grafana Dashboard (Giám sát hệ thống):${NC}"
echo -e "   • Theo IP:        ${CYAN}http://${TS_IP}:3000${NC}"
if [ -n "$TS_DNS" ]; then
    echo -e "   • Theo MagicDNS:  ${CYAN}http://${TS_DNS}:3000${NC}"
fi
echo -e "   • Đăng nhập mặc định: ${YELLOW}admin / admin${NC}"
echo ""
echo -e "🔌 ${YELLOW}Backend API (Swagger Docs):${NC}"
echo -e "   • URL:            ${CYAN}http://${TS_IP}/api/v1/docs${NC}"
echo ""
echo -e "${BLUE}Lưu ý:${NC}"
echo -e "- Để dừng chia sẻ qua Tailscale, chạy: ${YELLOW}bash scripts/linux/tailscale/stop-tailscale.sh${NC}"
echo -e "- Để kiểm tra trạng thái chia sẻ: ${YELLOW}tailscale serve status${NC}"
echo ""

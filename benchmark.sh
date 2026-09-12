#!/usr/bin/env bash
# ==============================================================================
# Premium E-Commerce Platform - Load Testing & Auto-Scaling Benchmark (ab)
# ==============================================================================

set -e

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "========================================================================"
echo "    PREMIUM E-COMMERCE - APACHE BENCHMARK & K8S HPA LOAD TEST           "
echo "========================================================================"
echo -e "${NC}"

# Check for 'ab' tool
if ! command -v ab &> /dev/null; then
    echo -e "${RED}Lỗi: Không tìm thấy lệnh 'ab' (ApacheBench) trên hệ thống.${NC}"
    echo "Cài đặt trên Ubuntu/Debian: sudo apt-get install -y apache2-utils"
    echo "Cài đặt trên Arch Linux:   sudo pacman -S apache"
    echo "Cài đặt trên RHEL/CentOS:  sudo yum install -y httpd-tools"
    exit 1
fi

# Detect Target Host
TARGET_HOST="192.168.49.2"
if command -v minikube &> /dev/null; then
    MK_IP=$(minikube ip 2>/dev/null || true)
    if [ -n "$MK_IP" ]; then
        TARGET_HOST="$MK_IP"
    fi
fi

# Check if target is responding
echo -e "Kiểm tra kết nối tới cluster Gateway (${BLUE}http://${TARGET_HOST}/api/health${NC})..."
if ! curl -s --max-time 3 "http://${TARGET_HOST}/api/health" | grep -q "ok"; then
    echo -e "${YELLOW}Cảnh báo: Không thể kết nối qua Ingress IP (${TARGET_HOST}). Kiểm tra localhost...${NC}"
    if curl -s --max-time 3 "http://localhost/api/health" | grep -q "ok"; then
        TARGET_HOST="localhost"
        echo -e "${GREEN}✓ Đã chuyển sang target http://localhost${NC}"
    elif curl -s --max-time 3 "http://localhost:8000/api/health" | grep -q "ok"; then
        TARGET_HOST="localhost:8000"
        echo -e "${GREEN}✓ Đã chuyển sang target http://localhost:8000${NC}"
    else
        echo -e "${RED}Lỗi: Không thể kết nối tới Backend API. Hãy đảm bảo cụm Minikube hoặc Docker đang chạy.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Kết nối Backend API sẵn sàng!${NC}\n"

# Fetch Grafana URL if available
GRAFANA_URL="http://${TARGET_HOST}:32589"
if command -v kubectl &> /dev/null; then
    NODE_PORT=$(kubectl get svc grafana -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "32589")
    GRAFANA_URL="http://${TARGET_HOST}:${NODE_PORT}"
fi

echo -e "${MAGENTA}${BOLD}📊 GRAFANA MONITORING DASHBOARD:${NC}"
echo -e "   URL: ${CYAN}${BOLD}${GRAFANA_URL}${NC}"
echo -e "   (Hoặc ${CYAN}http://localhost:3000${NC} nếu đang chạy 'minikube tunnel')"
echo -e "   Tài khoản: ${BOLD}admin / admin${NC} -> Mở Dashboard: ${BOLD}Operations / Premium E-Commerce Platform - System Monitoring${NC}\n"

# Menu options
echo -e "${BOLD}Chọn kịch bản Benchmark:${NC}"
echo -e "  ${CYAN}1)${NC} Fast Warm-up (Health Check: /api/health)       - 5,000 reqs, Concurrency: 50"
echo -e "  ${CYAN}2)${NC} Standard Load (Products API: /api/v1/products/) - 10,000 reqs, Concurrency: 100"
echo -e "  ${CYAN}3)${NC} ${BOLD}HPA Auto-Scale Stress Test (Products API)${NC}      - 25,000 reqs, Concurrency: 150 (Kích hoạt scale pod)"
echo -e "  ${CYAN}4)${NC} Custom Parameters (Tự chọn endpoint, số request, concurrency)"
echo ""

CHOICE="${1:-}"
if [ -z "$CHOICE" ]; then
    read -p "Nhập lựa chọn của bạn [1-4] (Mặc định: 3): " CHOICE
    CHOICE="${CHOICE:-3}"
fi

case "$CHOICE" in
    1)
        ENDPOINT="/api/health"
        REQUESTS=5000
        CONCURRENCY=50
        KEEP_ALIVE="-k"
        ;;
    2)
        ENDPOINT="/api/v1/products/"
        REQUESTS=5000
        CONCURRENCY=50
        KEEP_ALIVE="-k"
        ;;
    3)
        ENDPOINT="/api/v1/products/"
        REQUESTS=10000
        CONCURRENCY=100
        KEEP_ALIVE="-k"
        ;;
    4)
        read -p "Đường dẫn endpoint (Ví dụ: /api/v1/products/): " ENDPOINT
        ENDPOINT="${ENDPOINT:-/api/v1/products/}"
        read -p "Tổng số requests (Ví dụ: 10000): " REQUESTS
        REQUESTS="${REQUESTS:-10000}"
        read -p "Mức đồng thời / Concurrency (Ví dụ: 100): " CONCURRENCY
        CONCURRENCY="${CONCURRENCY:-100}"
        KEEP_ALIVE="-k"
        ;;
    *)
        echo -e "${RED}Lựa chọn không hợp lệ. Thoát.${NC}"
        exit 1
        ;;
esac

TARGET_URL="http://${TARGET_HOST}${ENDPOINT}"

echo ""
echo -e "${BOLD}========================================================================"
echo -e " THÔNG SỐ KIỂM THỬ TẢI:"
echo -e "   Target URL    : ${CYAN}${TARGET_URL}${NC}"
echo -e "   Tổng Requests : ${BOLD}${REQUESTS}${NC}"
echo -e "   Concurrency   : ${BOLD}${CONCURRENCY}${NC}"
echo -e "   Keep-Alive    : ${BOLD}Bật (-k)${NC}"
echo -e "========================================================================${NC}\n"

# Check Initial Pod & HPA State
if command -v kubectl &> /dev/null && kubectl get deployment backend &>/dev/null; then
    echo -e "${YELLOW}Trạng thái Pods và HPA trước khi tải:${NC}"
    kubectl get hpa backend-hpa 2>/dev/null || true
    kubectl get pods -l app=backend --no-headers | awk '{print "  Pod: " $1 " | Status: " $3 " | Ready: " $2}'
    echo ""
fi

# Background Watcher for HPA/Pods during test
WATCHER_PID=""
if command -v kubectl &> /dev/null && kubectl get deployment backend &>/dev/null; then
    (
        while true; do
            sleep 4
            REPLICAS=$(kubectl get deployment backend -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "?")
            HPA_CPU=$(kubectl get hpa backend-hpa -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}' 2>/dev/null || echo "N/A")
            echo -e "\n  ${MAGENTA}[Auto-Scaler Monitor]${NC} Active Pods: ${GREEN}${BOLD}${REPLICAS}${NC} | CPU Utilization: ${YELLOW}${HPA_CPU}%${NC}"
        done
    ) &
    WATCHER_PID=$!
fi

# Cleanup watcher on exit
cleanup() {
    if [ -n "$WATCHER_PID" ]; then
        kill "$WATCHER_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

echo -e "${GREEN}${BOLD}🚀 ĐANG BẮT ĐẦU CHẠY APACHE BENCHMARK...${NC}"
echo -e "(Mẹo: Quan sát biểu đồ thời gian thực tại Grafana: ${CYAN}${GRAFANA_URL}${NC})\n"

START_TIME=$(date +%s)
TMP_OUTPUT=$(mktemp)

# Run ApacheBench
ab ${KEEP_ALIVE} -s 60 -c "${CONCURRENCY}" -n "${REQUESTS}" "${TARGET_URL}" > "${TMP_OUTPUT}" 2>&1 || true

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Stop watcher
if [ -n "$WATCHER_PID" ]; then
    kill "$WATCHER_PID" 2>/dev/null || true
    WATCHER_PID=""
fi

echo -e "\n${GREEN}========================================================================"
echo -e "                    KẾT QUẢ BENCHMARK (APACHE BENCH)                    "
echo -e "========================================================================${NC}"

# Parse and display key metrics
grep -E "(Server Software|Server Hostname|Complete requests|Failed requests|Total transferred|Requests per second|Time per request|Transfer rate)" "${TMP_OUTPUT}" || cat "${TMP_OUTPUT}"

echo ""
echo -e "${CYAN}${BOLD}ĐỘ TRỄ PHẢN HỒI (LATENCY PERCENTILES):${NC}"
grep -A 8 "Percentage of the requests served within a certain time" "${TMP_OUTPUT}" | tail -n 8 || true

echo ""
echo -e "${YELLOW}========================================================================"
echo -e "              TRẠNG THÁI KUBERNETES AUTO-SCALING SAU TẢI                "
echo -e "========================================================================${NC}"
if command -v kubectl &> /dev/null && kubectl get deployment backend &>/dev/null; then
    kubectl get hpa backend-hpa 2>/dev/null || true
    echo ""
    kubectl get pods -l app=backend --no-headers | awk '{print "  Pod: " $1 " | Status: " $3 " | Ready: " $2}'
fi

echo ""
echo -e "${GREEN}✓ Hoàn thành benchmark trong ${DURATION} giây!${NC}"
echo -e "Xem lại biểu đồ Throughput, Latency P50-P99 và CPU/Memory trên Grafana:"
echo -e "👉 ${CYAN}${BOLD}${GRAFANA_URL}${NC}\n"

rm -f "${TMP_OUTPUT}"

#!/bin/bash
# start-k8s-linux.sh - Automated local Kubernetes deployment for Linux (Minikube / Kind)

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}   PREMIUM E-COMMERCE - KUBERNETES AUTOMATION (LINUX)  ${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo ""

# -------------------------------------------------------------
# 1. Check Docker
# -------------------------------------------------------------
echo -e "${CYAN}[1/7] Kiểm tra Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Lỗi: Docker chưa được cài đặt. Vui lòng cài đặt Docker trước.${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}Lỗi: Docker daemon chưa chạy.${NC}"
    echo -e "Hãy khởi động Docker bằng lệnh: ${YELLOW}sudo systemctl start docker${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker đang hoạt động.${NC}"

# -------------------------------------------------------------
# 2. Check kubectl
# -------------------------------------------------------------
echo -e "${CYAN}[2/7] Kiểm tra kubectl...${NC}"
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}kubectl chưa được cài đặt.${NC}"
    if command -v pacman &> /dev/null; then
        echo "Đang cài đặt kubectl qua pacman..."
        sudo pacman -S --noconfirm kubectl
    else
        echo -e "${RED}Vui lòng cài đặt kubectl trước khi tiếp tục.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ kubectl đã sẵn sàng ($(kubectl version --client -o yaml 2>/dev/null | grep gitVersion | head -n1 | awk '{print $2}' || echo "installed")).${NC}"

# -------------------------------------------------------------
# 3. Check & Setup Local Cluster (Minikube / Kind)
# -------------------------------------------------------------
echo -e "${CYAN}[3/7] Kiểm tra cụm Kubernetes cục bộ (Minikube / Kind)...${NC}"

CLUSTER_TOOL=""
if command -v minikube &> /dev/null; then
    CLUSTER_TOOL="minikube"
elif command -v kind &> /dev/null; then
    CLUSTER_TOOL="kind"
else
    echo -e "${YELLOW}Chưa tìm thấy Minikube hoặc Kind trên máy.${NC}"
    if command -v pacman &> /dev/null; then
        echo -e "Tự động cài đặt ${GREEN}minikube${NC} bằng pacman..."
        sudo pacman -S --noconfirm minikube
        CLUSTER_TOOL="minikube"
    else
        echo -e "${RED}Vui lòng cài đặt Minikube (sudo pacman -S minikube) hoặc Kind.${NC}"
        exit 1
    fi
fi

if [ "$CLUSTER_TOOL" = "minikube" ]; then
    echo -e "Sử dụng ${GREEN}Minikube${NC} làm cluster provider."
    # Check if minikube is running
    if ! minikube status &> /dev/null; then
        echo "Khởi động Minikube (driver=docker)..."
        minikube start --driver=docker
    else
        echo -e "${GREEN}✓ Minikube cluster đang chạy.${NC}"
    fi

    # Ensure DNS resolution inside Minikube works (resolves host systemd-resolved / tailscale bridge DNS issues)
    echo "Cấu hình DNS cho Minikube node..."
    minikube ssh "echo -e 'nameserver 8.8.8.8\nnameserver 1.1.1.1' | sudo tee /etc/resolv.conf" 2>/dev/null || true

    # Enable ingress addon if not enabled
    echo "Bật Ingress addon trên Minikube..."
    minikube addons enable ingress 2>/dev/null || true

elif [ "$CLUSTER_TOOL" = "kind" ]; then
    echo -e "Sử dụng ${GREEN}Kind${NC} làm cluster provider."
    if ! kind get clusters 2>/dev/null | grep -q 'kind'; then
        echo "Tạo mới Kind cluster..."
        kind create cluster
    else
        echo -e "${GREEN}✓ Kind cluster đang chạy.${NC}"
    fi
fi

# Verify cluster connectivity
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Lỗi: Không thể kết nối tới Kubernetes cluster.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Đã kết nối thành công tới Kubernetes cluster.${NC}"

# -------------------------------------------------------------
# 4. Stop Docker Compose (Avoid Port Conflicts)
# -------------------------------------------------------------
echo -e "${CYAN}[4/7] Kiểm tra và tắt Docker Compose để tránh xung đột cổng...${NC}"
if command -v docker-compose &> /dev/null; then
    docker-compose down 2>/dev/null || true
elif docker compose version &> /dev/null; then
    docker compose down 2>/dev/null || true
fi
echo -e "${GREEN}✓ Cổng hệ thống đã sẵn sàng cho Kubernetes.${NC}"

# -------------------------------------------------------------
# 5. Environment & Secrets
# -------------------------------------------------------------
echo -e "${CYAN}[5/7] Chuẩn bị biến môi trường và Kubernetes Secrets...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "Không tìm thấy .env, tự động tạo từ .env.example..."
        cp .env.example .env
    else
        echo -e "${YELLOW}Cảnh báo: Không tìm thấy file .env hoặc .env.example.${NC}"
    fi
fi

if [ -f .env ]; then
    kubectl create secret generic app-secrets --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -
    kubectl create secret generic db-secrets --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -
    echo -e "${GREEN}✓ Đã áp dụng app-secrets và db-secrets từ .env.${NC}"
fi

# -------------------------------------------------------------
# 6. Build and Load Docker Images
# -------------------------------------------------------------
echo -e "${CYAN}[6/7] Build và nạp Docker images vào Kubernetes cluster...${NC}"

echo "Đang build image ecommerce-backend:latest..."
docker build -t ecommerce-backend:latest ./backend

echo "Đang build image ecommerce-frontend:latest..."
docker build -t ecommerce-frontend:latest ./frontend

echo "Đang nạp images vào cluster ($CLUSTER_TOOL)..."
if [ "$CLUSTER_TOOL" = "minikube" ]; then
    minikube image load ecommerce-backend:latest
    minikube image load ecommerce-frontend:latest
elif [ "$CLUSTER_TOOL" = "kind" ]; then
    kind load docker-image ecommerce-backend:latest
    kind load docker-image ecommerce-frontend:latest
fi
echo -e "${GREEN}✓ Images đã được nạp thành công vào cluster.${NC}"

# -------------------------------------------------------------
# 7. Deploy Kubernetes Manifests
# -------------------------------------------------------------
echo -e "${CYAN}[7/7] Triển khai Kubernetes manifests (k8s/)...${NC}"

# Delete old jobs/pods if they exist so migration job can re-run
kubectl delete job db-migration-job --ignore-not-found=true
kubectl delete pod image-cleaner --ignore-not-found=true

# Wait for Ingress Controller if using Minikube
if [ "$CLUSTER_TOOL" = "minikube" ]; then
    echo "Đợi Ingress Controller sẵn sàng..."
    kubectl wait --namespace ingress-nginx \
      --for=condition=ready pod \
      --selector=app.kubernetes.io/component=controller \
      --timeout=90s 2>/dev/null || true
fi

# Apply all manifests
kubectl apply -f k8s/

echo ""
echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}        TRIỂN KHAI KUBERNETES HOÀN TẤT!               ${NC}"
echo -e "${GREEN}=======================================================${NC}"
echo ""
echo -e "Để theo dõi trạng thái các Pod và Service, chạy:"
echo -e "   ${YELLOW}bash status.sh${NC}"
echo -e "hoặc:"
echo -e "   ${YELLOW}kubectl get pods -w${NC}"
echo ""

if [ "$CLUSTER_TOOL" = "minikube" ]; then
    echo -e "${BLUE}Cách truy cập ứng dụng trên Minikube (chọn 1 trong 2):${NC}"
    echo -e "1. ${YELLOW}Cách 1 (Khuyên dùng - Nhanh gọn):${NC} Mở thẳng URL frontend trong trình duyệt:"
    echo -e "   ${CYAN}minikube service frontend${NC}"
    echo ""
    echo -e "2. ${YELLOW}Cách 2 (LoadBalancer / Ingress qua http://localhost):${NC}"
    echo -e "   Mở một terminal mới và chạy lệnh (yêu cầu sudo để bind cổng 80):"
    echo -e "   ${CYAN}minikube tunnel${NC}"
    echo -e "   Sau đó truy cập: ${CYAN}http://localhost${NC} (Frontend) và ${CYAN}http://localhost:8000${NC} (Backend)"
fi
echo ""

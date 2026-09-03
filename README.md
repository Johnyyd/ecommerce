# Premium E-Commerce Platform

Đây là một dự án học tập mang tính chất mô phỏng quy trình thực tế phát triển phần mềm, từ khâu thiết kế kiến trúc, code ứng dụng cho đến kiểm thử tự động và triển khai hệ thống (CI/CD, DevOps). Dự án được xây dựng với mục tiêu cung cấp một hệ thống thương mại điện tử mạnh mẽ, hiệu suất cao và có khả năng mở rộng tốt.

## 📖 Mô tả hệ thống

Hệ thống cung cấp nền tảng thương mại điện tử với các tính năng cơ bản như quản lý sản phẩm, giỏ hàng, xác thực người dùng và thanh toán.
Kiến trúc hệ thống được thiết kế theo mô hình Microservices/SOA gọn nhẹ, tách biệt giữa Frontend và Backend, đồng thời sử dụng các kỹ thuật tối ưu như Connection Pooling cho Database và In-memory Caching để đảm bảo tốc độ phản hồi nhanh.

## 🚀 Công nghệ sử dụng (Tech Stack)

### 1. Backend

- **Ngôn ngữ & Framework**: Python 3.12, FastAPI (Async) giúp xử lý hàng nghìn request đồng thời.
- **Cơ sở dữ liệu (Database)**: PostgreSQL 16 (sử dụng asyncpg cho các thao tác bất đồng bộ).
- **Caching**: Redis phục vụ lưu trữ session và cache dữ liệu thường xuyên truy xuất.
- **Connection Pooling**: PgBouncer được sử dụng để quản lý kết nối hiệu quả tới PostgreSQL, tránh quá tải số lượng connection.
- **ORM & Migrations**: SQLAlchemy 2.0 và Alembic.

### 2. Frontend

- **Ngôn ngữ & Library**: React 18, TypeScript, Vite.
- **Quản lý state**: Zustand cho global state nhẹ và hiệu quả.
- **Giao diện & UI**: TailwindCSS, Framer Motion (cho các hiệu ứng chuyển động mượt mà), Lucide React (Icons).
- **Testing**: Vitest và React Testing Library.

### 3. DevOps & Infrastructure

- **Containerization**: Docker & Docker Compose.
- **Orchestration**: Kubernetes (K8s) cho phép tự động thay thế pod khi lỗi, quản lý scaling.
- **CI/CD**: GitHub Actions tích hợp luồng kiểm thử, build image và dry-run deploy K8s.
- **Proxy/Routing**: Nginx Ingress Controller (nếu dùng K8s) hoặc Nginx reverse proxy.

## 🧪 Quy trình kiểm thử (Testing)

Dự án áp dụng quy trình kiểm thử tự động chặt chẽ để đảm bảo chất lượng code trước khi deploy:

- **Unit Testing Backend**: Sử dụng `pytest` kết hợp `pytest-asyncio` và `pytest-cov` để đo lường độ phủ của code (coverage).
- **Unit Testing Frontend**: Sử dụng `vitest` để test các component và logic của giao diện.
- **Linting & Code Quality**:
  - Frontend: `eslint` để bắt lỗi cú pháp.
  - Backend: `flake8` để đảm bảo code chuẩn PEP8.
- **Security Scan**: Chạy `bandit` để dò quét các lỗ hổng bảo mật phổ biến trong code Python.

## ⚙️ Hướng dẫn cài đặt và Deploy

Dự án cung cấp sẵn các bộ script tiện ích hỗ trợ khởi chạy nhanh chóng trên cả Windows và Linux/macOS.
_Lưu ý: Bạn cần copy file `.env.example` thành `.env` ở thư mục gốc và cấu hình các biến cần thiết trước khi khởi chạy._

### Cách 1: Chạy bằng Docker Compose (Khuyên dùng cho môi trường Dev)

Sử dụng Docker Compose giúp bạn khởi chạy nhanh toàn bộ các services bao gồm Backend, Frontend, Postgres, PgBouncer, và Redis chỉ với một câu lệnh.

- **Trên Windows**:
  - Khởi động: Chạy file `start-docker.bat`
  - Tắt hệ thống: Chạy file `stop-docker.bat`
- **Trên Linux/macOS**:
  - Khởi động: `bash start-docker.sh`
  - Tắt hệ thống: `bash stop-docker.sh`

### Cách 2: Deploy lên Kubernetes (K8s)

Dành cho môi trường Production hoặc khi bạn muốn mô phỏng hệ thống K8s (sử dụng Docker Desktop Kubernetes hoặc Minikube).

- **Trên Windows**:
  - Triển khai: Chạy file `start-k8s.bat`
  - Gỡ bỏ: Chạy file `stop-k8s.bat`
- **Trên Linux/macOS**:
  - Triển khai: `bash start-k8s.sh`
  - Gỡ bỏ: `bash stop-k8s.sh`

K8s Deployment bao gồm một `db-migration-job` chạy tự động mỗi khi khởi tạo để đảm bảo Database schema luôn được cập nhật mới nhất trước khi các Backend Pod được phép nhận request.

---

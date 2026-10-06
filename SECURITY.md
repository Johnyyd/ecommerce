# Chính Sách & Chuẩn Bảo Mật (Security Policy & Standards)

Tài liệu này xác định các chính sách, chuẩn mực thiết kế và kiến trúc bảo mật phòng thủ chiều sâu (Defense-in-Depth) được áp dụng trong toàn bộ hệ thống E-commerce, bao gồm tầng Ứng dụng, Cơ sở dữ liệu, Container và Kubernetes.

---

## 1. Phiên Bản Được Hỗ Trợ (Supported Versions)

Chúng tôi liên tục cập nhật các bản vá bảo mật cho các nhánh và phiên bản sau:

| Phiên Bản / Nhánh | Nhận Bản Vá Bảo Mật | Ghi Chú |
| :--- | :--- | :--- |
| `main` |  Có | Nhánh phát hành chính thức (Production) |
| `feature` |  Có | Nhánh tích hợp tính năng |
| `< 1.0.0` (Legacy) |  Không | Khuyến nghị nâng cấp lên phiên bản mới nhất |

---

## 2. Quy Trình Báo Cáo Lỗ Hổng Bảo Mật (Vulnerability Disclosure)

Nếu bạn phát hiện lỗ hổng bảo mật trong hệ thống, vui lòng thực hiện theo quy trình Tiết lộ có trách nhiệm (Coordinated Vulnerability Disclosure - CVD):

1. **Kênh liên hệ khẩn cấp**:
   - Gửi email chi tiết tới: `security@ecommerce.local` (hoặc mở Private Vulnerability Advisory trên GitHub).
   - **Vui lòng KHÔNG** tạo Public Issue hoặc thảo luận công khai trước khi lỗi được khắc phục.
2. **Nội dung báo cáo**:
   - Mô tả chi tiết lỗ hổng và phạm vi ảnh hưởng (Asset/Endpoint).
   - Bằng chứng khái niệm (Proof-of-Concept - PoC) hoặc các bước tái hiện (Requests/Payloads).
   - Đánh giá mức độ nghiêm trọng (CVSS score) nếu có.
3. **Cam kết SLA phản hồi**:
   - **Xác nhận tiếp nhận**: Trong vòng 24 - 48 giờ làm việc.
   - **Đánh giá & Phân loại**: Trong vòng 3 - 5 ngày làm việc.
   - **Phát hành bản vá**: 7 đến 30 ngày tùy theo mức độ nghiêm trọng (Critical/High/Medium/Low).

---

## 3. Kiến Trúc Bảo Mật Phòng Thủ Chiều Sâu (Defense-in-Depth Architecture)

Hệ thống được thiết kế theo mô hình bảo mật đa tầng, đảm bảo nếu một lớp phòng thủ bị vi phạm thì các lớp khác vẫn ngăn chặn được kẻ tấn công.

```
+-------------------------------------------------------------------------+
| [1] Mạng & Vành đai (Network & Perimeter)                              |
| - K8s Ingress Controller & NetworkPolicies (Default Deny / Egress Rules)|
| - Nginx Reverse Proxy (Server tokens off, Timeouts, Body size limits)   |
+-------------------------------------------------------------------------+
                                    |
+-------------------------------------------------------------------------+
| [2] Web & Tiêu đề Bảo mật (HTTP Security Headers)                      |
| - CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff    |
| - Permissions-Policy, Referrer-Policy: strict-origin-when-cross-origin  |
+-------------------------------------------------------------------------+
                                    |
+-------------------------------------------------------------------------+
| [3] Ứng dụng & API (FastAPI / OWASP Top 10 Defenses)                    |
| - RBAC (Admin, Staff, Customer), IDOR Ownership Enforcement             |
| - Rate Limiting (SlowAPI / Redis Token Bucket)                          |
| - Password Hashing (Argon2id), JWT Token Verification                   |
| - File Upload MIME Magic Byte Validation                                |
+-------------------------------------------------------------------------+
                                    |
+-------------------------------------------------------------------------+
| [4] Container & Kubernetes (CIS Benchmark & Pod Security Standards)    |
| - Non-root Execution (UID/GID 1000), Seccomp RuntimeDefault             |
| - Drop ALL Linux Capabilities, allowPrivilegeEscalation: false          |
| - automountServiceAccountToken: false, enableServiceLinks: false        |
| - Resource Limits (CPU & RAM) ngăn chặn DoS / Out-of-Memory             |
+-------------------------------------------------------------------------+
                                    |
+-------------------------------------------------------------------------+
| [5] Dữ liệu & Lưu trữ (Data & Secrets Layer)                           |
| - Phân tách Secrets (app-secrets, db-secrets), .env loại trừ khỏi Git   |
| - PgBouncer Transaction Pooling & TLS Connection                        |
| - Mã hóa Backup tự động (PostgreSQL Dump CronJob)                       |
+-------------------------------------------------------------------------+
```

---

## 4. Ma Trận Phòng Ngự OWASP Top 10

| Hạng mục OWASP | Rủi ro tiềm ẩn | Biện pháp bảo vệ trong mã nguồn dự án |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | BOLA / IDOR, Leo thang đặc quyền người dùng | <ul><li>Phân quyền RBAC (`get_current_admin`, `get_current_user`, `get_current_staff`).</li><li>Mọi truy vấn Order, Address, Review đều xác thực quyền sở hữu (`WHERE user_id == current_user.id`).</li><li>Admin endpoints được bảo vệ nghiêm ngặt (trả về 403 Forbidden nếu không có quyền).</li></ul> |
| **A02: Cryptographic Failures** | Lộ lọt mật khẩu, yếu mật mã JWT | <ul><li>Mật khẩu lưu trữ bằng thuật toán **Argon2id** (`m=65536, t=3, p=4`).</li><li>Token JWT có thời gian hết hạn nghiêm ngặt (Access Token: 15m, Refresh Token: 7d).</li><li>Bắt buộc `SECRET_KEY` mạnh và cấm dùng secret mặc định ở môi trường production.</li></ul> |
| **A03: Injection** | SQL Injection, XSS, Path Traversal | <ul><li>Toàn bộ truy vấn Database sử dụng SQLAlchemy 2.0 async ORM với tham số hóa (Parameterized Queries).</li><li>File Upload xác thực Magic Bytes (PNG, JPEG, WebP) và chặn đứng file thực thi (.php, .sh, .exe).</li><li>Backup Restore kiểm tra regex định dạng file, chặn Path Traversal (`../../etc/passwd`).</li></ul> |
| **A04: Insecure Design** | Brute force API, Spam đơn hàng | <ul><li>Tích hợp **SlowAPI** Rate Limiting theo địa chỉ IP / User ID (Auth: `5/phút`, Search: `30/phút`, Mặc định: `100/phút`).</li><li>Idempotency Key cho các giao dịch thanh toán VietQR / PayOS.</li><li>Tác vụ hủy đơn hàng tự động sau 15 phút nếu chưa thanh toán.</li></ul> |
| **A05: Security Misconfiguration** | Lộ phiên bản, cấu hình sai K8s | <ul><li>Nginx tắt `server_tokens off;`.</li><li>Pydantic `Settings` xác thực nghiêm ngặt các biến môi trường lúc khởi động (`MEILISEARCH_MASTER_KEY`, `POSTGRES_PASSWORD`).</li><li>Tắt `enableServiceLinks: false` ngăn chặn inject link K8s tự động.</li></ul> |
| **A06: Outdated Components** | Lỗ hổng thư viện bên thứ ba | <ul><li>Pipeline CI chạy `pip-audit`, `npm audit`, và GitHub Dependabot cảnh báo tự động.</li><li>Khóa phiên bản chính xác qua `package-lock.json` và `requirements.txt`.</li></ul> |
| **A07: Identification Failures** | Session Hijacking, Token Forgery | <ul><li>Xác thực chữ ký JWT đầy đủ, từ chối token giả mạo (401 Unauthorized).</li><li>Cơ chế vô hiệu hóa tài khoản (`is_active: false`) có hiệu lực tức thì.</li></ul> |
| **A08: Software & Data Integrity** | Webhook giả mạo, dữ liệu bị sửa đổi | <ul><li>Xác thực Checksum bảo mật cho Webhook thanh toán PayOS / VietQR.</li><li>Dữ liệu migration Alembic được kiểm soát qua revision IDs tuyến tính.</li></ul> |
| **A09: Logging & Monitoring** | Thiếu bằng chứng điều tra tấn công | <ul><li>Ghi log có cấu trúc (Structured Logging) với Request ID và Trace ID OpenTelemetry.</li><li>Tích hợp Prometheus Metrics & Grafana theo dõi lưu lượng và lỗi bất thường.</li><li>Không ghi thông tin nhạy cảm (mật khẩu, khóa riêng) vào logs.</li></ul> |
| **A10: SSRF** | Gọi nội bộ cluster trái phép | <ul><li>Kubernetes NetworkPolicies chặn toàn bộ Egress ngoài ý muốn từ Pod.</li><li>Các kết nối API bên thứ ba (GHN, VietQR) được định tuyến và kiểm tra URL nghiêm ngặt.</li></ul> |

---

## 5. Chuẩn Bảo Mật Kubernetes & Container (CIS Benchmarks)

Các Kubernetes Manifests trong thư mục `k8s/` tuân thủ các chuẩn mực:

1. **Chạy không đặc quyền (Least Privilege & Non-Root)**:
   - Tất cả Pods (`backend`, `frontend`, `worker`, `migration-job`) chạy với `runAsNonRoot: true`, `runAsUser: 1000`, `runAsGroup: 1000`.
   - Cấm leo thang đặc quyền: `allowPrivilegeEscalation: false`.
   - Loại bỏ toàn bộ Linux Capabilities: `capabilities.drop: ["ALL"]`.
2. **Cách ly Seccomp Profile**:
   - Kích hoạt `seccompProfile.type: RuntimeDefault` cho toàn bộ Pod specs.
3. **Cách ly Dịch vụ K8s**:
   - `automountServiceAccountToken: false`: Không tự động gắn ServiceAccount token vào Pod để ngăn kẻ tấn công lạm dụng quyền API Kubernetes.
   - `enableServiceLinks: false`: Không tự động inject các biến môi trường của các Service khác vào Pod.
4. **Kiểm soát Lưu lượng Mạng (Network Policies)**:
   - `backend-network-policy`: Chỉ cho phép Frontend, Prometheus và Tailscale kết nối vào cổng 8000. Chỉ cho phép Backend kết nối tới PgBouncer (6432) và Redis (6379).
   - `frontend-network-policy`: Chỉ nhận traffic từ Ingress/LoadBalancer và chỉ gửi traffic tới Backend API.
5. **Giới hạn Tài nguyên (Resource Constraints)**:
   - Toàn bộ Pods đều có `requests` và `limits` cụ thể về CPU và RAM, ngăn chặn tấn công từ chối dịch vụ (Denial of Service) và hiện tượng OOM làm sập cụm máy chủ.

---

## 6. Hướng Dẫn Kiểm Tra & Xác Minh An Toàn (Security Audit Commands)

Để kiểm tra định kỳ tính an toàn của dự án, chạy các lệnh sau:

### 1. Kiểm tra Unit & Integration Security Tests:
```bash
# Kiểm tra bộ test OWASP Top 10 của backend:
cd backend
pytest tests/api/test_owasp_security.py -v

# Kiểm tra toàn bộ tests frontend:
cd frontend
npm test
```

### 2. Quét lỗ hổng mã nguồn & dependencies:
```bash
# Quét phụ thuộc Python:
pip-audit -r backend/requirements.txt

# Quét mã nguồn Python tìm lỗ hổng bảo mật:
bandit -r backend/app

# Quét phụ thuộc Frontend:
cd frontend
npm audit
```

### 3. Kiểm tra trạng thái Pods và Network Policies trong K8s:
```bash
# Kiểm tra trạng thái Network Policies:
kubectl get networkpolicies

# Kiểm tra trạng thái các Pods:
kubectl get pods -o wide
```

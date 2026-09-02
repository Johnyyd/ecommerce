# Hướng dẫn Khắc phục sự cố Kubernetes (K8s Troubleshooting)

Tài liệu này ghi lại các lỗi đã gặp trong quá trình triển khai K8s và cách chúng được khắc phục, giúp bạn dễ dàng theo dõi hệ thống.

## 1. Lỗi `CreateContainerConfigError`
**Triệu chứng:**
Các Pod của cơ sở dữ liệu (`pgbouncer`, `postgres`, `redis`) không thể khởi tạo và báo lỗi `CreateContainerConfigError`.

**Nguyên nhân:**
Kubernetes Manifests (như `pgbouncer.yaml`, `redis.yaml`...) được cấu hình để lấy biến môi trường từ các K8s Secret có tên là `db-secrets`, `app-secrets`, hoặc `redis-secrets`. Tuy nhiên, các Secret này chưa được tạo trong cluster.

**Khắc phục đã thực hiện:**
- Cập nhật script `start-k8s.bat` và `start-k8s.sh` để tự động tạo `db-secrets` và `app-secrets` từ file `.env` trước khi chạy `kubectl apply -f k8s/`.
- Sửa lỗi không đồng nhất tên Secret trong file `k8s/redis.yaml` (đổi từ `redis-secrets` sang `db-secrets`).

---

## 2. Lỗi `ErrImageNeverPull`
**Triệu chứng:**
Các Pod của `backend` và `frontend` bị kẹt ở trạng thái `ErrImageNeverPull`.

**Nguyên nhân:**
Các K8s Manifest (e.g. `backend.yaml`) đang thiết lập `imagePullPolicy: Never` vì dự án sử dụng các Docker image được build cục bộ (`ecommerce-backend:latest`).
Nếu bạn đang sử dụng **Minikube** hoặc **Kind**, Kubernetes daemon nằm tách biệt với Docker daemon trên máy chủ của bạn, do đó K8s không thể tìm thấy các Image này.

**Cách khắc phục cho bạn (NẾU đang dùng Minikube):**
Nếu hệ thống của bạn vẫn báo lỗi `ErrImageNeverPull`, bạn cần tải các image vừa build vào bên trong node của K8s.
Chạy các lệnh sau:
```bash
# Nạp image vào Minikube
minikube image load ecommerce-backend:latest
minikube image load ecommerce-frontend:latest
```

*Lưu ý: Nếu bạn sử dụng Docker Desktop Kubernetes, các image cục bộ thường được chia sẻ tự động, tuy nhiên hãy chắc chắn bạn đã build chúng thành công (bằng cách chạy `start-docker.bat` hoặc lệnh `docker-compose build` một lần).*
**Khắc phục tự động:**
- Đã cấu hình đổi `imagePullPolicy: Never` thành `imagePullPolicy: IfNotPresent` ở các file `backend.yaml`, `frontend.yaml`, và `migration-job.yaml` để Docker Desktop tự động kéo image cục bộ lên K8s.

---

## 3. Lỗi Pydantic ValidationError (REDIS_PORT)
**Triệu chứng:**
Khi K8s cố gắng chạy `backend` hoặc `db-migration-job`, tiến trình bị crash với lỗi Python:
`Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='tcp://10.96.160.105:6379', input_type=str]`

**Nguyên nhân:**
Bởi vì chúng ta có một K8s Service tên là `redis`, K8s mặc định tự động tiêm (inject) các biến môi trường dạng link (ví dụ `REDIS_PORT=tcp://...`) vào mọi Pod. Biến này đè lên `REDIS_PORT=6379` từ file `.env` (vốn dĩ phải là số nguyên), làm cho thư viện Pydantic báo lỗi cấu hình sai và ứng dụng không chạy.

**Khắc phục đã thực hiện:**
- Bổ sung cấu hình `enableServiceLinks: false` vào `backend.yaml`, `frontend.yaml`, và `migration-job.yaml` để vô hiệu hóa tính năng tự động tiêm biến lỗi thời này của K8s, giúp ứng dụng load đúng `REDIS_PORT` kiểu Integer từ `db-secrets`.

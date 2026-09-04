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

_Lưu ý: Nếu bạn sử dụng Docker Desktop Kubernetes, các image cục bộ thường được chia sẻ tự động, tuy nhiên hãy chắc chắn bạn đã build chúng thành công (bằng cách chạy `start-docker.bat` hoặc lệnh `docker-compose build` một lần)._
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

---

## 4. Lỗi 500 Internal Server Error và Xung đột với Docker Compose

**Triệu chứng:**
Khi gọi API `/api/v1/products/` tại `http://127.0.0.1/api/v1/products/`, NGINX trả về lỗi `500 Internal Server Error`. Mặc dù đã build lại và cập nhật trên Kubernetes, lỗi vẫn xuất hiện ở trình duyệt/máy tính cá nhân.

**Nguyên nhân:**
Có 2 nguyên nhân chồng chéo:

1. **Mã nguồn bị thiếu module:** Gunicorn worker trong backend bị crash do lỗi `ModuleNotFoundError: No module named 'app.schemas.cart'` khi import ở `main.py`. Điều này khiến backend không thể khởi động hoàn toàn.
2. **Xung đột môi trường chạy (Port Conflict):** Mặc dù lỗi code trên Kubernetes đã được khắc phục và hệ thống K8s chạy hoàn hảo, nhưng do bạn đang chạy **cả hai hệ thống Docker Compose và Kubernetes cùng một lúc**. Docker Compose đã chiếm dụng cổng `80` của máy tính. Do đó, yêu cầu `127.0.0.1:80` bị chuyển hướng vào container cũ của Docker Compose (vốn chưa được build lại code) thay vì Kubernetes, dẫn đến lỗi 500 ảo.

**Khắc phục đã thực hiện:**

- Thêm file `app/schemas/cart.py` với các Pydantic model cần thiết để backend khởi động thành công.
- Build và khởi động lại (`docker-compose build` và `up -d`) các container của Docker Compose để nhận code mới nhất.
- **Lưu ý:** Để tránh nhầm lẫn trong quá trình debug Kubernetes, hãy tắt hệ thống Docker Compose (`docker-compose down`) nếu bạn đang kiểm thử trên K8s (LoadBalancer) qua cổng 80, hoặc map sang cổng khác.

---

## 5. Lỗi Service K8s bị kẹt ở trạng thái Terminating (Không truy cập được 127.0.0.1)

**Triệu chứng:**
Ngay cả sau khi đã tắt Docker Compose và chạy lại `start-k8s.bat`, bạn vẫn không thể truy cập `http://127.0.0.1` trên trình duyệt. Trong log hiển thị cảnh báo: `Warning: Detected changes to resource frontend which is currently being deleted`. Service `frontend` của K8s bị kẹt ở trạng thái `LoadBalancer <pending>` hoặc đang trong quá trình Terminating vĩnh viễn.

**Nguyên nhân:**
Quá trình trước đó bạn đã vô tình chạy song song cả Docker Compose và Kubernetes. Docker Compose đã chiếm giữ hoàn toàn cổng `80` (`127.0.0.1`). Khi K8s cố gắng tạo Service LoadBalancer trên cùng cổng này, nó thất bại và sinh ra lỗi nội bộ. Khi bạn chạy script tắt/khởi động lại K8s, K8s cố gắng xóa Service cũ đi nhưng bị kẹt lại bởi cơ chế `finalizers` (cơ chế dọn dẹp tài nguyên của K8s), khiến nó lơ lửng mãi mãi ở trạng thái Terminating.

**Khắc phục đã thực hiện:**

- **Bước 1:** Ép K8s gỡ bỏ cơ chế `finalizers` bảo vệ của Service đang bị lỗi để ép nó xóa ngay lập tức:
  ```bash
  kubectl patch svc frontend -p '{"metadata":{"finalizers":[]}}' --type=merge
  ```
- **Bước 2:** Chắc chắn rằng Docker Compose đã được tắt hoàn toàn (`.\stop-docker.bat`).
- **Bước 3:** Khởi tạo lại Service `frontend` mới tinh để nó bắt thành công cổng 80:
  ```bash
  kubectl apply -f k8s/frontend.yaml
  ```
  Sau khi thực hiện, K8s sẽ được cấp IP thành công và `127.0.0.1` sẽ trỏ đúng vào Pod frontend của K8s.

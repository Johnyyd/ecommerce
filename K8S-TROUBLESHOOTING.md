# Hướng dẫn Khắc phục sự cố Kubernetes (K8s Troubleshooting)

Tài liệu này ghi lại các lỗi đã gặp trong quá trình triển khai K8s và cách chúng được khắc phục, giúp bạn dễ dàng theo dõi hệ thống.

## 1. Lỗi `CreateContainerConfigError`

**Triệu chứng:**
Các Pod của cơ sở dữ liệu (`pgbouncer`, `postgres`, `redis`) không thể khởi tạo và báo lỗi `CreateContainerConfigError`.

**Nguyên nhân:**
Kubernetes Manifests (như `pgbouncer.yaml`, `redis.yaml`...) được cấu hình để lấy biến môi trường từ các K8s Secret có tên là `db-secrets`, `app-secrets`, hoặc `redis-secrets`. Tuy nhiên, các Secret này chưa được tạo trong cluster.

**Khắc phục đã thực hiện:**

- Cập nhật script `scripts\windows\k8s\start-k8s-windows.bat` và `scripts/linux/k8s/start-k8s-linux.sh` để tự động tạo `db-secrets` và `app-secrets` từ file `.env` trước khi chạy `kubectl apply -f k8s/`.
- Sửa lỗi không đồng nhất tên Secret trong file `k8s/redis.yaml` (đổi từ `redis-secrets` sang `db-secrets`).

---

## 2. Lỗi `ErrImageNeverPull` và `ImagePullBackOff` / `ErrImagePull`

**Triệu chứng:**
- **Trường hợp A (`ErrImageNeverPull`):** Các Pod của `backend` và `frontend` bị kẹt ở trạng thái `ErrImageNeverPull`.
- **Trường hợp B (`ImagePullBackOff` / `ErrImagePull`):** Khi kiểm tra `status.sh`, các Pod `backend` và `frontend` bị kẹt ở trạng thái `ImagePullBackOff`. Kiểm tra `kubectl describe pod` ghi nhận lỗi:
  ```text
  Failed to pull image "ecommerce-backend:latest": Error response from daemon: 
  pull access denied for ecommerce-backend, repository does not exist or may require 'docker login'
  ```

**Nguyên nhân:**
1. **Với `ErrImageNeverPull`:** K8s Manifest đặt `imagePullPolicy: Never`, nhưng image chưa được nạp vào node của Minikube/Kind.
2. **Với `ImagePullBackOff`:** K8s Manifest vô tình đặt `imagePullPolicy: Always` (hoặc mặc định của K8s khi dùng tag `:latest` mà không chỉ định rõ policy). Khi đặt là `Always`, Kubernetes **bỏ qua hoàn toàn image đã có trong node Minikube** và luôn cố gắng kết nối ra internet để kéo từ Docker Hub (`docker.io/library/ecommerce-backend:latest`). Do image này là bản build nội bộ không tồn tại trên Docker Hub công cộng, Docker daemon trả về lỗi từ chối truy cập `pull access denied` ➔ `ErrImagePull` ➔ `ImagePullBackOff`.

**Cách khắc phục triệt để:**

1. **Thiết lập chuẩn `imagePullPolicy: IfNotPresent`:**
   Trong tất cả các file manifest (`k8s/backend.yaml`, `k8s/frontend.yaml`, `k8s/worker.yaml`, `k8s/migration-job.yaml`), luôn luôn cấu hình:
   ```yaml
   image: ecommerce-backend:latest
   imagePullPolicy: IfNotPresent
   ```
   *Với `IfNotPresent`, K8s sẽ ưu tiên tuyệt đối việc sử dụng image cục bộ đã được nạp sẵn vào Minikube.*

2. **Nạp image vào Minikube sau mỗi lần build code mới:**
   ```bash
   minikube image load ecommerce-backend:latest
   minikube image load ecommerce-frontend:latest
   ```

3. **Tự động hóa hoàn toàn:**
   Script `scripts/linux/k8s/start-k8s-linux.sh` (và `start-k8s-windows.bat`) đã được tích hợp tự động: build Docker image ➔ xóa cache image cũ trong node ➔ nạp image mới vào Minikube ➔ triển khai các manifests với `imagePullPolicy: IfNotPresent`.

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
Ngay cả sau khi đã tắt Docker Compose và chạy lại `scripts\windows\k8s\start-k8s-windows.bat`, bạn vẫn không thể truy cập `http://127.0.0.1` trên trình duyệt. Trong log hiển thị cảnh báo: `Warning: Detected changes to resource frontend which is currently being deleted`. Service `frontend` của K8s bị kẹt ở trạng thái `LoadBalancer <pending>` hoặc đang trong quá trình Terminating vĩnh viễn.

**Nguyên nhân:**
Quá trình trước đó bạn đã vô tình chạy song song cả Docker Compose và Kubernetes. Docker Compose đã chiếm giữ hoàn toàn cổng `80` (`127.0.0.1`). Khi K8s cố gắng tạo Service LoadBalancer trên cùng cổng này, nó thất bại và sinh ra lỗi nội bộ. Khi bạn chạy script tắt/khởi động lại K8s, K8s cố gắng xóa Service cũ đi nhưng bị kẹt lại bởi cơ chế `finalizers` (cơ chế dọn dẹp tài nguyên của K8s), khiến nó lơ lửng mãi mãi ở trạng thái Terminating.

**Khắc phục đã thực hiện:**

- **Bước 1:** Ép K8s gỡ bỏ cơ chế `finalizers` bảo vệ của Service đang bị lỗi để ép nó xóa ngay lập tức:
  ```bash
  kubectl patch svc frontend -p '{"metadata":{"finalizers":[]}}' --type=merge
  ```
- **Bước 2:** Chắc chắn rằng Docker Compose đã được tắt hoàn toàn (`.\scripts\windows\docker\stop-docker.bat`).
- **Bước 3:** Khởi tạo lại Service `frontend` mới tinh để nó bắt thành công cổng 80:
  ```bash
  kubectl apply -f k8s/frontend.yaml
  ```
  Sau khi thực hiện, K8s sẽ được cấp IP thành công và `127.0.0.1` sẽ trỏ đúng vào Pod frontend của K8s.

## 6. Lỗi Pods Backend bị kẹt ở trạng thái `Pending` (Unbound PersistentVolumeClaims)

**Triệu chứng:**
- Khi kiểm tra trạng thái bằng `bash scripts/linux/status.sh`, tất cả các Pod `backend` đều bị kẹt ở trạng thái `Pending` (`0/1 Pending`), Deployment `backend` báo `0/3` Ready.
- Khi kiểm tra chi tiết bằng `kubectl describe pod backend-...` hoặc `kubectl get events`, xuất hiện lỗi cảnh báo:
  ```text
  Warning  FailedScheduling  pod/backend-...  0/1 nodes are available: pod has unbound immediate PersistentVolumeClaims. not found
  ```
- Kiểm tra PVC bằng `kubectl get pvc` thấy `postgres-backups-pvc` ở trạng thái `Pending`:
  ```text
  Waiting for a volume to be created either by the external provisioner 'k8s.io/minikube-hostpath' or manually by the system administrator.
  ```

**Nguyên nhân:**
1. **Thiếu tiến trình cấp phát lưu trữ (Storage Provisioner):** Minikube sử dụng StorageClass mặc định `standard` với provisioner `k8s.io/minikube-hostpath`. Do sự cố cụm máy chủ hoặc addon bị tắt, Pod `storage-provisioner` trong namespace `kube-system` không hoạt động. Vì vậy, K8s không thể tự động tạo PersistentVolume (PV) mới khi có yêu cầu từ `postgres-backups-pvc`.
2. **PV cũ bị kẹt ở trạng thái `Released`:** Khi một PVC cũ bị xóa và tạo lại, PersistentVolume tương ứng không tự giải phóng mà chuyển sang trạng thái `Released` (vẫn giữ tham chiếu `claimRef` cũ), ngăn không cho PVC mới được gán (bind) vào.
3. **Ảnh hưởng dây chuyền:** Do Pod `backend` định nghĩa volume mount tới `postgres-backups-pvc` (để lưu trữ và tải bản backup PostgreSQL), Kubernetes Scheduler từ chối lập lịch (`PodScheduled: False`) chạy Pod trên Node cho đến khi tất cả các Volume yêu cầu được Bound thành công.

**Cách khắc phục:**

- **Bước 1: Kích hoạt lại addon `storage-provisioner` trên Minikube:**
  ```bash
  minikube addons disable storage-provisioner
  minikube addons enable storage-provisioner
  ```
  Kiểm tra pod đã chạy:
  ```bash
  kubectl get pods -n kube-system -l integration-test=storage-provisioner
  # Hoặc:
  kubectl get pods -n kube-system | grep storage-provisioner
  ```

- **Bước 2: Xóa các PV cũ đang bị kẹt ở trạng thái `Released` (nếu có):**
  ```bash
  kubectl get pv
  # Nếu thấy PV có STATUS là Released, xóa nó:
  kubectl delete pv <tên-pv-released>
  ```

- **Bước 3: Kiểm tra PVC đã Bound và Pods Backend khởi động:**
  ```bash
  kubectl get pvc postgres-backups-pvc
  # Kết quả: STATUS: Bound
  ```
  Ngay khi PVC ở trạng thái `Bound`, Kubernetes Scheduler sẽ tự động phân bổ Node và các Pod Backend sẽ lập tức chuyển sang trạng thái `1/1 Running`.

- **Bước 4 (Tự động hóa):** Script `start-k8s-linux.sh` đã được bổ sung lệnh tự động bật addon `storage-provisioner` và dọn dẹp các PV ở trạng thái `Released` trước khi triển khai, ngăn chặn triệt để lỗi này tái diễn.

---

## 7. Lỗi `NotFound: deployments.apps "redis" not found` khi xem log

**Triệu chứng:**
Khi chạy lệnh `kubectl logs deployments/redis` hoặc `kubectl logs deployments/postgres`, K8s báo lỗi:
```text
Error from server (NotFound): deployments.apps "redis" not found in namespace "default"
```

**Nguyên nhân:**
Cơ sở dữ liệu **Redis** và **PostgreSQL** trong dự án được triển khai dưới dạng **`StatefulSet`** (để đảm bảo tính toàn vẹn dữ liệu, định danh Pod cố định `redis-0`, `postgres-0` và gắn liền với PersistentVolumeClaims) chứ không phải `Deployment`.

**Cách khắc phục:**
Sử dụng đúng đối tượng `statefulset` hoặc tên Pod cụ thể để xem logs:

```bash
# Xem logs Redis:
kubectl logs statefulset/redis
# Hoặc:
kubectl logs redis-0

# Xem logs PostgreSQL:
kubectl logs statefulset/postgres
# Hoặc:
kubectl logs postgres-0
```

---

## 8. Hướng dẫn Giám sát & Truy cập các Dịch vụ

### Theo dõi trạng thái hệ thống:
```bash
bash scripts/linux/status.sh
# Hoặc theo dõi trực tiếp các Pods:
kubectl get pods -w
```

### Cách truy cập ứng dụng (Docker Desktop / Windows / Mac):

Vì Docker Desktop cho phép expose Ingress trực tiếp ra `localhost`, bạn chỉ cần đảm bảo không có dịch vụ nào đang chiếm dụng cổng 80.
Truy cập trực tiếp trên trình duyệt:
- **Frontend**: [http://localhost](http://localhost)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs) (khi ở chế độ dev) hoặc [http://localhost/api/health](http://localhost/api/health)
- **Grafana Monitoring**: [http://localhost:3000](http://localhost:3000) (tài khoản: `admin` / `admin`)
- **Prometheus Metrics**: [http://localhost:9090](http://localhost:9090)

---

### Cách truy cập ứng dụng trên Minikube (Linux / Windows / Mac):

1. **Cách 1 (Khuyên dùng - Nhanh gọn nhất):**
   - Mở giao diện Frontend:
     ```bash
     minikube service frontend
     ```
   - Mở giao diện giám sát Grafana:
     ```bash
     minikube service grafana
     ```

2. **Cách 2 (LoadBalancer / Ingress qua `localhost`):**
   - Mở một tab terminal mới và chạy lệnh (yêu cầu mật khẩu sudo để bind cổng 80):
     ```bash
     minikube tunnel
     ```
   - Sau đó truy cập trên trình duyệt:
     - **Frontend**: [http://localhost](http://localhost)
     - **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs) (khi ở chế độ dev) hoặc [http://localhost/api/health](http://localhost/api/health)
     - **Grafana Monitoring**: [http://localhost:3000](http://localhost:3000) (tài khoản: `admin` / `admin`)
     - **Prometheus Metrics**: [http://localhost:9090](http://localhost:9090)

---

## 9. Lỗi `exec /app/entrypoint.sh: no such file or directory` (CrashLoopBackOff trên Windows)

**Triệu chứng:**
Khi chạy trên môi trường Windows, các Pod của `backend` hoặc `worker` bị kẹt ở trạng thái `CrashLoopBackOff`.
Khi xem log của Pod bằng lệnh `kubectl logs deployment/backend`, bạn nhận được thông báo lỗi:
`exec /app/entrypoint.sh: no such file or directory` (hoặc lỗi tương tự với `\r: command not found`).

**Nguyên nhân:**
Lỗi này xảy ra do định dạng ký tự kết thúc dòng (Line Endings) của các file script `.sh` (như `entrypoint.sh`) bị sai. Khi bạn clone code và chạy lệnh `docker compose build` trên Windows, Git mặc định chuyển đổi ký tự kết thúc dòng sang chuẩn Windows (CRLF - `\r\n`). Tuy nhiên, các container chạy nhân Linux, Linux không hiểu ký tự `\r` (Carriage Return) nên nó coi đường dẫn `/bin/sh\r` là một file không tồn tại.

**Khắc phục:**
Bạn cần chuyển đổi định dạng dòng kết thúc của các file script `.sh` từ **CRLF** sang **LF**, sau đó build lại image:

- **Cách 1 (Bằng VS Code - Khuyên dùng):**
  1. Mở các file script chạy lúc khởi động (ví dụ `backend/entrypoint.sh`, `worker/start.sh`) bằng VS Code.
  2. Nhìn xuống góc phải dưới cùng của cửa sổ VS Code, bạn sẽ thấy chữ **CRLF**.
  3. Click vào chữ **CRLF** và chọn **LF**.
  4. Lưu file lại.
  5. Chạy lại lệnh build image trên Windows:
     ```bash
     docker compose build
     ```
  6. Xóa pod bị lỗi để Kubernetes tạo lại với image mới (hoặc chạy lại script `scripts\windows\k8s\start-k8s-windows.bat`):
     ```bash
     kubectl delete pod -l app=backend
     kubectl delete pod -l app=worker
     ```

- **Cách 2 (Bằng Git):** 
  Thay đổi cấu hình Git để không tự động đổi Line Endings:
  ```bash
  git config --global core.autocrlf false
  ```
  Sau đó xóa folder chứa code và clone lại.

---

## 10. Lỗi `DuplicateColumnError` ở Pod `db-migration-job` (Error)

**Triệu chứng:**
Pod `db-migration-job` bị lỗi ở trạng thái `Error`. Khi xem log bằng lệnh `kubectl logs job/db-migration-job`, bạn thấy thông báo tương tự như:
`asyncpg.exceptions.DuplicateColumnError: column "slug" of relation "categories" already exists`

**Nguyên nhân:**
Job migration của cơ sở dữ liệu đang cố gắng tạo một cột (column) hoặc bảng (table) đã tồn tại. Điều này thường xảy ra khi bạn chạy lại Kubernetes hoặc Docker Compose trên một cơ sở dữ liệu Postgres đã có sẵn dữ liệu và đã được cập nhật cấu trúc từ trước (khi database không bị xóa hoàn toàn).

**Khắc phục:**
Vì đây là môi trường phát triển (Dev), cách nhanh nhất là xóa bỏ Persistent Volume (dữ liệu lưu trữ) của PostgreSQL để database được tạo mới hoàn toàn:

1. Xóa bỏ Pod migration hiện tại đang bị lỗi:
   ```bash
   kubectl delete job db-migration-job
   ```
2. Gỡ bỏ database hiện tại và xóa ổ cứng lưu trữ:
   ```bash
   kubectl delete statefulset postgres
   kubectl delete pvc postgres-backups-pvc
   ```
   *(Lưu ý: Nếu bạn có khai báo một PVC khác cho dữ liệu chính của postgres, hãy xóa cả PVC đó. Ví dụ `kubectl delete pvc data-postgres-0`)*
3. Chạy lại file khởi tạo K8s `scripts\windows\k8s\start-k8s-windows.bat` để hệ thống tự động thiết lập lại mọi thứ với một database sạch.

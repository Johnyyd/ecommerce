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

   _Với `IfNotPresent`, K8s sẽ ưu tiên tuyệt đối việc sử dụng image cục bộ đã được nạp sẵn vào Minikube._

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
   _(Lưu ý: Nếu bạn có khai báo một PVC khác cho dữ liệu chính của postgres, hãy xóa cả PVC đó. Ví dụ `kubectl delete pvc data-postgres-0`)_
3. Chạy lại file khởi tạo K8s `scripts\windows\k8s\start-k8s-windows.bat` để hệ thống tự động thiết lập lại mọi thứ với một database sạch.

---

## 11. Lỗi `Multiple head revisions` & Sai kiểu dữ liệu pgvector tại Pod `db-migration-job`

**Triệu chứng:**

- Khi chạy `status.sh`, Pod `db-migration-job-...` báo trạng thái `Error` liên tục và `job.batch/db-migration-job` báo `Failed`.
- Xem log bằng lệnh `kubectl logs -l job-name=db-migration-job` ghi nhận:
  ```text
  ERROR [alembic.util.messaging] Multiple head revisions are present for given argument 'head'; please specify a specific target revision, '<branchname>@head' to narrow to a specific head, or 'heads' for all heads
  FAILED: Multiple head revisions are present for given argument 'head'; please specify a specific target revision, '<branchname>@head' to narrow to a specific head, or 'heads' for all heads
  ```
- Khi debug thủ công trên terminal máy host bằng lệnh:
  ```bash
  alembic -c /app/alembic.ini upgrade head
  ```
  Nhận thông báo lỗi:
  ```text
  FAILED: No 'script_location' key found in configuration.
  ```

**Nguyên nhân:**

1. **Lỗi `script_location` khi chạy trên máy Host:**
   Đường dẫn `/app/alembic.ini` là đường dẫn thư mục **bên trong container Docker/K8s**, không tồn tại trên filesystem của máy host Linux/Windows. Khi Alembic không tìm thấy file ini tại `/app`, nó load cấu hình rỗng và báo thiếu khóa `script_location`.
2. **Lỗi rẽ nhánh Alembic (Multiple head revisions):**
   Database hiện tại đã được nâng cấp lên revision `hh0c1d2e3f5b` (các trường shipping/completion của đơn hàng). Tuy nhiên, file migration tìm kiếm & AI mới `011_add_search_and_embedding_columns.py` lại đặt `down_revision = 'ff8a9b0c2e3f'` thay vì kế thừa `hh0c1d2e3f5b`. Điều này tạo ra 2 nhánh migration song song (`012` và `hh0c1d2e3f5b`), khiến Alembic không thể xác định đâu là `head` duy nhất khi K8s chạy `alembic upgrade head`.
3. **Lỗi không tương thích kiểu dữ liệu `pgvector`:**
   Cột `embedding` được khai báo kiểu `sa.ARRAY(sa.Float)` (`double precision[]`), nhưng câu lệnh tạo chỉ mục lại dùng `USING ivfflat (embedding vector_l2_ops)`. PostgreSQL từ chối thực thi và báo lỗi:
   `operator class "vector_l2_ops" does not accept data type double precision[]` (bắt buộc phải là kiểu `vector(1536)` của extension `pgvector`).
4. **Lỗi hàm PostgreSQL không tồn tại & cú pháp Python trong SQL:**
   - Ràng buộc `CheckConstraint("embedding IS NULL OR array_length(embedding, 1) = 1536")`: Hàm `array_length` của Postgres không chấp nhận tham số kiểu `vector`. Kiểu `vector(1536)` đã tự động đảm bảo độ dài 1536 ở cấp độ database.
   - Cú pháp `ARRAY[0.0] * 1533` trong câu lệnh cập nhật dữ liệu là cú pháp nhân mảng của Python, gây lỗi cú pháp trong PostgreSQL (`operator does not exist: numeric[] * integer`).
   - Cột `failed_sync_tasks.product_id` khai báo `sa.Integer()`, không khớp với kiểu khóa chính `UUID` của bảng `products`.

**Khắc phục đã thực hiện:**

1. **Chuẩn hóa Lineage Migration (`011_add_search_and_embedding_columns.py`):**
   Chỉnh sửa `down_revision = 'hh0c1d2e3f5b'` để toàn bộ lịch sử migration trở thành một chuỗi tuyến tính duy nhất:
   `... -> ff8a9b0c2e3f -> gg9b0c2e3f4a -> hh0c1d2e3f5b -> 011 -> 012 (head)`
2. **Sử dụng đúng kiểu `Vector(1536)`:**
   Import `from pgvector.sqlalchemy import Vector` trong cả file migration `011` và model `backend/app/models/product.py`:
   ```python
   embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=True)
   ```
   Loại bỏ check constraint `ck_products_embedding_dim` do kiểu `Vector(1536)` đã tự động kiểm tra số chiều.
3. **Sửa kiểu dữ liệu `failed_sync_tasks.product_id`:**
   Chuyển thành `PGUUID(as_uuid=True)` khớp với `products.id`.
4. **Hỗ trợ `pgvector` trong PostgreSQL Pod (`k8s/postgres.yaml`):**
   Sử dụng image `pgvector/pgvector:pg16` thay vì `postgres:16-alpine` tiêu chuẩn để có sẵn extension `vector`.
5. **Cập nhật Backend & Chạy lại Job Migration:**
   Chạy script cập nhật để build image mới, nạp vào Minikube và chạy lại migration job:
   ```bash
   bash scripts/linux/update-k8s-backend.sh
   ```
   Kết quả: `db-migration-job` hoàn thành (`Completed 1/1`), database đạt revision `012`.

**Hướng dẫn kiểm tra và chạy Alembic đúng cách:**

- **Trên máy Host:**
  ```bash
  cd backend
  .venv/bin/alembic upgrade head
  ```
- **Bên trong Pod K8s:**
  ```bash
  kubectl exec -it deployment/backend -- alembic upgrade head
  ```
- **Kiểm tra trạng thái migration hiện tại của Database:**
  ```bash
  kubectl exec postgres-0 -- psql -U ecommerce_user -d ecommerce_db -c "SELECT * FROM alembic_version;"
  ```

---

## 12. Lỗi Pod `worker` bị `CrashLoopBackOff` do `ModuleNotFoundError: No module named 'app.db'`

**Triệu chứng:**

- Pod `worker` bị crash liên tục với trạng thái `CrashLoopBackOff`.
- Khi xem log bằng lệnh `kubectl logs deployment/worker`, xuất hiện lỗi:
  ```text
  ModuleNotFoundError: No module named 'app.db'
  ```
- Lỗi xảy ra tại dòng import trong `backend/app/worker.py`:
  ```python
  from app.db.session import get_async_session
  ```

**Nguyên nhân:**

1. **Code local đã được cập nhật nhưng image Docker trên cluster chưa được cập nhật:** File `backend/app/worker.py` ở máy local đã được sửa đổi import từ `from app.db.session import get_async_session` sang `from app.core.db import get_db_session` (và thêm import các task gốc: `send_email_task`, `optimize_image_task`, `generate_sales_report_task`).
2. **ImagePullPolicy `IfNotPresent`:** Manifest `k8s/worker.yaml` được cấu hình `imagePullPolicy: IfNotPresent`, khiến Kubernetes ưu tiên sử dụng image đã có sẵn trong node Minikube (`ecommerce-backend:latest`) thay vì kéo image mới.
3. **Image `ecommerce-backend:latest` trong Minikube là phiên bản cũ** (chưa chứa code đã sửa), dẫn đến worker pod chạy code cũ và crash.

**Khắc phục đã thực hiện:**

1. **Sửa import trong `backend/app/worker.py`:**

   ```python
   # Cũ (gây lỗi)
   from app.db.session import get_async_session

   # Mới (đã sửa)
   from app.core.db import get_db_session
   ```

   Đồng thời khôi phục import các task gốc:

   ```python
   from app.services.media import optimize_image_task
   from app.services.reports import generate_sales_report_task
   from app.services.email import send_email
   ```

2. **Build lại Docker image với tag mới và nạp vào Minikube:**

   ```bash
   # Build image với tag mới (v2)
   docker build -t ecommerce-backend:v2 ./backend

   # Nạp image vào Minikube (bắt buộc vì imagePullPolicy: IfNotPresent)
   minikube image load ecommerce-backend:v2

   # Cập nhật deployment để dùng image mới
   kubectl set image deployment/worker worker=ecommerce-backend:v2
   ```

3. **Xác minh worker pod khởi động thành công:**

   ```bash
   kubectl get pods -l app=worker
   # Kết quả mong đợi: Running 1/1

   kubectl logs deployment/worker | head -20
   # Kết quả mong đợi: "Registered tasks: send_email_task, optimize_image_task, generate_sales_report_task, generate_embeddings_task, sync_to_meilisearch_task, incremental_sync_task"
   ```

**Lưu ý quan trọng:**

- Mỗi khi thay đổi code backend/worker, **bắt buộc** build image mới, nạp vào Minikube (`minikube image load`), và cập nhật deployment (`kubectl set image` hoặc apply lại manifest).
- Script `scripts/linux/update-k8s-backend.sh` đã được cập nhật để tự động hóa quy trình này cho backend và worker.
- Đảm bảo `imagePullPolicy: IfNotPresent` trong mọi manifest K8s (`backend.yaml`, `worker.yaml`, `frontend.yaml`, `migration-job.yaml`) để ưu tiên image cục bộ.

**Kết quả:**

- Worker pod chạy ổn định với 6 task đã đăng ký.
- Tất cả 37 tests mới (embedding + meilisearch) và 75 tests backend hiện có đều pass.

---

## 13. Lỗi `DuplicateColumnError` & `PostgresSyntaxError: cannot insert multiple commands into a prepared statement` tại Pod `db-migration-job`

**Triệu chứng:**

- Khi chạy script triển khai K8s hoặc kiểm tra trạng thái bằng `status.bat` / `status.sh`, `job.batch/db-migration-job` ở trạng thái `Failed` và các Pod `db-migration-job-*` bị lỗi `Error` (`0/1 Error`).
- Khi kiểm tra log của Pod bằng lệnh:
  ```bash
  kubectl logs -l job-name=db-migration-job --tail=100
  ```
  Xuất hiện 2 lỗi tuần tự:
  1. **Lỗi thứ nhất (ở migration revision 011):**
     ```text
     sqlalchemy.exc.ProgrammingError: (sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError)
     <class 'asyncpg.exceptions.DuplicateColumnError'>: column "search_vector" of relation "products" already exists
     [SQL: ALTER TABLE products ADD COLUMN search_vector TSVECTOR]
     File "/app/alembic/versions/011_add_search_and_embedding_columns.py", line 29, in upgrade
     ```
  2. **Lỗi thứ hai (ở migration revision 012 sau khi sửa revision 011):**
     ```text
     sqlalchemy.exc.ProgrammingError: (sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError)
     <class 'asyncpg.exceptions.PostgresSyntaxError'>: cannot insert multiple commands into a prepared statement
     [SQL:
         DROP TRIGGER IF EXISTS trigger_products_search_vector ON products;
         CREATE TRIGGER trigger_products_search_vector
         BEFORE INSERT OR UPDATE OF name, description, brand ON products
         FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
     ]
     File "/app/alembic/versions/012_add_search_vector_trigger.py", line 36, in upgrade
     ```

**Nguyên nhân chi tiết:**

1. **Lỗi DDL không có tính Lũy tiến (Non-Idempotent DDL) và lệnh `COMMIT` thủ công (ở file `011`):**
   - Trong `011_add_search_and_embedding_columns.py`, trước đây có chứa lệnh `op.execute('COMMIT')` (nhằm mục đích tạo index CONCURRENTLY). Tuy nhiên, việc tự ý `COMMIT` đã phá vỡ cơ chế quản lý transaction của Alembic (`with context.begin_transaction()`).
   - Khi transaction bị commit giữa chừng, câu lệnh `ALTER TABLE products ADD COLUMN search_vector ...` đã được ghi nhận vĩnh viễn vào PostgreSQL. Nếu bước tiếp theo gặp lỗi hoặc Pod bị restart, transaction tổng của Alembic bị rollback và bảng `alembic_version` **chưa được ghi nhận lên revision 011** (vẫn lưu phiên bản cũ `hh0c1d2e3f5b`).
   - Khi K8s tự động thử lại (retry `backoffLimit: 4`), Alembic chạy lại file `011` từ đầu. Phương thức `op.add_column('products', ...)` sinh ra câu lệnh DDL thô không có điều kiện kiểm tra tồn tại. Do cột `search_vector` đã tồn tại trong database từ lần chạy trước, PostgreSQL từ chối thực thi và báo lỗi `DuplicateColumnError`.

2. **Lỗi Trình điều khiển `asyncpg` không hỗ trợ nhiều lệnh SQL trong một Prepared Statement (ở file `012`):**
   - Thư viện `asyncpg` (driver bất đồng bộ cho SQLAlchemy) tuân thủ chặt chẽ chuẩn PostgreSQL protocol: **mỗi prepared statement chỉ được phép thực thi một câu lệnh SQL duy nhất**.
   - Trong `012_add_search_vector_trigger.py`, hai câu lệnh SQL (`DROP TRIGGER IF EXISTS ...;` và `CREATE TRIGGER ...;`) bị gộp chung trong một lời gọi `op.execute(...)`. Khi `asyncpg` biên dịch câu lệnh, nó ném ngoại lệ `cannot insert multiple commands into a prepared statement`.

3. **Lỗi Cache Image trong Containerd của Docker Desktop / Kubernetes (`k8s.io` namespace):**
   - Trên môi trường Docker Desktop (Windows/Mac) sử dụng containerd runtime, Kubernetes lưu cache image riêng biệt trong namespace `k8s.io`.
   - Với chính sách `imagePullPolicy: IfNotPresent`, sau khi bạn sửa code và chạy `docker build -t ecommerce-backend:latest`, containerd của K8s vẫn có thể tái sử dụng image cũ đã nạp sẵn trong cache của node nếu không được xóa trước. Do đó, Pod migration vẫn tiếp tục chạy code cũ bị lỗi.

**Cách khắc phục triệt để:**

1. **Chuẩn hóa Migration `011_add_search_and_embedding_columns.py` thành Idempotent (Lũy tiến):**
   - Thay thế toàn bộ DDL thông thường bằng cú pháp `IF NOT EXISTS` và gỡ bỏ hoàn toàn lệnh `COMMIT`/`BEGIN` thủ công:

     ```python
     # 1. Thêm cột một cách an toàn (không bị lỗi nếu cột đã tồn tại từ trước)
     op.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector TSVECTOR')
     op.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(1536)')

     # 2. Tạo index an toàn
     op.execute('CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING GIN (search_vector)')
     op.execute('''
         CREATE INDEX IF NOT EXISTS idx_products_embedding
         ON products USING ivfflat (embedding vector_l2_ops)
         WITH (lists = 100)
     ''')

     # 3. Tạo các bảng Dead Letter Queue & Backfill an toàn
     op.execute('CREATE TABLE IF NOT EXISTS failed_sync_tasks (...)')
     op.execute('CREATE TABLE IF NOT EXISTS backfill_jobs (...)')
     ```

2. **Tách các câu lệnh SQL độc lập trong `012_add_search_vector_trigger.py`:**
   - Tách thành 2 lời gọi `op.execute` riêng biệt để tương thích hoàn toàn với `asyncpg`:
     ```python
     # Tách DROP TRIGGER và CREATE TRIGGER riêng biệt
     op.execute('DROP TRIGGER IF EXISTS trigger_products_search_vector ON products')
     op.execute('''
         CREATE TRIGGER trigger_products_search_vector
         BEFORE INSERT OR UPDATE OF name, description, brand ON products
         FOR EACH ROW EXECUTE FUNCTION products_search_vector_update()
     ''')
     ```

3. **Tự động hóa dọn dẹp Cache Image containerd trước khi chạy Migration Job:**
   - Trong script `scripts/windows/update-k8s-backend.bat` và `scripts/linux/update-k8s-backend.sh`, bổ sung tiến trình chạy Pod `image-cleaner` (chạy `ctr -n k8s.io images rm ...`) để xóa bỏ cache image cũ trước khi tạo `db-migration-job`.

4. **Các bước thủ công để chạy lại Migration khi gặp lỗi:**
   - **Bước 1: Build lại image backend mới nhất:**
     ```bash
     docker build -t ecommerce-backend:latest ./backend
     ```
   - **Bước 2: Xóa image cũ trong containerd cache (nếu dùng Docker Desktop):**
     ```bash
     kubectl delete pod image-cleaner --ignore-not-found=true
     kubectl apply -f k8s/cleaner.yaml
     kubectl wait --for=condition=Ready pod/image-cleaner --timeout=15s
     ```
   - **Bước 3: Xóa Job migration cũ bị lỗi và áp dụng lại:**
     ```bash
     kubectl delete job db-migration-job --ignore-not-found=true
     kubectl apply -f k8s/migration-job.yaml
     ```
   - **Bước 4: Theo dõi kết quả migration:**
     ```bash
     kubectl wait --for=condition=complete job/db-migration-job --timeout=60s
     kubectl logs -l job-name=db-migration-job
     ```
     _Kết quả mong đợi:_
     ```text
     INFO  [alembic.runtime.migration] Running upgrade hh0c1d2e3f5b -> 011, add_search_and_embedding_columns
     INFO  [alembic.runtime.migration] Running upgrade 011 -> 012, add_search_vector_trigger
     ```
   - **Bước 5: Khởi động lại backend & worker để nhận cấu trúc DB mới:**
     ```bash
     kubectl rollout restart deployment backend
     kubectl rollout restart deployment worker
     ```
   - **Bước 6: Kiểm tra version hiện tại của DB trong PostgreSQL:**
     ```bash
     kubectl exec postgres-0 -- psql -U ecommerce_user -d ecommerce_db -c "SELECT * FROM alembic_version;"
     # Kết quả: 012
     ```

---

## 14. Lỗi `SyntaxError: unterminated triple-quoted string literal` tại Pod `db-migration-job`

**Triệu chứng:**
Pod `db-migration-job` bị lỗi ở trạng thái `Error` (`0/1 Error`) và liên tục thử lại đến khi Job thất bại.
Khi kiểm tra log của Pod bằng lệnh `kubectl logs -l job-name=db-migration-job`, ghi nhận lỗi cú pháp Python:

```text
  File "<frozen importlib._bootstrap>", line 488, in _call_with_frames_removed
  File "/app/alembic/versions/011_add_search_and_embedding_columns.py", line 159
    ''')
    ^
SyntaxError: unterminated triple-quoted string literal (detected at line 177)
```

**Nguyên nhân:**
Trong file `backend/alembic/versions/011_add_search_and_embedding_columns.py`, một đoạn code bị dán lặp (duplicate code) giữa dòng 39 và 116. Tại dòng 40, câu lệnh `op.execute('''` bị cắt ngang giữa chừng trước khi kết thúc khối chuỗi ba nháy `'''`. Khi Alembic nạp module migration bằng `pyfiles.load_module_py`, Python compiler phát hiện chuỗi ba nháy không đóng và ném ngoại lệ `SyntaxError`, ngăn cản toàn bộ quá trình `alembic upgrade head`.

**Cách khắc phục:**

1. **Dọn dẹp code thừa và đóng chuẩn chuỗi trong `011_add_search_and_embedding_columns.py`:**
   Loại bỏ các khối tạo bảng/cột bị dán trùng, sử dụng các câu lệnh SQL lũy tiến (`CREATE EXTENSION IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) với cặp dấu `'''` đóng mở chuẩn xác.
2. **Kiểm tra cú pháp Python trước khi build image:**
   ```bash
   python -m py_compile backend/alembic/versions/011_add_search_and_embedding_columns.py
   ```
3. **Build lại image backend và cập nhật Kubernetes:**
   ```bash
   .\scripts\windows\update-k8s-backend.bat
   ```
   Job `db-migration-job` hoàn thành thành công với trạng thái `1/1 Completed`.

---

## 15. Pod `tailscale` bị `CrashLoopBackOff` / `Error` — Missing Auth Key & Network Egress Blocked

**Triệu chứng:**

- Pod `tailscale` liên tục ở trạng thái `CrashLoopBackOff` hoặc `Error` với nhiều lần restart.
- Khi kiểm tra log bằng `kubectl logs deployment/tailscale`, ghi nhận:
  ```text
  Received error: fetch control key: Get "https://controlplane.tailscale.com/key?v=142": context deadline exceeded
  boot: failed to auth tailscale: failed to auth tailscale: tailscale up failed: context deadline exceeded
  ```

**Nguyên nhân:**
Có **2 nguyên nhân chồng chéo** khiến Pod `tailscale` không thể khởi động:

1. **Thiếu `TS_AUTHKEY` trong Kubernetes Secret `app-secrets`:**
   - File manifest `k8s/addons/tailscale.yaml` cấu hình biến `TS_AUTHKEY_FILE` trỏ đến `/var/run/secrets/tailscale/TS_AUTHKEY`, được mount từ Secret `app-secrets` với key `TS_AUTHKEY`.
   - Tuy nhiên, Secret `app-secrets` hiện tại chỉ chứa các key: `POSTGRES_DB`, `POSTGRES_PASSWORD`, `POSTGRES_USER`, `REDIS_PASSWORD`, `SECRET_KEY`. **Không có key `TS_AUTHKEY`**.
   - Volume mount được đặt `optional: true`, nên Pod vẫn khởi động được nhưng file auth key trống hoặc không tồn tại, khiến `tailscale up` thất bại sau khi hết timeout.

2. **NetworkPolicy chặn egress ra Internet:**
   - `tailscale-network-policy` trong `k8s/networkpolicies.yaml` cho phép egress trên port 443 và UDP 41641, nhưng chỉ cho phép traffic đến các Pod nội bộ (frontend, grafana, backend) qua `podSelector`.
   - Khi tailscale cố gắng kết nối ra `controlplane.tailscale.com` (IP ngoài cluster), NetworkPolicy chặn kết nối vì không có rule egress cho traffic ra ngoài cluster (thiếu `namespaceSelector: {}` hoặc `ipBlock` cho external traffic).
   - Log xác nhận: `context deadline exceeded` trên mọi request đến `https://controlplane.tailscale.com`.

**Cách khắc phục:**

### Bước 1: Tạo Tailscale Auth Key

1. Đăng nhập vào [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys).
2. Tạo một Auth Key mới (khuyến nghị: Reusable + Ephemeral cho K8s).
3. Thêm key vào Secret `app-secrets`:

   ```bash
   # Lấy giá trị hiện tại của các secret keys
   kubectl get secret app-secrets -o yaml > /tmp/app-secrets-backup.yaml

   # Xóa secret cũ và tạo lại với key mới
   kubectl delete secret app-secrets
   kubectl create secret generic app-secrets \
     --from-literal=POSTGRES_USER=ecommerce_user \
     --from-literal=POSTGRES_PASSWORD=<your_password> \
     --from-literal=POSTGRES_DB=ecommerce_db \
     --from-literal=REDIS_PASSWORD=<your_redis_password> \
     --from-literal=SECRET_KEY=<your_secret_key> \
     --from-literal=TS_AUTHKEY=tskey-auth-xxxxxxxxxxxx
   ```

### Bước 2: Cập nhật NetworkPolicy cho phép egress ra Internet

Sửa `tailscale-network-policy` trong `k8s/networkpolicies.yaml` — thêm rule egress cho traffic ra ngoài cluster:

```yaml
# Thêm rule egress không giới hạn destination cho tailscale VPN traffic
- ports:
    - protocol: UDP
      port: 41641
    - protocol: TCP
      port: 443
```

Hoặc cho phép egress tự do (vì Tailscale VPN cần kết nối linh hoạt ra nhiều IP):

```yaml
egress:
  - {} # Allow all egress for VPN connectivity
```

### Bước 3: Restart Pod tailscale

```bash
kubectl rollout restart deployment tailscale
kubectl get pods -l app=tailscale -w
```

**Kết quả mong đợi:**

```text
pod/tailscale-xxxx   1/1     Running   0   10s
```

**Lưu ý:**

- Nếu bạn không sử dụng Tailscale VPN, có thể scale deployment xuống 0 để tránh lỗi liên tục:
  ```bash
  kubectl scale deployment tailscale --replicas=0
  ```
- Trên môi trường phát triển local (Docker Desktop), Tailscale thường không cần thiết. Chỉ cần thiết khi triển khai lên cloud và muốn truy cập private network qua Tailscale.

---

## 16. Lỗi `502 Bad Gateway` khi Đăng nhập (Login) — Backend Pod bị `OOMKilled` do Argon2 Hashing

**Triệu chứng:**
- Người dùng duyệt web, xem danh sách sản phẩm (`GET /api/v1/products`) vẫn diễn ra bình thường và tải dữ liệu nhanh chóng.
- Tuy nhiên, khi gửi yêu cầu đăng nhập (`POST /api/v1/auth/login`), hệ thống phản hồi lỗi `502 Bad Gateway`.
- Kiểm tra log của Nginx tại Frontend Pod ghi nhận:
  ```text
  [error] upstream prematurely closed connection while reading response header from upstream, request: "POST /api/v1/auth/login HTTP/1.1", upstream: "http://<backend-ip>:8000/api/v1/auth/login"
  ```
- Kiểm tra trạng thái các Pod backend bằng lệnh `kubectl get pods -l app=backend`:
  ```text
  backend-xxxx-xxxx   0/1   OOMKilled   1   ...
  ```
  Pod bị kernel hủy với `Exit Code: 137` (`OOMKilled`).

**Nguyên nhân:**
1. **Mức tiêu thụ RAM nền của Gunicorn:**
   - Trong `k8s/backend.yaml`, số worker được chỉ định là `WEB_CONCURRENCY=5` (hoặc tính toán mặc định theo CPU). Mỗi worker Python Uvicorn nạp FastAPI, Pydantic, SQLAlchemy chiếm trung bình ~85MB RAM. 
   - Với 5 worker cùng tiến trình master, mức RAM nền (baseline) của Pod khi khởi động đã chạm ngưỡng ~450MB - 480MB.
2. **Thuật toán băm mật khẩu Argon2:**
   - Hệ thống sử dụng Argon2id (`m=65536, t=3, p=4`) để bảo mật mật khẩu. Khi thực hiện xác thực (`verify_password`), thuật toán cần cấp phát một bộ đệm tối thiểu 64MB RAM.
3. **Giới hạn bộ nhớ bị vượt ngưỡng:**
   - File cấu hình `k8s/backend.yaml` đặt `limits.memory: 512Mi`.
   - Khi Pod nhận request login, mức RAM tăng từ 480MB + 64MB = 544MB, vượt quá giới hạn 512MiB (536MB). Cgroup OOM Killer của Linux lập tức gửi tín hiệu `SIGKILL (137)` kết liễu container khiến kết nối HTTP tới Nginx bị đứt gãy đột ngột, sinh ra lỗi 502. Các request duyệt sản phẩm không chạy hàm băm Argon2 nên mức RAM không vượt ngưỡng và không bị crash.

**Cách khắc phục:**
1. **Nâng mức giới hạn bộ nhớ trong `k8s/backend.yaml`:**
   - Tăng `limits.memory` từ `512Mi` lên `1Gi` (1024MiB) và `requests.memory` lên `256Mi` để đảm bảo đủ không gian cho 5 worker cùng lúc xử lý tác vụ băm Argon2 an toàn.
2. **Cập nhật script khởi động `backend/entrypoint.sh`:**
   - Ưu tiên đọc biến môi trường `WEB_CONCURRENCY` nếu được thiết lập từ Kubernetes deployment thay vì chỉ tự động tính toán.
3. **Build lại image với tag `latest` và cập nhật Pods:**
   - Thực thi script `.\scripts\windows\update-k8s-backend.bat` để build image `ecommerce-backend:latest`, dọn cache containerd và rollout restart deployment backend.


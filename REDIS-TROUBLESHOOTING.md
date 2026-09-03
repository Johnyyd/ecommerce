# Hướng dẫn Khắc phục sự cố Redis (Redis Troubleshooting)

Tài liệu này ghi lại các lỗi liên quan đến Redis Cache trong quá trình phát triển và vận hành hệ thống.

## 1. Dữ liệu rỗng khi gọi API mặc dù Database đã có dữ liệu (Stale Cache)

**Triệu chứng:**
Sau khi chạy script tạo dữ liệu mẫu (`seed_db.py`) và hệ thống thông báo `Already seeded!` hoặc `Seed completed successfully!`, bạn dùng `curl` hoặc truy cập frontend để gọi API `/api/v1/products/` nhưng hệ thống vẫn trả về mảng rỗng `[]`.

**Nguyên nhân:**
API danh sách sản phẩm `/api/v1/products/` sử dụng tính năng caching (bộ nhớ đệm) của Redis.
Trước khi chạy script nạp dữ liệu mẫu, nếu có bất kỳ người dùng nào hoặc lệnh curl nào vô tình gọi vào API này, hệ thống sẽ chọc xuống Database trống và lưu kết quả `[]` này vào Redis trong vòng 5 phút (300 giây).

Khi bạn chạy file `seed_db.py`, dữ liệu được đổ trực tiếp vào database PostgreSQL bằng công cụ quản trị (bỏ qua tầng API), do đó Redis **không biết** dữ liệu đã thay đổi và tiếp tục trả về mảng rỗng `[]` thay vì gọi vào database lấy dữ liệu mới nhất.

**Khắc phục đã thực hiện:**
Cần phải xóa bỏ (flush) toàn bộ cache đang bị lỗi thời trong Redis để hệ thống lấy lại dữ liệu mới từ Database.
Bạn có thể xóa Redis cache thông qua command line theo môi trường bạn đang chạy:

_Lưu ý: Bạn phải tìm mật khẩu của Redis trong file `.env` (ví dụ: `secure_redis_password`) để thực thi câu lệnh._

**Trên môi trường Kubernetes:**

```bash
kubectl exec statefulset/redis -n default -- redis-cli -a secure_redis_password flushall
```

**Trên môi trường Docker Compose:**

```bash
docker-compose exec redis redis-cli -a secure_redis_password flushall
```

Sau khi chạy lệnh trên nhận kết quả `OK`, gọi lại API sẽ trả về dữ liệu chuẩn.

## 2. Dữ liệu chỉ cập nhật ở một môi trường (Docker Compose / Kubernetes)

**Triệu chứng:**
Bạn có thể đã seed database và flush cache ở một môi trường (ví dụ: Kubernetes), nhưng khi gọi API ở cổng `80` (thường được map với Nginx của Docker Compose), bạn vẫn thấy dữ liệu rỗng hoặc dữ liệu cũ.

**Nguyên nhân:**
Hệ thống hiện tại đang sử dụng song song 2 môi trường: **Kubernetes** và **Docker Compose**. Cần đặc biệt lưu ý:

- Database PostgreSQL và Redis Cache của Kubernetes là các resource (Pod/StatefulSet) chạy riêng biệt.
- Database PostgreSQL và Redis Cache của Docker Compose là các container riêng biệt.
  Chúng **không chia sẻ dữ liệu** cho nhau. Khi bạn chạy script seed data hoặc flush Redis trên môi trường này, nó không ảnh hưởng gì tới môi trường kia.

**Cách khắc phục:**
Nếu bạn làm việc và truy cập qua Kubernetes (ví dụ port-forward tới service của backend), bạn cần:

1. Seed Database trong pod K8s: `kubectl exec -it deployment/backend -- python seed_db.py`
2. Flush Redis trong pod K8s: `kubectl exec statefulset/redis -n default -- redis-cli -a secure_redis_password flushall`

Nếu bạn làm việc và truy cập thông qua Docker Compose (ví dụ qua `localhost:80`):

1. Seed Database trong container Docker Compose: `docker-compose exec backend python seed_db.py`
2. Flush Redis trong container Docker Compose: `docker-compose exec redis redis-cli -a secure_redis_password flushall`

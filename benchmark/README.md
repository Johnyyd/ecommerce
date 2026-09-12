# Benchmark & Load Testing Tools

Thư mục này chứa các tài liệu và công cụ kiểm thử hiệu năng cho hệ thống **Premium E-Commerce Platform**.

- **Tài liệu hướng dẫn chi tiết**: Xem tại [BENCHMARK.md](../BENCHMARK.md).
- **Script kiểm thử tải tự động**: [`../benchmark.sh`](../benchmark.sh).

### Cách sử dụng nhanh:
```bash
# Di chuyển về thư mục gốc và chạy script:
cd ..
./benchmark.sh
```

Hệ thống hỗ trợ kiểm thử tải đồng thời qua **ApacheBench (`ab`)**, kích hoạt **Kubernetes Horizontal Pod Autoscaler (HPA)** co giãn từ 3 pods lên 8 pods, và theo dõi trực quan các chỉ số qua **Grafana Dashboard**.

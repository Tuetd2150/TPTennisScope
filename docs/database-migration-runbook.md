# TennisScope — Database Migration Runbook (Local Docker → Cloud PostgreSQL)

Tài liệu này hướng dẫn quy trình chuyển đổi dữ liệu từ PostgreSQL Local (Docker container `tennisscope-db`) sang Cloud PostgreSQL (Neon / Vercel Postgres) một cách an toàn, bảo toàn 100% dữ liệu lịch sử, quan hệ và đặc biệt là hạn mức `API_USAGE`.

---

## 1. Nguyên tắc an toàn bất biến (Invariants)

1. **Không migrate schema bằng data reset**: Không bao giờ chạy `prisma migrate reset` trên database đích.
2. **Bảo tồn bắt buộc `API_USAGE`**: Các bản ghi `SyncJob` với `type = 'API_USAGE'` của ngày hiện tại phải được giữ nguyên để Cloud backend không reset quota về 0, tránh làm cạn kiệt RapidAPI key.
3. **Sequence Alignment**: Toàn bộ PostgreSQL sequences (`Player_id_seq`, `Match_id_seq`, `SyncJob_id_seq`, v.v.) phải được cập nhật tương ứng với `MAX(id)` sau khi import dữ liệu.
4. **Verifiable**: Sau khi import, bắt buộc phải chạy `npm run db:verify --workspace=backend` để đối chiếu với các chỉ số vàng (Golden Sanity Checks).
5. **No Double Schedulers**: Không bật `ENABLE_PRODUCTION_CRON=true` trên Vercel cho đến khi toàn bộ dữ liệu đã được import và xác minh thành công.

---

## 2. Các bước thực hiện chi tiết

### Bước 1: Khởi tạo Cloud Database trên Vercel / Neon
1. Trên Vercel Dashboard, tại tab **Storage**, chọn **Create Database** -> **Postgres** (hoặc tích hợp Neon).
2. Đặt tên database: `tennisscope-db-prod`.
3. Lưu lại chuỗi kết nối `DATABASE_URL` (dạng `postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require`).

---

### Bước 2: Khởi tạo Schema trên Cloud Database
Sử dụng Prisma Migrate để tạo cấu trúc bảng, enum, indexes và constraints trên cloud:

```bash
# Đặt biến môi trường DATABASE_URL trỏ tới Cloud DB
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require" npx prisma migrate deploy --schema=backend/prisma/schema.prisma
```

*Lưu ý: Lệnh `prisma migrate deploy` chỉ áp dụng các file migration đã có, không tạo dữ liệu giả và không xóa bảng.*

---

### Bước 3: Export dữ liệu từ Local PostgreSQL Docker
Thực hiện trích xuất dữ liệu thuần túy (data-only) từ container `tennisscope-db`:

```bash
# 1. Export dữ liệu ra file SQL
docker exec -t tennisscope-db pg_dump -U postgres -d tennisscope \
  --data-only \
  --no-owner \
  --no-acl \
  --disable-triggers \
  -f /tmp/tennisscope_data.sql

# 2. Copy file dump từ Docker container ra máy host
docker cp tennisscope-db:/tmp/tennisscope_data.sql ./tennisscope_data.sql
```

---

### Bước 4: Import dữ liệu vào Cloud PostgreSQL
Sử dụng công cụ `psql` để nạp file dữ liệu vào Cloud DB:

```bash
psql "postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require" -f ./tennisscope_data.sql
```

---

### Bước 5: Cập nhật PostgreSQL Sequences (Tránh Primary Key Collision)
Chạy script SQL sau trên Cloud DB để đảm bảo sequence của tất cả các bảng tự tăng (`id`) trỏ tới giá trị lớn nhất hiện tại:

```sql
SELECT setval(pg_get_serial_sequence('"Player"', 'id'), coalesce(max(id), 0) + 1, false) FROM "Player";
SELECT setval(pg_get_serial_sequence('"Tournament"', 'id'), coalesce(max(id), 0) + 1, false) FROM "Tournament";
SELECT setval(pg_get_serial_sequence('"Match"', 'id'), coalesce(max(id), 0) + 1, false) FROM "Match";
SELECT setval(pg_get_serial_sequence('"MatchPlayerStat"', 'id'), coalesce(max(id), 0) + 1, false) FROM "MatchPlayerStat";
SELECT setval(pg_get_serial_sequence('"RankingSnapshot"', 'id'), coalesce(max(id), 0) + 1, false) FROM "RankingSnapshot";
SELECT setval(pg_get_serial_sequence('"PlayerCareerStat"', 'id'), coalesce(max(id), 0) + 1, false) FROM "PlayerCareerStat";
SELECT setval(pg_get_serial_sequence('"PlayerTitle"', 'id'), coalesce(max(id), 0) + 1, false) FROM "PlayerTitle";
SELECT setval(pg_get_serial_sequence('"SyncJob"', 'id'), coalesce(max(id), 0) + 1, false) FROM "SyncJob";
```

---

### Bước 6: Chạy kiểm định toàn vẹn (Database Verification)
Chạy script kiểm tra với `DATABASE_URL` trỏ tới Cloud DB:

```bash
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require" npm run db:verify --workspace=backend
```

**Bảng tiêu chí kiểm tra (Expected Baseline Metrics):**
- **Total Players**: $\ge 605$
- **Current Top 100 Count**: Đủ $100/100$
- **Top 100 Country Coverage**: $100/100$ (tất cả có mã quốc gia hợp lệ từ RapidAPI)
- **Top 100 Birthday Coverage**: $\ge 44/100$
- **Latest Ranking Snapshot**: $100$ entries
- **Matches**: $\ge 463$
- **MatchPlayerStats**: $\ge 322$
- **API_USAGE**: Phải bảo toàn chính xác số requests đã sử dụng trong ngày
- **Golden Checks**:
  - Alexander Zverev: Rank 1, `countryCode = 'GER'`, tuổi 29, có dữ liệu trận đấu năm 2026.
  - Jannik Sinner: Rank 2, `countryCode = 'ITA'`, có Career Stats và Titles.
  - Carlos Alcaraz: Rank 3, `countryCode = 'ESP'`, có dữ liệu trận đấu năm 2026.
- Kết quả audit: `Overall Integrity Result: ✅ PASS`.

Sau khi xác minh PASS, tiến hành kích hoạt Vercel Cron theo hướng dẫn `docs/vercel-deployment.md`.

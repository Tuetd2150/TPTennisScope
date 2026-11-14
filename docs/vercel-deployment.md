# TennisScope — Vercel Production Deployment Guide

Hướng dẫn thiết lập và triển khai hệ thống TennisScope trên **Vercel** thành 2 Projects độc lập (Frontend Web và Backend API), kết nối cơ sở dữ liệu Cloud PostgreSQL (Neon/Vercel Postgres) và vận hành Vercel Cron an toàn hạn ngạch.

---

## 1. Kiến trúc Production trên Vercel

```text
GitHub Repo: Tuetd2150/TPTennisScope
│
├── frontend/
│   └── Vercel Project: "tennisscope-web"
│       Framework: Vite (React + TypeScript + Tailwind)
│       Output: dist/
│       SPA Deep-link Rewrite: frontend/vercel.json
│
├── backend/
│   └── Vercel Project: "tennisscope-api"
│       Serverless Framework: Node.js / Express
│       Database: Prisma ORM (Serverless Singleton + Advisory Locks)
│       Cron Jobs: Vercel Cron (/api/cron/*)
│       Config: backend/vercel.json
│
└── Cloud PostgreSQL (Neon / Vercel Postgres)
    └── Persistent Storage cho Rankings, Players, Matches, SyncJobs & API_USAGE
```

---

## 2. Thiết lập Project 1: Backend API (`tennisscope-api`)

### Bước 1: Import Repository
1. Trên Vercel Dashboard, bấm **Add New...** -> **Project**.
2. Chọn repository `Tuetd2150/TPTennisScope`.
3. Đặt **Project Name**: `tennisscope-api`.
4. Tại mục **Root Directory**, bấm **Edit** và chọn thư mục: `backend`.
5. **Framework Preset**: Chọn `Other` (hoặc Node.js).
6. **Build Command**: `npm run build` (sẽ chạy `prisma generate && tsc`).
7. **Output Directory**: Bỏ trống (mặc định cho Serverless Functions).

### Bước 2: Thiết lập Environment Variables cho Backend
Tại tab **Environment Variables**, thêm các biến sau:

| Biến | Giá trị khuyến nghị / Ví dụ | Ghi chú |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` | Chuỗi kết nối Cloud Postgres |
| `RAPIDAPI_KEY` | *(Key RapidAPI của dự án)* | **Bảo mật**: Không public |
| `RAPIDAPI_HOST` | `tennis-api-atp-wta-itf.p.rapidapi.com` | Host provider Tennis |
| `NODE_ENV` | `production` | Môi trường production |
| `FRONTEND_ORIGIN` | `https://tennisscope-web.vercel.app` | Domain frontend chính thức |
| `FRONTEND_ORIGINS` | `https://tennisscope-web.vercel.app,http://localhost:5173` | Hỗ trợ nhiều origin |
| `SYNC_TIMEZONE` | `Asia/Ho_Chi_Minh` | Múi giờ chuẩn nghiệp vụ |
| `DAILY_API_REQUEST_BUDGET` | `45` | Hạn ngạch API bảo vệ quota |
| `CRON_SECRET` | *(Chuỗi ngẫu nhiên bảo mật 32+ ký tự)* | Token bảo vệ `/api/cron/*` |
| `ENABLE_LOCAL_SCHEDULER` | `false` | **Bắt buộc false** trên Vercel |
| `ENABLE_PRODUCTION_CRON` | `false` *(Ban đầu)* | **Chỉ bật true sau khi hoàn tất migrate DB** |

### Bước 3: Deploy Backend
1. Bấm **Deploy**.
2. Sau khi deploy xong, lưu lại domain API được cấp (ví dụ: `https://tennisscope-api.vercel.app`).
3. Kiểm tra endpoint kiểm tra sức khỏe:
   `GET https://tennisscope-api.vercel.app/api/health`
   Kết quả trả về phải là `{ "status": "ok", "environment": "production" }`.

---

## 3. Thiết lập Project 2: Frontend Web (`tennisscope-web`)

### Bước 1: Import Repository
1. Trên Vercel Dashboard, bấm **Add New...** -> **Project**.
2. Chọn repository `Tuetd2150/TPTennisScope`.
3. Đặt **Project Name**: `tennisscope-web`.
4. Tại mục **Root Directory**, bấm **Edit** và chọn thư mục: `frontend`.
5. **Framework Preset**: Chọn `Vite`.
6. **Build Command**: `npm run build` (`tsc -b && vite build`).
7. **Output Directory**: `dist`.

### Bước 2: Thiết lập Environment Variables cho Frontend
Tại tab **Environment Variables**:

| Biến | Giá trị khuyến nghị / Ví dụ | Ghi chú |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://tennisscope-api.vercel.app` | URL trỏ tới Backend API vừa deploy |

*Hàm chuẩn hóa `buildApiBaseUrl` đã tích hợp sẵn sẽ tự động xử lý dù bạn điền `https://tennisscope-api.vercel.app` hay `https://tennisscope-api.vercel.app/api`, đảm bảo không bao giờ bị trùng `/api/api` hoặc thiếu `/api`.*

### Bước 3: Deploy Frontend
1. Bấm **Deploy**.
2. Truy cập web domain (ví dụ: `https://tennisscope-web.vercel.app`).
3. Thử tải lại các trang deep link như:
   - `/rankings`
   - `/player/24008`
   - `/compare`
   Đảm bảo không bị lỗi 404 nhờ cấu hình rewrite trong `frontend/vercel.json`.

---

## 4. Lịch trình Vercel Cron (Đã cấu hình trong `backend/vercel.json`)

Vercel Cron hoạt động theo múi giờ UTC, đã được quy đổi chính xác từ giờ Việt Nam (UTC+7):

| Nhiệm vụ Sync | Giờ VN (UTC+7) | Giờ UTC tương ứng | Biểu thức Cron UTC | Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Ranking Sync** | `03:00` hàng ngày | `20:00` hàng ngày | `0 20 * * *` | `/api/cron/ranking` |
| **Match Sync** | `00:00, 06:00, 12:00, 18:00` (mỗi 6h) | `17:00, 23:00, 05:00, 11:00` | `0 5,11,17,23 * * *` | `/api/cron/matches` |
| **Profile / Birthday** | `04:00` hàng ngày | `21:00` hàng ngày | `0 21 * * *` | `/api/cron/profile-reconcile` |

*Ghi chú*:
- Vercel Cron tự động gắn header `Authorization: Bearer ${CRON_SECRET}` khi gửi request.
- Các route cron được bảo vệ bằng **PostgreSQL Advisory Lock** (`pg_try_advisory_lock`), đảm bảo không có 2 instance serverless nào chạy trùng lặp khi Vercel scale.

---

## 5. Quy trình kích hoạt an toàn (Zero-Quota-Leak Sequence)

Để đảm bảo không bao giờ xảy ra tình trạng chạy đồng thời 2 scheduler (local và Vercel) hoặc chạy cron khi database cloud chưa có dữ liệu:

1. **Deploy Backend**: `ENABLE_PRODUCTION_CRON=false`.
2. **Thực hiện Migration Dữ liệu**: Làm theo `docs/database-migration-runbook.md`.
3. **Chạy Kiểm định**: Chạy `npm run db:verify --workspace=backend` với Cloud DB. Kết quả phải `✅ PASS`.
4. **Deploy Frontend**: Kết nối và test giao diện trên browser.
5. **Tắt Scheduler Local**:
   - Nếu chạy server local, đặt `ENABLE_LOCAL_SCHEDULER=false` trong `backend/.env`.
6. **Kích hoạt Production Cron**:
   - Vào Vercel Backend Project -> **Settings** -> **Environment Variables**.
   - Đổi `ENABLE_PRODUCTION_CRON` từ `false` thành `true`.
   - Bấm **Redeploy** phiên bản backend mới nhất.
7. **Xác nhận**: Theo dõi tab **Cron** trên Vercel Dashboard của backend project.

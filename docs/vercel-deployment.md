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

## 4. Lịch trình Vercel Schedules (Cấu hình trong `backend/vercel.json`)

TennisScope sử dụng cơ chế **Vercel Schedules** mới (hỗ trợ bởi `@vercel/schedules` và private functions với `experimentalTriggers: schedule/v1beta`). Cơ chế này hỗ trợ trực tiếp múi giờ địa phương `Asia/Ho_Chi_Minh` mà không bị giới hạn 1 lần/ngày của Vercel Hobby Cron cũ:

| Tên Schedule | Giờ chạy (Asia/Ho_Chi_Minh) | Biểu thức Cron | Target Function | Ghi chú an toàn |
| :--- | :--- | :--- | :--- | :--- |
| **`ranking-sync`** | `03:00` hàng ngày | `0 3 * * *` | `api/schedule-ranking` | Top 100 ranking, ENTER/STAY/LEAVE, new snapshots |
| **`match-sync`** | `00:00, 06:00, 12:00, 18:00` (mỗi 6h) | `0 0,6,12,18 * * *` | `api/schedule-matches` | Incremental singles match sync (OR Top 100 rule) |
| **`profile-reconcile`** | `04:00` hàng ngày | `0 4 * * *` | `api/schedule-profile-reconcile` | Reconcile birthdays/profiles (Quota-aware, Safety buffer 6) |

*Đặc tính an toàn của Vercel Schedules*:
- **Private Function**: Nhờ trigger `schedule/v1beta`, các function này **không có URL công khai**, không thể bị kích hoạt từ internet.
- **Header CloudEvent Validation**: SDK `@vercel/schedules` tự động kiểm tra chữ ký CloudEvent từ scheduler nội bộ của Vercel. Mọi HTTP request thông thường từ ngoài sẽ bị từ chối `400 Bad Request`.
- **Database Row Lock (Neon/PgBouncer-safe)**: Khóa chống chạy trùng lặp sử dụng bảng `SyncJob` với TTL 15 phút, hoàn toàn tương thích với cơ chế connection pooler của Neon.

---

## 5. Quy trình kích hoạt an toàn (Zero-Quota-Leak Sequence)

1. **Deploy Backend**: `ENABLE_PRODUCTION_CRON=false`.
2. **Kiểm tra trên Vercel Dashboard**:
   - Truy cập Vercel Dashboard -> Project `tennisscope-api` (hoặc `tp-tennis-scope-api`).
   - Vào tab **Settings** -> mục **Schedules** (hoặc tab **Schedules** trực tiếp trên thanh điều hướng project nếu giao diện mới hiển thị).
   - Bạn sẽ thấy 3 schedules tĩnh: `ranking-sync`, `match-sync`, `profile-reconcile`.
   - Mỗi schedule sẽ hiển thị trạng thái, biểu thức cron và múi giờ `Asia/Ho_Chi_Minh`.
3. **Tắt Scheduler Local**:
   - Nếu chạy server local, đặt `ENABLE_LOCAL_SCHEDULER=false` trong `backend/.env` để tránh double scheduler.
4. **Kích hoạt Production Sync**:
   - Vào Vercel Backend Project -> **Settings** -> **Environment Variables**.
   - Tìm biến `ENABLE_PRODUCTION_CRON`, sửa giá trị từ `false` thành `true`.
   - Bấm **Save**.
   - Vào tab **Deployments**, chọn deployment mới nhất -> bấm dấu 3 chấm `...` -> chọn **Redeploy** (để Vercel nạp giá trị biến môi trường mới vào serverless container).
5. **Theo dõi**: Kiểm tra log của các scheduled functions trong tab **Logs** hoặc **Schedules** của project backend.

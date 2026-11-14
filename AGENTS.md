# TennisScope — Quy tắc nền của dự án

## 1. Mục tiêu dài hạn

TennisScope là hệ thống theo dõi và phân tích ATP Men's Singles Top 100.

Kiến trúc phải hướng tới khả năng vận hành tự động:

- cập nhật ranking theo lịch;
- xác định Current Top 100 động;
- phát hiện player ENTER / STAY / LEAVE Top 100;
- theo dõi mọi trận có ít nhất một Current Top 100 player;
- lưu ranking history, match history và statistics;
- enrich/catch-up player khi họ vào lại Top 100;
- giữ dữ liệu lịch sử khi họ rời Top 100;
- hoạt động an toàn trong giới hạn API quota.

Không thiết kế hệ thống quanh tên một player cụ thể.

## 2. Kiến trúc hiện tại

Monorepo:

- `frontend`: React + TypeScript + Vite + Tailwind + React Router + Axios + Recharts;
- `backend`: Node.js + TypeScript + Express + Zod + node-cron + Prisma;
- database: PostgreSQL;
- provider: Tennis API qua RapidAPI;
- frontend chỉ gọi backend qua `/api/...`.

Không đưa RapidAPI key, database credential hoặc provider secret sang frontend.

Không tự ý thay framework, ORM, database, API architecture, state manager hoặc Prisma major version nếu chưa có yêu cầu rõ ràng.

## 3. Player identity

Luôn phân biệt:

- `Player.id`: primary key nội bộ PostgreSQL;
- `Player.externalId`: ID player của provider.

Khi đối chiếu provider response, dùng `externalId`.

Khi tạo Prisma relation, dùng internal `Player.id`.

Không được trộn hai loại ID.

## 4. Dynamic Top 100

Không hardcode tên hoặc provider ID làm production tracking target.

Sai:

```ts
const trackedPlayers = ["Jannik Sinner", "Carlos Alcaraz"];
```

Sai:

```ts
if (player.externalId === 47275) {
  // special behavior
}
```

Current Top 100 phải được suy ra từ authoritative ranking data/snapshot hiện hành.

Nếu task chọn theo rank, rank chỉ là selector để resolve player hiện tại. Sau khi resolve, pipeline phải generic.

## 5. Quy tắc theo dõi trận đấu

Một match cần được theo dõi khi:

```ts
currentTop100ExternalIds.has(player1ExternalId) ||
currentTop100ExternalIds.has(player2ExternalId)
```

Đây là điều kiện **OR**, không phải AND.

Ví dụ:

```text
#1 vs #150    -> lưu
#50 vs #72    -> lưu
#110 vs #180  -> bỏ qua nếu không có tracked player khác
```

## 6. Opponent ngoài Top 100

Nếu tracked player gặp opponent ngoài Top 100:

- vẫn lưu match đầy đủ;
- create/reuse minimal Player record;
- lưu opponent stats nếu provider trả;
- Recent Matches vẫn hiển thị opponent bình thường;
- minimal profile có thể truy cập như behavior hiện tại.

Không tự động gọi Profile/Career/Titles/full-season backfill cho opponent ngoài Top 100 chỉ vì họ xuất hiện trong một trận.

Nếu sau này opponent lọt Top 100, tái sử dụng Player record đã có và enrich record đó. Không tạo duplicate Player.

## 7. Player rời hoặc quay lại Top 100

Khi player rời Top 100:

- không xóa Player;
- không xóa Profile/Career/Titles;
- không xóa Match/MatchPlayerStat;
- không xóa RankingSnapshot;
- không xóa historical season data.

Chỉ ngừng deep tracking/enrichment nếu policy hiện hành yêu cầu.

Khi player quay lại Top 100:

- tái sử dụng record cũ;
- chạy catch-up/backfill phần dữ liệu bị thiếu nếu cần.

## 8. Ranking history

`RankingSnapshot` là historical data.

Không overwrite snapshot cũ chỉ để giữ latest ranking.

Không chế tạo ranking history giả.

Ranking/current points authoritative phải đến từ ranking pipeline, không lấy profile/career `currentRank` hoặc points để thay thế.

## 9. Provider Source of Truth (RapidAPI / Matchstat)

RapidAPI / Matchstat là **single source of truth** duy nhất cho toàn bộ hệ thống TennisScope.

Nguyên tắc bất biến (Project-wide Invariant):

- Mọi miền dữ liệu sau đây đều bắt buộc xuất phát từ RapidAPI:
  - rankings / ranking points;
  - player profile / metadata;
  - country / nationality;
  - career statistics;
  - titles / trophy cabinet;
  - tournaments / surfaces;
  - matches / results;
  - match statistics / serve statistics;
  - season data.
- **Không dùng ATP website, Wikipedia, Flashscore hay bất kỳ nguồn ngoài nào để “correct” hoặc can thiệp dữ liệu provider.**
- TennisScope được phép tính các derived aggregates (tổng hợp phái sinh) từ dữ liệu RapidAPI đã lưu trong PostgreSQL, nhưng nguyên liệu đầu vào luôn phải là dữ liệu provider.
- Nếu RapidAPI trả `null` hoặc missing, giữ nguyên `null`/missing đó là trạng thái hợp lệ của provider; không fabricate dữ liệu bị thiếu.
- `null` không đồng nghĩa với `0`.
- **Tuyệt đối không suy luận hoặc ghi đè nationality từ birthplace.** Nơi sinh không đồng nhất với quốc tịch thể thao chính thức.

## 10. Sync strategy

- Initial player onboarding/recovery: ưu tiên player `past-matches` có `include=...stat`.
- Ongoing production updates: ưu tiên incremental Results theo thời gian/ngày rồi lọc match có ít nhất một Current Top 100 player.
- Không gọi `past-matches` cho toàn bộ Top 100 mỗi 6 giờ.
- Không gọi H2H match-stat riêng cho từng match nếu embedded stats đã có.

Mục tiêu production đã thống nhất:

- ranking sync: theo lịch hằng ngày;
- match sync: mỗi 6 giờ;
- timezone cấu hình: `Asia/Ho_Chi_Minh`.

Không thay cron production một cách tùy tiện nếu task chỉ yêu cầu logic khác.

## 11. API quota

Mọi provider request phải đi qua TennisApiClient/quota reservation hiện có.

Không bypass bằng raw `fetch`, raw `axios`, `curl`, `Invoke-WebRequest`, Postman hoặc browser request nếu chúng không đi qua quota accounting.

Persistent API_USAGE là bắt buộc.

Giá trị trong environment/config là nguồn budget local; không hardcode budget vào production logic nếu config đã tồn tại.

## 12. Database safety

Không tự ý chạy:

- `prisma migrate`;
- `prisma db push`;
- database reset/drop;
- bulk destructive cleanup;
- Prisma major upgrade.

Nếu task thực sự cần schema change/migration, dừng và báo rõ lý do trước khi thực hiện trừ khi user đã cho phép trực tiếp.

## 13. Change policy

Trước khi sửa production code:

1. chạy/đọc `git status`;
2. inspect implementation hiện tại;
3. hiểu data flow đang hoạt động;
4. xác định phạm vi nhỏ nhất cần thay đổi;
5. ưu tiên generic fix.

Không broad-refactor phần đang hoạt động chỉ vì có cách viết khác đẹp hơn.

Không sửa file không liên quan.

Không ghi đè thay đổi chưa commit của user.

## 14. Regression-sensitive areas

Giữ nguyên behavior đã được xác nhận trừ khi task yêu cầu thay đổi có chủ đích:

- Player Profile;
- Career;
- Titles/Trophy Cabinet;
- Season backfill;
- surface mapping;
- weighted stats aggregation;
- Recent Matches DB-backed;
- minimal opponent profile;
- RankingSnapshot history;
- API_USAGE/quota guard;
- `useApi` infinite-loop fix.

## 15. Validation

Sau production-code change, chạy các script project hiện có tương ứng với:

- typecheck;
- lint;
- test;
- build.

Temporary audit/debug script phải disconnect tài nguyên, kết thúc sạch và được xóa nếu không phải tool tái sử dụng.

## 16. Thứ tự ưu tiên

Khi có trade-off, ưu tiên:

1. correctness;
2. data integrity;
3. quota safety;
4. generic/dynamic architecture;
5. idempotency;
6. regression safety;
7. maintainability;
8. performance optimization khi có bằng chứng cần thiết.

## 17. Git safety

Antigravity có thể dùng Git nhưng không tự commit/push nếu user chưa yêu cầu rõ ràng.

Trước commit/push:

- inspect `git status`, branch, remote và diff;
- chạy verification phù hợp;
- stage có chọn lọc, không mặc định `git add .`/`git add -A`;
- kiểm tra staged diff và secret;
- không commit `.env`, credential, private key hoặc generated/temp artifact ngoài ý muốn.

Không tự dùng `reset --hard`, `clean -fd`, rebase/amend hoặc force push.

Khi user yêu cầu commit/push, ưu tiên skill `tennisscope-git-finish` và tuân thủ `.agents/rules/git-safety.md`.

## 18. Vercel Serverless & Production Deployment Invariants

- **2 Vercel Projects độc lập**: Frontend Web (`tennisscope-web`) và Backend API (`tennisscope-api`).
- **RapidAPI là Single Source of Truth**: Dữ liệu trên Cloud PostgreSQL bắt buộc xuất phát từ RapidAPI; không dùng nguồn ngoài để can thiệp.
- **Production Cron tách biệt**: Production cron sử dụng Vercel Cron (`/api/cron/*`), không được chạy `node-cron` bên trong Vercel Functions.
- **No Double Scheduler**: Tuyệt đối không để local scheduler và Vercel scheduler cùng hoạt động song song. Quản lý an toàn bằng `ENABLE_LOCAL_SCHEDULER` và `ENABLE_PRODUCTION_CRON`.
- **Serverless Anti-Overlap DB Lock**: Chống chạy trùng lặp trên serverless phải dùng database-backed lock (PostgreSQL `pg_try_advisory_lock`), không dựa vào boolean in-memory lock.
- **Bảo tồn API_USAGE khi migrate**: Di chuyển dữ liệu lên Cloud PostgreSQL bắt buộc bảo tồn các bản ghi `API_USAGE` trong `SyncJob` của ngày hiện tại để tránh reset quota về 0.
- **Preview Deployments Gate**: Mọi deploy dạng preview/staging (`VERCEL_ENV != 'production'`) bị cấm gọi RapidAPI live sync.
- **Avatar Storage Caveat**: Filesystem của Vercel Serverless Function không có tính bền vững (non-persistent); task avatar vẫn PAUSED cho đến khi tích hợp Cloud Object Storage riêng.

# TennisScope — Bài học đã đúc kết

Tài liệu này lưu các bài học kỹ thuật từ quá trình xây và debug TennisScope. Đây không phải nơi lưu current ranking hoặc current season totals để hardcode.

## 1. Golden Profile chứng minh pipeline, không phải template hardcode player

ATP #1 từng được dùng làm Golden Profile để debug toàn bộ pipeline end-to-end:

```text
Ranking
-> Profile
-> Career
-> Titles
-> Season backfill
-> Match stats
-> Surface
-> Season aggregation
-> Recent Matches
```

Bài học: sau khi pipeline đã generic, player mới chỉ là input. Không tạo `syncSinner()`, `syncAlcaraz()` hoặc logic theo tên.

## 2. Resolve theo ranking, không theo tên

Lần validation thứ hai chọn `rank = 3` từ latest RankingSnapshot rồi resolve ra player hiện tại.

Bài học: nếu user nói “số 3 thế giới”, code phải resolve Current #3 từ data. Tên player chỉ là sanity check, không phải selector lâu dài.

## 3. ATP Finals = 0 phải là generic behavior

Case ATP #3 đã chứng minh provider có thể trả `tourRankId = 7` với `titlesWon = 0`.

Bài học:

- Trophy Cabinet luôn dựa trên title categories của player hiện tại;
- không hardcode zero;
- không ẩn row chỉ vì zero;
- category hợp lệ với zero khác với missing/malformed provider data.

## 4. `include=stat` là chìa khóa của season backfill

Đã từng gọi player past-matches mà không include stats rồi tưởng provider không cung cấp full season stats.

Sau khi dùng:

```text
include=round,tournament,tournament.court,stat
```

embedded stats xuất hiện đầy đủ cho season test.

Bài học: trước khi thêm endpoint phụ, kiểm tra include/expansion của endpoint chính.

## 5. Không dùng H2H stat từng trận cho full season nếu không cần

Giai đoạn thử nghiệm đã tiêu nhiều quota do Results + per-match H2H stats.

Bài học: một request season có embedded stats tốt hơn hàng chục request per match.

## 6. Daily historical Results không phù hợp để backfill một player

Cách thử ban đầu dùng Results theo ngày đã insert nhiều match không liên quan và khó kiểm soát quota.

Bài học:

- player past-matches: initial/player-specific backfill;
- daily Results: ongoing incremental system-wide sync.

## 7. Surface fallback có thể sai

Tournament-name inference từng phân loại French Open sai do keyword ordering/naming mismatch.

Bài học:

- dùng `courtId`/explicit court trước;
- name fallback chỉ là defensive fallback;
- thêm fallback phải generic, không patch theo từng tournament nếu có provider field tốt hơn.

## 8. Minimal opponent profile là behavior được chấp nhận

Opponent ngoài Top 100 vẫn cần:

- Player record tối thiểu;
- match history;
- stats nếu có;
- route/profile tối thiểu nếu UI hiện hỗ trợ.

Không cần tiêu quota để full-enrich họ.

Nếu sau này lọt Top 100, enrich record hiện có.

## 9. Current Top 100 match rule là OR

Sai:

```text
p1 Top100 AND p2 Top100
```

Đúng:

```text
p1 Top100 OR p2 Top100
```

Nếu không, hệ thống sẽ bỏ mất phần lớn match thật của Top 100 khi gặp qualifier/lower-ranked player.

## 10. Weighted percentages

Không average % từng match.

Dùng tổng numerator / tổng denominator trên toàn season.

Đây là điều kiện quan trọng để stats không bị bias bởi match ngắn/dài khác nhau.

## 11. Career high null guard

Career endpoint có thể trả `bestRank = null` trong một số response.

Bài học: không dùng null để wipe career high hợp lệ đã lưu.

## 12. Empty titles response

Player có thể hợp lệ nhưng không có title categories.

Bài học: `[]` có thể là valid zero-title dataset, nhưng phải phân biệt với malformed/null/unexpected provider response.

## 13. RankingSnapshot phải tích lũy

Ranking history từng chỉ có một điểm vì mới có một snapshot. Đây không phải UI bug.

Bài học: scheduler ranking hằng ngày sẽ làm history tăng tự nhiên; không fake các điểm quá khứ.

## 14. Frontend phải DB-backed

Recent Matches và PlayerPage không nên gọi provider trực tiếp khi render.

Provider sync -> PostgreSQL -> backend API -> frontend.

Điều này giảm quota, tăng tính ổn định và giữ secret ở backend.

## 15. Không viết lại `useApi` nếu không cần

Infinite flashing loop của `useApi` đã được sửa bằng cách ổn định fetcher/dependency.

Bài học: đây là regression-sensitive area. Không refactor lại hook chỉ vì đang sửa player/sync logic.

## 16. Quota accounting phải tính cả retry

Một lần sync thất bại có thể đã tiêu request trước khi DB save fail.

Bài học:

- mỗi actual HTTP attempt phải reserve quota trước;
- retry = request mới;
- log/report exact attempts, không chỉ số logical job.

## 17. Không suy ra provider reset từ local day

Local API_USAGE và provider subscription/reset window có thể không trùng nhau.

Bài học: app budget là safety guard độc lập. Không tăng budget chỉ vì local date vừa đổi nếu provider state chưa cho phép.

## 18. Build trước, live test sau

Dynamic Top 100/scheduler có thể implement và mock-test không tốn provider quota, nhưng production readiness cần controlled live integration test sau đó.

Bài học: cần cả hai lớp:

```text
mock test -> chứng minh logic nội bộ
live test -> chứng minh integration với provider thật
```

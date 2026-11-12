---
name: tennisscope-player-sync
description: Đồng bộ, onboard, enrich, backfill hoặc kiểm tra một player TennisScope theo pipeline generic gồm Profile, Career, Titles, season matches, embedded stats, minimal opponents, Recent Matches và validation. Dùng khi user yêu cầu hoàn thiện player, xử lý player theo rank, catch-up player mới vào Top 100 hoặc debug dữ liệu player.
---

# TennisScope Player Sync

## Mục tiêu

Xử lý một target player bằng pipeline generic đã được kiểm chứng.

Không biến tên player đang test thành production logic.

Trước khi làm, đọc khi cần:

- `../../resources/provider-contract.md`;
- `../../resources/lessons-learned.md`.

## Quy trình chuẩn

### 1. Resolve target

Nếu input là rank:

1. lấy latest authoritative RankingSnapshot trong DB;
2. resolve Player đang giữ rank đó;
3. report `rankingDate`, rank, name, internal `id`, `externalId`, points;
4. dùng `externalId` cho provider pipeline.

Tên player chỉ là sanity check nếu user có nêu tên.

Nếu ranking DB khác expectation của prompt, ưu tiên data hiện hành và báo rõ.

Nếu input là Player đã biết, ưu tiên resolve record hiện có trong DB thay vì hardcode provider ID.

### 2. Audit trước network

Kiểm tra:

- Profile fields;
- PlayerCareerStat;
- PlayerTitle;
- season Match count;
- MatchPlayerStat coverage;
- SyncJob history;
- API_USAGE.

Xác định chính xác phần thiếu trước khi gọi provider.

Khuyến nghị dùng `/tennisscope-db-audit` hoặc script audit đi kèm.

### 3. Tính request budget

Tính minimum provider calls.

Ví dụ nếu Profile đã có:

```text
Career  -> 1
Titles  -> 1
Season  -> 1
```

Không gọi endpoint đã có dữ liệu complete nếu task không yêu cầu refresh.

Nếu required requests vượt hard cap/quota, dừng trước network thay vì làm player dở dang.

### 4. Profile

Chỉ sync Profile nếu cần.

Không dùng Profile `currentRank`/points để ghi đè ranking authoritative.

Giữ image fallback hiện tại nếu provider image không khả dụng.

Không scrape ảnh ngoài provider nếu task không yêu cầu.

### 5. Career

Dùng generic Career pipeline hiện có.

Persist theo provider semantics:

- wins/losses;
- favourite surface;
- finals;
- titles;
- runner-ups;
- career high/date.

Nếu `bestRank` null, không wipe career high hợp lệ đang tồn tại.

### 6. Titles

Dùng generic Titles pipeline.

Không hardcode Trophy Cabinet theo player.

Sau khi Titles dataset load thành công, UI phải derive category values generic.

Player không có ATP Finals title phải hiển thị `0` theo title data, không bằng special conditional.

Phân biệt valid empty response với malformed response.

### 7. Season backfill

Cho initial backfill/catch-up, ưu tiên:

```text
GET /tennis/v2/atp/player/past-matches/{playerId}
pageNo=1
pageSize=500
filter=GameYear:{year}
include=round,tournament,tournament.court,stat
```

Không revert sang historical daily Results cho một player nếu endpoint trên đủ.

Không gọi H2H match-stat từng match nếu embedded `stat` đã có.

Nếu pagination xuất hiện, tôn trọng hard request cap.

### 8. Import matches

Cho mỗi completed singles match:

- create/reuse minimal opponent Player;
- upsert Tournament;
- upsert Match;
- persist target MatchPlayerStat;
- persist opponent MatchPlayerStat nếu provider trả.

Nếu match đã được import từ player khác hoặc incremental scheduler, reuse cùng record.

### 9. Opponent ngoài Top 100

Giữ match đầy đủ.

Không full-enrich opponent ngoài target scope.

Nếu sau này opponent lọt Top 100, enrich Player record hiện có.

### 10. Season aggregation

Kiểm tra:

- Matches/W/L/Win%;
- Hard/Clay/Grass W-L;
- Aces/Double Faults;
- serve percentages;
- break point percentages;
- winners/unforced errors;
- net points;
- serve speeds.

Dùng weighted raw totals, không average per-match percentage.

Nếu stats coverage materially incomplete, giữ safeguard hiện có thay vì trình bày partial totals như full season.

### 11. Recent Matches

Recent Matches phải đọc DB.

Không provider request khi render PlayerPage.

Kiểm tra opponent ngoài Top 100 vẫn hiển thị bình thường.

### 12. Code-change policy

Expected production changes thường là 0 hoặc generic fix nhỏ.

Nếu player mới làm lộ bug:

- tìm generic assumption bị sai;
- sửa một lần cho tất cả player;
- không viết player-specific branch.

### 13. Validation

Sau production change:

- typecheck;
- lint;
- tests;
- build.

Có thể dùng `/tennisscope-verify`.

## Decision tree

```text
Dữ liệu đã complete?
├─ Có -> không gọi provider; chỉ audit/verify
└─ Không
   ├─ quota đủ cho toàn phần cần thiết? -> chạy generic pipeline
   └─ quota không đủ -> dừng trước network và báo request estimate
```

## Output tối thiểu

Report:

- target resolution;
- data before/after;
- provider requests;
- quota before/after;
- season completeness;
- generic bugs/fixes;
- files modified;
- validation status.

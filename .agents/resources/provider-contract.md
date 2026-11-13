# TennisScope — Provider contract đã kiểm chứng

> Đây là reference kỹ thuật dùng chung. Chỉ thay đổi khi có evidence mới từ provider và đã kiểm tra regression.

## Provider Source of Truth (Single Source of Truth)

RapidAPI / Matchstat (`tennis-api-atp-wta-itf.p.rapidapi.com`) là **single source of truth** duy nhất cho toàn bộ hệ thống TennisScope:

- **Mọi dữ liệu tennis**: ranking, points, profile, country, career stats, titles, tournaments, matches, serve/return stats đều bắt buộc xuất phát từ provider này.
- **Scope của Matchstat dataset**: Dataset `atp` / men's singles của provider bao gồm cả các giải cấp độ Challenger, ITF, Davis Cup (các level provider hỗ trợ). Vì vậy:
  - Career W-L, số danh hiệu (Titles), hoặc Season aggregates có thể lớn hơn hoặc khác biệt so với số liệu thống kê chỉ tính ATP Tour main-draw trên trang web chính thức của ATP Tour.
  - **Đây là semantic chính thức của provider, hoàn toàn bình thường và không phải là lỗi**.
  - Tuyệt đối không can thiệp, reconcile hay chỉnh sửa bằng nguồn ngoài (ATP website, Wikipedia...).
- **Xử lý missing/null**: Nếu provider trả `null` hoặc không có dữ liệu, TennisScope giữ nguyên `null`/missing đó là trạng thái hợp lệ. Không chế tạo số liệu giả.

## RapidAPI Endpoints & Thẩm quyền

Host hiện dùng:

```text
tennis-api-atp-wta-itf.p.rapidapi.com
```

Không đưa API key vào tài liệu hoặc frontend.

## ATP Singles Ranking

```text
GET /tennis/v2/atp/ranking/singles?pageNo=1&pageSize=100
```

- Ranking endpoint là authoritative duy nhất cho current rank, points, ranking date của TennisScope.
- Payload ranking cũng cung cấp mã quốc gia của player (`countryAcr`, `country.nameCode`, `country.acronym`) với độ bao phủ cao (Precedence #1 cho nationality).
- Không dùng profile/career `currentRank`/`currentPoints` để ghi đè ranking authoritative.

## Daily Results

```text
GET /tennis/v2/atp/results/{YYYY-MM-DD}
```

Các query thực tế có thể gồm:

```text
pageSize=...
pageNo=...
filter=PlayerGroup:singles
```

Use case chính: incremental production match sync.

Không dùng daily Results để backfill lịch sử của từng player nếu player past-matches đã đáp ứng tốt hơn.

## Player Profile

```text
GET /tennis/v2/atp/player/profile/{playerId}?include=form,ranking,country
```

- Profile endpoint là authoritative fallback cho player metadata (ngày sinh, chiều cao, cân nặng, tay thuận, HLV...) và countryCode (Precedence #2) khi ranking payload không có.
- Tuyệt đối không suy luận nationality từ `birthplace`.
- Profile có thể trả image không khả dụng/404. Placeholder hiện tại là behavior hợp lệ.
- Không tự động tải avatar nếu chưa có luồng chuyên dụng.

## Career Statistics

```text
GET /tennis/v2/profile/{playerId}/statistics?type=atp&includeAll=true
```

Các field đã gặp gồm:

- `total`;
- `bestRank`;
- `mainTours`;
- `tourFinals`;
- `master`;
- `grandSlam`;
- `favouriteCourt`;
- `totalTitles`;
- `totalTitlesWon`;
- `totalFinalsWon`.

Provider Career W-L có scope rộng hơn ATP main-tour official. TennisScope giữ provider semantics, không tự sửa bằng nguồn khác.

## Titles

```text
GET /tennis/v2/atp/player/titles/{playerId}
```

Known mapping:

```text
0 Futures/Satellites/ITF $10K
1 Challengers/ITF > $10K
2 Main tour
3 Masters series
4 Grand Slam
5 Davis/Fed Cup
7 Tour finals / ATP Finals
```

Provider có thể trả category khác như Olympics. Không tự map category chưa xác nhận.

`titlesWon` / `titlesLost` có thể là string, normalize về number theo pipeline hiện có.

## Player Past Matches — preferred season backfill

```text
GET /tennis/v2/atp/player/past-matches/{playerId}
```

Query đã kiểm chứng:

```text
pageNo=1
pageSize=500
filter=GameYear:{year}
include=round,tournament,tournament.court,stat
```

`include=...stat` là quan trọng. Không có `stat` có thể khiến response thiếu embedded match statistics.

Ưu tiên endpoint này cho:

- initial onboarding;
- full season backfill;
- re-entry catch-up;
- recovery.

Không dùng endpoint này cho toàn bộ Top 100 mỗi 6 giờ.

## Embedded stats

Các field đã kiểm chứng có thể gồm:

```text
firstServe
firstServeOf
aces
doubleFaults
winningOnFirstServe
winningOnFirstServeOf
winningOnSecondServe
winningOnSecondServeOf
winners
unforcedErrors
breakPointsConverted
breakPointsConvertedOf
netApproaches
netApproachesOf
totalPointsWon
fastestServe
averageFirstServeSpeed
averageSecondServeSpeed
```

Giữ null nếu provider không trả.

## Break points

Player break points converted/chances dùng own fields:

```text
own.breakPointsConverted
own.breakPointsConvertedOf
```

Nếu không có direct faced/saved:

```text
breakPointsFaced = opponent.breakPointsConvertedOf
breakPointsSaved = opponent.breakPointsConvertedOf - opponent.breakPointsConverted
```

## Surface

Known mapping:

```text
courtId 1 -> Hard
courtId 2 -> Clay
courtId 5 -> Grass
```

Indoor Hard aggregate về Hard nếu gặp.

Explicit provider court/surface > tournament-name fallback.

## Match stats endpoint

Endpoint H2H/match-stats từng trận đã từng được dùng trong giai đoạn thử nghiệm nhưng rất tốn quota.

Không gọi per-match stats nếu `past-matches + include=stat` hoặc incremental payload đã cung cấp đủ dữ liệu.

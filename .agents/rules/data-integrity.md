---
trigger: model_decision
description: "Áp dụng khi task đọc/ghi hoặc thay đổi logic liên quan Player, RankingSnapshot, Tournament, Match, MatchPlayerStat, PlayerCareerStat, PlayerTitle, SyncJob, season stats hoặc provider normalization."
---

# TennisScope — Quy tắc toàn vẹn dữ liệu

## Idempotency

Provider-derived entities phải converge về cùng record khi sync lặp lại.

Đặc biệt bảo vệ:

- Player;
- Tournament;
- Match;
- MatchPlayerStat;
- RankingSnapshot;
- PlayerCareerStat;
- PlayerTitle.

Không tạo duplicate chỉ vì cùng dữ liệu đi vào từ nhiều pipeline.

## Player identity

Provider identity dùng `Player.externalId`.

Database relation dùng internal `Player.id`.

Minimal Player đã tồn tại phải được reuse/enrich, không tạo Player mới.

## Match identity

Cùng một match có thể xuất hiện từ:

- player season backfill;
- opponent season backfill;
- incremental Results scheduler.

Tất cả phải upsert về cùng Match record theo identity/unique constraints hiện có.

## Current Top 100

Không dùng static player list.

Current Top 100 được suy ra từ latest authoritative ranking state.

Một match được track nếu p1 **OR** p2 thuộc Current Top 100.

## Surface

Canonical surface:

- `Hard`;
- `Clay`;
- `Grass`.

Mapping provider đã kiểm chứng:

```text
courtId 1 -> Hard
courtId 2 -> Clay
courtId 5 -> Grass
```

Indoor Hard phải aggregate về Hard khi phù hợp.

Explicit provider court/surface có ưu tiên cao hơn tournament-name fallback.

## Season percentages

Không average percentage từng match.

Tính từ raw totals, ví dụ:

```text
1st Serve %
= SUM(firstServe) / SUM(firstServeOf)
```

Áp dụng cùng nguyên tắc cho:

- 1st Serve Points Won;
- 2nd Serve Points Won;
- Break Points Converted;
- Break Points Saved;
- Net Points Won.

## Break points

Nếu provider không có direct faced/saved:

```text
breakPointsFaced = opponent.breakPointsConvertedOf
```

```text
breakPointsSaved =
opponent.breakPointsConvertedOf - opponent.breakPointsConverted
```

Không thay semantic này nếu chưa có provider evidence mới.

## Null và zero

`null` = không có/không biết dữ liệu.

`0` = dữ liệu hợp lệ và giá trị thực bằng 0.

Không tự chuyển null thành 0.

Ví dụ Titles dataset đã load thành công nhưng không có category ATP Finals có thể render 0 theo generic UI logic. Không tạo fake PlayerTitle chỉ để ép UI hiện 0.

## Titles mapping

Mapping đã kiểm chứng:

```text
tourRankId 0 -> Futures / Satellites / lower-level ITF
tourRankId 1 -> Challengers / ITF > $10K
tourRankId 2 -> Main Tour
tourRankId 3 -> Masters Series
tourRankId 4 -> Grand Slam
tourRankId 5 -> Davis/Fed Cup
tourRankId 7 -> Tour Finals / ATP Finals
```

Trophy Cabinet:

```text
Grand Slams      -> 4
ATP Finals       -> 7
Masters 1000     -> 3
Main Tour Titles -> 2
```

Không map theo tên player.

## Career high guard

Nếu career provider trả `bestRank = null`, không wipe một career high hợp lệ đã có từ nguồn/provider response trước đó.

## Valid empty response

Phân biệt:

- empty dataset hợp lệ, ví dụ player chưa có title category;
- malformed/null/unexpected response do provider/parser lỗi.

Không đánh dấu malformed response là completed chỉ vì array normalization ra rỗng.

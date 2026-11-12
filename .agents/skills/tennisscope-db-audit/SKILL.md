---
name: tennisscope-db-audit
description: Audit PostgreSQL của TennisScope trước hoặc sau sync để kiểm tra target player, latest ranking, Profile/Career/Titles, season Match/MatchPlayerStat, SyncJob và API_USAGE, đồng thời ước lượng số provider requests cần thiết. Dùng trước rollout, debugging, quota planning hoặc validation.
---

# TennisScope DB Audit

## Mục tiêu

Dùng database làm nguồn quan sát đầu tiên trước khi đốt provider quota.

## Tool đi kèm

Script:

```text
scripts/audit-player.mjs
```

Trước khi đọc source script, ưu tiên chạy:

```powershell
node .agents/skills/tennisscope-db-audit/scripts/audit-player.mjs --help
```

Sau đó chạy từ root project.

Ví dụ:

```powershell
node .agents/skills/tennisscope-db-audit/scripts/audit-player.mjs --rank 3 --year 2026
```

hoặc:

```powershell
node .agents/skills/tennisscope-db-audit/scripts/audit-player.mjs --external-id 68074 --year 2026
```

Nếu script không tương thích với schema hiện tại, inspect schema/code và sửa script generic; không gọi provider để bù cho audit tool lỗi.

## Audit target theo rank

1. lấy latest RankingSnapshot date;
2. resolve exactly one player ở target rank;
3. report rank/name/internal id/externalId/points;
4. không dùng hardcoded name làm selector.

## Player audit

Kiểm tra tối thiểu:

- Player existence;
- profile fields;
- career row;
- titles count;
- ranking data;
- season match count;
- MatchPlayerStat count.

## SyncJob audit

Nếu schema cho phép, inspect:

- PROFILE;
- CAREER;
- TITLES;
- BACKFILL;
- MATCH-related jobs;
- FAILED/RETRY;
- API_USAGE.

## Quota audit

Report current local usage theo project policy/config.

Không tạo network request chỉ để audit.

## Request estimate

Sau audit, kết luận:

```text
Missing:
- ...

Minimum provider requests required:
N
```

Nếu complete:

```text
Minimum provider requests required:
0
```

## Output

Output ngắn, có thể copy vào task tiếp theo:

- target;
- DB completeness;
- quota state;
- missing components;
- request estimate;
- suspicious inconsistencies.

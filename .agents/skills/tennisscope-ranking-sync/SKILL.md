---
name: tennisscope-ranking-sync
description: Triển khai, kiểm tra hoặc vận hành dynamic ATP Top 100 của TennisScope, gồm ranking sync, RankingSnapshot history, Current Top 100 membership, ENTER/STAY/LEAVE, player re-entry catch-up và ranking scheduler. Dùng khi task liên quan ranking, Top 100 động hoặc player vào/rời Top 100.
---

# TennisScope Ranking Sync

## Mục tiêu

Current Top 100 phải là tập động được derive từ authoritative ranking data.

Không dùng static player list.

Đọc khi cần:

- `../../resources/provider-contract.md`;
- `../../resources/lessons-learned.md`.

## Luồng chuẩn

```text
Ranking provider
-> normalize Top 100
-> upsert/reuse Player identity
-> append/persist RankingSnapshot theo thiết kế hiện có
-> derive Current Top 100
-> compare membership với trạng thái trước
-> ENTERED / STAYED / LEFT
```

## Ranking source

Ranking endpoint là authoritative cho:

- current rank;
- current points;
- ranking date.

Không lấy Profile/Career ranking field để thay thế.

## Current Top 100

Current Top 100 phải derive từ latest authoritative snapshot/state trong DB.

Không hardcode player name/provider ID.

Không hardcode “#3 = Carlos Alcaraz”. Rank chỉ là vị trí động.

## ENTERED

Khi player mới vào Current Top 100:

1. reuse existing Player nếu đã từng xuất hiện như minimal opponent;
2. update ranking state/snapshot;
3. queue Profile/Career/Titles nếu thiếu;
4. queue current-season catch-up/backfill nếu thiếu;
5. không tạo duplicate Player.

Deep enrichment phải quota-aware và có thể chạy theo queue/batch, không bắt buộc đốt hết trong cùng ranking job.

## STAYED

Khi player vẫn trong Top 100:

- cập nhật ranking snapshot/state;
- tiếp tục tracking;
- không deep-enrich lại dữ liệu đã fresh chỉ vì ranking job chạy.

## LEFT

Khi player rời Top 100:

- giữ Player;
- giữ Profile/Career/Titles;
- giữ Match/Stats;
- giữ RankingSnapshot;
- không destructive cleanup.

Ngừng deep tracking/enrichment theo policy hiện hành.

Nếu player rời Top 100 nhưng gặp một Current Top 100 player, match đó vẫn phải được lưu vì match rule là OR.

## Re-entry

Khi player quay lại Top 100:

- reuse record cũ;
- không tạo player mới;
- catch-up khoảng season bị thiếu nếu cần;
- tránh sync lại phần đã complete.

## Ranking history

Không overwrite history để chỉ còn latest point.

Không fake historical ranking points.

Nếu chart chỉ có một point vì DB mới có một snapshot, đó không phải bug.

## Scheduler

Mục tiêu đã thống nhất: ranking sync theo lịch hằng ngày, timezone theo config `Asia/Ho_Chi_Minh`.

Không assume chính xác cron expression nếu current code/config đã có lựa chọn khác; inspect implementation trước.

Scheduler phải chống overlap/duplicate execution khi app restart.

## Quota

Ranking live sync phải đi qua TennisApiClient/quota accounting.

Không gọi ranking API trong task chỉ cần implement/mock nếu user nói chưa live.

## Validation cases

Tối thiểu test:

1. same Top 100 -> STAYED;
2. one player enters, one leaves;
3. entrant đã có minimal Player -> reuse;
4. leaver giữ historical data;
5. duplicate ranking run không tạo duplicate snapshot bất hợp lý theo current uniqueness design;
6. rank selection không hardcode name/id.

## Output

Report:

- ranking date;
- Top 100 count;
- ENTERED/STAYED/LEFT counts;
- queued enrichment/catch-up;
- provider requests/quota;
- files changed;
- test/build status.

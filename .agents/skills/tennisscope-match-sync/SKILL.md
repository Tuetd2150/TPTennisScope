---
name: tennisscope-match-sync
description: Triển khai, kiểm tra hoặc vận hành incremental match sync của TennisScope cho mọi singles match có ít nhất một Current Top 100 player, gồm Results filtering, minimal opponents, Tournament/Match/MatchPlayerStat upsert, idempotency, quota guard và scheduler mỗi 6 giờ.
---

# TennisScope Match Sync

## Mục tiêu

Production system tự cập nhật mọi completed singles match có ít nhất một Current Top 100 player.

Đọc khi cần:

- `../../resources/provider-contract.md`;
- `../../resources/lessons-learned.md`.

## Rule bắt buộc

```ts
const shouldTrackMatch =
  currentTop100ExternalIds.has(player1ExternalId) ||
  currentTop100ExternalIds.has(player2ExternalId);
```

Không dùng AND.

## Production strategy

Ongoing sync ưu tiên incremental Results theo time/day window.

Không chạy `past-matches` cho toàn bộ Top 100 mỗi 6 giờ.

`past-matches` dùng cho:

- initial backfill;
- entrant onboarding;
- re-entry catch-up;
- recovery.

## Luồng chuẩn

```text
scheduler trigger
-> quota/lock guard
-> determine Results window
-> provider Results + pagination nếu cần
-> normalize singles matches
-> load Current Top 100 external IDs
-> filter p1 OR p2 tracked
-> upsert/reuse Players
-> upsert Tournament
-> upsert Match
-> persist MatchPlayerStat nếu payload có
-> finish SyncJob/report usage
```

## Results window

Không hardcode một ngày lịch sử.

Thiết kế window phải chịu được:

- scheduler chạy trễ;
- app restart;
- match provider cập nhật muộn;
- rerun cùng window.

Ưu tiên idempotent overlap nhỏ hơn bỏ sót match.

Không mở rộng window vô hạn gây pagination/quota bùng nổ.

## Current Top 100 lookup

Lấy từ latest authoritative ranking state trong DB.

Không dùng list tên player.

## Opponent ngoài Top 100

Nếu một participant tracked và một participant untracked:

- match vẫn import;
- create/reuse minimal Player cho untracked opponent;
- giữ country/name/avatar metadata nếu payload có;
- giữ stats nếu payload có;
- không full-enrich opponent.

Minimal profile hiện tại là behavior hợp lệ.

## Idempotency

Cùng match có thể đi vào từ Results scheduler hoặc player backfill.

Phải converge về một Match record.

Không duplicate Match/Player/MatchPlayerStat.

## Stats

Nếu Results payload đã có stats phù hợp, persist chúng.

Nếu incremental Results không có đủ stats, không tự gọi per-match H2H hàng loạt nếu chưa có quota-aware design được duyệt.

Không fabricate missing stats.

## Scheduler

Mục tiêu production: mỗi 6 giờ.

Timezone theo config `Asia/Ho_Chi_Minh`.

Phải chống:

- overlapping runs;
- duplicate cron registration;
- uncontrolled retry;
- quota exhaustion;
- process restart duplicate effects.

## Quota-aware execution

Trước live request:

- audit API_USAGE;
- estimate base request count + possible pagination;
- apply hard cap;
- stop gracefully khi chạm guard.

Mọi HTTP attempt kể cả retry phải được accounted.

## Mock-first validation

Trước live test, có fixture/mock cho các case:

1. Top100 vs Top100 -> import;
2. Top100 vs outside -> import + minimal opponent;
3. outside vs outside -> ignore;
4. same match rerun -> no duplicate;
5. pagination;
6. provider error/retry;
7. quota exhausted;
8. no matches;
9. app rerun same time window.

## Live smoke test

Chỉ chạy khi user cho phép/live quota đủ.

Trước test khai báo:

```text
Expected requests: X
Hard cap: Y
```

Sau test verify end-to-end:

```text
provider
-> DB
-> backend read API
-> frontend DB-backed result
```

## Output

Report:

- Results window;
- Current Top 100 source;
- provider attempts;
- matches scanned/tracked/ignored;
- minimal opponents created/reused;
- duplicates prevented;
- quota before/after;
- test/build result.

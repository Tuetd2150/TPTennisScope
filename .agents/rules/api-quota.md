---
trigger: model_decision
description: "Áp dụng khi task có thể gọi Tennis provider/RapidAPI, chạy sync live, backfill, scheduler live, retry, pagination hoặc cần lập kế hoạch quota."
---

# TennisScope — Quy tắc API quota

## Trước mọi live provider activity

Luôn audit:

- persistent `API_USAGE`;
- configured budget/limit;
- requests đã dùng;
- requests còn lại;
- minimum requests cần cho task;
- hard cap của task.

Không bắt đầu live request nếu chưa biết request budget.

## Không bypass quota accounting

Mọi request tới provider phải đi qua client/quota reservation hiện có.

Không dùng raw:

- `fetch`;
- `axios`;
- `curl`;
- `Invoke-WebRequest`;
- Postman;
- browser request;
- custom HTTP client;

để né persistent quota.

Retry cũng là một HTTP attempt và phải được tính.

## Audit DB trước network

Trước khi gọi provider, kiểm tra database và SyncJob.

Nếu dữ liệu đã complete/fresh đủ cho task, tái sử dụng.

Không gọi lại chỉ để “xem thử”.

## Debug không được đốt quota vô ích

Ưu tiên theo thứ tự:

1. source code;
2. PostgreSQL;
3. SyncJob/API_USAGE;
4. saved responses;
5. fixtures;
6. mocks/unit tests;
7. live provider request cuối cùng khi thực sự cần.

## Chọn endpoint tiết kiệm

Ưu tiên một request trả được cả dataset hơn N request nhỏ.

Ví dụ player season backfill:

- ưu tiên `past-matches` + `include=round,tournament,tournament.court,stat`;
- không gọi H2H match-stat cho từng trận nếu embedded stats đã tồn tại.

## Hard cap

Nếu task khai báo `MAX_REQUESTS = N`, tuyệt đối không vượt N.

Nếu hoàn thành task cần request N+1:

- dừng network activity;
- giữ trạng thái nhất quán;
- báo blocker;
- không brute-force.

## Mock/implementation không tốn provider quota

Các thao tác sau không được làm tăng API_USAGE:

- đọc/sửa code;
- DB audit;
- mock/fixture test;
- typecheck;
- lint;
- unit/integration test không network;
- build.

## Live integration test

Trước khi chạy phải báo/ghi nhận:

```text
Expected requests: X
Hard cap: Y
```

Sau khi chạy phải report:

- API_USAGE before;
- API_USAGE after;
- exact HTTP attempts;
- exact endpoint paths;
- retries/pagination;
- remaining budget.

## Scheduler safety

Scheduler phải chống:

- cron overlap;
- duplicate run khi app restart;
- retry loop không giới hạn;
- pagination không kiểm soát;
- tiếp tục gọi khi quota đã chạm guard.

Không giả định provider reset window giống local calendar day nếu chưa xác nhận. Persistent local budget vẫn phải bảo vệ app độc lập với provider reset.

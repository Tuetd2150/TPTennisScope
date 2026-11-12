---
trigger: always_on
description: "Bảo vệ repo TennisScope khỏi thay đổi ngoài phạm vi, migration/reset ngoài ý muốn, hardcode player, mất dữ liệu hoặc regression sau khi sửa code."
---

# TennisScope — Quy tắc an toàn thay đổi

## Trước khi sửa

Luôn:

1. kiểm tra `git status`;
2. inspect file/flow liên quan;
3. nhận diện thay đổi chưa commit của user;
4. xác định phạm vi nhỏ nhất cần sửa.

Không ghi đè user changes.

## Generic fix

Nếu một player làm lộ bug, sửa generic implementation một lần.

Không dùng production conditional theo:

- player name;
- provider ID;
- rank cụ thể;

để vá một case riêng.

Rank/name cụ thể chỉ được dùng trong temporary verification/audit nếu task yêu cầu.

## Không broad refactor

Không refactor phần đang hoạt động chỉ vì có cách viết khác.

Không đổi naming, folder structure hoặc architecture ngoài phạm vi task.

## Database safety

Không tự ý:

- migrate;
- db push;
- reset/drop database;
- bulk delete;
- cleanup historical rows;
- upgrade Prisma major.

Nếu schema change thực sự cần thiết mà user chưa cho phép, dừng và báo lý do.

## Temporary code

Temporary scripts được phép cho audit/debug/rollout nhưng phải:

- terminate sạch;
- disconnect Prisma/DB;
- không để process nền;
- được xóa sau task nếu không trở thành reusable tool.

## Regression validation

Sau production change, chạy project scripts hiện có tương ứng với:

- typecheck;
- lint;
- test;
- build.

Nếu command fail, phân biệt lỗi do thay đổi mới với lỗi tồn tại trước.

Không sửa lan sang module khác chỉ để làm output “xanh”.

## Báo cáo cuối task

Tối thiểu report:

- mục tiêu;
- kết quả;
- files modified;
- DB/schema/migration changes;
- provider requests/quota nếu có;
- test/build status;
- blocker/risk còn lại.

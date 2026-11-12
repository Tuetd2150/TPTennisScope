---
name: tennisscope-verify
description: Chạy quality gate và regression verification cho TennisScope sau khi sửa code, gồm git diff/status, typecheck, lint, tests, build, schema/migration safety, API_USAGE safety và temporary-process/file checks. Dùng sau implementation, bug fix, refactor nhỏ hoặc trước khi kết luận task hoàn thành.
---

# TennisScope Verify

## Mục tiêu

Không kết luận task production-code hoàn thành trước khi kiểm tra regression cơ bản.

## Tool đi kèm

Script:

```text
scripts/verify-project.mjs
```

Trước tiên:

```powershell
node .agents/skills/tennisscope-verify/scripts/verify-project.mjs --help
```

Dry run:

```powershell
node .agents/skills/tennisscope-verify/scripts/verify-project.mjs --dry-run
```

Full verify:

```powershell
node .agents/skills/tennisscope-verify/scripts/verify-project.mjs
```

Script dùng các root npm scripts hiện có. Nếu project scripts thay đổi, cập nhật tool thay vì tạo nhiều command rời lặp lại.

## Manual checks bổ sung

Ngoài automated commands, inspect:

- `git status`;
- `git diff`;
- `backend/prisma/schema.prisma` có thay đổi không;
- migration folder có file mới không;
- API_USAGE có tăng ngoài ý muốn không;
- temporary debug/audit script có còn không;
- Node/tsx background task có bị treo không.

## Expected quality gate

Sau production change:

- typecheck PASS;
- lint PASS;
- tests PASS;
- build PASS.

Nếu một command không tồn tại, report rõ thay vì giả vờ PASS.

Nếu fail do issue pre-existing, đưa evidence và không tự sửa module ngoài scope.

## Report format

```text
Git status: ...
Typecheck: PASS/FAIL
Lint: PASS/FAIL
Tests: PASS/FAIL
Build: PASS/FAIL
Schema changed: YES/NO
Migration added: YES/NO
Provider requests used: N/unknown
Unexpected temporary files/processes: ...
Remaining risks: ...
```

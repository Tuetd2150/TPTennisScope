---
name: tennisscope-git-finish
description: Kết thúc một task TennisScope bằng quy trình Git an toàn gồm kiểm tra status/diff/branch/remote, chạy verification, stage đúng file, quét secret và file ngoài scope, tạo commit message phù hợp, commit và push khi user yêu cầu. Dùng khi user nói commit, push, đưa code lên Git/GitHub, hoàn tất task lên repo hoặc yêu cầu kiểm tra an toàn trước khi đẩy code.
---

# TennisScope Git Finish

## Mục tiêu

Kết thúc task bằng một commit sạch, có thể truy vết và chỉ push đúng thay đổi đã được kiểm tra.

Skill này chuẩn hóa cách dùng Git; không thay thế khả năng Git có sẵn của Antigravity.

Tuân thủ thêm `.agents/rules/git-safety.md`.

## Điều kiện kích hoạt hành động ghi Git

Đọc yêu cầu user thật kỹ.

- Nếu user chỉ yêu cầu **kiểm tra**: chỉ audit, không commit/push.
- Nếu user yêu cầu **commit**: được commit sau khi pass gate, không push nếu user chưa yêu cầu push.
- Nếu user yêu cầu **commit và push**: thực hiện đủ quy trình bên dưới.

Không suy diễn rằng "hoàn thành task" đồng nghĩa với phải push.

## Bước 1 — Audit repo

Chạy:

```powershell
git status --short
git status -sb
git branch --show-current
git remote -v
git diff --stat
```

Nếu cần, đọc `git diff` để phân loại file.

Xác định:

- branch hiện tại;
- remote hiện tại;
- user changes có sẵn trước task;
- file thuộc task;
- file không thuộc task;
- file nhạy cảm/tạm/generated.

Nếu không ở Git worktree, dừng và báo user.

Nếu detached HEAD, không push.

## Bước 2 — Verification

Với production-code change, sử dụng skill `tennisscope-verify` hoặc chạy quality gate tương đương.

Gate kỳ vọng:

```text
Typecheck PASS
Lint PASS
Tests PASS
Build PASS
```

Nếu fail do thay đổi mới: không commit/push.

Nếu fail pre-existing: thu thập evidence, báo user; không tự lờ lỗi.

Nếu task chỉ thay đổi documentation/rule/skill và không ảnh hưởng production code, có thể dùng verification phù hợp phạm vi nhưng vẫn phải validate customization nếu có thay đổi `.agents`:

```powershell
node .agents\tools\validate-customizations.mjs
```

## Bước 3 — Inspect diff trước stage

Đọc diff và xác nhận:

- không có secret;
- không có `.env` thật;
- không có generated artifact ngoài ý muốn;
- không có migration/schema change ngoài scope;
- không có debug code/temp script còn sót;
- không có player-specific hack trái rules;
- thay đổi đúng mục tiêu user.

Không stage file ngoài scope chỉ để working tree sạch.

## Bước 4 — Stage có chọn lọc

Stage chính xác các file thuộc task:

```powershell
git add -- <file1> <file2> ...
```

Tránh `git add .` và `git add -A` theo mặc định.

Sau đó chạy:

```powershell
git diff --cached --stat
git diff --cached
```

## Bước 5 — Pre-push safety check

Chạy tool:

```powershell
node .agents\skills\tennisscope-git-finish\scripts\pre-push-check.mjs
```

Tool này chỉ audit staged state; không commit và không push.

Nếu tool trả FAIL: dừng và xử lý nguyên nhân trước.

Nếu tool trả WARN: đọc warning và xác nhận có an toàn trước khi tiếp tục.

## Bước 6 — Commit

Chọn message dựa trên staged diff thực tế.

Ví dụ:

```text
feat: add dynamic top 100 tracking
fix: make match sync idempotent
chore: add Git safety automation
```

Commit:

```powershell
git commit -m "<message>"
```

Không amend commit cũ nếu user không yêu cầu.

Sau commit kiểm tra:

```powershell
git show --stat --oneline --decorate -1
git status -sb
```

## Bước 7 — Push khi được yêu cầu

Xác nhận `origin` đúng repository.

Nếu upstream đã tồn tại:

```powershell
git push
```

Nếu chưa có upstream nhưng `origin` đã được xác nhận:

```powershell
git push -u origin <current-branch>
```

Không force push.

Nếu authentication/permission fail: báo lỗi thật, không retry vô hạn và không đổi credential cấu hình ngoài scope.

## Bước 8 — Verify sau push

Chạy:

```powershell
git status -sb
git log -1 --oneline
```

Nếu cần kiểm tra upstream:

```powershell
git branch -vv
```

## Báo cáo cuối

Báo ngắn gọn:

```text
Branch: ...
Remote: ...
Verification: PASS/FAIL
Staged files: ...
Commit: <short-hash> <message>
Push: PASS/FAIL/NOT REQUESTED
Remaining working-tree changes: ...
Warnings: ...
```

Không nói `Push: PASS` nếu Git command không thành công.

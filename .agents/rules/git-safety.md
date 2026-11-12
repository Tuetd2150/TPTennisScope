---
trigger: always_on
description: "Bảo vệ thao tác Git của TennisScope: chỉ commit/push khi user yêu cầu, kiểm tra diff/test/secret trước commit, stage có chọn lọc, không force-push/reset-hard/clean nguy hiểm và xác nhận branch/remote trước khi đẩy lên remote."
---

# TennisScope — Quy tắc an toàn Git

## Nguyên tắc chung

Git là thao tác có thể làm thay đổi lịch sử hoặc đẩy dữ liệu ra remote. Luôn ưu tiên an toàn và khả năng truy vết.

Không tự động `commit` hoặc `push` chỉ vì task code đã hoàn thành.

Chỉ commit/push khi:

- user yêu cầu rõ ràng trong task hiện tại; hoặc
- user yêu cầu workflow kết thúc bằng commit/push.

Nếu user chỉ yêu cầu sửa code, dừng sau verification và báo các file đã thay đổi.

## Trước khi stage/commit

Luôn kiểm tra:

```text
git status --short
git branch --show-current
git remote -v
git diff --stat
git diff
```

Nhận diện:

- thay đổi do task hiện tại;
- thay đổi có sẵn từ trước của user;
- file generated/tạm;
- file secret hoặc credential;
- schema/migration ngoài phạm vi.

Không ghi đè hoặc đưa thay đổi riêng của user vào commit chỉ vì chúng đang nằm trong working tree.

## Verification bắt buộc

Trước commit production code, sử dụng `tennisscope-verify` hoặc quality gate tương đương.

Không commit/push nếu thay đổi mới làm fail:

- typecheck;
- lint;
- tests;
- build;

Nếu failure là pre-existing, phải có evidence rõ ràng và báo user trước khi push. Không tự coi là PASS.

## Stage có chọn lọc

Ưu tiên stage đúng file thuộc task:

```text
git add -- <file1> <file2> ...
```

Không mặc định dùng:

```text
git add .
git add -A
git commit -am
```

vì chúng có thể kéo theo file ngoài scope hoặc file chưa được kiểm tra.

Sau stage luôn kiểm tra:

```text
git diff --cached --stat
git diff --cached
```

Commit chỉ được chứa thay đổi đúng scope.

## Secret và file cấm commit

Không commit các file/giá trị nhạy cảm như:

- `.env`, `.env.local`, `.env.*` chứa secret thật;
- RapidAPI key;
- database password/credential;
- private key (`*.pem`, `*.key`, `id_rsa`, `id_ed25519`);
- token/access key;
- credential dump;
- database dump chứa dữ liệu nhạy cảm.

`.env.example` chỉ được commit nếu chỉ chứa placeholder an toàn.

Nếu phát hiện secret đã staged:

1. dừng commit;
2. unstage file bằng thao tác không phá dữ liệu;
3. báo user;
4. nếu secret đã từng được commit/push, không tự rewrite history — báo user để xử lý riêng.

## File generated/tạm

Không commit ngoài ý muốn:

- `node_modules/`;
- `dist/`, `build/`, `coverage/` nếu project không theo dõi chúng;
- log;
- scratch JSON;
- temporary audit/debug scripts;
- database local files;
- editor/cache artifacts.

Tôn trọng `.gitignore` hiện tại.

## Commit message

Commit message phải mô tả đúng thay đổi thực tế, ngắn gọn và không phóng đại.

Ưu tiên dạng:

```text
feat: add dynamic top 100 tracking
fix: preserve ranking history during sync
chore: add Antigravity Git safety rules
```

Không ghi "complete", "final" hoặc nội dung chưa được verification chứng minh.

## Trước khi push

Xác nhận:

- current branch;
- remote `origin`;
- upstream hiện tại nếu có;
- commit vừa tạo;
- không có secret trong commit;
- commit không chứa file ngoài scope.

Nếu `origin` chưa tồn tại hoặc trỏ sai repository: dừng và báo user.

Nếu đang ở detached HEAD: không push; dừng và báo user.

Nếu branch là `main` hoặc `master`: không tự coi đó là lỗi, nhưng phải chắc rằng user thực sự yêu cầu push branch hiện tại.

## Push

Ưu tiên push bình thường:

```text
git push
```

Nếu branch chưa có upstream và remote `origin` đã được user xác nhận:

```text
git push -u origin <current-branch>
```

Không tự dùng:

```text
git push --force
git push -f
git push --force-with-lease
```

trừ khi user yêu cầu rõ ràng sau khi được giải thích rủi ro.

## Các lệnh Git nguy hiểm

Không tự chạy nếu chưa có yêu cầu rõ ràng:

```text
git reset --hard
git clean -fd
git checkout -- <file>
git restore <file>       # nếu sẽ làm mất user changes
git rebase
git commit --amend
git push --force*
```

Không rewrite history chỉ để làm lịch sử "đẹp hơn".

## Sau push

Kiểm tra:

```text
git status -sb
git log -1 --oneline
```

Báo cáo:

- branch;
- remote;
- commit hash ngắn;
- commit message;
- push result;
- working tree còn thay đổi nào chưa commit hay không.

Không khẳng định push thành công nếu command chưa thực sự thành công.

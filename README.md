# TennisScope Antigravity Customization Pack v1

Bộ cấu hình project-local dành riêng cho `D:\TPTennisScope`.

Mục tiêu của bộ này là chuyển những quy tắc, kinh nghiệm và quy trình đã được kiểm chứng trong quá trình xây TennisScope ra khỏi prompt dài, để Antigravity có thể tự nạp đúng ngữ cảnh theo task.

## Cài đặt

1. Giải nén gói này.
2. Copy **hai mục** sau vào root của project TennisScope:
   - `AGENTS.md`
   - `.agents/`
3. Cấu trúc sau khi copy nên là:

```text
D:\TPTennisScope
├── AGENTS.md
├── .agents\
├── backend\
├── frontend\
├── package.json
└── ...
```

4. Mở Antigravity bằng workspace `D:\TPTennisScope`.
5. Mở một conversation mới nếu cần để Antigravity discovery lại customization.
6. Trong Antigravity IDE/App, có thể kiểm tra các skill/rule trong phần Customizations.

## Thành phần

### Rule luôn hoạt động

- `AGENTS.md`: kiến trúc, invariant và mục tiêu dài hạn của TennisScope.
- `.agents/rules/change-safety.md`: bảo vệ phạm vi sửa code, database và regression.

### Rule kích hoạt theo ngữ cảnh

- `.agents/rules/api-quota.md`: dùng khi task có thể đụng RapidAPI/provider/scheduler live.
- `.agents/rules/data-integrity.md`: dùng khi task đọc/ghi ranking, player, match, stats, title hoặc career.

### Skill

- `/tennisscope-player-sync`: onboard/enrich/backfill một player theo pipeline generic.
- `/tennisscope-ranking-sync`: dynamic Top 100, RankingSnapshot, ENTER/STAY/LEAVE.
- `/tennisscope-match-sync`: incremental match sync, rule OR, scheduler 6 giờ.
- `/tennisscope-db-audit`: audit database và ước lượng request trước khi gọi provider.
- `/tennisscope-verify`: typecheck, lint, test, build, diff, schema/API safety.

### Tài liệu dùng chung

- `.agents/resources/provider-contract.md`: endpoint, mapping và semantic provider đã xác nhận.
- `.agents/resources/lessons-learned.md`: các bài học thực tế rút ra từ Sinner, ATP #3 và quá trình debug.

### Tool/script

- `.agents/skills/tennisscope-db-audit/scripts/audit-player.mjs`
- `.agents/skills/tennisscope-verify/scripts/verify-project.mjs`
- `.agents/tools/validate-customizations.mjs`

## Kiểm tra bộ customization

Từ root project:

```powershell
node .agents/tools/validate-customizations.mjs
```

Kết quả mong đợi:

```text
PASS: AGENTS.md
PASS: rules
PASS: skills
PASS: resources
Customization pack hợp lệ.
```

## Cách prompt sau khi cài

Không cần lặp lại toàn bộ constraint của project.

Ví dụ:

```text
Triển khai dynamic Top 100 và ranking scheduler. Chưa gọi API thật.
```

Hoặc:

```text
Dùng /tennisscope-match-sync để triển khai match sync mỗi 6 giờ. Mock test trước, chưa chạy live.
```

Hoặc:

```text
Dùng /tennisscope-db-audit kiểm tra tay vợt rank #3 mùa 2026 và cho biết cần bao nhiêu request để hoàn thiện.
```

Hoặc:

```text
Chạy /tennisscope-verify cho thay đổi vừa làm.
```

## Nguyên tắc bảo trì

- Khi phát hiện một **quy tắc bền vững mới**, cập nhật Rule hoặc `AGENTS.md`.
- Khi phát hiện một **quy trình nhiều bước lặp lại**, cập nhật/tạo Skill.
- Khi phát hiện một **bài học provider/bug đặc thù**, cập nhật `resources/lessons-learned.md`.
- Không đưa số liệu động như current ranking hoặc current season totals vào production rule.
- Dùng `/learn` của Antigravity sau những lần phải sửa Anti để đề xuất lưu bài học mới vào workspace customization.

## Lưu ý về quota

Không hardcode giả định rằng provider luôn có cùng daily quota/reset window. Giá trị cấu hình trong project và persistent `API_USAGE` là nguồn kiểm soát local. Mọi live test phải khai báo request budget trước khi chạy.

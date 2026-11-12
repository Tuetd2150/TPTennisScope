# TennisScope Antigravity Customization Pack v1

## Cài đặt

3. Cấu trúc:

```text
D:\TPTennisScope
├── AGENTS.md
├── .agents\
├── backend\
├── frontend\
├── package.json
└── ...
```

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

## Nguyên tắc bảo trì

- Khi phát hiện một **quy tắc bền vững mới**, cập nhật Rule hoặc `AGENTS.md`.
- Khi phát hiện một **quy trình nhiều bước lặp lại**, cập nhật/tạo Skill.
- Khi phát hiện một **bài học provider/bug đặc thù**, cập nhật `resources/lessons-learned.md`.
- Không đưa số liệu động như current ranking hoặc current season totals vào production rule.
- Dùng `/learn` của Antigravity sau những lần phải sửa Anti để đề xuất lưu bài học mới vào workspace customization.

## Lưu ý về quota

Không hardcode giả định rằng provider luôn có cùng daily quota/reset window. Giá trị cấu hình trong project và persistent `API_USAGE` là nguồn kiểm soát local. Mọi live test phải khai báo request budget trước khi chạy.

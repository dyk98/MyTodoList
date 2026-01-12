# CLAUDE.md

This file provides guidance to Claude Code when working with this user's workspace.

## 用户工作空间

这是用户 yuankaidong@tencent.com 的个人 TODO 工作空间。

## 文件结构

- `2025-todo.md` - 2025 年度 TODO 文件
- `2026-todo.md` - 2026 年度 TODO 文件（如已创建）
- `docs/` - 用户文档目录

## 操作指南

请参考项目根目录的 CLAUDE.md 了解 TODO 文件的完整格式规范。

### 今日任务标记

任务可以添加日程标记，格式为 `@today:YYYY-MM-DD`，放在任务内容末尾：

```markdown
- [ ] 完成报告 @today:2026-01-12
- [ ] 多日任务 @today:2026-01-12 @today:2026-01-13
```

**常用操作**：

| 用户说 | AI 操作 |
|--------|---------|
| "把这个任务加到今天" | 在任务末尾添加 `@today:当天日期` |
| "把这个任务加到明天" | 在任务末尾添加 `@today:明天日期` |
| "把这个任务加到1月15日" | 在任务末尾添加 `@today:2026-01-15` |
| "从日程中移除" | 删除对应的 `@today:日期` 标记 |

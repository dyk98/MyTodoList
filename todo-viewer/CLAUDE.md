# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是 MyTodoList 项目的可视化前端，用于展示和操作父目录中的 `2025-todo.md` 文件。提供 Web 界面来查看待办池、切换任务状态、新增任务。

## 常用命令

```bash
# 开发（同时启动前端和后端）
npm run dev

# 单独启动
npm run dev:client    # Vite 前端 (port 3000)
npm run dev:server    # Express 后端 (port 3001)

# 构建
npm run build
```

## 架构

### 前后端分离

- **前端**: React + Vite + Ant Design，运行在 3000 端口
- **后端**: Express 服务，运行在 3001 端口，负责读写 `../2025-todo.md`
- Vite 配置了 `/api` 代理到后端

### 核心数据流

1. `server/index.ts` 读取父目录的 `2025-todo.md` 文件
2. `src/utils/parser.ts` 将 Markdown 解析为结构化数据（`ParsedTodo`）
3. 前端组件渲染待办池（`TodoPool`）和周区块（`WeekBlock`）
4. 状态变更通过 API 直接修改源文件

### 关键文件

| 文件 | 职责 |
|------|------|
| `server/index.ts` | Express API 服务，处理文件读写 |
| `src/utils/parser.ts` | Markdown 解析器，支持嵌套任务树 |
| `src/types/index.ts` | TypeScript 类型定义 |
| `src/utils/api.ts` | 前端 API 封装 |

### 数据结构

- `TodoItem`: 单个任务，支持嵌套子任务（通过 `children` 数组）
- `ProjectGroup`: 待办池中的项目分组
- `WeekBlock`: 周归档区块
- `ParsedTodo`: 完整解析结果，包含 `pool`、`weeks`、`raw`

## 路径别名

使用 `@/` 指向 `src/` 目录（在 vite.config.ts 和 tsconfig.json 中配置）。

## 注意事项

- 后端直接操作文件系统，修改会立即写入 `2025-todo.md`
- 任务状态切换基于行号（`lineIndex`），解析器需要准确追踪行号
- 项目列表硬编码在 `parser.ts` 的 `PROJECTS` 常量中
- 使用中文回答用户
- 当发现 CLAUDE.md 中有内容过期或不准确时，主动修改

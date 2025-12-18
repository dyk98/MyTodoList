# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这是什么

这是一个个人工作 TODO 管理仓库，用于记录和追踪日常工作任务。AI 的职责是协助维护 TODO 列表的结构、帮助拆解任务、以及将新任务归类到正确位置。

## 文件结构

- `data/` - TODO 数据文件目录
  - `2025-todo.md` - 2025 年度 TODO 文件
  - 未来年份创建新文件如 `2026-todo.md`
- `src/` - 前端 React 代码
- `server/` - Express 后端服务
- `otherDocs/` - 其他文档

## 常用命令

```bash
# 开发（同时启动前端和后端）
npm run dev

# 单独启动
npm run dev:client    # Vite 前端 (port 3333)
npm run dev:server    # Express 后端 (port 3334)

# 构建
npm run build
```

## 前端架构

### 前后端分离

- **前端**: React + Vite + Ant Design，运行在 3333 端口
- **后端**: Express 服务，运行在 3334 端口，负责读写 `data/` 目录下的 TODO 文件
- Vite 配置了 `/api` 代理到后端

### 核心数据流

1. `server/index.ts` 读取 `data/` 目录下对应年份的 TODO 文件
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

### 路径别名

使用 `@/` 指向 `src/` 目录（在 vite.config.ts 和 tsconfig.json 中配置）。

### 响应式设计

支持手机和电脑两种设备，断点为 **768px**：

| 设备 | 宽度 | 特点 |
|------|------|------|
| 手机 | ≤768px | Header 按钮收纳为菜单、AI Drawer 全屏、操作按钮始终显示 |
| 电脑 | >768px | 完整布局 |

**相关文件**：
- `src/hooks/useMediaQuery.ts` - 响应式 hook（`useIsMobile()`）
- `src/styles/responsive.css` - 全局媒体查询和 CSS 变量

**CSS 变量**（在 responsive.css 中定义）：
```css
--header-padding    /* 手机: 0 12px, 电脑: 0 24px */
--content-padding   /* 手机: 12px, 电脑: 24px */
--content-max-width /* 手机: 100%, 电脑: 900px */
```

**使用方式**：
```tsx
import { useIsMobile } from '@/hooks/useMediaQuery'

function MyComponent() {
  const isMobile = useIsMobile()
  return <div style={{ width: isMobile ? '100%' : 400 }}>...</div>
}
```

### 前端注意事项

- 后端直接操作文件系统，修改会立即写入对应年份的 TODO 文件
- 任务状态切换基于行号（`lineIndex`），解析器需要准确追踪行号
- 项目分类从文件中动态解析，支持通过界面新增分类
- 前端支持年份切换，通过 Header 右侧的下拉框选择不同年份
- 新增任务时可选择时间段（待办池或指定周）

## TODO 文件内部结构

文件采用**倒序结构**（最新内容在最上方）：

```markdown
# 2025 TODO

## 待办池

按项目分类存放所有未完成的任务。

### AgentDriver
- [ ] 任务1
- [ ] 任务2

### AgentRL
- [ ] 任务...

### build-server
### 多端
### 工具
### zhiwei
### 教育场景
### 其他

---

## 12月9日 - 12月15日

当前周的工作记录...

---

## 12月2日 - 12月8日

上周已完成的任务归档...

---

## （更早的周继续往下...）
```

## 项目分类

识别以下关键词自动归类：

| 分类 | 关键词 |
|------|--------|
| AgentDriver | AgentDriver、Driver、场景、场景集、Handlebars、qwen-code、七彩石 |
| AgentRL | AgentRL、RL、强化学习 |
| build-server | build-server、编译、wcc、wcsc、pageframe |
| 多端 | 多端、iOS、Android、chooseMedia、蓝牙、日历 |
| 工具 | 工具、devtools、skyline、调试器 |
| zhiwei | zhiwei、智勇、镜像、容器 |
| 教育场景 | 教育、教学、讲解、自由创作 |
| 其他 | 无法匹配以上分类的任务 |

## AI 操作指南

### 新增 TODO

当用户说要记录一个 TODO 时：
1. 识别任务属于哪个项目分类
2. 将任务添加到「待办池」对应分类下
3. 如果是大任务，主动询问是否需要拆解为子任务

### 周结算（用户主动触发）

当用户说「本周结束」或「周结算」时，执行智能归档流程。

#### 核心归档规则

**归档触发条件**：
- 任何任务只要有已完成的子任务（或自己已完成），就会参与归档

**归档策略**（适用于任意层级嵌套）：
1. **归档内容**：父任务链 + 所有已完成的子任务
   - 在周区块中，父任务显示为 `[x]`（已完成状态）

2. **待办池保留规则**：
   - **有未完成子任务**：保留父任务（`[ ]`）+ 未完成的子任务
   - **无未完成子任务，但父任务本身未勾选**：只保留父任务（`[ ]`），无子任务
   - **父任务已勾选且所有子任务都完成**：完全删除

3. **操作流程**：
   - 创建新的周区块（格式：`## X月X日 - X月X日`）
   - 新周区块插入在「待办池」分隔线之后、上一周区块之前

#### 归档示例

**示例1：部分子任务完成**
```markdown
归档前（待办池）：
### A分类
- [ ] B任务
    - [x] C子任务 ✓
    - [ ] D子任务

归档后（周区块）：
- [x] A分类
    - [x] B任务
        - [x] C子任务

归档后（待办池）：
### A分类
- [ ] B任务
    - [ ] D子任务
```

**示例2：所有子任务完成，但父任务未勾选**
```markdown
归档前（待办池）：
### A分类
- [ ] B任务 ← 父任务未勾选
    - [x] C子任务 ✓
    - [x] D子任务 ✓

归档后（周区块）：
- [x] A分类
    - [x] B任务
        - [x] C子任务
        - [x] D子任务

归档后（待办池）：
### A分类
- [ ] B任务 ← 只保留父任务
```

**示例3：多层嵌套 - 中间层部分完成**
```markdown
归档前（待办池）：
### A分类
- [ ] B任务
    - [ ] C子任务
        - [x] E子子任务 ✓
        - [ ] F子子任务
    - [ ] D子任务

归档后（周区块）：
- [x] A分类
    - [x] B任务
        - [x] C子任务
            - [x] E子子任务

归档后（待办池）：
### A分类
- [ ] B任务
    - [ ] C子任务
        - [ ] F子子任务
    - [ ] D子任务
```

**关键点**：
- 归档时维护完整的父任务链，确保上下文清晰
- 待办池中未完成的子任务保留原有的嵌套结构
- 递归应用该规则到任意深度的嵌套层级

### 任务状态

- `- [ ]` 未完成
- `- [x]` 已完成
- 支持多级嵌套子任务（缩进 4 空格）

### 任务拆解

当任务较大或复杂时，主动建议拆解：
```markdown
- [ ] 大任务标题
    - [ ] 子任务1
    - [ ] 子任务2
    - [ ] 子任务3
```

### 技术笔记

允许在任务下方添加技术笔记或解决方案，使用无序列表或普通段落：
```markdown
- [x] 修复某个问题
    - [x] 子任务
    问题原因是 xxx，解决方案是 xxx
```

## 常用操作示例

**用户：** "记录一下，AgentDriver 需要支持新的模型配置"
**AI：** 将任务添加到待办池的 AgentDriver 分类下

**用户：** "帮我把这个任务拆一下：支持七彩石可视化配置"
**AI：**
```markdown
- [ ] 支持七彩石可视化配置
    - [ ] 设计配置字段 schema
    - [ ] 实现前端配置界面
    - [ ] 对接七彩石 API
    - [ ] 添加灰度发布支持
```

**用户：** "周结算"
**AI：** 执行周结算流程，整理本周完成的任务

## 注意事项

1. 保持结构一致性，不要改变已有的格式约定
2. 历史记录中的技术笔记保留原样，不要删减
3. 新增任务时如果分类不明确，放入「其他」或询问用户
4. 周日期格式统一使用「X月X日 - X月X日」
5. 使用中文回答用户
6. 当发现 CLAUDE.md、AGENTS.md 中有内容过期或不准确时，主动同步修改这两个文件

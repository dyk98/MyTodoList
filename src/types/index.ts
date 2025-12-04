// 单个任务项
export interface TodoItem {
  lineIndex: number        // 在原文件中的行号
  content: string          // 任务内容（不含 - [ ] 前缀）
  completed: boolean       // 是否完成
  indent: number           // 缩进层级（0 = 顶级，1 = 子任务...）
  children: TodoItem[]     // 子任务
}

// 项目分类（待办池中的项目）
export interface ProjectGroup {
  name: string             // 项目名：AgentDriver, build-server 等
  items: TodoItem[]        // 该项目下的任务
}

// 周区块
export interface WeekBlock {
  title: string            // 如 "11月27日 - 12月3日"
  isCurrent: boolean       // 是否是当前周
  items: TodoItem[]        // 该周的任务
  startLine: number        // 起始行号
}

// 解析后的完整数据结构
export interface ParsedTodo {
  pool: ProjectGroup[]     // 待办池
  weeks: WeekBlock[]       // 周区块列表（倒序，当前周在前）
  raw: string              // 原始内容
}

// API 响应
export interface ApiResponse<T = unknown> {
  success: boolean
  error?: string
  content?: string
  newContent?: string
  data?: T
}

// 便利贴颜色类型
export type NoteColor = 'yellow' | 'pink' | 'green' | 'blue' | 'purple'

// 便利贴
export interface Note {
  id: string
  title: string
  content: string
  color: NoteColor
  createdAt: string
  updatedAt: string
}

import type { TodoItem, ProjectGroup, WeekBlock, ParsedTodo } from '@/types'

// 项目列表（用于识别待办池中的项目）
const PROJECTS = [
  'AgentDriver',
  'AgentRL',
  'build-server',
  '多端',
  '工具',
  'zhiwei',
  '教育场景',
  '其他',
]

// 解析单行任务
function parseTodoLine(line: string, lineIndex: number): TodoItem | null {
  const match = line.match(/^(\s*)- \[([ x])\]\s*(.*)$/)
  if (!match) return null

  const [, indent, status, content] = match
  return {
    lineIndex,
    content: content.trim(),
    completed: status === 'x',
    indent: Math.floor(indent.length / 4),
    children: [],
  }
}

// 将扁平任务列表转换为树形结构
function buildTaskTree(items: TodoItem[]): TodoItem[] {
  const result: TodoItem[] = []
  const stack: TodoItem[] = []

  for (const item of items) {
    // 找到合适的父节点
    while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop()
    }

    if (stack.length === 0) {
      result.push(item)
    } else {
      stack[stack.length - 1].children.push(item)
    }

    stack.push(item)
  }

  return result
}

// 解析 Markdown 内容
export function parseTodoMd(content: string): ParsedTodo {
  const lines = content.split('\n')
  const pool: ProjectGroup[] = []
  const weeks: WeekBlock[] = []

  let currentSection: 'pool' | 'weeks' | null = null
  let currentProject: ProjectGroup | null = null
  let currentWeek: WeekBlock | null = null
  let tempItems: TodoItem[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 检测待办池开始
    if (line.trim() === '## 待办池') {
      currentSection = 'pool'
      continue
    }

    // 检测项目标题（### ProjectName）
    if (currentSection === 'pool' && line.startsWith('### ')) {
      // 保存上一个项目
      if (currentProject && tempItems.length > 0) {
        currentProject.items = buildTaskTree(tempItems)
        pool.push(currentProject)
        tempItems = []
      }

      const projectName = line.slice(4).trim()
      if (PROJECTS.includes(projectName)) {
        currentProject = { name: projectName, items: [] }
      } else {
        currentProject = null
      }
      continue
    }

    // 检测周区块标题（## X月X日 - X月X日）
    if (line.startsWith('## ') && /\d+月\d+日/.test(line)) {
      // 保存上一个项目（如果在 pool 中）
      if (currentSection === 'pool' && currentProject && tempItems.length > 0) {
        currentProject.items = buildTaskTree(tempItems)
        pool.push(currentProject)
        tempItems = []
        currentProject = null
      }

      // 保存上一个周区块
      if (currentWeek && tempItems.length > 0) {
        currentWeek.items = buildTaskTree(tempItems)
        weeks.push(currentWeek)
        tempItems = []
      }

      currentSection = 'weeks'
      const title = line.slice(3).trim()
      currentWeek = {
        title,
        isCurrent: false,
        items: [],
        startLine: i,
      }
      continue
    }

    // 检测分隔线
    if (line.trim() === '---') {
      // 保存当前项目
      if (currentSection === 'pool' && currentProject && tempItems.length > 0) {
        currentProject.items = buildTaskTree(tempItems)
        pool.push(currentProject)
        tempItems = []
        currentProject = null
      }

      // 保存当前周区块
      if (currentWeek && tempItems.length > 0) {
        currentWeek.items = buildTaskTree(tempItems)
        weeks.push(currentWeek)
        tempItems = []
        currentWeek = null
      }
      continue
    }

    // 解析任务行
    const todoItem = parseTodoLine(line, i)
    if (todoItem) {
      tempItems.push(todoItem)
    }
  }

  // 处理最后一个区块
  if (currentProject && tempItems.length > 0) {
    currentProject.items = buildTaskTree(tempItems)
    pool.push(currentProject)
  } else if (currentWeek && tempItems.length > 0) {
    currentWeek.items = buildTaskTree(tempItems)
    weeks.push(currentWeek)
  }

  // 标记当前周（第一个周区块）
  if (weeks.length > 0) {
    weeks[0].isCurrent = true
  }

  return { pool, weeks, raw: content }
}

// 序列化回 Markdown（简单实现，用于新增任务等场景）
export function serializeTodoItem(item: TodoItem, indent = 0): string {
  const prefix = '    '.repeat(indent)
  const status = item.completed ? 'x' : ' '
  let result = `${prefix}- [${status}] ${item.content}\n`

  for (const child of item.children) {
    result += serializeTodoItem(child, indent + 1)
  }

  return result
}

import type { ApiResponse } from '@/types'

const BASE_URL = '/api'

// 获取可用年份列表
export async function fetchYears(): Promise<number[]> {
  const res = await fetch(`${BASE_URL}/years`)
  const data = await res.json() as { success: boolean; years?: number[]; error?: string }
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch years')
  }
  return data.years || []
}

// 获取 TODO 内容
export async function fetchTodo(year?: number): Promise<{ content: string; year: number }> {
  const url = year ? `${BASE_URL}/todo?year=${year}` : `${BASE_URL}/todo`
  const res = await fetch(url)
  const data: ApiResponse & { year?: number } = await res.json()
  if (!data.success || !data.content) {
    throw new Error(data.error || 'Failed to fetch todo')
  }
  return { content: data.content, year: data.year || new Date().getFullYear() }
}

// 更新整个 TODO 文件
export async function updateTodo(content: string, year?: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/todo`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, year }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to update todo')
  }
}

// 切换任务完成状态
export async function toggleTodo(lineIndex: number, year?: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/todo/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineIndex, year }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to toggle todo')
  }
  return data.newContent
}

// 新增任务
export async function addTodo(
  task: string,
  project: string,
  year?: number,
  weekLineIndex?: number
): Promise<string> {
  const res = await fetch(`${BASE_URL}/todo/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, project, year, weekLineIndex }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to add todo')
  }
  return data.newContent
}

// 获取周列表
export async function fetchWeeks(year?: number): Promise<{ title: string; lineIndex: number }[]> {
  const url = year ? `${BASE_URL}/weeks?year=${year}` : `${BASE_URL}/weeks`
  const res = await fetch(url)
  const data = await res.json() as { success: boolean; weeks?: { title: string; lineIndex: number }[]; error?: string }
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch weeks')
  }
  return data.weeks || []
}

// 新增分类
export async function addProject(name: string, year?: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/project/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, year }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to add project')
  }
  return data.newContent
}

// 任务排序
export async function reorderTodo(fromLineIndex: number, toLineIndex: number, year?: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/todo/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromLineIndex, toLineIndex, year }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to reorder todo')
  }
  return data.newContent
}

// 周结算
export async function weekSettle(year?: number): Promise<{ newContent: string; settledCount: number; weekTitle: string }> {
  const res = await fetch(`${BASE_URL}/todo/week-settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year }),
  })
  const data = await res.json() as { success: boolean; newContent?: string; settledCount?: number; weekTitle?: string; error?: string }
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to settle week')
  }
  return { newContent: data.newContent, settledCount: data.settledCount || 0, weekTitle: data.weekTitle || '' }
}

// 获取文档列表
export async function fetchDocs(): Promise<{ name: string; filename: string }[]> {
  const res = await fetch(`${BASE_URL}/docs`)
  const data = await res.json() as { success: boolean; docs?: { name: string; filename: string }[]; error?: string }
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch docs')
  }
  return data.docs || []
}

// 获取文档内容
export async function fetchDocContent(filename: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/docs/${encodeURIComponent(filename)}`)
  const data = await res.json() as { success: boolean; content?: string; error?: string }
  if (!data.success || !data.content) {
    throw new Error(data.error || 'Failed to fetch doc content')
  }
  return data.content
}

// 上传文档
export async function uploadDoc(file: File): Promise<{ name: string; filename: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE_URL}/docs/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json() as { success: boolean; name?: string; filename?: string; error?: string }
  if (!data.success || !data.filename) {
    throw new Error(data.error || 'Failed to upload doc')
  }
  return { name: data.name!, filename: data.filename }
}

// 新增周区块
export async function addWeek(weekTitle: string, year?: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/week/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekTitle, year }),
  })
  const data = await res.json() as { success: boolean; newContent?: string; error?: string }
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to add week')
  }
  return data.newContent
}

// AI 聊天
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function aiChat(message: string, history: ChatMessage[] = [], year?: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, year }),
  })
  const data = await res.json() as { success: boolean; reply?: string; error?: string }
  if (!data.success || !data.reply) {
    throw new Error(data.error || 'Failed to chat with AI')
  }
  return data.reply
}

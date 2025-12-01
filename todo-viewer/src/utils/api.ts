import type { ApiResponse } from '@/types'

const BASE_URL = '/api'

// 获取 TODO 内容
export async function fetchTodo(): Promise<string> {
  const res = await fetch(`${BASE_URL}/todo`)
  const data: ApiResponse = await res.json()
  if (!data.success || !data.content) {
    throw new Error(data.error || 'Failed to fetch todo')
  }
  return data.content
}

// 更新整个 TODO 文件
export async function updateTodo(content: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/todo`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to update todo')
  }
}

// 切换任务完成状态
export async function toggleTodo(lineIndex: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/todo/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineIndex }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to toggle todo')
  }
  return data.newContent
}

// 新增任务
export async function addTodo(task: string, project: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/todo/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, project }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to add todo')
  }
  return data.newContent
}

import type { ApiResponse } from '@/types'

const BASE_URL = '/api'

// Token 存储键名
const TOKEN_KEY = 'auth_token'

// 获取存储的 token
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

// 存储 token
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

// 清除 token
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// 构建带认证的请求头
function getAuthHeaders(): Record<string, string> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

// ========== 认证相关 API ==========

export interface User {
  email: string
  isAdmin: boolean
}

// 注册
export async function register(email: string, password: string, inviteCode: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, inviteCode }),
  })
  const data = await res.json() as { success: boolean; token?: string; error?: string }
  if (!data.success || !data.token) {
    throw new Error(data.error || '注册失败')
  }
  setToken(data.token)
}

// 登录
export async function login(email: string, password: string): Promise<{ isAdmin: boolean }> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json() as { success: boolean; token?: string; isAdmin?: boolean; error?: string }
  if (!data.success || !data.token) {
    throw new Error(data.error || '登录失败')
  }
  setToken(data.token)
  return { isAdmin: data.isAdmin || false }
}

// 登出
export function logout(): void {
  clearToken()
}

// 获取当前用户信息
export async function getCurrentUser(): Promise<User | null> {
  const token = getToken()
  if (!token) return null

  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    })
    const data = await res.json() as { success: boolean; user?: User; error?: string }
    if (!data.success || !data.user) {
      clearToken()
      return null
    }
    return data.user
  } catch {
    clearToken()
    return null
  }
}

// 修改密码
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ oldPassword, newPassword }),
  })
  const data = await res.json() as { success: boolean; error?: string }
  if (!data.success) {
    throw new Error(data.error || '修改密码失败')
  }
}

// 生成邀请码（仅管理员）
export async function generateInvite(targetEmail: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ targetEmail }),
  })
  const data = await res.json() as { success: boolean; code?: string; error?: string }
  if (!data.success || !data.code) {
    throw new Error(data.error || '生成邀请码失败')
  }
  return data.code
}

// ========== TODO 相关 API ==========

// 获取可用年份列表
export async function fetchYears(): Promise<number[]> {
  const res = await fetch(`${BASE_URL}/years`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json() as { success: boolean; years?: number[]; error?: string }
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch years')
  }
  return data.years || []
}

// 获取 TODO 内容
export async function fetchTodo(year?: number): Promise<{ content: string; year: number; isDemo?: boolean }> {
  const url = year ? `${BASE_URL}/todo?year=${year}` : `${BASE_URL}/todo`
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  })
  const data: ApiResponse & { year?: number; isDemo?: boolean } = await res.json()
  if (!data.success || !data.content) {
    throw new Error(data.error || 'Failed to fetch todo')
  }
  return { content: data.content, year: data.year || new Date().getFullYear(), isDemo: data.isDemo }
}

// 更新整个 TODO 文件
export async function updateTodo(content: string, year?: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/todo`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ lineIndex, year }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to toggle todo')
  }
  return data.newContent
}

// 删除任务
export async function deleteTodo(lineIndex: number, year?: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/todo/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ lineIndex, year }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to delete todo')
  }
  return data.newContent
}

// 编辑任务
export async function editTodo(lineIndex: number, newContent: string, year?: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/todo/edit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ lineIndex, newContent, year }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to edit todo')
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
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ task, project, year, weekLineIndex }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to add todo')
  }
  return data.newContent
}

// 新增子任务
export async function addSubtask(
  task: string,
  parentLineIndex: number,
  year?: number
): Promise<string> {
  const res = await fetch(`${BASE_URL}/todo/add-subtask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ task, parentLineIndex, year }),
  })
  const data: ApiResponse = await res.json()
  if (!data.success || !data.newContent) {
    throw new Error(data.error || 'Failed to add subtask')
  }
  return data.newContent
}

// 获取周列表
export async function fetchWeeks(year?: number): Promise<{ title: string; lineIndex: number }[]> {
  const url = year ? `${BASE_URL}/weeks?year=${year}` : `${BASE_URL}/weeks`
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  })
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
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
  const res = await fetch(`${BASE_URL}/docs`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json() as { success: boolean; docs?: { name: string; filename: string }[]; error?: string }
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch docs')
  }
  return data.docs || []
}

// 获取文档内容
export async function fetchDocContent(filename: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/docs/${encodeURIComponent(filename)}`, {
    headers: getAuthHeaders(),
  })
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
    headers: getAuthHeaders(),
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
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
}

export async function aiChat(message: string, history: ChatMessage[] = [], year?: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ message, history, year }),
  })
  const data = await res.json() as { success: boolean; reply?: string; error?: string }
  if (!data.success || !data.reply) {
    throw new Error(data.error || 'Failed to chat with AI')
  }
  return data.reply
}

// 获取对话历史
export async function fetchChatHistory(): Promise<ChatSession[]> {
  const res = await fetch(`${BASE_URL}/chat-history`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json() as { success: boolean; sessions?: ChatSession[]; error?: string }
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch chat history')
  }
  return data.sessions || []
}

// 保存对话会话
export async function saveChatSession(session: ChatSession): Promise<ChatSession> {
  const res = await fetch(`${BASE_URL}/chat-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ session }),
  })
  const data = await res.json() as { success: boolean; session?: ChatSession; error?: string }
  if (!data.success || !data.session) {
    throw new Error(data.error || 'Failed to save chat session')
  }
  return data.session
}

// 删除对话会话
export async function deleteChatSession(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/chat-history/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  })
  const data = await res.json() as { success: boolean; error?: string }
  if (!data.success) {
    throw new Error(data.error || 'Failed to delete chat session')
  }
}

// ========== 便利贴相关 API ==========

export interface Note {
  id: string
  title: string
  content: string
  color: 'yellow' | 'pink' | 'green' | 'blue' | 'purple'
  createdAt: string
  updatedAt: string
}

// 获取所有便利贴
export async function fetchNotes(): Promise<Note[]> {
  const res = await fetch(`${BASE_URL}/notes`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json() as { success: boolean; notes?: Note[]; error?: string }
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch notes')
  }
  return data.notes || []
}

// 创建便利贴
export async function createNote(
  title: string,
  content?: string,
  color?: Note['color']
): Promise<Note> {
  const res = await fetch(`${BASE_URL}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ title, content, color }),
  })
  const data = await res.json() as { success: boolean; note?: Note; error?: string }
  if (!data.success || !data.note) {
    throw new Error(data.error || 'Failed to create note')
  }
  return data.note
}

// 更新便利贴
export async function updateNote(
  id: string,
  updates: { title?: string; content?: string; color?: Note['color'] }
): Promise<Note> {
  const res = await fetch(`${BASE_URL}/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(updates),
  })
  const data = await res.json() as { success: boolean; note?: Note; error?: string }
  if (!data.success || !data.note) {
    throw new Error(data.error || 'Failed to update note')
  }
  return data.note
}

// 删除便利贴
export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/notes/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  })
  const data = await res.json() as { success: boolean; error?: string }
  if (!data.success) {
    throw new Error(data.error || 'Failed to delete note')
  }
}

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'

// JWT 密钥（生产环境应使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'mytodolist-jwt-secret-key-2025'

// 数据目录
const DATA_DIR = path.resolve(import.meta.dirname, '../data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const INVITES_FILE = path.join(DATA_DIR, 'invites.json')

// 管理员邮箱（第一个注册的用户或指定邮箱）
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

// 类型定义
export interface User {
  email: string
  passwordHash: string
  createdAt: string
  isAdmin: boolean
}

interface UsersData {
  users: User[]
}

interface InvitesData {
  [email: string]: string
}

export interface AuthRequest extends Request {
  user?: {
    email: string
    isAdmin: boolean
  }
}

// ========== 数据读写函数 ==========

async function readUsers(): Promise<UsersData> {
  try {
    const content = await fs.readFile(USERS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { users: [] }
  }
}

async function writeUsers(data: UsersData): Promise<void> {
  await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

async function readInvites(): Promise<InvitesData> {
  try {
    const content = await fs.readFile(INVITES_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function writeInvites(data: InvitesData): Promise<void> {
  await fs.writeFile(INVITES_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// ========== 用户目录管理 ==========

export function getUserDataDir(email: string): string {
  // 使用邮箱的 hash 作为目录名，避免特殊字符问题
  const hash = crypto.createHash('md5').update(email).digest('hex').slice(0, 12)
  return path.join(DATA_DIR, hash)
}

export function getUserDocsDir(email: string): string {
  return path.join(getUserDataDir(email), 'docs')
}

async function createUserDirectories(email: string): Promise<void> {
  const userDir = getUserDataDir(email)
  const docsDir = getUserDocsDir(email)

  await fs.mkdir(userDir, { recursive: true })
  await fs.mkdir(docsDir, { recursive: true })

  // 创建初始的 TODO 文件
  const year = new Date().getFullYear()
  const todoFile = path.join(userDir, `${year}-todo.md`)

  const initialContent = `# ${year} TODO

## 待办池

### 工作

（暂无未完成任务）

### 学习

（暂无未完成任务）

### 生活

（暂无未完成任务）

### 其他

（暂无未完成任务）

---
`

  await fs.writeFile(todoFile, initialContent, 'utf-8')

  // 创建用户专属的 CLAUDE.md
  const claudeMdContent = `# CLAUDE.md

This file provides guidance to Claude Code when working with this user's workspace.

## 用户工作空间

这是用户 ${email} 的个人 TODO 工作空间。

## 文件结构

- \`${year}-todo.md\` - ${year} 年度 TODO 文件
- \`docs/\` - 用户文档目录

## 操作指南

请参考项目根目录的 CLAUDE.md 了解 TODO 文件的格式规范。
`

  await fs.writeFile(path.join(userDir, 'CLAUDE.md'), claudeMdContent, 'utf-8')
}

// ========== 认证函数 ==========

export async function register(
  email: string,
  password: string,
  inviteCode: string
): Promise<{ success: boolean; error?: string; token?: string }> {
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { success: false, error: '邮箱格式不正确' }
  }

  // 验证密码长度
  if (password.length < 6) {
    return { success: false, error: '密码长度至少 6 位' }
  }

  // 验证邀请码
  const invites = await readInvites()
  if (invites[email] !== inviteCode) {
    return { success: false, error: '邀请码无效或与邮箱不匹配' }
  }

  // 检查用户是否已存在
  const usersData = await readUsers()
  if (usersData.users.find(u => u.email === email)) {
    return { success: false, error: '该邮箱已注册' }
  }

  // 创建用户
  const passwordHash = await bcrypt.hash(password, 10)
  const isAdmin = usersData.users.length === 0 || email === ADMIN_EMAIL

  const newUser: User = {
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
    isAdmin,
  }

  usersData.users.push(newUser)
  await writeUsers(usersData)

  // 删除已使用的邀请码
  delete invites[email]
  await writeInvites(invites)

  // 创建用户目录
  await createUserDirectories(email)

  // 生成 token
  const token = jwt.sign(
    { email, isAdmin },
    JWT_SECRET
  )

  return { success: true, token }
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; token?: string; isAdmin?: boolean }> {
  const usersData = await readUsers()
  const user = usersData.users.find(u => u.email === email)

  if (!user) {
    return { success: false, error: '邮箱或密码错误' }
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) {
    return { success: false, error: '邮箱或密码错误' }
  }

  const token = jwt.sign(
    { email: user.email, isAdmin: user.isAdmin },
    JWT_SECRET
  )

  return { success: true, token, isAdmin: user.isAdmin }
}

export async function changePassword(
  email: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 6) {
    return { success: false, error: '新密码长度至少 6 位' }
  }

  const usersData = await readUsers()
  const userIndex = usersData.users.findIndex(u => u.email === email)

  if (userIndex === -1) {
    return { success: false, error: '用户不存在' }
  }

  const user = usersData.users[userIndex]
  const passwordMatch = await bcrypt.compare(oldPassword, user.passwordHash)

  if (!passwordMatch) {
    return { success: false, error: '旧密码错误' }
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10)
  await writeUsers(usersData)

  return { success: true }
}

// ========== 邀请码管理 ==========

export async function generateInviteCode(
  adminEmail: string,
  targetEmail: string
): Promise<{ success: boolean; error?: string; code?: string }> {
  // 验证管理员权限
  const usersData = await readUsers()
  const admin = usersData.users.find(u => u.email === adminEmail)

  if (!admin?.isAdmin) {
    return { success: false, error: '无权限操作' }
  }

  // 验证目标邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(targetEmail)) {
    return { success: false, error: '邮箱格式不正确' }
  }

  // 检查是否已注册
  if (usersData.users.find(u => u.email === targetEmail)) {
    return { success: false, error: '该邮箱已注册' }
  }

  // 生成邀请码
  const code = crypto.randomBytes(8).toString('hex')

  const invites = await readInvites()
  invites[targetEmail] = code
  await writeInvites(invites)

  return { success: true, code }
}

// ========== JWT 中间件 ==========

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录' })
  }

  const token = authHeader.slice(7)

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string; isAdmin: boolean }
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Token 无效' })
  }
}

// 可选认证中间件（用于示例模式）
export function optionalAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { email: string; isAdmin: boolean }
      req.user = decoded
    } catch {
      // Token 无效时忽略，当作未登录
    }
  }

  next()
}

// Demo 用户目录
export const DEMO_DATA_DIR = path.join(DATA_DIR, 'demo')
export const DEMO_DOCS_DIR = path.join(DEMO_DATA_DIR, 'docs')

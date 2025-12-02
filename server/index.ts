import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import multer from 'multer'
import {
  register,
  login,
  changePassword,
  generateInviteCode,
  authMiddleware,
  optionalAuthMiddleware,
  getUserDataDir,
  getUserDocsDir,
  DEMO_DATA_DIR,
  DEMO_DOCS_DIR,
  type AuthRequest,
} from './auth.js'

const app = express()
const PORT = 3334

// 项目根目录
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..')

// 获取用户的 TODO 文件路径
function getTodoFilePath(userEmail: string | null, year: number | string): string {
  if (!userEmail) {
    // 未登录用户使用 demo 数据
    return path.join(DEMO_DATA_DIR, `${year}-todo.md`)
  }
  return path.join(getUserDataDir(userEmail), `${year}-todo.md`)
}

// 获取用户的文档目录
function getDocsDir(userEmail: string | null): string {
  if (!userEmail) {
    return DEMO_DOCS_DIR
  }
  return getUserDocsDir(userEmail)
}

// ========== 统一的检测辅助函数 ==========

// 占位文本常量
const PLACEHOLDER_TEXT = '（暂无未完成任务）'

// 检测是否为分隔线
function isSeparator(line: string): boolean {
  return line.trim() === '---'
}

// 检测是否为项目标题 (### xxx)
function isProjectHeader(line: string): boolean {
  return line.startsWith('### ')
}

// 检测是否为周标题 (## X月X日 - X月X日)
function isWeekHeader(line: string): boolean {
  return line.startsWith('## ') && /\d+月\d+日/.test(line)
}

// 检测是否为任务行
function isTaskLine(line: string): boolean {
  return /^(\s*)- \[[ x]\]/.test(line)
}

// 检测是否为已完成任务
function isCompletedTask(line: string): boolean {
  return /^(\s*)- \[x\]/.test(line)
}

// 检测是否为未完成任务
function isPendingTask(line: string): boolean {
  return /^(\s*)- \[ \]/.test(line)
}

// 检测是否为占位文本
function isPlaceholder(line: string): boolean {
  return line.trim() === PLACEHOLDER_TEXT
}

// 检测是否为区块边界（分隔线或项目标题）
function isBlockBoundary(line: string): boolean {
  return isSeparator(line) || isProjectHeader(line)
}

// 统一的错误处理函数
function handleError(res: express.Response, error: unknown, context: string) {
  console.error(`[${context}] Error:`, error)
  const errorMessage = error instanceof Error ? error.message : String(error)
  res.status(500).json({ success: false, error: errorMessage })
}

app.use(cors())
app.use(express.json())

// 配置 multer 用于文件上传（动态目录，在路由中处理）
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const authReq = req as AuthRequest
      const docsDir = getDocsDir(authReq.user?.email || null)
      cb(null, docsDir)
    },
    filename: (_req, file, cb) => {
      // 保留原文件名，使用 UTF-8 解码
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
      cb(null, originalName)
    },
  }),
  fileFilter: (_req, file, cb) => {
    // 只允许上传 .md 文件
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    if (originalName.endsWith('.md')) {
      cb(null, true)
    } else {
      cb(new Error('只允许上传 .md 文件'))
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 限制
  },
})

// ========== 认证相关 API ==========

// 注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, inviteCode } = req.body
    if (!email || !password || !inviteCode) {
      return res.status(400).json({ success: false, error: '邮箱、密码和邀请码都是必填项' })
    }
    const result = await register(email, password, inviteCode)
    if (result.success) {
      res.json({ success: true, token: result.token })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    handleError(res, error, 'POST /api/auth/register')
  }
})

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, error: '邮箱和密码都是必填项' })
    }
    const result = await login(email, password)
    if (result.success) {
      res.json({ success: true, token: result.token, isAdmin: result.isAdmin })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    handleError(res, error, 'POST /api/auth/login')
  }
})

// 修改密码（需要登录）
app.post('/api/auth/change-password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '旧密码和新密码都是必填项' })
    }
    const result = await changePassword(req.user!.email, oldPassword, newPassword)
    if (result.success) {
      res.json({ success: true })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    handleError(res, error, 'POST /api/auth/change-password')
  }
})

// 获取当前用户信息（需要登录）
app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({
    success: true,
    user: {
      email: req.user!.email,
      isAdmin: req.user!.isAdmin,
    },
  })
})

// 生成邀请码（仅管理员）
app.post('/api/auth/invite', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { targetEmail } = req.body
    if (!targetEmail) {
      return res.status(400).json({ success: false, error: '目标邮箱是必填项' })
    }
    const result = await generateInviteCode(req.user!.email, targetEmail)
    if (result.success) {
      res.json({ success: true, code: result.code })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    handleError(res, error, 'POST /api/auth/invite')
  }
})

// ========== TODO 相关 API（支持用户隔离）==========

// 获取可用年份列表
app.get('/api/years', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const userEmail = req.user?.email || null
    const dataDir = userEmail ? getUserDataDir(userEmail) : DEMO_DATA_DIR
    const files = await fs.readdir(dataDir)
    const years = files
      .filter(f => /^\d{4}-todo\.md$/.test(f))
      .map(f => parseInt(f.slice(0, 4)))
      .sort((a, b) => b - a) // 降序，最新年份在前
    res.json({ success: true, years })
  } catch (error) {
    handleError(res, error, 'GET /api/years')
  }
})

// 获取 TODO 文件内容（支持年份参数）
app.get('/api/todo', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const userEmail = req.user?.email || null
    const year = req.query.year ? String(req.query.year) : new Date().getFullYear()
    const filePath = getTodoFilePath(userEmail, year)
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ success: true, content, year: Number(year), isDemo: !userEmail })
  } catch (error) {
    handleError(res, error, 'GET /api/todo')
  }
})

// 更新 TODO 文件内容（需要登录）
app.put('/api/todo', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { content, year } = req.body
    const targetYear = year || new Date().getFullYear()
    if (typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'content is required' })
    }
    const filePath = getTodoFilePath(req.user!.email, targetYear)
    await fs.writeFile(filePath, content, 'utf-8')
    res.json({ success: true })
  } catch (error) {
    handleError(res, error, 'PUT /api/todo')
  }
})

// 切换任务完成状态（需要登录）
app.patch('/api/todo/toggle', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { lineIndex, year } = req.body
    const targetYear = year || new Date().getFullYear()
    if (typeof lineIndex !== 'number') {
      return res.status(400).json({ success: false, error: 'lineIndex is required' })
    }

    const filePath = getTodoFilePath(req.user!.email, targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return res.status(400).json({ success: false, error: 'Invalid lineIndex' })
    }

    const line = lines[lineIndex]
    if (isPendingTask(line)) {
      lines[lineIndex] = line.replace('- [ ]', '- [x]')
    } else if (isCompletedTask(line)) {
      lines[lineIndex] = line.replace('- [x]', '- [ ]')
    } else {
      return res.status(400).json({ success: false, error: 'Line is not a todo item' })
    }

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    handleError(res, error, 'PATCH /api/todo/toggle')
  }
})

// 获取周列表（用于新增任务时选择时间段）
app.get('/api/weeks', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const userEmail = req.user?.email || null
    const year = req.query.year ? String(req.query.year) : new Date().getFullYear()
    const filePath = getTodoFilePath(userEmail, year)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    const weeks: { title: string; lineIndex: number }[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (isWeekHeader(line)) {
        weeks.push({
          title: line.slice(3).trim(),
          lineIndex: i,
        })
      }
    }

    res.json({ success: true, weeks })
  } catch (error) {
    handleError(res, error, 'GET /api/weeks')
  }
})

// 新增任务（需要登录）
app.post('/api/todo/add', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { task, project, year, weekLineIndex } = req.body
    const targetYear = year || new Date().getFullYear()
    if (!task || !project) {
      return res.status(400).json({ success: false, error: 'task and project are required' })
    }

    const filePath = getTodoFilePath(req.user!.email, targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    let insertIndex = -1

    // 如果指定了周，添加到周区块
    if (typeof weekLineIndex === 'number' && weekLineIndex >= 0) {
      // 找到周标题后，在项目下添加（如果周内有该项目分类）或直接添加到周内
      // 周区块内任务直接添加，不分项目
      for (let j = weekLineIndex + 1; j < lines.length; j++) {
        // 遇到下一个周标题或分隔线就停止
        if (isWeekHeader(lines[j]) || isSeparator(lines[j])) {
          insertIndex = j
          break
        }
      }
      if (insertIndex === -1) {
        insertIndex = lines.length
      }
    } else {
      // 添加到待办池的对应项目下
      const projectHeader = `### ${project}`

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === projectHeader) {
          // 检查是否有占位文本需要移除
          let placeholderIndex = -1
          for (let j = i + 1; j < lines.length; j++) {
            if (isPlaceholder(lines[j])) {
              placeholderIndex = j
              break
            }
            // 遇到边界或任务行就停止搜索
            if (isBlockBoundary(lines[j]) || isTaskLine(lines[j])) {
              break
            }
          }
          if (placeholderIndex !== -1) {
            lines.splice(placeholderIndex, 1)
          }

          // 找到项目标题后，找下一个边界之前插入
          for (let j = i + 1; j < lines.length; j++) {
            if (isBlockBoundary(lines[j])) {
              insertIndex = j
              break
            }
            if (lines[j].trim() === '' && lines[j + 1] && isProjectHeader(lines[j + 1])) {
              insertIndex = j
              break
            }
          }
          if (insertIndex === -1) {
            insertIndex = i + 1
          }
          break
        }
      }

      if (insertIndex === -1) {
        return res.status(400).json({ success: false, error: 'Project not found' })
      }
    }

    // 插入新任务
    const newTask = `- [ ] ${task}`
    lines.splice(insertIndex, 0, newTask)

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    handleError(res, error, 'POST /api/todo/add')
  }
})

// 新增子任务（需要登录）
app.post('/api/todo/add-subtask', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { task, parentLineIndex, year } = req.body
    const targetYear = year || new Date().getFullYear()

    if (!task || typeof parentLineIndex !== 'number') {
      return res.status(400).json({ success: false, error: 'task and parentLineIndex are required' })
    }

    const filePath = getTodoFilePath(req.user!.email, targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    if (parentLineIndex < 0 || parentLineIndex >= lines.length) {
      return res.status(400).json({ success: false, error: 'Invalid parentLineIndex' })
    }

    const parentLine = lines[parentLineIndex]
    if (!isTaskLine(parentLine)) {
      return res.status(400).json({ success: false, error: 'Parent line is not a todo item' })
    }

    // 计算父任务的缩进，子任务需要多缩进 4 个空格
    const parentIndent = parentLine.search(/\S/)
    const childIndent = ' '.repeat(parentIndent + 4)

    // 找到插入位置：父任务后面，在所有现有子任务之后
    let insertIndex = parentLineIndex + 1
    for (let i = parentLineIndex + 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '') {
        // 跳过空行
        continue
      }
      const currentIndent = line.search(/\S/)
      if (currentIndent <= parentIndent) {
        // 遇到同级或更高级的内容，在这里插入
        insertIndex = i
        break
      }
      // 继续往下找
      insertIndex = i + 1
    }

    // 插入新子任务
    const newSubtask = `${childIndent}- [ ] ${task}`
    lines.splice(insertIndex, 0, newSubtask)

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    handleError(res, error, 'POST /api/todo/add-subtask')
  }
})

// 新增分类（项目）（需要登录）
app.post('/api/project/add', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, year } = req.body
    const targetYear = year || new Date().getFullYear()
    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' })
    }

    const filePath = getTodoFilePath(req.user!.email, targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    // 检查是否已存在该分类
    const projectHeader = `### ${name}`
    for (const line of lines) {
      if (line.trim() === projectHeader) {
        return res.status(400).json({ success: false, error: '分类已存在' })
      }
    }

    // 找到待办池中的 --- 分隔线位置，在其前插入新分类
    let separatorIndex = -1
    let inPool = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '## 待办池') {
        inPool = true
        continue
      }
      if (inPool && isSeparator(line)) {
        separatorIndex = i
        break
      }
    }

    if (separatorIndex === -1) {
      return res.status(400).json({ success: false, error: '未找到待办池分隔线' })
    }

    // 在 --- 分隔线前插入新分类
    lines.splice(separatorIndex, 0, projectHeader, '', PLACEHOLDER_TEXT, '')

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    handleError(res, error, 'POST /api/project/add')
  }
})

// 删除任务（需要登录）
app.delete('/api/todo/delete', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { lineIndex, year } = req.body
    const targetYear = year || new Date().getFullYear()

    if (typeof lineIndex !== 'number') {
      return res.status(400).json({ success: false, error: 'lineIndex is required' })
    }

    const filePath = getTodoFilePath(req.user!.email, targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return res.status(400).json({ success: false, error: 'Invalid lineIndex' })
    }

    const line = lines[lineIndex]
    if (!isTaskLine(line)) {
      return res.status(400).json({ success: false, error: 'Line is not a todo item' })
    }

    // 收集要删除的行（任务及其子任务）
    const baseIndent = line.search(/\S/)
    const linesToDelete: number[] = [lineIndex]

    for (let i = lineIndex + 1; i < lines.length; i++) {
      const nextLine = lines[i]
      if (nextLine.trim() === '' || isBlockBoundary(nextLine)) {
        break
      }
      const nextIndent = nextLine.search(/\S/)
      if (nextIndent > baseIndent) {
        linesToDelete.push(i)
      } else {
        break
      }
    }

    // 从后往前删除，避免索引偏移
    for (let i = linesToDelete.length - 1; i >= 0; i--) {
      lines.splice(linesToDelete[i], 1)
    }

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    handleError(res, error, 'DELETE /api/todo/delete')
  }
})

// 编辑任务内容（需要登录）
app.patch('/api/todo/edit', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { lineIndex, newContent, year } = req.body
    const targetYear = year || new Date().getFullYear()

    if (typeof lineIndex !== 'number' || typeof newContent !== 'string') {
      return res.status(400).json({ success: false, error: 'lineIndex and newContent are required' })
    }

    const filePath = getTodoFilePath(req.user!.email, targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return res.status(400).json({ success: false, error: 'Invalid lineIndex' })
    }

    const line = lines[lineIndex]
    if (!isTaskLine(line)) {
      return res.status(400).json({ success: false, error: 'Line is not a todo item' })
    }

    // 保留原有的缩进和复选框状态
    const match = line.match(/^(\s*- \[[ x]\] )/)
    if (!match) {
      return res.status(400).json({ success: false, error: 'Invalid task format' })
    }

    lines[lineIndex] = match[1] + newContent.trim()

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    handleError(res, error, 'PATCH /api/todo/edit')
  }
})

// 任务排序：移动任务位置（需要登录）
app.post('/api/todo/reorder', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { year, fromLineIndex, toLineIndex } = req.body
    const targetYear = year || new Date().getFullYear()

    if (typeof fromLineIndex !== 'number' || typeof toLineIndex !== 'number') {
      return res.status(400).json({ success: false, error: 'fromLineIndex and toLineIndex are required' })
    }

    const filePath = getTodoFilePath(req.user!.email, targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    if (fromLineIndex < 0 || fromLineIndex >= lines.length || toLineIndex < 0 || toLineIndex >= lines.length) {
      return res.status(400).json({ success: false, error: 'Invalid line index' })
    }

    // 收集要移动的行（任务及其子任务）
    const fromLine = lines[fromLineIndex]
    const baseIndent = fromLine.search(/\S/)
    const linesToMove: string[] = [fromLine]

    // 收集子任务
    for (let i = fromLineIndex + 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '' || isBlockBoundary(line)) {
        break
      }
      const indent = line.search(/\S/)
      if (indent > baseIndent) {
        linesToMove.push(line)
      } else {
        break
      }
    }

    // 删除原位置的行
    lines.splice(fromLineIndex, linesToMove.length)

    // 计算新的插入位置（考虑删除后的偏移）
    let newToIndex = toLineIndex
    if (toLineIndex > fromLineIndex) {
      newToIndex = toLineIndex - linesToMove.length
    }

    // 插入到新位置
    lines.splice(newToIndex, 0, ...linesToMove)

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    handleError(res, error, 'POST /api/todo/reorder')
  }
})

// 辅助函数：获取某个日期所在周的周一
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - (day === 0 ? 6 : day - 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// 辅助函数：格式化周标题
function formatWeekTitle(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const format = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`
  return `${format(monday)} - ${format(sunday)}`
}

// 辅助函数：解析周标题获取周一日期
function parseWeekTitle(title: string): Date | null {
  // 格式：X月X日 - X月X日
  const match = title.match(/(\d+)月(\d+)日\s*-\s*(\d+)月(\d+)日/)
  if (!match) return null
  const [, startMonth, startDay] = match
  const now = new Date()
  const year = now.getFullYear()
  return new Date(year, parseInt(startMonth) - 1, parseInt(startDay))
}

// 周结算：将待办池中已完成的任务移动到当前周区块（需要登录）
app.post('/api/todo/week-settle', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { year } = req.body
    const targetYear = year || new Date().getFullYear()

    const filePath = getTodoFilePath(req.user!.email, targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    let lines = content.split('\n')

    // 1. 找到待办池区域，收集已完成的任务
    const completedTasks: { lines: string[]; projectName: string }[] = []
    let currentProject = ''
    let inPool = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.trim() === '## 待办池') {
        inPool = true
        continue
      }

      if (inPool && isSeparator(line)) {
        break
      }

      if (inPool && isProjectHeader(line)) {
        currentProject = line.slice(4).trim()
        continue
      }

      // 收集已完成的一级任务（包括其子任务）
      if (inPool && isCompletedTask(line.trim())) {
        const taskLines: string[] = [line]
        const baseIndent = line.search(/\S/)

        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]
          if (nextLine.trim() === '' || isBlockBoundary(nextLine)) {
            break
          }
          const nextIndent = nextLine.search(/\S/)
          if (nextIndent > baseIndent) {
            taskLines.push(nextLine)
          } else {
            break
          }
        }

        completedTasks.push({ lines: taskLines, projectName: currentProject })
      }
    }

    if (completedTasks.length === 0) {
      return res.status(400).json({ success: false, error: '没有已完成的任务需要结算' })
    }

    // 2. 从待办池中删除已完成的任务
    const linesToRemove = new Set<number>()
    inPool = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.trim() === '## 待办池') {
        inPool = true
        continue
      }

      if (inPool && isSeparator(line)) {
        break
      }

      if (inPool && isCompletedTask(line.trim())) {
        linesToRemove.add(i)
        const baseIndent = line.search(/\S/)
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]
          if (nextLine.trim() === '' || isBlockBoundary(nextLine)) {
            break
          }
          const nextIndent = nextLine.search(/\S/)
          if (nextIndent > baseIndent) {
            linesToRemove.add(j)
          } else {
            break
          }
        }
      }
    }

    // 3. 过滤掉要删除的行
    lines = lines.filter((_, i) => !linesToRemove.has(i))

    // 3.5 检查待办池中是否有分类变空，如果变空则添加占位文本
    inPool = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '## 待办池') {
        inPool = true
        continue
      }
      if (inPool && isSeparator(line)) {
        break
      }
      // 检查项目标题后是否为空（下一个非空行是另一个项目标题或分隔线）
      if (inPool && isProjectHeader(line)) {
        let hasContent = false
        let insertPlaceholderAt = -1
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]
          if (nextLine.trim() === '') {
            if (insertPlaceholderAt === -1) insertPlaceholderAt = j
            continue
          }
          if (isBlockBoundary(nextLine)) {
            // 分类为空，需要添加占位文本
            if (!hasContent && insertPlaceholderAt === -1) {
              insertPlaceholderAt = j
            }
            break
          }
          if (isPlaceholder(nextLine)) {
            hasContent = true // 已经有占位文本
            break
          }
          if (isTaskLine(nextLine)) {
            hasContent = true
            break
          }
        }
        if (!hasContent && insertPlaceholderAt !== -1) {
          lines.splice(insertPlaceholderAt, 0, PLACEHOLDER_TEXT)
        }
      }
    }

    // 4. 找到现有的周区块，确定当前周是否存在
    const currentMonday = getMonday(new Date())
    const currentWeekTitle = formatWeekTitle(currentMonday)

    // 查找所有周区块
    const weekBlocks: { title: string; lineIndex: number; monday: Date }[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (isWeekHeader(line)) {
        const title = line.slice(3).trim()
        const monday = parseWeekTitle(title)
        if (monday) {
          weekBlocks.push({ title, lineIndex: i, monday })
        }
      }
    }

    // 5. 找到待办池后的第一个 --- 位置（插入新周区块的位置）
    let insertPosition = -1
    for (let i = 0; i < lines.length; i++) {
      if (isSeparator(lines[i])) {
        insertPosition = i + 1
        break
      }
    }

    if (insertPosition === -1) {
      insertPosition = lines.length
    }

    // 6. 检查是否需要创建缺失的周区块
    let currentWeekLineIndex: number

    if (weekBlocks.length === 0) {
      // 没有任何周区块，创建当前周
      const newWeekBlock = ['', '---', '', `## ${currentWeekTitle}`, '']
      lines.splice(insertPosition, 0, ...newWeekBlock)
      currentWeekLineIndex = insertPosition + 3 // ## 行的位置
    } else {
      // 找当前周区块
      const existingCurrentWeek = weekBlocks.find(w => w.title === currentWeekTitle)

      if (existingCurrentWeek) {
        currentWeekLineIndex = existingCurrentWeek.lineIndex
      } else {
        // 当前周不存在，需要创建从最新周到当前周之间的所有缺失周
        const latestWeek = weekBlocks[0] // 按文件顺序，第一个是最新的
        const weeksToCreate: string[] = []

        // 从最新周的下一周开始，创建到当前周
        const nextMonday = new Date(latestWeek.monday)
        nextMonday.setDate(nextMonday.getDate() + 7)

        while (nextMonday <= currentMonday) {
          weeksToCreate.push(formatWeekTitle(new Date(nextMonday)))
          nextMonday.setDate(nextMonday.getDate() + 7)
        }

        // 按时间倒序插入（最新的在最前面）
        weeksToCreate.reverse()

        // 在待办池 --- 后插入新周区块
        const newWeekLines: string[] = []
        for (const weekTitle of weeksToCreate) {
          newWeekLines.push('', '---', '', `## ${weekTitle}`, '')
        }

        lines.splice(insertPosition, 0, ...newWeekLines)

        // 当前周是第一个插入的
        currentWeekLineIndex = insertPosition + 3
      }
    }

    // 7. 重新扫描找到当前周的位置（因为可能插入了新行）
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === `## ${currentWeekTitle}`) {
        currentWeekLineIndex = i
        break
      }
    }

    // 8. 找到当前周区块的结束位置（下一个 --- 或周标题或文件结尾）
    let weekEndIndex = lines.length
    for (let i = currentWeekLineIndex + 1; i < lines.length; i++) {
      if (isSeparator(lines[i]) || isWeekHeader(lines[i])) {
        weekEndIndex = i
        break
      }
    }

    // 9. 构建要插入的任务内容
    const tasksByProject: Record<string, string[]> = {}
    for (const task of completedTasks) {
      if (!tasksByProject[task.projectName]) {
        tasksByProject[task.projectName] = []
      }
      tasksByProject[task.projectName].push(...task.lines)
    }

    const taskLines: string[] = []
    for (const projectName of Object.keys(tasksByProject)) {
      const tasks = tasksByProject[projectName]
      if (projectName) {
        taskLines.push(`- [x] ${projectName}`)
        for (const taskLine of tasks) {
          taskLines.push('    ' + taskLine.trim())
        }
      } else {
        taskLines.push(...tasks.map((t: string) => t.trim()))
      }
    }

    // 10. 在当前周区块末尾插入任务
    lines.splice(weekEndIndex, 0, ...taskLines, '')

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({
      success: true,
      newContent: lines.join('\n'),
      settledCount: completedTasks.length,
      weekTitle: currentWeekTitle
    })
  } catch (error) {
    handleError(res, error, 'POST /api/todo/week-settle')
  }
})

// 获取文档列表（支持用户隔离）
app.get('/api/docs', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const userEmail = req.user?.email || null
    const docsDir = getDocsDir(userEmail)
    const files = await fs.readdir(docsDir)
    const docs = files
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f.replace('.md', ''),
        filename: f,
      }))
    res.json({ success: true, docs, isDemo: !userEmail })
  } catch (error) {
    handleError(res, error, 'GET /api/docs')
  }
})

// 获取文档内容（支持用户隔离）
app.get('/api/docs/:filename', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const { filename } = req.params
    // 安全检查：防止路径遍历
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ success: false, error: 'Invalid filename' })
    }
    const userEmail = req.user?.email || null
    const docsDir = getDocsDir(userEmail)
    const filePath = path.join(docsDir, filename)
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ success: true, content })
  } catch (error) {
    handleError(res, error, 'GET /api/docs/:filename')
  }
})

// 上传文档（需要登录）
app.post('/api/docs/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' })
    }
    const filename = req.file.filename
    res.json({
      success: true,
      filename,
      name: filename.replace('.md', ''),
    })
  } catch (error) {
    handleError(res, error, 'POST /api/docs/upload')
  }
})

// 新增周区块（需要登录）
app.post('/api/week/add', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { year, weekTitle } = req.body
    const targetYear = year || new Date().getFullYear()

    if (!weekTitle) {
      return res.status(400).json({ success: false, error: 'weekTitle is required' })
    }

    const filePath = getTodoFilePath(req.user!.email, targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    // 检查周区块是否已存在（使用精确匹配）
    const targetWeekHeader = `## ${weekTitle}`
    for (const line of lines) {
      if (line.trim() === targetWeekHeader) {
        return res.status(400).json({ success: false, error: '该周区块已存在' })
      }
    }

    // 找到待办池后的第一个 --- 位置
    let insertPosition = -1
    for (let i = 0; i < lines.length; i++) {
      if (isSeparator(lines[i])) {
        insertPosition = i + 1
        break
      }
    }

    if (insertPosition === -1) {
      insertPosition = lines.length
    }

    // 插入新周区块
    const newWeekBlock = ['', '---', '', `## ${weekTitle}`, '']
    lines.splice(insertPosition, 0, ...newWeekBlock)

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    handleError(res, error, 'POST /api/week/add')
  }
})

// AI 聊天接口 - 使用 claude CLI（支持用户隔离工作空间）
app.post('/api/ai/chat', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const { message, history = [] } = req.body

    if (!message) {
      return res.status(400).json({ success: false, error: 'message is required' })
    }

    // 确定工作目录：登录用户使用个人目录，未登录使用 demo 目录
    const userEmail = req.user?.email || null
    const workDir = userEmail ? getUserDataDir(userEmail) : DEMO_DATA_DIR

    // 构建包含历史的 prompt
    // 只取最近 5 条对话（10 条消息）
    const recentHistory = (history as { role: string; content: string }[]).slice(-10)
    let fullPrompt = ''

    if (recentHistory.length > 0) {
      fullPrompt += '以下是之前的对话历史：\n\n'
      for (const msg of recentHistory) {
        const roleLabel = msg.role === 'user' ? '用户' : '助手'
        fullPrompt += `${roleLabel}: ${msg.content}\n\n`
      }
      fullPrompt += '---\n\n现在用户说：\n\n'
    }

    fullPrompt += message

    // 使用 claude CLI 执行任务
    // --print 模式直接输出结果
    // --allowedTools 限制可用工具为 Read 和 Edit
    // --permission-mode acceptEdits 自动接受编辑
    const escapedMessage = fullPrompt.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$')
    const command = `claude -p "${escapedMessage}" --allowedTools "Read,Edit" --permission-mode acceptEdits`

    console.log('Executing claude command with history, message length:', fullPrompt.length, 'workDir:', workDir)

    const result = execSync(command, {
      cwd: workDir,
      encoding: 'utf-8',
      timeout: 120000, // 2 分钟超时
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    })

    res.json({ success: true, reply: result.trim() })
  } catch (error) {
    handleError(res, error, 'POST /api/ai/chat')
  }
})

// 数据目录（用于日志输出）
const DATA_DIR = path.resolve(import.meta.dirname, '../data')

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`Data directory: ${DATA_DIR}`)
})

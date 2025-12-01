import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
const PORT = 3001

// TODO 文件目录
const DATA_DIR = path.resolve(import.meta.dirname, '../data')
// 文档目录
const DOCS_DIR = path.resolve(import.meta.dirname, '../otherDocs')
// CLAUDE.md 路径
const CLAUDE_MD_PATH = path.resolve(import.meta.dirname, '../CLAUDE.md')

// 初始化 Anthropic 客户端
const anthropic = new Anthropic({
  baseURL: 'https://gaccode.com/claudecode',
  apiKey: ''
})

// 获取指定年份的文件路径
function getTodoFilePath(year: number | string): string {
  return path.join(DATA_DIR, `${year}-todo.md`)
}

app.use(cors())
app.use(express.json())

// 获取可用年份列表
app.get('/api/years', async (_req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR)
    const years = files
      .filter(f => /^\d{4}-todo\.md$/.test(f))
      .map(f => parseInt(f.slice(0, 4)))
      .sort((a, b) => b - a) // 降序，最新年份在前
    res.json({ success: true, years })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 获取 TODO 文件内容（支持年份参数）
app.get('/api/todo', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear()
    const filePath = getTodoFilePath(year)
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ success: true, content, year: Number(year) })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 更新 TODO 文件内容
app.put('/api/todo', async (req, res) => {
  try {
    const { content, year } = req.body
    const targetYear = year || new Date().getFullYear()
    if (typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'content is required' })
    }
    const filePath = getTodoFilePath(targetYear)
    await fs.writeFile(filePath, content, 'utf-8')
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 切换任务完成状态
app.patch('/api/todo/toggle', async (req, res) => {
  try {
    const { lineIndex, year } = req.body
    const targetYear = year || new Date().getFullYear()
    if (typeof lineIndex !== 'number') {
      return res.status(400).json({ success: false, error: 'lineIndex is required' })
    }

    const filePath = getTodoFilePath(targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return res.status(400).json({ success: false, error: 'Invalid lineIndex' })
    }

    const line = lines[lineIndex]
    if (line.includes('- [ ]')) {
      lines[lineIndex] = line.replace('- [ ]', '- [x]')
    } else if (line.includes('- [x]')) {
      lines[lineIndex] = line.replace('- [x]', '- [ ]')
    } else {
      return res.status(400).json({ success: false, error: 'Line is not a todo item' })
    }

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 获取周列表（用于新增任务时选择时间段）
app.get('/api/weeks', async (req, res) => {
  try {
    const year = req.query.year ? String(req.query.year) : new Date().getFullYear()
    const filePath = getTodoFilePath(year)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    const weeks: { title: string; lineIndex: number }[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // 匹配周标题：## X月X日 - X月X日
      if (line.startsWith('## ') && /\d+月\d+日/.test(line)) {
        weeks.push({
          title: line.slice(3).trim(),
          lineIndex: i,
        })
      }
    }

    res.json({ success: true, weeks })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 新增任务
app.post('/api/todo/add', async (req, res) => {
  try {
    const { task, project, year, weekLineIndex } = req.body
    const targetYear = year || new Date().getFullYear()
    if (!task || !project) {
      return res.status(400).json({ success: false, error: 'task and project are required' })
    }

    const filePath = getTodoFilePath(targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    let insertIndex = -1

    // 如果指定了周，添加到周区块
    if (typeof weekLineIndex === 'number' && weekLineIndex >= 0) {
      // 找到周标题后，在项目下添加（如果周内有该项目分类）或直接添加到周内
      // 周区块内任务直接添加，不分项目
      for (let j = weekLineIndex + 1; j < lines.length; j++) {
        // 遇到下一个 ## 或 --- 就停止
        if (lines[j].startsWith('## ') || lines[j].trim() === '---') {
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
          // 找到项目标题后，找下一个空行或下一个 ### 之前插入
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].startsWith('###') || lines[j] === '---') {
              insertIndex = j
              break
            }
            if (lines[j].trim() === '' && lines[j + 1]?.startsWith('###')) {
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
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 新增分类（项目）
app.post('/api/project/add', async (req, res) => {
  try {
    const { name, year } = req.body
    const targetYear = year || new Date().getFullYear()
    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' })
    }

    const filePath = getTodoFilePath(targetYear)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    // 检查是否已存在该分类
    const projectHeader = `### ${name}`
    for (const line of lines) {
      if (line.trim() === projectHeader) {
        return res.status(400).json({ success: false, error: '分类已存在' })
      }
    }

    // 找到待办池中最后一个 ### 分类的位置，在其后插入新分类
    let insertIndex = -1
    let inPool = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '## 待办池') {
        inPool = true
        continue
      }
      if (inPool && line.trim() === '---') {
        // 在分隔线前插入
        insertIndex = i
        break
      }
      if (inPool && line.startsWith('### ')) {
        // 记录最后一个项目位置
        insertIndex = i
      }
    }

    if (insertIndex === -1) {
      return res.status(400).json({ success: false, error: '未找到待办池' })
    }

    // 找到 insertIndex 后面的合适位置（在该分类内容结束后）
    let actualInsertIndex = insertIndex + 1
    for (let j = insertIndex + 1; j < lines.length; j++) {
      if (lines[j].startsWith('###') || lines[j].trim() === '---') {
        actualInsertIndex = j
        break
      }
    }

    // 插入新分类
    lines.splice(actualInsertIndex, 0, '', projectHeader, '')

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 任务排序：移动任务位置
app.post('/api/todo/reorder', async (req, res) => {
  try {
    const { year, fromLineIndex, toLineIndex } = req.body
    const targetYear = year || new Date().getFullYear()

    if (typeof fromLineIndex !== 'number' || typeof toLineIndex !== 'number') {
      return res.status(400).json({ success: false, error: 'fromLineIndex and toLineIndex are required' })
    }

    const filePath = getTodoFilePath(targetYear)
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
      if (line.trim() === '' || line.startsWith('###') || line.trim() === '---') {
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
    res.status(500).json({ success: false, error: String(error) })
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

// 周结算：将待办池中已完成的任务移动到当前周区块
app.post('/api/todo/week-settle', async (req, res) => {
  try {
    const { year } = req.body
    const targetYear = year || new Date().getFullYear()

    const filePath = getTodoFilePath(targetYear)
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

      if (inPool && line.trim() === '---') {
        break
      }

      if (inPool && line.startsWith('### ')) {
        currentProject = line.slice(4).trim()
        continue
      }

      // 收集已完成的一级任务（包括其子任务）
      if (inPool && /^- \[x\]/.test(line.trim())) {
        const taskLines: string[] = [line]
        const baseIndent = line.search(/\S/)

        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]
          if (nextLine.trim() === '' || nextLine.startsWith('###') || nextLine.trim() === '---') {
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

      if (inPool && line.trim() === '---') {
        break
      }

      if (inPool && /^- \[x\]/.test(line.trim())) {
        linesToRemove.add(i)
        const baseIndent = line.search(/\S/)
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]
          if (nextLine.trim() === '' || nextLine.startsWith('###') || nextLine.trim() === '---') {
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

    // 4. 找到现有的周区块，确定当前周是否存在
    const currentMonday = getMonday(new Date())
    const currentWeekTitle = formatWeekTitle(currentMonday)

    // 查找所有周区块
    const weekBlocks: { title: string; lineIndex: number; monday: Date }[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('## ') && /\d+月\d+日/.test(line)) {
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
      if (lines[i].trim() === '---') {
        insertPosition = i + 1
        break
      }
    }

    if (insertPosition === -1) {
      insertPosition = lines.length
    }

    // 6. 检查是否需要创建缺失的周区块
    let currentWeekLineIndex = -1

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

    // 8. 找到当前周区块的结束位置（下一个 --- 或 ## 或文件结尾）
    let weekEndIndex = lines.length
    for (let i = currentWeekLineIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '---' || (lines[i].startsWith('## ') && i !== currentWeekLineIndex)) {
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
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 获取文档列表
app.get('/api/docs', async (_req, res) => {
  try {
    const files = await fs.readdir(DOCS_DIR)
    const docs = files
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f.replace('.md', ''),
        filename: f,
      }))
    res.json({ success: true, docs })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 获取文档内容
app.get('/api/docs/:filename', async (req, res) => {
  try {
    const { filename } = req.params
    // 安全检查：防止路径遍历
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ success: false, error: 'Invalid filename' })
    }
    const filePath = path.join(DOCS_DIR, filename)
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ success: true, content })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// AI 聊天接口
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, year } = req.body
    const targetYear = year || new Date().getFullYear()

    if (!message) {
      return res.status(400).json({ success: false, error: 'message is required' })
    }

    // 读取 CLAUDE.md 和当前 TODO 文件
    const [claudeMd, todoContent] = await Promise.all([
      fs.readFile(CLAUDE_MD_PATH, 'utf-8').catch(() => ''),
      fs.readFile(getTodoFilePath(targetYear), 'utf-8').catch(() => ''),
    ])

    // 构建 system prompt
    const systemPrompt = `你是一个 TODO 管理助手，帮助用户管理他们的工作任务。

${claudeMd}

---

当前 TODO 文件内容（${targetYear}年）：
\`\`\`markdown
${todoContent}
\`\`\`

---

你的职责：
1. 当用户说完成了某个任务，输出需要添加到本周区块的任务记录（格式：- [x] 任务内容）
2. 当用户说要记录新任务，输出需要添加到待办池的任务（格式：- [ ] 任务内容，并说明应该放到哪个分类）
3. 当用户询问任务状态，根据 TODO 文件回答
4. 帮助用户拆解复杂任务

请用简洁的中文回复，如果涉及到任务操作，请明确说明操作内容。`

    // 使用流式请求
    const stream = await anthropic.messages.stream({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: message }
      ],
    })

    // 收集完整响应
    const finalMessage = await stream.finalMessage()
    const textContent = finalMessage.content.find(c => c.type === 'text')
    const reply = textContent ? textContent.text : ''

    res.json({ success: true, reply })
  } catch (error) {
    console.error('AI chat error:', error)
    res.status(500).json({ success: false, error: String(error) })
  }
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`Data directory: ${DATA_DIR}`)
})

import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'

const app = express()
const PORT = 3001

// TODO 文件路径（上级目录的 2025-todo.md）
const TODO_FILE_PATH = path.resolve(import.meta.dirname, '../../2025-todo.md')

app.use(cors())
app.use(express.json())

// 获取 TODO 文件内容
app.get('/api/todo', async (_req, res) => {
  try {
    const content = await fs.readFile(TODO_FILE_PATH, 'utf-8')
    res.json({ success: true, content })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 更新 TODO 文件内容
app.put('/api/todo', async (req, res) => {
  try {
    const { content } = req.body
    if (typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'content is required' })
    }
    await fs.writeFile(TODO_FILE_PATH, content, 'utf-8')
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 切换任务完成状态
app.patch('/api/todo/toggle', async (req, res) => {
  try {
    const { lineIndex } = req.body
    if (typeof lineIndex !== 'number') {
      return res.status(400).json({ success: false, error: 'lineIndex is required' })
    }

    const content = await fs.readFile(TODO_FILE_PATH, 'utf-8')
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

    await fs.writeFile(TODO_FILE_PATH, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

// 新增任务
app.post('/api/todo/add', async (req, res) => {
  try {
    const { task, project } = req.body
    if (!task || !project) {
      return res.status(400).json({ success: false, error: 'task and project are required' })
    }

    const content = await fs.readFile(TODO_FILE_PATH, 'utf-8')
    const lines = content.split('\n')

    // 找到对应项目的位置
    const projectHeader = `### ${project}`
    let insertIndex = -1

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

    // 插入新任务
    const newTask = `- [ ] ${task}`
    lines.splice(insertIndex, 0, newTask)

    await fs.writeFile(TODO_FILE_PATH, lines.join('\n'), 'utf-8')
    res.json({ success: true, newContent: lines.join('\n') })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`TODO file: ${TODO_FILE_PATH}`)
})

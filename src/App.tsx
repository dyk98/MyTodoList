import { useEffect, useState, useCallback, useRef } from 'react'
import { Layout, Typography, Spin, Alert, Divider, Select, Space, Dropdown, Button, Modal, message, Input } from 'antd'
import { FileTextOutlined, CalendarOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { TodoPool, WeekBlock, DocViewer, AiChatBubble } from '@/components'
import { fetchTodo, fetchYears, toggleTodo, addTodo, addProject, fetchDocs, weekSettle, reorderTodo, addWeek, uploadDoc } from '@/utils/api'
import { parseTodoMd } from '@/utils/parser'
import type { ParsedTodo } from '@/types'

const { Header, Content } = Layout
const { Title } = Typography

function App() {
  const [data, setData] = useState<ParsedTodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [years, setYears] = useState<number[]>([])
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())

  // 文档相关状态
  const [docs, setDocs] = useState<{ name: string; filename: string }[]>([])
  const [docViewerOpen, setDocViewerOpen] = useState(false)
  const [currentDoc, setCurrentDoc] = useState<{ name: string; filename: string } | null>(null)

  // 加载年份列表和文档列表
  useEffect(() => {
    fetchYears().then(setYears).catch(console.error)
    fetchDocs().then(setDocs).catch(console.error)
  }, [])

  const loadData = useCallback(async (year?: number) => {
    try {
      setLoading(true)
      const { content, year: loadedYear } = await fetchTodo(year)
      const parsed = parseTodoMd(content)
      setData(parsed)
      setCurrentYear(loadedYear)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleYearChange = (year: number) => {
    setCurrentYear(year)
    loadData(year)
  }

  const handleToggle = async (lineIndex: number) => {
    try {
      const newContent = await toggleTodo(lineIndex, currentYear)
      const parsed = parseTodoMd(newContent)
      setData(parsed)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleAdd = async (task: string, project: string, weekLineIndex?: number) => {
    const newContent = await addTodo(task, project, currentYear, weekLineIndex)
    const parsed = parseTodoMd(newContent)
    setData(parsed)
  }

  const handleProjectAdd = async (name: string) => {
    const newContent = await addProject(name, currentYear)
    const parsed = parseTodoMd(newContent)
    setData(parsed)
  }

  const handleReorder = async (fromLineIndex: number, toLineIndex: number) => {
    const newContent = await reorderTodo(fromLineIndex, toLineIndex, currentYear)
    const parsed = parseTodoMd(newContent)
    setData(parsed)
  }

  const handleDocClick = (doc: { name: string; filename: string }) => {
    setCurrentDoc(doc)
    setDocViewerOpen(true)
  }

  // 周结算
  const handleWeekSettle = () => {
    Modal.confirm({
      title: '周结算',
      content: (
        <div>
          <p>将待办池中所有已完成的任务归档到当前周区块</p>
          <p style={{ fontSize: 12, color: '#999' }}>如果当前周区块不存在，会自动创建</p>
        </div>
      ),
      okText: '确认结算',
      cancelText: '取消',
      onOk: async () => {
        try {
          const { newContent, settledCount, weekTitle } = await weekSettle(currentYear)
          const parsed = parseTodoMd(newContent)
          setData(parsed)
          message.success(`周结算完成，共归档 ${settledCount} 个任务到「${weekTitle}」`)
        } catch (e) {
          message.error(String(e))
        }
      },
    })
  }

  // 新增周区块
  const handleAddWeek = () => {
    let weekTitleInput = ''

    Modal.confirm({
      title: '新增周区块',
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>输入周区块标题（格式：X月X日 - X月X日）</p>
          <Input
            placeholder="例如：12月9日 - 12月15日"
            onChange={(e) => { weekTitleInput = e.target.value }}
          />
        </div>
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        if (!weekTitleInput.trim()) {
          message.warning('请输入周区块标题')
          return Promise.reject()
        }
        try {
          const newContent = await addWeek(weekTitleInput.trim(), currentYear)
          const parsed = parseTodoMd(newContent)
          setData(parsed)
          message.success(`周区块「${weekTitleInput}」创建成功`)
        } catch (e) {
          message.error(String(e))
          return Promise.reject()
        }
      },
    })
  }

  // 文档上传
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.md')) {
      message.error('只能上传 .md 文件')
      return
    }

    try {
      const result = await uploadDoc(file)
      setDocs(prev => [...prev, result])
      message.success(`文档「${result.name}」上传成功`)
    } catch (err) {
      message.error(String(err))
    }

    // 清空 input 以便可以再次上传同名文件
    e.target.value = ''
  }

  // 文档下拉菜单
  const docMenuItems = [
    ...docs.map(doc => ({
      key: doc.filename,
      label: doc.name,
      onClick: () => handleDocClick(doc),
    })),
    { type: 'divider' as const, key: 'divider' },
    {
      key: 'upload',
      label: '上传文档',
      icon: <UploadOutlined />,
      onClick: handleUploadClick,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: '16px 0' }}>TODO List</Title>
          <Space>
            <Button
              icon={<PlusOutlined />}
              onClick={handleAddWeek}
            >
              新增周
            </Button>
            <Button
              icon={<CalendarOutlined />}
              onClick={handleWeekSettle}
            >
              周结算
            </Button>
            <Dropdown menu={{ items: docMenuItems }} placement="bottomRight">
              <Button icon={<FileTextOutlined />}>文档</Button>
            </Dropdown>
            <Select
              value={currentYear}
              onChange={handleYearChange}
              style={{ width: 120 }}
              options={years.map(y => ({ value: y, label: `${y} 年` }))}
            />
          </Space>
        </Space>
      </Header>
      <Content style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
        {loading && <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />}

        {error && (
          <Alert
            message="加载失败"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {data && (
          <>
            <TodoPool
              projects={data.pool}
              currentYear={currentYear}
              onToggle={handleToggle}
              onAdd={handleAdd}
              onProjectAdd={handleProjectAdd}
              onReorder={handleReorder}
            />

            <Divider orientation="left">历史周记录</Divider>

            {data.weeks.map((week) => (
              <WeekBlock
                key={week.startLine}
                week={week}
                onToggle={handleToggle}
              />
            ))}
          </>
        )}
      </Content>

      {/* 文档查看器 */}
      <DocViewer
        open={docViewerOpen}
        filename={currentDoc?.filename || null}
        title={currentDoc?.name || ''}
        onClose={() => setDocViewerOpen(false)}
      />

      {/* AI 聊天助手 */}
      <AiChatBubble
        currentYear={currentYear}
        onRefresh={() => loadData(currentYear)}
      />

      {/* 隐藏的文件上传 input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".md"
        onChange={handleFileChange}
      />
    </Layout>
  )
}

export default App

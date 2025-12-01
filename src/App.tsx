import { useEffect, useState, useCallback } from 'react'
import { Layout, Typography, Spin, Alert, Divider, Select, Space, Dropdown, Button, Modal, message } from 'antd'
import { FileTextOutlined, CalendarOutlined } from '@ant-design/icons'
import { TodoPool, WeekBlock, DocViewer, AiChatBubble } from '@/components'
import { fetchTodo, fetchYears, toggleTodo, addTodo, addProject, fetchDocs, weekSettle, reorderTodo } from '@/utils/api'
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

  // 文档下拉菜单
  const docMenuItems = docs.map(doc => ({
    key: doc.filename,
    label: doc.name,
    onClick: () => handleDocClick(doc),
  }))

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: '16px 0' }}>TODO List</Title>
          <Space>
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
    </Layout>
  )
}

export default App

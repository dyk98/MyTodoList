import { useEffect, useState, useCallback } from 'react'
import { Layout, Typography, Spin, Alert, Divider } from 'antd'
import { TodoPool, WeekBlock } from '@/components'
import { fetchTodo, toggleTodo, addTodo } from '@/utils/api'
import { parseTodoMd } from '@/utils/parser'
import type { ParsedTodo } from '@/types'

const { Header, Content } = Layout
const { Title } = Typography

function App() {
  const [data, setData] = useState<ParsedTodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const content = await fetchTodo()
      const parsed = parseTodoMd(content)
      setData(parsed)
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

  const handleToggle = async (lineIndex: number) => {
    try {
      const newContent = await toggleTodo(lineIndex)
      const parsed = parseTodoMd(newContent)
      setData(parsed)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleAdd = async (task: string, project: string) => {
    const newContent = await addTodo(task, project)
    const parsed = parseTodoMd(newContent)
    setData(parsed)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={3} style={{ margin: '16px 0' }}>TODO List</Title>
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
              onToggle={handleToggle}
              onAdd={handleAdd}
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
    </Layout>
  )
}

export default App

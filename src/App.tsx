import { useEffect, useState, useCallback, useRef } from 'react'
import { Layout, Typography, Spin, Alert, Divider, Select, Space, Dropdown, Button, Modal, message, Input, Tag } from 'antd'
import { FileTextOutlined, CalendarOutlined, PlusOutlined, UploadOutlined, UserOutlined, SettingOutlined, LoginOutlined, LogoutOutlined, MenuOutlined, PushpinOutlined } from '@ant-design/icons'
import { TodoPool, WeekBlock, DocViewer, AiChatBubble, AuthModal, SettingsModal } from '@/components'
import NotesPanel from '@/components/NotesPanel'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { fetchTodo, fetchYears, toggleTodo, addTodo, addSubtask, addProject, fetchDocs, weekSettle, reorderTodo, addWeek, uploadDoc, editTodo, deleteTodo } from '@/utils/api'
import { parseTodoMd } from '@/utils/parser'
import { useAuth } from '@/contexts/AuthContext'
import type { ParsedTodo } from '@/types'

const { Header, Content } = Layout
const { Title } = Typography

function App() {
  const { user, loading: authLoading, isDemo, logout } = useAuth()
  const isMobile = useIsMobile()
  const [data, setData] = useState<ParsedTodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [years, setYears] = useState<number[]>([])
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())

  // 文档相关状态
  const [docs, setDocs] = useState<{ name: string; filename: string }[]>([])
  const [docViewerOpen, setDocViewerOpen] = useState(false)
  const [currentDoc, setCurrentDoc] = useState<{ name: string; filename: string } | null>(null)

  // 认证相关状态
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  // 便利贴相关状态
  const [noteModalOpen, setNoteModalOpen] = useState(false)

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

  const handleEdit = async (lineIndex: number, newContent: string) => {
    try {
      const updatedContent = await editTodo(lineIndex, newContent, currentYear)
      const parsed = parseTodoMd(updatedContent)
      setData(parsed)
      message.success('修改成功')
    } catch (e) {
      message.error(String(e))
    }
  }

  const handleDelete = async (lineIndex: number) => {
    try {
      const newContent = await deleteTodo(lineIndex, currentYear)
      const parsed = parseTodoMd(newContent)
      setData(parsed)
      message.success('删除成功')
    } catch (e) {
      message.error(String(e))
    }
  }

  const handleAddSubtask = async (parentLineIndex: number, task: string) => {
    const newContent = await addSubtask(task, parentLineIndex, currentYear)
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

  // 移动端操作菜单
  const mobileMenuItems = [
    ...(!isDemo ? [
      {
        key: 'addNote',
        label: '新增便利贴',
        icon: <PushpinOutlined />,
        onClick: () => setNoteModalOpen(true),
      },
      { type: 'divider' as const, key: 'divider0' },
      {
        key: 'addWeek',
        label: '新增周',
        icon: <PlusOutlined />,
        onClick: handleAddWeek,
      },
      {
        key: 'weekSettle',
        label: '周结算',
        icon: <CalendarOutlined />,
        onClick: handleWeekSettle,
      },
      { type: 'divider' as const, key: 'divider1' },
    ] : []),
    ...docs.map(doc => ({
      key: doc.filename,
      label: doc.name,
      icon: <FileTextOutlined />,
      onClick: () => handleDocClick(doc),
    })),
    { type: 'divider' as const, key: 'divider2' },
    {
      key: 'upload',
      label: '上传文档',
      icon: <UploadOutlined />,
      onClick: handleUploadClick,
    },
  ]

  // 显示加载状态
  if (authLoading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />
      </Layout>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#fff', padding: 'var(--header-padding)', borderBottom: '1px solid #f0f0f0' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Title level={3} style={{ margin: '16px 0', fontSize: isMobile ? 18 : 24 }}>TODO List</Title>
              {isDemo && (
                <Tag color="orange">试用</Tag>
              )}
            </Space>
          <Space size={isMobile ? 4 : 8}>
            {isMobile ? (
              // 移动端：收纳为菜单
              <Dropdown menu={{ items: mobileMenuItems }} placement="bottomRight">
                <Button icon={<MenuOutlined />} />
              </Dropdown>
            ) : (
              // 电脑端：展开按钮
              <>
                {!isDemo && (
                  <>
                    <Button
                      icon={<PushpinOutlined />}
                      onClick={() => setNoteModalOpen(true)}
                    >
                      便利贴
                    </Button>
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
                  </>
                )}
                <Dropdown menu={{ items: docMenuItems }} placement="bottomRight">
                  <Button icon={<FileTextOutlined />}>文档</Button>
                </Dropdown>
              </>
            )}
            <Select
              value={currentYear}
              onChange={handleYearChange}
              style={{ width: isMobile ? 90 : 120 }}
              options={years.map(y => ({ value: y, label: `${y} 年` }))}
            />
            {isDemo ? (
              <Button
                type="primary"
                icon={<LoginOutlined />}
                onClick={() => setAuthModalOpen(true)}
              >
                {isMobile ? '' : '登录'}
              </Button>
            ) : (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'user',
                      label: user?.email,
                      disabled: true,
                    },
                    { type: 'divider' },
                    {
                      key: 'settings',
                      label: '设置',
                      icon: <SettingOutlined />,
                      onClick: () => setSettingsModalOpen(true),
                    },
                    {
                      key: 'logout',
                      label: '退出登录',
                      icon: <LogoutOutlined />,
                      danger: true,
                      onClick: () => {
                        Modal.confirm({
                          title: '确认退出登录？',
                          okText: '退出',
                          cancelText: '取消',
                          onOk: logout,
                        })
                      },
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <Button icon={<UserOutlined />}>
                  {isMobile ? '' : user?.email?.split('@')[0]}
                </Button>
              </Dropdown>
            )}
          </Space>
        </Space>
      </Header>
      <Content style={{ padding: 'var(--content-padding)', maxWidth: 'var(--content-max-width)', margin: '0 auto', width: '100%' }}>
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
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddSubtask={handleAddSubtask}
              readOnly={isDemo}
            />

            <Divider orientation="left">历史周记录</Divider>

            {data.weeks.map((week) => (
              <WeekBlock
                key={week.startLine}
                week={week}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
                readOnly={isDemo}
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

      {/* 登录/注册模态框 */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* 设置模态框 */}
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      {/* 便利贴面板 - 浮动在右侧 */}
      <NotesPanel
        isDemo={isDemo}
        showModal={noteModalOpen}
        onCloseModal={() => setNoteModalOpen(false)}
      />
    </Layout>
  )
}

export default App

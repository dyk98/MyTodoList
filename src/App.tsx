import { useEffect, useState, useCallback, useRef } from 'react'
import { Layout, Spin, Alert, Divider, Select, Space, Dropdown, Button, Modal, Drawer, Tabs, message, Input, Tag, App as AntApp } from 'antd'
import { FileTextOutlined, CalendarOutlined, PlusOutlined, UploadOutlined, UserOutlined, SettingOutlined, LoginOutlined, LogoutOutlined, MenuOutlined, PushpinOutlined, ScheduleOutlined } from '@ant-design/icons'
import { TodoPool, WeekBlock, DocViewer, AiChatBubble, AuthModal, SettingsModal, YearMigrationModal } from '@/components'
import NotesPanel from '@/components/NotesPanel'
import SchedulePanel from '@/components/SchedulePanel'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { fetchTodo, fetchTodoStatus, fetchYears, toggleTodo, addTodo, addSubtask, addProject, fetchDocs, weekSettle, moveTodo, addWeek, uploadDoc, editTodo, deleteTodo, updateTodo, createTodoYear, setTodayDate, removeTodayDate } from '@/utils/api'
import { parseTodoMd } from '@/utils/parser'
import { useAuth } from '@/contexts/AuthContext'
import type { ParsedTodo, ProjectGroup, TodoItem, ScheduleTask } from '@/types'
import MarkdownPreview from '@uiw/react-markdown-preview'

const { Header, Content } = Layout

function isWeekHeader(line: string): boolean {
  return line.startsWith('## ') && /\d+月\d+日/.test(line)
}

function validateTodoMarkdownStructure(content: string): string | null {
  const lines = content.split('\n')

  const poolHeaderIndex = lines.findIndex(line => line.trim() === '## 待办池')
  if (poolHeaderIndex === -1) {
    return '缺少「## 待办池」区块标题'
  }

  const firstSeparatorIndex = lines.findIndex(line => line.trim() === '---')
  if (firstSeparatorIndex === -1) {
    return '缺少分隔线「---」（用于分隔待办池与周区块）'
  }

  if (firstSeparatorIndex < poolHeaderIndex) {
    return '文件中第一个「---」必须位于「## 待办池」之后（否则会影响新增周/周结算等功能）'
  }

  for (let i = poolHeaderIndex + 1; i < firstSeparatorIndex; i++) {
    if (isWeekHeader(lines[i])) {
      return '检测到周区块标题出现在待办池分隔线之前，请将「---」放在待办池结束位置'
    }
  }

  return null
}

const PLACEHOLDER_TEXT = '（暂无未完成任务）'

function filterSelectedItems(items: TodoItem[], selected: Set<number>): TodoItem[] {
  const result: TodoItem[] = []
  for (const item of items) {
    const children = filterSelectedItems(item.children, selected)
    if (selected.has(item.lineIndex) || children.length > 0) {
      result.push({ ...item, children })
    }
  }
  return result
}

function serializeTodoItems(items: TodoItem[], indent = 0): string[] {
  const lines: string[] = []
  for (const item of items) {
    const prefix = '    '.repeat(indent)
    const status = item.completed ? 'x' : ' '
    lines.push(`${prefix}- [${status}] ${item.content}`)
    lines.push(...serializeTodoItems(item.children, indent + 1))
  }
  return lines
}

function buildMigratedTodoContent(year: number, projects: ProjectGroup[], selected: Set<number>): string {
  const lines: string[] = [`# ${year} TODO`, '', '## 待办池', '']

  for (const project of projects) {
    lines.push(`### ${project.name}`, '')
    const filtered = filterSelectedItems(project.items, selected)
    if (filtered.length === 0) {
      lines.push(PLACEHOLDER_TEXT, '')
    } else {
      lines.push(...serializeTodoItems(filtered), '')
    }
  }

  lines.push('---', '')
  return lines.join('\n')
}

function App() {
  const { modal } = AntApp.useApp()
  const { user, loading: authLoading, isDemo, logout } = useAuth()
  const isMobile = useIsMobile()
  const [data, setData] = useState<ParsedTodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [years, setYears] = useState<number[]>([])
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [migrationOpen, setMigrationOpen] = useState(false)
  const [migrationSourceYear, setMigrationSourceYear] = useState<number | null>(null)
  const [migrationTargetYear, setMigrationTargetYear] = useState<number | null>(null)
  const [migrationProjects, setMigrationProjects] = useState<ProjectGroup[]>([])
  const [migrationLoading, setMigrationLoading] = useState(false)

  // 文档相关状态
  const [docs, setDocs] = useState<{ name: string; filename: string }[]>([])
  const [docViewerOpen, setDocViewerOpen] = useState(false)
  const [currentDoc, setCurrentDoc] = useState<{ name: string; filename: string } | null>(null)

  // 认证相关状态
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  // 便利贴相关状态
  const [noteModalOpen, setNoteModalOpen] = useState(false)

  // 日程相关状态
  const [scheduleDate, setScheduleDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [schedulePanelCollapsed, setSchedulePanelCollapsed] = useState(true)

  // 新增周相关状态
  const [addWeekModalOpen, setAddWeekModalOpen] = useState(false)
  const [weekTitleInput, setWeekTitleInput] = useState('')

  // Markdown 全文编辑
  const [todoMdEditorOpen, setTodoMdEditorOpen] = useState(false)
  const [todoMdDraft, setTodoMdDraft] = useState('')
  const [todoMdOriginal, setTodoMdOriginal] = useState('')
  const [todoMdSaving, setTodoMdSaving] = useState(false)
  const [todoMdMobileTab, setTodoMdMobileTab] = useState<'edit' | 'preview'>('edit')

  // 加载文档列表
  useEffect(() => {
    if (authLoading) return
    fetchDocs().then(setDocs).catch(console.error)
  }, [authLoading])

  const loadData = useCallback(async (year?: number): Promise<ParsedTodo | null> => {
    try {
      setLoading(true)
      const { content, year: loadedYear } = await fetchTodo(year)
      const parsed = parseTodoMd(content)
      setData(parsed)
      setCurrentYear(loadedYear)
      setError(null)
      return parsed
    } catch (e) {
      setError(String(e))
      return null
    } finally {
      setLoading(false)
    }
  }, [])
 
  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    const init = async () => {
      try {
        const [yearsList, status] = await Promise.all([
          fetchYears(),
          fetchTodoStatus(),
        ])
        if (cancelled) return
        setYears(yearsList)

        if (status.currentExists) {
          await loadData(status.currentYear)
          return
        }

        if (status.prevExists) {
          const parsed = await loadData(status.prevYear)
          if (cancelled) return
          if (!isDemo) {
            setMigrationSourceYear(status.prevYear)
            setMigrationTargetYear(status.currentYear)
            setMigrationProjects(parsed?.pool || [])
            setMigrationOpen(true)
          }
          return
        }

        await loadData(status.currentYear)
        if (cancelled) return
        const refreshedYears = await fetchYears()
        if (cancelled) return
        setYears(refreshedYears)
      } catch (e) {
        if (!cancelled) {
          setError(String(e))
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [authLoading, isDemo, loadData])

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

  const handleMove = async (fromLineIndex: number, toLineIndex: number, position: 'before' | 'inside' | 'after') => {
    const newContent = await moveTodo(fromLineIndex, toLineIndex, position, currentYear)
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

  // 日程相关处理函数
  const getScheduleTasks = useCallback((date: string): ScheduleTask[] => {
    if (!data) return []
    const tasks: ScheduleTask[] = []

    const collectTasks = (items: TodoItem[], projectName: string, archived: boolean) => {
      for (const item of items) {
        if (item.todayDates?.includes(date)) {
          tasks.push({ item, projectName, archived })
        }
        collectTasks(item.children, projectName, archived)
      }
    }

    // 从待办池提取
    for (const project of data.pool) {
      collectTasks(project.items, project.name, false)
    }

    // 从历史周提取
    for (const week of data.weeks) {
      collectTasks(week.items, week.title, true)
    }

    return tasks
  }, [data])

  const getTaskCountByDate = useCallback((): Record<string, number> => {
    if (!data) return {}
    const counts: Record<string, number> = {}

    const collectDates = (items: TodoItem[]) => {
      for (const item of items) {
        if (item.todayDates) {
          item.todayDates.forEach(d => {
            counts[d] = (counts[d] || 0) + 1
          })
        }
        collectDates(item.children)
      }
    }

    // 从待办池提取
    for (const project of data.pool) {
      collectDates(project.items)
    }

    // 从历史周提取
    for (const week of data.weeks) {
      collectDates(week.items)
    }

    return counts
  }, [data])

  const handleSetToday = async (lineIndex: number, date: string) => {
    try {
      const newContent = await setTodayDate(lineIndex, date, currentYear)
      const parsed = parseTodoMd(newContent)
      setData(parsed)
    } catch (e) {
      message.error(String(e))
    }
  }

  const handleRemoveFromSchedule = async (lineIndex: number, date: string) => {
    try {
      const newContent = await removeTodayDate(lineIndex, date, currentYear)
      const parsed = parseTodoMd(newContent)
      setData(parsed)
      message.success('已从日程中移除')
    } catch (e) {
      message.error(String(e))
    }
  }

  const handleMigrationCancel = () => {
    setMigrationOpen(false)
  }

  const handleMigrationConfirm = async (selectedLineIndices: number[]) => {
    if (!migrationTargetYear) return

    const projects = migrationProjects.length > 0 ? migrationProjects : data?.pool || []
    const selectedSet = new Set(selectedLineIndices)
    const content = buildMigratedTodoContent(migrationTargetYear, projects, selectedSet)

    const createYear = async () => {
      setMigrationLoading(true)
      try {
        await createTodoYear(migrationTargetYear, content)
        message.success(`已创建 ${migrationTargetYear} 年 TODO`)
        setMigrationOpen(false)
        const refreshedYears = await fetchYears()
        setYears(refreshedYears)
        await loadData(migrationTargetYear)
      } catch (e) {
        message.error(String(e))
      } finally {
        setMigrationLoading(false)
      }
    }

    if (selectedLineIndices.length === 0) {
      modal.confirm({
        title: '确认创建空结构？',
        content: `未选择任何任务，将创建空结构的 ${migrationTargetYear} 年 TODO，创建后将不再提示。`,
        okText: '确认创建',
        cancelText: '继续选择',
        onOk: createYear,
      })
      return
    }

    await createYear()
  }

  const handleDocClick = (doc: { name: string; filename: string }) => {
    setCurrentDoc(doc)
    setDocViewerOpen(true)
  }

  const handleOpenTodoMdEditor = () => {
    if (!data) return
    setTodoMdOriginal(data.raw)
    setTodoMdDraft(data.raw)
    setTodoMdMobileTab('edit')
    setTodoMdEditorOpen(true)
  }

  const handleCloseTodoMdEditor = () => {
    if (todoMdDraft !== todoMdOriginal) {
      modal.confirm({
        title: '放弃未保存的修改？',
        content: '关闭后将丢失当前的 Markdown 改动',
        okText: '放弃修改',
        cancelText: '继续编辑',
        onOk: () => setTodoMdEditorOpen(false),
      })
      return
    }
    setTodoMdEditorOpen(false)
  }

  const handleSaveTodoMd = async () => {
    const validationError = validateTodoMarkdownStructure(todoMdDraft)
    if (validationError) {
      message.error(validationError)
      return
    }

    setTodoMdSaving(true)
    try {
      await updateTodo(todoMdDraft, currentYear)
      setData(parseTodoMd(todoMdDraft))
      setTodoMdOriginal(todoMdDraft)
      setTodoMdEditorOpen(false)
      message.success('保存成功')
    } catch (e) {
      message.error(String(e))
    } finally {
      setTodoMdSaving(false)
    }
  }

  // 周结算
  const handleWeekSettle = () => {
    modal.confirm({
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
    setWeekTitleInput('')
    setAddWeekModalOpen(true)
  }

  const handleAddWeekConfirm = async () => {
    if (!weekTitleInput.trim()) {
      message.warning('请输入周区块标题')
      return
    }
    try {
      const newContent = await addWeek(weekTitleInput.trim(), currentYear)
      const parsed = parseTodoMd(newContent)
      setData(parsed)
      message.success(`周区块「${weekTitleInput}」创建成功`)
      setAddWeekModalOpen(false)
      setWeekTitleInput('')
    } catch (e) {
      message.error(String(e))
    }
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
        key: 'schedule',
        label: '日程',
        icon: <ScheduleOutlined />,
        onClick: () => setSchedulePanelCollapsed(false),
      },
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
              <img src="/logo.png" alt="TickGo" style={{ height: isMobile ? 28 : 36, marginTop: 12 }} />
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
                      icon={<ScheduleOutlined />}
                      onClick={() => setSchedulePanelCollapsed(!schedulePanelCollapsed)}
                    >
                      日程
                    </Button>
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
                        modal.confirm({
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
              onMove={handleMove}
              onEditMarkdown={handleOpenTodoMdEditor}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddSubtask={handleAddSubtask}
              onSetToday={handleSetToday}
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

      {/* 年度迁移弹窗 */}
      {migrationSourceYear !== null && migrationTargetYear !== null && (
        <YearMigrationModal
          open={migrationOpen}
          sourceYear={migrationSourceYear}
          targetYear={migrationTargetYear}
          projects={migrationProjects}
          confirmLoading={migrationLoading}
          onConfirm={handleMigrationConfirm}
          onCancel={handleMigrationCancel}
        />
      )}

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

      {/* 新增周区块模态框 */}
      <Modal
        title="新增周区块"
        open={addWeekModalOpen}
        onOk={handleAddWeekConfirm}
        onCancel={() => setAddWeekModalOpen(false)}
        okText="创建"
        cancelText="取消"
      >
        <div>
          <p style={{ marginBottom: 8 }}>输入周区块标题（格式：X月X日 - X月X日）</p>
          <Input
            placeholder="例如：12月9日 - 12月15日"
            value={weekTitleInput}
            onChange={(e) => setWeekTitleInput(e.target.value)}
          />
        </div>
      </Modal>

      {/* TODO Markdown 全文编辑 */}
      {isMobile ? (
        <Drawer
          title="Markdown 编辑"
          placement="right"
          width="100%"
          open={todoMdEditorOpen}
          onClose={handleCloseTodoMdEditor}
          extra={
            <Button type="primary" onClick={handleSaveTodoMd} loading={todoMdSaving}>
              保存
            </Button>
          }
          styles={{
            body: {
              padding: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          <div style={{ padding: 12, fontSize: 12, color: '#999' }}>
            保存前会校验结构：必须包含「## 待办池」，且文件中第一个「---」位于其后。
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Tabs
              activeKey={todoMdMobileTab}
              onChange={(key) => setTodoMdMobileTab(key as 'edit' | 'preview')}
              items={[
                {
                  key: 'edit',
                  label: '编辑',
                  children: (
                    <div style={{ padding: 12 }}>
                      <Input.TextArea
                        value={todoMdDraft}
                        onChange={(e) => setTodoMdDraft(e.target.value)}
                        style={{ height: '60vh', fontFamily: 'monospace' }}
                      />
                    </div>
                  ),
                },
                {
                  key: 'preview',
                  label: '预览',
                  children: (
                    <div style={{ padding: 12 }}>
                      <MarkdownPreview
                        source={todoMdDraft}
                        style={{ backgroundColor: 'transparent' }}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </Drawer>
      ) : (
        <Modal
          title="Markdown 编辑"
          open={todoMdEditorOpen}
          onOk={handleSaveTodoMd}
          onCancel={handleCloseTodoMdEditor}
          okText="保存"
          cancelText="关闭"
          confirmLoading={todoMdSaving}
          width={1100}
          styles={{
            body: {
              padding: 16,
            },
          }}
        >
          <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
            保存前会校验结构：必须包含「## 待办池」，且文件中第一个「---」位于其后。
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Input.TextArea
                value={todoMdDraft}
                onChange={(e) => setTodoMdDraft(e.target.value)}
                style={{ height: '70vh', fontFamily: 'monospace' }}
              />
            </div>
            <div
              style={{
                flex: 1,
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 12,
                height: '70vh',
                overflow: 'auto',
                background: '#fafafa',
              }}
            >
              <MarkdownPreview
                source={todoMdDraft}
                style={{ backgroundColor: 'transparent' }}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* 便利贴面板 - 浮动在右侧 */}
      <NotesPanel
        isDemo={isDemo}
        showModal={noteModalOpen}
        onCloseModal={() => setNoteModalOpen(false)}
      />

      {/* 日程面板 - 浮动在左侧 */}
      {!isDemo && (
        <SchedulePanel
          tasks={getScheduleTasks(scheduleDate)}
          selectedDate={scheduleDate}
          onDateChange={setScheduleDate}
          onToggle={handleToggle}
          onRemoveFromSchedule={handleRemoveFromSchedule}
          collapsed={schedulePanelCollapsed}
          onCollapse={setSchedulePanelCollapsed}
          taskCountByDate={getTaskCountByDate()}
          isDemo={isDemo}
        />
      )}
    </Layout>
  )
}

export default App

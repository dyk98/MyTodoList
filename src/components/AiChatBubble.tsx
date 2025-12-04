import { useState, useRef, useEffect } from 'react'
import { FloatButton, Drawer, Input, Button, List, Typography, Spin, Space, Modal, message } from 'antd'
import { RobotOutlined, SendOutlined, PlusOutlined, HistoryOutlined, DeleteOutlined } from '@ant-design/icons'
import { aiChat, fetchChatHistory, saveChatSession, deleteChatSession, type ChatMessage, type ChatSession } from '@/utils/api'
import { useIsMobile } from '@/hooks/useMediaQuery'

const { TextArea } = Input
const { Text } = Typography

interface Props {
  currentYear: number
  onRefresh: () => void
}

// 生成会话标题（从第一条用户消息截取）
function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find(m => m.role === 'user')
  if (!firstUserMsg) return '新对话'
  return firstUserMsg.content.slice(0, 20) + (firstUserMsg.content.length > 20 ? '...' : '')
}

export function AiChatBubble({ currentYear, onRefresh }: Props) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 加载历史会话列表
  const loadSessions = async () => {
    setLoadingSessions(true)
    try {
      const data = await fetchChatHistory()
      setSessions(data)
    } catch (e) {
      message.error('加载历史对话失败')
    } finally {
      setLoadingSessions(false)
    }
  }

  // 打开历史对话时加载列表
  useEffect(() => {
    if (showHistory) {
      loadSessions()
    }
  }, [showHistory])

  // 保存当前会话
  const saveCurrentSession = async (updatedMessages: ChatMessage[]) => {
    if (updatedMessages.length === 0) return

    try {
      const session: ChatSession = {
        id: currentSessionId || Date.now().toString(),
        title: generateTitle(updatedMessages),
        messages: updatedMessages,
        createdAt: currentSessionId ? sessions.find(s => s.id === currentSessionId)?.createdAt || Date.now() : Date.now(),
      }

      await saveChatSession(session)

      if (!currentSessionId) {
        setCurrentSessionId(session.id)
      }

      // 更新本地会话列表
      setSessions(prev => {
        const existingIndex = prev.findIndex(s => s.id === session.id)
        if (existingIndex >= 0) {
          const newSessions = [...prev]
          newSessions[existingIndex] = session
          return newSessions
        } else {
          return [session, ...prev]
        }
      })
    } catch (e) {
      console.error('保存会话失败:', e)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // 传递最近 5 条对话（10 条消息）作为历史
      const reply = await aiChat(userMessage, messages.slice(-10), currentYear)
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: reply }]
      setMessages(finalMessages)

      try {
        await saveCurrentSession(finalMessages)
      } catch (saveError) {
        console.error('保存会话失败:', saveError)
        message.error('保存对话历史失败')
      }

      // 如果 AI 回复中包含任务操作相关内容，刷新数据
      if (reply.includes('- [') || reply.includes('已添加') || reply.includes('已记录')) {
        onRefresh()
      }
    } catch (e) {
      console.error('AI 对话错误:', e)
      const errorMessages = [...newMessages, { role: 'assistant' as const, content: `错误: ${String(e)}` }]
      setMessages(errorMessages)
      try {
        await saveCurrentSession(errorMessages)
      } catch (saveError) {
        console.error('保存错误会话失败:', saveError)
      }
    } finally {
      setLoading(false)
    }
  }

  // 开始新对话
  const startNewChat = () => {
    setMessages([])
    setCurrentSessionId(null)
    setShowHistory(false)
  }

  // 加载历史会话
  const loadSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      setMessages(session.messages)
      setCurrentSessionId(sessionId)
      setShowHistory(false)
    }
  }

  // 删除会话
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个对话吗？',
      onOk: async () => {
        try {
          await deleteChatSession(sessionId)
          setSessions(prev => prev.filter(s => s.id !== sessionId))
          if (currentSessionId === sessionId) {
            startNewChat()
          }
          message.success('删除成功')
        } catch (e) {
          message.error('删除失败')
        }
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shift+Enter 发送消息，Enter 换行
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <FloatButton
        icon={<RobotOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24, width: 56, height: 56 }}
        onClick={() => setOpen(true)}
      />

      <Drawer
        title={showHistory ? '历史对话' : 'AI 助手'}
        placement="right"
        width={isMobile ? '100%' : 400}
        open={open}
        onClose={() => {
          if (showHistory) {
            // 如果在历史页面，返回对话页面
            setShowHistory(false)
          } else {
            // 如果在对话页面，关闭 Drawer
            setOpen(false)
          }
        }}
        extra={
          <Space style={{ minHeight: 32 }}>
            {!showHistory && (
              <>
                <Button
                  type="text"
                  icon={<HistoryOutlined />}
                  onClick={() => setShowHistory(true)}
                >
                  历史
                </Button>
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={startNewChat}
                >
                  新对话
                </Button>
              </>
            )}
          </Space>
        }
        styles={{
          body: {
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
        }}
      >
        {showHistory ? (
          // 历史对话列表
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {loadingSessions ? (
              <div style={{ textAlign: 'center', padding: 50 }}>
                <Spin />
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', marginTop: 100 }}>
                <HistoryOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>暂无历史对话</p>
              </div>
            ) : (
              <List
                dataSource={sessions}
                renderItem={(session) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      padding: '12px 16px',
                      borderRadius: 8,
                      marginBottom: 8,
                      background: currentSessionId === session.id ? '#f0f0f0' : 'transparent',
                    }}
                    onClick={() => loadSession(session.id)}
                    extra={
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => handleDeleteSession(session.id, e)}
                      />
                    }
                  >
                    <List.Item.Meta
                      title={session.title}
                      description={`${session.messages.length} 条消息 · ${new Date(session.createdAt).toLocaleDateString()}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        ) : (
          // 当前对话界面
          <>
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', marginTop: 100 }}>
                  <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <p>你好！我是 TODO 管理助手</p>
                  <p style={{ fontSize: 12 }}>试试说：「今天完成了 xxx」或「记录一个新任务：xxx」</p>
                </div>
              ) : (
                <List
                  dataSource={messages}
                  renderItem={(msg) => (
                    <List.Item
                      style={{
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        border: 'none',
                        padding: '8px 0',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '85%',
                          padding: '8px 12px',
                          borderRadius: 12,
                          background: msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                          color: msg.role === 'user' ? '#fff' : '#000',
                        }}
                      >
                        <Text
                          style={{
                            color: 'inherit',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {msg.content}
                        </Text>
                      </div>
                    </List.Item>
                  )}
                />
              )}
              {loading && (
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <Spin tip="思考中..." />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息... (Shift+Enter 发送)"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={loading}
                />
              </div>
            </div>
          </>
        )}
      </Drawer>
    </>
  )
}

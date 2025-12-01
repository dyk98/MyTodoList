import { useState, useRef, useEffect } from 'react'
import { FloatButton, Drawer, Input, Button, List, Typography, Spin } from 'antd'
import { RobotOutlined, SendOutlined, CloseOutlined } from '@ant-design/icons'
import { aiChat } from '@/utils/api'

const { TextArea } = Input
const { Text } = Typography

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  currentYear: number
  onRefresh: () => void
}

export function AiChatBubble({ currentYear, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const reply = await aiChat(userMessage, currentYear)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      // 如果 AI 回复中包含任务操作相关内容，刷新数据
      if (reply.includes('- [') || reply.includes('已添加') || reply.includes('已记录')) {
        onRefresh()
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${String(e)}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
        title="AI 助手"
        placement="right"
        width={400}
        open={open}
        onClose={() => setOpen(false)}
        extra={
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => setMessages([])}
          >
            清空
          </Button>
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
              placeholder="输入消息..."
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
      </Drawer>
    </>
  )
}

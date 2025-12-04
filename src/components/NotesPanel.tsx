import { useState, useEffect } from 'react'
import { Button, Modal, Input, Select, message, Spin } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import NoteCard from './NoteCard'
import { fetchNotes, createNote, updateNote, deleteNote, type Note } from '@/utils/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import './NotesPanel.css'

const { TextArea } = Input

interface NotesPanelProps {
  isDemo: boolean
  showModal: boolean
  onCloseModal: () => void
}

export default function NotesPanel({ isDemo, showModal, onCloseModal }: NotesPanelProps) {
  const isMobile = useIsMobile()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteContent, setNewNoteContent] = useState('')
  const [newNoteColor, setNewNoteColor] = useState<Note['color']>('yellow')

  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async () => {
    setLoading(true)
    try {
      const data = await fetchNotes()
      setNotes(data)
    } catch (error) {
      console.error('Failed to load notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newNoteTitle.trim()) {
      message.warning('请输入便利贴标题')
      return
    }

    setLoading(true)
    try {
      const newNote = await createNote(newNoteTitle.trim(), newNoteContent.trim(), newNoteColor)
      setNotes([...notes, newNote])
      onCloseModal()
      setNewNoteTitle('')
      setNewNoteContent('')
      setNewNoteColor('yellow')
      message.success('创建成功')
    } catch (error: any) {
      message.error(error.message || '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleModalClose = () => {
    onCloseModal()
    setNewNoteTitle('')
    setNewNoteContent('')
    setNewNoteColor('yellow')
  }

  const handleUpdate = async (id: string, updates: { title?: string; content?: string; color?: Note['color'] }) => {
    try {
      const updatedNote = await updateNote(id, updates)
      setNotes(notes.map(n => n.id === id ? updatedNote : n))
      message.success('更新成功')
    } catch (error: any) {
      message.error(error.message || '更新失败')
      throw error
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id)
      setNotes(notes.filter(n => n.id !== id))
      message.success('删除成功')
    } catch (error: any) {
      message.error(error.message || '删除失败')
      throw error
    }
  }

  if (collapsed) {
    return (
      <div className="notes-panel notes-panel-collapsed">
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={() => setCollapsed(false)}
          className="notes-panel-toggle"
          title="展开便利贴"
        />
      </div>
    )
  }

  return (
    <>
      <div className="notes-panel">
        <div className="notes-panel-toggle-container">
          <Button
            type="text"
            icon={<RightOutlined />}
            size="small"
            onClick={() => setCollapsed(true)}
            title="收起便利贴"
            className="notes-panel-collapse-btn"
          />
        </div>
        <div className="notes-panel-content">
          {loading && notes.length === 0 ? (
            <div className="notes-panel-loading">
              <Spin />
            </div>
          ) : notes.length === 0 ? (
            <div className="notes-panel-empty">
              {isDemo ? '演示账号无法使用便利贴功能' : '暂无便利贴，点击上方按钮创建'}
            </div>
          ) : (
            notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      <Modal
        title="新增便利贴"
        open={showModal}
        onOk={handleCreate}
        onCancel={handleModalClose}
        confirmLoading={loading}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>标题</div>
          <Input
            placeholder="输入便利贴标题"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            maxLength={50}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>内容</div>
          <TextArea
            placeholder="输入便利贴内容"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            maxLength={500}
            rows={4}
            style={{ resize: 'none' }}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>颜色</div>
          <Select
            value={newNoteColor}
            onChange={setNewNoteColor}
            style={{ width: '100%' }}
            options={[
              { value: 'yellow', label: '黄色' },
              { value: 'pink', label: '粉色' },
              { value: 'green', label: '绿色' },
              { value: 'blue', label: '蓝色' },
              { value: 'purple', label: '紫色' },
            ]}
          />
        </div>
      </Modal>
    </>
  )
}

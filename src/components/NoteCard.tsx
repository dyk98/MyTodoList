import { useState } from 'react'
import { Card, Input, Button, Popconfirm } from 'antd'
import { EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons'
import type { Note } from '@/utils/api'
import './NoteCard.css'

const { TextArea } = Input

interface NoteCardProps {
  note: Note
  onUpdate: (id: string, updates: { title?: string; content?: string; color?: Note['color'] }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function NoteCard({ note, onUpdate, onDelete }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title)
  const [editContent, setEditContent] = useState(note.content)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!editTitle.trim()) {
      return
    }
    setLoading(true)
    try {
      await onUpdate(note.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      })
      setIsEditing(false)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditTitle(note.title)
    setEditContent(note.content)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await onDelete(note.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      className={`note-card note-card-${note.color}`}
      size="small"
      title={
        isEditing ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="便利贴标题"
            maxLength={50}
            disabled={loading}
          />
        ) : (
          <div className="note-card-title">{note.title}</div>
        )
      }
      extra={
        isEditing ? (
          <div className="note-card-actions">
            <Button
              type="text"
              icon={<SaveOutlined />}
              size="small"
              onClick={handleSave}
              loading={loading}
            />
            <Button
              type="text"
              icon={<CloseOutlined />}
              size="small"
              onClick={handleCancel}
              disabled={loading}
            />
          </div>
        ) : (
          <div className="note-card-actions">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => setIsEditing(true)}
            />
            <Popconfirm
              title="确认删除这个便利贴？"
              onConfirm={handleDelete}
              okText="删除"
              cancelText="取消"
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                danger
              />
            </Popconfirm>
          </div>
        )
      }
    >
      {isEditing ? (
        <TextArea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          placeholder="便利贴内容"
          rows={4}
          maxLength={500}
          disabled={loading}
          style={{ resize: 'none' }}
        />
      ) : (
        <div className="note-card-content">
          {note.content || <span className="note-card-empty">暂无内容</span>}
        </div>
      )}
    </Card>
  )
}

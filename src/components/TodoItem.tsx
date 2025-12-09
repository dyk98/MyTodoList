import { useState } from 'react'
import { Checkbox, Typography, Button, Input, Popconfirm, Space, message } from 'antd'
import { HolderOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TodoItem as TodoItemType } from '@/types'

const { Text } = Typography

interface Props {
  item: TodoItemType
  onToggle: (lineIndex: number) => void
  onEdit?: (lineIndex: number, newContent: string) => Promise<void>
  onDelete?: (lineIndex: number) => Promise<void>
  onAddSubtask?: (parentLineIndex: number, task: string) => Promise<void>
  readOnly?: boolean
}

export function TodoItem({ item, onToggle, onEdit, onDelete, onAddSubtask, readOnly = false }: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(item.content)
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [subtaskValue, setSubtaskValue] = useState('')

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.lineIndex.toString() })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleSaveEdit = async () => {
    if (editValue.trim() && onEdit) {
      await onEdit(item.lineIndex, editValue.trim())
      setEditing(false)
    }
  }

  const handleCancelEdit = () => {
    setEditValue(item.content)
    setEditing(false)
  }

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(item.lineIndex)
    }
  }

  const handleAddSubtask = async () => {
    if (!subtaskValue.trim()) {
      message.warning('请输入子任务内容')
      return
    }
    if (onAddSubtask) {
      try {
        await onAddSubtask(item.lineIndex, subtaskValue.trim())
        setSubtaskValue('')
        setAddingSubtask(false)
        message.success('子任务添加成功')
      } catch (e) {
        message.error('添加失败: ' + String(e))
      }
    }
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '4px 0',
          position: 'relative',
        }}
        className="todo-item-row"
      >
        {!readOnly && (
          <HolderOutlined
            {...listeners}
            style={{
              cursor: 'grab',
              color: '#999',
              marginTop: 4,
            }}
          />
        )}
        <Checkbox
          checked={item.completed}
          onChange={() => onToggle(item.lineIndex)}
          disabled={readOnly || editing}
        />
        {editing ? (
          <Space.Compact style={{ flex: 1 }}>
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onPressEnter={handleSaveEdit}
              onKeyDown={(e) => e.key === 'Escape' && handleCancelEdit()}
              autoFocus
              size="small"
            />
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleSaveEdit} />
            <Button size="small" icon={<CloseOutlined />} onClick={handleCancelEdit} />
          </Space.Compact>
        ) : (
          <>
            <Text
              delete={item.completed}
              type={item.completed ? 'secondary' : undefined}
              style={{ flex: 1, lineHeight: '22px' }}
            >
              {item.content}
            </Text>
            {!readOnly && (
              <div className="todo-item-actions-bubble">
                <Space size={4}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setAddingSubtask(true)}
                    title="添加子任务"
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => setEditing(true)}
                  />
                  <Popconfirm
                    title="确定删除此任务？"
                    description={item.children.length > 0 ? '子任务也会一并删除' : undefined}
                    onConfirm={handleDelete}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>
                </Space>
              </div>
            )}
          </>
        )}
      </div>
      {addingSubtask && (
        <div style={{ marginLeft: 24, padding: '8px 0' }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="输入子任务内容"
              value={subtaskValue}
              onChange={(e) => setSubtaskValue(e.target.value)}
              onPressEnter={handleAddSubtask}
              onKeyDown={(e) => e.key === 'Escape' && setAddingSubtask(false)}
              autoFocus
              size="small"
            />
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleAddSubtask} />
            <Button size="small" icon={<CloseOutlined />} onClick={() => { setAddingSubtask(false); setSubtaskValue('') }} />
          </Space.Compact>
        </div>
      )}
      {item.children.length > 0 && (
        <div style={{ marginLeft: 24 }}>
          {item.children.map((child) => (
            <TodoItem
              key={child.lineIndex}
              item={child}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
      <style>{`
        .todo-item-actions-bubble {
          position: absolute;
          left: 0;
          top: -8px;
          background: white;
          border: 1px solid #d9d9d9;
          border-radius: 8px;
          padding: 4px 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s, transform 0.2s;
          transform: translateY(-4px);
          z-index: 10;
        }
        .todo-item-row:hover .todo-item-actions-bubble {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}

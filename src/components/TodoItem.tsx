import { useState } from 'react'
import { Checkbox, Typography, Button, Input, Popconfirm, Space, message, DatePicker, Tooltip } from 'antd'
import { HolderOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, PlusOutlined, CalendarOutlined } from '@ant-design/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import dayjs from 'dayjs'
import type { TodoItem as TodoItemType } from '@/types'

const { Text } = Typography

type DragDropPosition = 'before' | 'inside' | 'after'

export interface TodoItemDragHint {
  activeLineIndex: number
  overLineIndex: number
  position: DragDropPosition
  valid: boolean
}

interface Props {
  item: TodoItemType
  onToggle: (lineIndex: number) => void
  onEdit?: (lineIndex: number, newContent: string) => Promise<void>
  onDelete?: (lineIndex: number) => Promise<void>
  onAddSubtask?: (parentLineIndex: number, task: string) => Promise<void>
  onSetToday?: (lineIndex: number, date: string) => Promise<void>
  dragHint?: TodoItemDragHint | null
  readOnly?: boolean
}

export function TodoItem({ item, onToggle, onEdit, onDelete, onAddSubtask, onSetToday, dragHint, readOnly = false }: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(item.content)
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [subtaskValue, setSubtaskValue] = useState('')
  const [datePickerOpen, setDatePickerOpen] = useState(false)

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

  const isDropTarget = dragHint?.overLineIndex === item.lineIndex && dragHint.activeLineIndex !== item.lineIndex
  const dropColor = dragHint?.valid ? '#1677ff' : '#ff4d4f'

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

  const handleSetToday = async (date: dayjs.Dayjs | null) => {
    if (date && onSetToday) {
      try {
        await onSetToday(item.lineIndex, date.format('YYYY-MM-DD'))
        setDatePickerOpen(false)
        message.success('已添加到日程')
      } catch (e) {
        message.error('设置失败: ' + String(e))
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
        {isDropTarget && dragHint && (
          <>
            {(dragHint.position === 'before' || dragHint.position === 'after') && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: 2,
                  background: dropColor,
                  top: dragHint.position === 'before' ? 0 : undefined,
                  bottom: dragHint.position === 'after' ? 0 : undefined,
                  pointerEvents: 'none',
                  borderRadius: 2,
                }}
              />
            )}
            {dragHint.position === 'inside' && (
              <div
                style={{
                  position: 'absolute',
                  left: -2,
                  right: -2,
                  top: -2,
                  bottom: -2,
                  border: `1px dashed ${dropColor}`,
                  background: dragHint.valid ? 'rgba(22, 119, 255, 0.08)' : 'rgba(255, 77, 79, 0.08)',
                  borderRadius: 6,
                  pointerEvents: 'none',
                }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: -26,
                fontSize: 12,
                padding: '2px 8px',
                background: '#fff',
                border: `1px solid ${dropColor}`,
                borderRadius: 999,
                color: dropColor,
                pointerEvents: 'none',
                zIndex: 20,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}
            >
              {dragHint.valid ? (
                dragHint.position === 'before'
                  ? '松开：插入前'
                  : dragHint.position === 'after'
                    ? '松开：插入后'
                    : '松开：成为子任务'
              ) : (
                '不可放置'
              )}
            </div>
          </>
        )}
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
                  <DatePicker
                    open={datePickerOpen}
                    onOpenChange={setDatePickerOpen}
                    onChange={handleSetToday}
                    defaultValue={dayjs()}
                    style={{ width: 0, height: 0, padding: 0, border: 'none', visibility: 'hidden', position: 'absolute' }}
                  />
                  <Tooltip title="添加到日程" mouseEnterDelay={0.1}>
                    <Button
                      type="text"
                      size="small"
                      icon={<CalendarOutlined />}
                      onClick={() => setDatePickerOpen(true)}
                    />
                  </Tooltip>
                  <Tooltip title="添加子任务" mouseEnterDelay={0.1}>
                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setAddingSubtask(true)}
                    />
                  </Tooltip>
                  <Tooltip title="编辑任务" mouseEnterDelay={0.1}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => setEditing(true)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="确定删除此任务？"
                    description={item.children.length > 0 ? '子任务也会一并删除' : undefined}
                    onConfirm={handleDelete}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Tooltip title="删除任务" mouseEnterDelay={0.1}>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                      />
                    </Tooltip>
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
              onSetToday={onSetToday}
              dragHint={dragHint}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
      <style>{`
        .todo-item-actions-bubble {
          position: absolute;
          left: 40px;
          top: -36px;
          background: white;
          border: 1px solid #d9d9d9;
          border-radius: 8px;
          padding: 4px 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s, transform 0.2s;
          transform: translateY(4px);
          z-index: 10;
        }
        .todo-item-actions-bubble:hover,
        .todo-item-row:hover .todo-item-actions-bubble {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        /* 创建一个不可见的桥接区域，连接任务和气泡 */
        .todo-item-actions-bubble::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 100%;
          height: 8px;
          background: transparent;
        }
      `}</style>
    </div>
  )
}

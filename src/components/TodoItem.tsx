import { Checkbox, Typography } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TodoItem as TodoItemType } from '@/types'

const { Text } = Typography

interface Props {
  item: TodoItemType
  onToggle: (lineIndex: number) => void
}

export function TodoItem({ item, onToggle }: Props) {
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

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '4px 0',
        }}
      >
        <HolderOutlined
          {...listeners}
          style={{
            cursor: 'grab',
            color: '#999',
            marginTop: 4,
          }}
        />
        <Checkbox
          checked={item.completed}
          onChange={() => onToggle(item.lineIndex)}
        />
        <Text
          delete={item.completed}
          type={item.completed ? 'secondary' : undefined}
          style={{ flex: 1, lineHeight: '22px' }}
        >
          {item.content}
        </Text>
      </div>
      {item.children.length > 0 && (
        <div style={{ marginLeft: 24 }}>
          {item.children.map((child) => (
            <TodoItem key={child.lineIndex} item={child} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  )
}

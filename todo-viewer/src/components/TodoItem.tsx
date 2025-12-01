import { Checkbox, Typography } from 'antd'
import type { TodoItem as TodoItemType } from '@/types'

const { Text } = Typography

interface Props {
  item: TodoItemType
  onToggle: (lineIndex: number) => void
}

export function TodoItem({ item, onToggle }: Props) {
  return (
    <div style={{ marginLeft: item.indent * 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
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
      {item.children.map((child) => (
        <TodoItem key={child.lineIndex} item={child} onToggle={onToggle} />
      ))}
    </div>
  )
}

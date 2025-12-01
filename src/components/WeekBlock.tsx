import { Card, Tag, Empty } from 'antd'
import type { WeekBlock as WeekBlockType } from '@/types'
import { TodoItem } from './TodoItem'

interface Props {
  week: WeekBlockType
  onToggle: (lineIndex: number) => void
}

export function WeekBlock({ week, onToggle }: Props) {
  return (
    <Card
      title={
        <span>
          {week.title}
          {week.isCurrent && (
            <Tag color="blue" style={{ marginLeft: 8 }}>当前周</Tag>
          )}
        </span>
      }
      style={{ marginTop: 16 }}
    >
      {week.items.length === 0 ? (
        <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        week.items.map((item) => (
          <TodoItem key={item.lineIndex} item={item} onToggle={onToggle} />
        ))
      )}
    </Card>
  )
}

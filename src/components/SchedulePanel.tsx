import { useState } from 'react'
import { Button, Checkbox, Typography, DatePicker, Calendar, Badge, Empty } from 'antd'
import { LeftOutlined, RightOutlined, DownOutlined, UpOutlined, CloseOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { ScheduleTask } from '@/types'
import './SchedulePanel.css'

const { Text } = Typography

interface SchedulePanelProps {
  tasks: ScheduleTask[]
  selectedDate: string
  onDateChange: (date: string) => void
  onToggle: (lineIndex: number) => void
  onRemoveFromSchedule: (lineIndex: number, date: string) => void
  collapsed: boolean
  onCollapse: (collapsed: boolean) => void
  datesWithTasks: string[]
  isDemo: boolean
}

export default function SchedulePanel({
  tasks,
  selectedDate,
  onDateChange,
  onToggle,
  onRemoveFromSchedule,
  collapsed,
  onCollapse,
  datesWithTasks,
  isDemo,
}: SchedulePanelProps) {
  const isMobile = useIsMobile()
  const [calendarOpen, setCalendarOpen] = useState(false)

  const today = dayjs().format('YYYY-MM-DD')
  const isToday = selectedDate === today

  // 按项目分组
  const tasksByProject = tasks.reduce((acc, task) => {
    if (!acc[task.projectName]) {
      acc[task.projectName] = []
    }
    acc[task.projectName].push(task)
    return acc
  }, {} as Record<string, ScheduleTask[]>)

  // 日历单元格渲染
  const dateCellRender = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    if (datesWithTasks.includes(dateStr)) {
      return <Badge status="processing" />
    }
    return null
  }

  // 格式化日期显示
  const formatDateDisplay = (dateStr: string) => {
    const date = dayjs(dateStr)
    if (dateStr === today) {
      return `${date.format('M月D日')} (今天)`
    }
    const diff = date.diff(dayjs(), 'day')
    if (diff === 1) {
      return `${date.format('M月D日')} (明天)`
    }
    if (diff === -1) {
      return `${date.format('M月D日')} (昨天)`
    }
    return date.format('M月D日')
  }

  if (collapsed) {
    return (
      <div className="schedule-panel schedule-panel-collapsed">
        <Button
          type="text"
          icon={isMobile ? <UpOutlined /> : <RightOutlined />}
          onClick={() => onCollapse(false)}
          className="schedule-panel-toggle"
          title="展开日程"
        />
      </div>
    )
  }

  return (
    <div className="schedule-panel">
      <div className="schedule-panel-inner">
        <div className="schedule-panel-toggle-container">
          <Button
            type="text"
            icon={isMobile ? <DownOutlined /> : <LeftOutlined />}
            size="small"
            onClick={() => onCollapse(true)}
            title="收起日程"
            className="schedule-panel-collapse-btn"
          />
        </div>

        <div className="schedule-panel-header">
        <DatePicker
          value={dayjs(selectedDate)}
          onChange={(date) => {
            if (date) {
              onDateChange(date.format('YYYY-MM-DD'))
              setCalendarOpen(false)
            }
          }}
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
          format={() => formatDateDisplay(selectedDate)}
          allowClear={false}
          suffixIcon={null}
          className="schedule-date-picker"
          cellRender={(current, info) => {
            if (info.type === 'date') {
              const dateStr = (current as Dayjs).format('YYYY-MM-DD')
              const hasTasks = datesWithTasks.includes(dateStr)
              return (
                <div className="ant-picker-cell-inner">
                  {(current as Dayjs).date()}
                  {hasTasks && <span className="schedule-date-dot" />}
                </div>
              )
            }
            return info.originNode
          }}
        />
        {!isToday && (
          <Button
            type="link"
            size="small"
            onClick={() => onDateChange(today)}
            style={{ padding: '0 4px', fontSize: 12 }}
          >
            回到今天
          </Button>
        )}
      </div>

      <div className="schedule-panel-content">
        {isDemo ? (
          <div className="schedule-panel-empty">
            演示账号无法使用日程功能
          </div>
        ) : tasks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`${isToday ? '今天' : formatDateDisplay(selectedDate)}暂无任务`}
            style={{ marginTop: 40 }}
          />
        ) : (
          Object.entries(tasksByProject).map(([projectName, projectTasks]) => (
            <div key={projectName} className="schedule-project-group">
              <div className="schedule-project-name">{projectName}</div>
              {projectTasks.map((task) => (
                <div
                  key={task.item.lineIndex}
                  className="schedule-task-item"
                >
                  <Checkbox
                    checked={task.item.completed}
                    onChange={() => onToggle(task.item.lineIndex)}
                  />
                  <Text
                    delete={task.item.completed}
                    type={task.item.completed ? 'secondary' : undefined}
                    className="schedule-task-content"
                  >
                    {task.item.content}
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    className="schedule-task-remove"
                    onClick={() => onRemoveFromSchedule(task.item.lineIndex, selectedDate)}
                    title="从日程中移除"
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  )
}

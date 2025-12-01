import { Card, Collapse, Badge, Button, Input, Select, Space, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useState } from 'react'
import type { ProjectGroup } from '@/types'
import { TodoItem } from './TodoItem'

interface Props {
  projects: ProjectGroup[]
  onToggle: (lineIndex: number) => void
  onAdd: (task: string, project: string) => Promise<void>
}

export function TodoPool({ projects, onToggle, onAdd }: Props) {
  const [adding, setAdding] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('AgentDriver')

  const handleAdd = async () => {
    if (!newTask.trim()) {
      message.warning('请输入任务内容')
      return
    }
    try {
      await onAdd(newTask.trim(), selectedProject)
      setNewTask('')
      setAdding(false)
      message.success('添加成功')
    } catch (e) {
      message.error('添加失败: ' + String(e))
    }
  }

  // 计算每个项目的未完成任务数
  const countPending = (items: ProjectGroup['items']): number => {
    let count = 0
    const traverse = (list: typeof items) => {
      for (const item of list) {
        if (!item.completed) count++
        traverse(item.children)
      }
    }
    traverse(items)
    return count
  }

  const collapseItems = projects
    .filter(p => p.items.length > 0)
    .map((project) => ({
      key: project.name,
      label: (
        <Space>
          <span>{project.name}</span>
          <Badge count={countPending(project.items)} size="small" />
        </Space>
      ),
      children: (
        <div>
          {project.items.map((item) => (
            <TodoItem key={item.lineIndex} item={item} onToggle={onToggle} />
          ))}
        </div>
      ),
    }))

  return (
    <Card
      title="待办池"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={() => setAdding(true)}
        >
          新增任务
        </Button>
      }
    >
      {adding && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="输入任务内容"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onPressEnter={handleAdd}
              autoFocus
            />
            <Space>
              <Select
                value={selectedProject}
                onChange={setSelectedProject}
                style={{ width: 150 }}
                options={projects.map((p) => ({ label: p.name, value: p.name }))}
              />
              <Button type="primary" onClick={handleAdd}>确定</Button>
              <Button onClick={() => { setAdding(false); setNewTask('') }}>取消</Button>
            </Space>
          </Space>
        </div>
      )}
      <Collapse
        items={collapseItems}
        defaultActiveKey={projects.filter(p => p.items.length > 0).map(p => p.name)}
        ghost
      />
    </Card>
  )
}

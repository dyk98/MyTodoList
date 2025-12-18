import { Card, Collapse, Badge, Button, Input, Select, Space, message, Modal } from 'antd'
import { PlusOutlined, FolderAddOutlined, FileMarkdownOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ProjectGroup } from '@/types'
import { TodoItem } from './TodoItem'
import { fetchWeeks } from '@/utils/api'

interface Props {
  projects: ProjectGroup[]
  currentYear: number
  onToggle: (lineIndex: number) => void
  onAdd: (task: string, project: string, weekLineIndex?: number) => Promise<void>
  onProjectAdd: (name: string) => Promise<void>
  onReorder: (fromLineIndex: number, toLineIndex: number) => Promise<void>
  onEditMarkdown?: () => void
  onEdit?: (lineIndex: number, newContent: string) => Promise<void>
  onDelete?: (lineIndex: number) => Promise<void>
  onAddSubtask?: (parentLineIndex: number, task: string) => Promise<void>
  readOnly?: boolean
}

export function TodoPool({ projects, currentYear, onToggle, onAdd, onProjectAdd, onReorder, onEditMarkdown, onEdit, onDelete, onAddSubtask, readOnly = false }: Props) {
  const [adding, setAdding] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('pool')
  const [weekOptions, setWeekOptions] = useState<{ title: string; lineIndex: number }[]>([])

  const [addingProject, setAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  // 项目快速添加任务相关状态
  const [quickAddingProject, setQuickAddingProject] = useState<string | null>(null)
  const [quickTaskInput, setQuickTaskInput] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    fetchWeeks(currentYear).then(setWeekOptions).catch(console.error)
  }, [currentYear])

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].name)
    }
  }, [projects, selectedProject])

  const handleAdd = async () => {
    if (!newTask.trim()) {
      message.warning('请输入任务内容')
      return
    }
    if (!selectedProject) {
      message.warning('请选择分类')
      return
    }
    try {
      const weekLineIndex = selectedPeriod === 'pool' ? undefined : parseInt(selectedPeriod)
      await onAdd(newTask.trim(), selectedProject, weekLineIndex)
      setNewTask('')
      setAdding(false)
      message.success('添加成功')
    } catch (e) {
      message.error('添加失败: ' + String(e))
    }
  }

  const handleAddProject = async () => {
    if (!newProjectName.trim()) {
      message.warning('请输入分类名称')
      return
    }
    try {
      await onProjectAdd(newProjectName.trim())
      setNewProjectName('')
      setAddingProject(false)
      message.success('分类添加成功')
    } catch (e) {
      message.error('添加失败: ' + String(e))
    }
  }

  // 快速添加任务到指定项目
  const handleQuickAdd = async (projectName: string) => {
    if (!quickTaskInput.trim()) {
      message.warning('请输入任务内容')
      return
    }
    try {
      await onAdd(quickTaskInput.trim(), projectName, undefined)
      setQuickTaskInput('')
      setQuickAddingProject(null)
      message.success('添加成功')
    } catch (e) {
      message.error('添加失败: ' + String(e))
    }
  }

  // 递归收集所有任务 ID
  const collectAllIds = (items: ProjectGroup['items']): string[] => {
    const ids: string[] = []
    const traverse = (list: typeof items) => {
      for (const item of list) {
        ids.push(item.lineIndex.toString())
        traverse(item.children)
      }
    }
    traverse(items)
    return ids
  }

  // 递归查找任务
  const findItemByLineIndex = (items: ProjectGroup['items'], lineIndex: string): ProjectGroup['items'][0] | null => {
    for (const item of items) {
      if (item.lineIndex.toString() === lineIndex) return item
      const found = findItemByLineIndex(item.children, lineIndex)
      if (found) return found
    }
    return null
  }

  const handleDragEnd = async (event: DragEndEvent, projectItems: ProjectGroup['items']) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const fromItem = findItemByLineIndex(projectItems, active.id as string)
    const toItem = findItemByLineIndex(projectItems, over.id as string)

    if (!fromItem || !toItem) return

    try {
      await onReorder(fromItem.lineIndex, toItem.lineIndex)
    } catch (e) {
      message.error('排序失败: ' + String(e))
    }
  }

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
        <div className="project-header" style={{ position: 'relative' }}>
          <Space>
            <span>{project.name}</span>
            <Badge count={countPending(project.items)} size="small" />
          </Space>
          {!readOnly && (
            <div className="project-quick-add-bubble">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  setQuickAddingProject(project.name)
                }}
                title="快速添加任务"
              />
            </div>
          )}
        </div>
      ),
      children: (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(event, project.items)}
        >
          <SortableContext
            items={collectAllIds(project.items)}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ marginTop: -20, paddingLeft: 24 }}>
              {project.items.map((item) => (
                <TodoItem
                  key={item.lineIndex}
                  item={item}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddSubtask={onAddSubtask}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ),
    }))

  const periodOptions = [
    { label: '待办池', value: 'pool' },
    ...weekOptions.map(w => ({ label: w.title, value: String(w.lineIndex) })),
  ]

  return (
    <Card
      title="待办池"
      extra={
        !readOnly && (
          <Space>
            <Button
              icon={<FileMarkdownOutlined />}
              size="small"
              onClick={onEditMarkdown}
            >
              Markdown 编辑
            </Button>
            <Button
              icon={<FolderAddOutlined />}
              size="small"
              onClick={() => setAddingProject(true)}
            >
              新增分类
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => setAdding(true)}
            >
              新增任务
            </Button>
          </Space>
        )
      }
    >
      {!readOnly && adding && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="输入任务内容"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              autoFocus
            />
            <Space wrap>
              <Select
                value={selectedProject}
                onChange={setSelectedProject}
                style={{ width: 150 }}
                placeholder="选择分类"
                options={projects.map((p) => ({ label: p.name + (p.items.length === 0 ? ' (空)' : ''), value: p.name }))}
              />
              <Select
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                style={{ width: 180 }}
                options={periodOptions}
              />
              <Button type="primary" onClick={handleAdd}>确定</Button>
              <Button onClick={() => { setAdding(false); setNewTask('') }}>取消</Button>
            </Space>
          </Space>
        </div>
      )}

      {/* 快速添加任务的输入框 */}
      {!readOnly && quickAddingProject && (
        <div style={{ marginBottom: 16, padding: 12, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ marginBottom: 8, fontWeight: 500, color: '#1890ff' }}>
              快速添加到「{quickAddingProject}」
            </div>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入任务内容"
                value={quickTaskInput}
                onChange={(e) => setQuickTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setQuickAddingProject(null)}
                autoFocus
              />
              <Button type="primary" onClick={() => handleQuickAdd(quickAddingProject)}>添加</Button>
              <Button onClick={() => { setQuickAddingProject(null); setQuickTaskInput('') }}>取消</Button>
            </Space.Compact>
          </Space>
        </div>
      )}

      <Collapse
        items={collapseItems}
        defaultActiveKey={projects.filter(p => p.items.length > 0).map(p => p.name)}
        ghost
      />

      <Modal
        title="新增分类"
        open={addingProject}
        onOk={handleAddProject}
        onCancel={() => { setAddingProject(false); setNewProjectName('') }}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="输入分类名称"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          autoFocus
        />
      </Modal>

      <style>{`
        .project-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .project-quick-add-bubble {
          position: absolute;
          left: -8px;
          top: -36px;
          background: white;
          border: 1px solid #d9d9d9;
          border-radius: 8px;
          padding: 2px 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s, transform 0.2s;
          transform: translateY(4px);
          z-index: 10;
        }
        .project-quick-add-bubble:hover,
        .project-header:hover .project-quick-add-bubble {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        /* 创建一个不可见的桥接区域 */
        .project-quick-add-bubble::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 100%;
          height: 8px;
          background: transparent;
        }
      `}</style>
    </Card>
  )
}

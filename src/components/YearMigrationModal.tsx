import { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Space, Tree, Typography } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { Key } from 'react'
import type { ProjectGroup, TodoItem } from '@/types'

const { Text, Paragraph } = Typography

interface YearMigrationModalProps {
  open: boolean
  sourceYear: number
  targetYear: number
  projects: ProjectGroup[]
  confirmLoading?: boolean
  onConfirm: (selectedLineIndices: number[]) => void
  onCancel: () => void
}

function buildTaskNodes(items: TodoItem[], allKeys: Key[], taskKeys: Key[]): DataNode[] {
  return items.map(item => {
    const key = `task:${item.lineIndex}`
    allKeys.push(key)
    taskKeys.push(key)
    return {
      key,
      title: `${item.completed ? '[x]' : '[ ]'} ${item.content}`,
      children: buildTaskNodes(item.children, allKeys, taskKeys),
    }
  })
}

function buildTree(projects: ProjectGroup[]) {
  const allKeys: Key[] = []
  const taskKeys: Key[] = []
  const treeData: DataNode[] = projects.map(project => {
    const key = `project:${project.name}`
    allKeys.push(key)
    return {
      key,
      title: project.name,
      children: buildTaskNodes(project.items, allKeys, taskKeys),
    }
  })

  return { treeData, allKeys, taskKeys }
}

export function YearMigrationModal({
  open,
  sourceYear,
  targetYear,
  projects,
  confirmLoading = false,
  onConfirm,
  onCancel,
}: YearMigrationModalProps) {
  const { treeData, allKeys, taskKeys } = useMemo(() => buildTree(projects), [projects])
  const [checkedKeys, setCheckedKeys] = useState<Key[]>([])

  useEffect(() => {
    if (open) {
      setCheckedKeys(allKeys)
    }
  }, [open, allKeys])

  const handleCheck = (nextKeys: Key[] | { checked: Key[]; halfChecked: Key[] }) => {
    const keys = Array.isArray(nextKeys) ? nextKeys : nextKeys.checked
    setCheckedKeys(keys)
  }

  const handleSelectAll = () => {
    setCheckedKeys(allKeys)
  }

  const handleConfirm = () => {
    const selectedLineIndices = checkedKeys
      .map(key => String(key))
      .filter(key => key.startsWith('task:'))
      .map(key => parseInt(key.replace('task:', ''), 10))
      .filter(Number.isFinite)
    onConfirm(selectedLineIndices)
  }

  const selectedTaskCount = checkedKeys.filter(key => String(key).startsWith('task:')).length

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={`${targetYear} 年待办迁移`}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button onClick={handleSelectAll}>全选</Button>
            <Text type="secondary">已选 {selectedTaskCount}/{taskKeys.length}</Text>
          </Space>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" onClick={handleConfirm} loading={confirmLoading}>
              创建 {targetYear}
            </Button>
          </Space>
        </div>
      )}
      width={640}
    >
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        从 {sourceYear} 待办池复制到 {targetYear}，默认全选。可勾选到最细任务，父子勾选联动。
      </Paragraph>
      <Tree
        checkable
        defaultExpandAll
        treeData={treeData}
        checkedKeys={checkedKeys}
        onCheck={handleCheck}
      />
    </Modal>
  )
}

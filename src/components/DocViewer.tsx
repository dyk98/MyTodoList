import { Modal, Spin } from 'antd'
import { useState, useEffect } from 'react'
import MarkdownPreview from '@uiw/react-markdown-preview'
import { fetchDocContent } from '@/utils/api'

interface Props {
  open: boolean
  filename: string | null
  title: string
  onClose: () => void
}

export function DocViewer({ open, filename, title, onClose }: Props) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && filename) {
      setLoading(true)
      fetchDocContent(filename)
        .then(setContent)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [open, filename])

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      styles={{
        body: {
          maxHeight: '70vh',
          overflow: 'auto',
          padding: '16px 24px',
        },
      }}
    >
      {loading ? (
        <Spin style={{ display: 'block', margin: '50px auto' }} />
      ) : (
        <MarkdownPreview
          source={content}
          style={{ backgroundColor: 'transparent' }}
        />
      )}
    </Modal>
  )
}

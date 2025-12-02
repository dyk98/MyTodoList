import { useState } from 'react'
import { Modal, Form, Input, Button, Divider, message, Typography, Space } from 'antd'
import { LockOutlined, MailOutlined, CopyOutlined, LogoutOutlined } from '@ant-design/icons'
import { changePassword, generateInvite } from '@/utils/api'
import { useAuth } from '@/contexts/AuthContext'

const { Text, Paragraph } = Typography

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user, logout } = useAuth()
  const [passwordForm] = Form.useForm()
  const [inviteForm] = Form.useForm()
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    setLoadingPassword(true)
    try {
      await changePassword(values.oldPassword, values.newPassword)
      message.success('密码修改成功')
      passwordForm.resetFields()
    } catch (error) {
      message.error(String(error))
    } finally {
      setLoadingPassword(false)
    }
  }

  const handleGenerateInvite = async (values: { targetEmail: string }) => {
    setLoadingInvite(true)
    try {
      const code = await generateInvite(values.targetEmail)
      setGeneratedCode(code)
      message.success('邀请码生成成功')
    } catch (error) {
      message.error(String(error))
    } finally {
      setLoadingInvite(false)
    }
  }

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode)
      message.success('邀请码已复制到剪贴板')
    }
  }

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出登录？',
      okText: '退出',
      cancelText: '取消',
      onOk: () => {
        logout()
        onClose()
      },
    })
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="设置"
      width={480}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">当前账号：</Text>
        <Text strong>{user?.email}</Text>
      </div>

      <Divider orientation="left">修改密码</Divider>
      <Form
        form={passwordForm}
        onFinish={handleChangePassword}
        layout="vertical"
      >
        <Form.Item
          name="oldPassword"
          rules={[{ required: true, message: '请输入旧密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="旧密码"
          />
        </Form.Item>
        <Form.Item
          name="newPassword"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码至少 6 位' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="新密码"
          />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          rules={[
            { required: true, message: '请确认新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="确认新密码"
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loadingPassword}>
            修改密码
          </Button>
        </Form.Item>
      </Form>

      {user?.isAdmin && (
        <>
          <Divider orientation="left">生成邀请码</Divider>
          <Form
            form={inviteForm}
            onFinish={handleGenerateInvite}
            layout="vertical"
          >
            <Form.Item
              name="targetEmail"
              rules={[
                { required: true, message: '请输入目标邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="目标用户邮箱"
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loadingInvite}>
                生成邀请码
              </Button>
            </Form.Item>
          </Form>
          {generatedCode && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">邀请码：</Text>
              <Space>
                <Paragraph
                  copyable={{
                    text: generatedCode,
                    icon: <CopyOutlined />,
                    onCopy: handleCopyCode,
                  }}
                  style={{ margin: 0, display: 'inline' }}
                >
                  <Text code strong>{generatedCode}</Text>
                </Paragraph>
              </Space>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  请将此邀请码发送给对应邮箱的用户，邀请码只能使用一次
                </Text>
              </div>
            </div>
          )}
        </>
      )}

      <Divider />
      <Button
        danger
        icon={<LogoutOutlined />}
        onClick={handleLogout}
      >
        退出登录
      </Button>
    </Modal>
  )
}

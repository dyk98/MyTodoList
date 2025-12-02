import { useState } from 'react'
import { Modal, Form, Input, Button, Tabs, message } from 'antd'
import { LockOutlined, MailOutlined, KeyOutlined } from '@ant-design/icons'
import { login, register } from '@/utils/api'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      await login(values.email, values.password)
      message.success('登录成功')
      onClose()
      loginForm.resetFields()
      // 等待一小段时间确保 localStorage 写入完成，然后刷新页面
      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (error) {
      message.error(String(error))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values: { email: string; password: string; confirmPassword: string; inviteCode: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      await register(values.email, values.password, values.inviteCode)
      message.success('注册成功')
      onClose()
      registerForm.resetFields()
      // 等待一小段时间确保 localStorage 写入完成，然后刷新页面
      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (error) {
      message.error(String(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={null}
      width={400}
      centered
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'login' | 'register')}
        centered
        items={[
          {
            key: 'login',
            label: '登录',
            children: (
              <Form
                form={loginForm}
                onFinish={handleLogin}
                layout="vertical"
                style={{ marginTop: 16 }}
              >
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: '请输入邮箱' },
                    { type: 'email', message: '邮箱格式不正确' },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="邮箱"
                    size="large"
                  />
                </Form.Item>
                <Form.Item
                  name="password"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="密码"
                    size="large"
                  />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    size="large"
                  >
                    登录
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'register',
            label: '注册',
            children: (
              <Form
                form={registerForm}
                onFinish={handleRegister}
                layout="vertical"
                style={{ marginTop: 16 }}
              >
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: '请输入邮箱' },
                    { type: 'email', message: '邮箱格式不正确' },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="邮箱"
                    size="large"
                  />
                </Form.Item>
                <Form.Item
                  name="password"
                  rules={[
                    { required: true, message: '请输入密码' },
                    { min: 6, message: '密码至少 6 位' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="密码"
                    size="large"
                  />
                </Form.Item>
                <Form.Item
                  name="confirmPassword"
                  rules={[
                    { required: true, message: '请确认密码' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('两次输入的密码不一致'))
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="确认密码"
                    size="large"
                  />
                </Form.Item>
                <Form.Item
                  name="inviteCode"
                  rules={[{ required: true, message: '请输入邀请码' }]}
                >
                  <Input
                    prefix={<KeyOutlined />}
                    placeholder="邀请码"
                    size="large"
                  />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    size="large"
                  >
                    注册
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
    </Modal>
  )
}

import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Typography, message, Card } from 'antd'
import { LockOutlined, MailOutlined, CrownOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import superAdminApi from '../../lib/superAdminApi'

const { Title, Text } = Typography

export default function SuperAdminLogin() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('superadmin_token')
    if (token) {
      superAdminApi.get('/me')
        .then((res) => {
          if (res.data?.isSuperAdmin) navigate('/super-admin', { replace: true })
          else localStorage.removeItem('superadmin_token')
        })
        .catch(() => localStorage.removeItem('superadmin_token'))
    }
  }, [navigate])

  const onFinish = async ({ email, password }) => {
    setLoading(true)
    try {
      const res = await superAdminApi.post('/login', { email, password })
      if (!res.data?.user?.isSuperAdmin) {
        message.error('Acesso negado. Conta sem permissão de super administrador.')
        return
      }
      localStorage.setItem('superadmin_token', res.data.token)
      navigate('/super-admin', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || 'Email ou senha incorretos.'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
    }}>
      <Card style={{ width: 380, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <CrownOutlined style={{ fontSize: 40, color: '#6366f1' }} />
          <Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>Super Admin</Title>
          <Text type="secondary">Painel de gerenciamento SaaS</Text>
        </div>

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="email"
            rules={[{ required: true, type: 'email', message: 'E-mail válido obrigatório' }]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#999' }} />}
              placeholder="E-mail"
              size="large"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Senha obrigatória' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#999' }} />}
              placeholder="Senha"
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              style={{ background: '#6366f1', borderColor: '#6366f1' }}
            >
              Entrar
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

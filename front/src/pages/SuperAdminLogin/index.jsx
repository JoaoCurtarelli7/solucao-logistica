import React, { useState, useEffect } from 'react'
import { Form, Input, message } from 'antd'
import { LockOutlined, MailOutlined, CrownOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import superAdminApi from '../../lib/superAdminApi'
import './styles.css'

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
    <div className="sal-root">
      <div className="sal-grid" />

      <div className="sal-orb sal-orb--1" />
      <div className="sal-orb sal-orb--2" />
      <div className="sal-orb sal-orb--3" />

      <div className="sal-topbar">
        <span className="sal-topbar__dot" />
        <span className="sal-topbar__text">SECURE · SUPER ADMIN PORTAL · RESTRICTED ACCESS</span>
      </div>

      <div className="sal-bracket sal-bracket--tl" />
      <div className="sal-bracket sal-bracket--tr" />
      <div className="sal-bracket sal-bracket--bl" />
      <div className="sal-bracket sal-bracket--br" />

      <div className="sal-card">
        <div className="sal-card__bracket sal-card__bracket--tl" />
        <div className="sal-card__bracket sal-card__bracket--tr" />
        <div className="sal-card__bracket sal-card__bracket--bl" />
        <div className="sal-card__bracket sal-card__bracket--br" />

        <div className="sal-crown">
          <div className="sal-crown__rings">
            <div className="sal-crown__ring sal-crown__ring--1" />
            <div className="sal-crown__ring sal-crown__ring--2" />
            <div className="sal-crown__ring sal-crown__ring--3" />
          </div>
          <div className="sal-crown__icon">
            <CrownOutlined />
          </div>
        </div>

        <div className="sal-header">
          <div className="sal-header__badge">Super Admin</div>
          <h1 className="sal-header__title">Painel SaaS</h1>
          <p className="sal-header__sub">Acesso restrito · Gerenciamento de tenants</p>
        </div>

        <Form
          className="sal-form"
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label={<span className="sal-label">E-mail</span>}
            rules={[{ required: true, type: 'email', message: 'E-mail válido obrigatório' }]}
          >
            <Input
              prefix={<MailOutlined className="sal-input-icon" />}
              placeholder="admin@empresa.com"
              autoComplete="email"
              className="sal-input"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span className="sal-label">Senha</span>}
            rules={[{ required: true, message: 'Senha obrigatória' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="sal-input-icon" />}
              placeholder="••••••••"
              autoComplete="current-password"
              className="sal-input"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <button
              type="submit"
              className={`sal-btn${loading ? ' sal-btn--loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="sal-btn__spinner" />
                  Autenticando...
                </>
              ) : (
                <>
                  <LockOutlined />
                  Acessar painel
                </>
              )}
            </button>
          </Form.Item>
        </Form>

        <div className="sal-footer">
          <span className="sal-footer__dot sal-footer__dot--green" />
          Sistema seguro · Acesso monitorado
        </div>
      </div>
    </div>
  )
}

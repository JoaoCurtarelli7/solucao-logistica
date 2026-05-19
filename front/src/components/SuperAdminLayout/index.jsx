import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Layout, Button, Typography, Space, Avatar, Dropdown, message } from 'antd'
import { CrownOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import superAdminApi from '../../lib/superAdminApi'

const { Header, Content } = Layout
const { Text } = Typography

export default function SuperAdminLayout() {
  const [adminUser, setAdminUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('superadmin_token')
    if (!token) {
      navigate('/super-admin/login', { replace: true })
      return
    }
    superAdminApi.get('/me')
      .then((res) => {
        if (!res.data?.isSuperAdmin) {
          localStorage.removeItem('superadmin_token')
          navigate('/super-admin/login', { replace: true })
        } else {
          setAdminUser(res.data)
        }
      })
      .catch(() => navigate('/super-admin/login', { replace: true }))
  }, [navigate])

  const logout = () => {
    localStorage.removeItem('superadmin_token')
    message.success('Logout realizado')
    navigate('/super-admin/login', { replace: true })
  }

  const menuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sair',
      onClick: logout,
      danger: true,
    },
  ]

  if (!adminUser) return null

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Space>
          <CrownOutlined style={{ color: '#6366f1', fontSize: 22 }} />
          <Text strong style={{ color: '#fff', fontSize: 16 }}>Super Admin</Text>
        </Space>

        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} style={{ background: '#6366f1' }} />
            <Text style={{ color: '#e2e8f0' }}>{adminUser.name}</Text>
          </Space>
        </Dropdown>
      </Header>

      <Content style={{ padding: '0' }}>
        <Outlet />
      </Content>
    </Layout>
  )
}

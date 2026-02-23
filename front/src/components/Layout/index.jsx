import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MenuOutlined } from '@ant-design/icons'
import AppSidebar from '../SideBar'
import './styles.css'

export default function AppLayout() {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="layout">
      {!isLoginPage ? (
        <>
          <button
            type="button"
            className="layout-mobile-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <MenuOutlined />
          </button>
          <div
            className={`layout-backdrop ${sidebarOpen ? 'layout-backdrop-open' : ''}`}
            onClick={() => setSidebarOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
            role="button"
            tabIndex={0}
            aria-label="Fechar menu"
          />
          <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="layout-content">
            <Outlet />
          </div>
        </>
      ) : (
        <Outlet />
      )}
    </div>
  )
}

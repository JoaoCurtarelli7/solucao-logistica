import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "antd";
import {
  HomeOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
  UserOutlined,
  ShopOutlined,
  PrinterOutlined,
  CalculatorOutlined,
  SafetyOutlined,
  CloseOutlined,
  ToolOutlined,
  CalendarOutlined,
  SettingOutlined,
  LogoutOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useUserContext } from "../../context/userContext";
import { usePermission } from "../../hooks/usePermission";
import "./styles.css";

export default function AppSidebar({ open = false, onClose }) {
  const { user: userContext, logout } = useUserContext();
  const { hasPermission } = usePermission();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  const menuItems = [
    {
      key: "/",
      icon: <HomeOutlined />,
      label: <Link to="/">Dashboard</Link>,
    },
    {
      key: "gestao",
      icon: <TeamOutlined />,
      label: "Gestão",
      children: [
        ...(hasPermission("users.manage")
          ? [
              {
                key: "/users-permissions",
                icon: <SafetyOutlined />,
                label: (
                  <Link to="/users-permissions">Usuários &amp; Permissões</Link>
                ),
              },
            ]
          : []),
        ...(hasPermission("closings.view")
          ? [
              {
                key: "/closings",
                icon: <CalculatorOutlined />,
                label: <Link to="/closings">Fechamento de Caixa</Link>,
              },
              {
                key: "/load-billing-closings",
                icon: <CalculatorOutlined />,
                label: (
                  <Link to="/load-billing-closings">Fechamento de Cargas</Link>
                ),
              },
            ]
          : []),
        ...(hasPermission("employees.view")
          ? [
              {
                key: "/employee",
                icon: <UserOutlined />,
                label: <Link to="/employee">Funcionários</Link>,
              },
            ]
          : []),
        ...(hasPermission("companies.view")
          ? [
              {
                key: "/companies",
                icon: <ShopOutlined />,
                label: <Link to="/companies">Empresas</Link>,
              },
            ]
          : []),
      ].filter(Boolean),
    },
    {
      key: "operacoes",
      icon: <TruckOutlined />,
      label: "Operações",
      children: [
        ...(hasPermission("loads.view")
          ? [
              {
                key: "/load",
                icon: <ShoppingCartOutlined />,
                label: <Link to="/load">Cargas / Pedidos</Link>,
              },
            ]
          : []),
        ...(hasPermission("maintenance.view") || hasPermission("trucks.view")
          ? [
              {
                key: "/vehicle-maintenance",
                icon: <TruckOutlined />,
                label: <Link to="/vehicle-maintenance">Frota</Link>,
              },
            ]
          : []),
      ].filter(Boolean),
    },
    {
      key: "manutencao",
      icon: <ToolOutlined />,
      label: "Manutenção",
      children: [
        ...(hasPermission("months.view")
          ? [
              {
                key: "/maintenance/months",
                icon: <CalendarOutlined />,
                label: (
                  <Link to="/maintenance/months">Cadastro de Meses</Link>
                ),
              },
            ]
          : []),
        ...(hasPermission("maintenance.view")
          ? [
              {
                key: "/maintenance/services",
                icon: <SettingOutlined />,
                label: (
                  <Link to="/maintenance/services">
                    Cadastro de Serviços
                  </Link>
                ),
              },
            ]
          : []),
      ].filter(Boolean),
    },
    ...(hasPermission("reports.view")
      ? [
          {
            key: "/reports",
            icon: <PrinterOutlined />,
            label: <Link to="/reports">Relatórios</Link>,
          },
        ]
      : []),
  ].filter((item) => {
    if (item.children && Array.isArray(item.children)) {
      return item.children.length > 0;
    }
    return true;
  });

  return (
    <div className={`sidebar ${open ? "sidebar-open" : ""}`}>
      {/* ── Header ── */}
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Fechar menu"
        >
          <CloseOutlined />
        </button>

        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <TruckOutlined />
          </div>
          <div>
            <span className="sidebar-eyebrow">Gestão operacional</span>
            <p className="sidebar-brand-name">Solução Logística</p>
          </div>
        </div>

        <div className="sidebar-user-row">
          <div className="sidebar-user-avatar">
            <UserOutlined />
          </div>
          <span className="sidebar-user-name">
            {userContext?.name || "Usuário"}
          </span>
        </div>
      </div>

      {/* ── Menu ── */}
      <div className="sidebar-menu">
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={["gestao", "operacoes", "manutencao"]}
          items={menuItems}
          onClick={onClose}
        />
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <Link to="/user-profile" className="footer-link" onClick={onClose}>
          <UserOutlined />
          Meu Perfil
        </Link>
        <button onClick={handleLogout} className="logout-btn">
          <LogoutOutlined />
          Sair
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Spin,
  Alert,
  Button,
  Space,
} from "antd";
import {
  TeamOutlined,
  BankOutlined,
  CarOutlined,
  DollarOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  CompassOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/dashboard");
      setDashboardData(response.data);
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
      setError("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "20px" }}>Carregando dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Erro ao carregar dashboard"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={loadDashboardData}>
            Tentar Novamente
          </Button>
        }
      />
    );
  }

  if (!dashboardData) {
    return (
      <Alert
        message="Nenhum dado disponível"
        description="Não foi possível carregar os dados do dashboard."
        type="warning"
        showIcon
      />
    );
  }

  const { summary } = dashboardData;

  // Função para formatar valores monetários
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const employeeActivePercentage =
    summary.totalEmployees > 0
      ? Math.round((summary.activeEmployees / summary.totalEmployees) * 100)
      : 0;

  const companyActivePercentage =
    summary.totalCompanies > 0
      ? Math.round((summary.activeCompanies / summary.totalCompanies) * 100)
      : 0;

  const totalOverview = [
    {
      key: "employees",
      title: "Funcionários",
      value: summary.totalEmployees,
      detail: `${summary.activeEmployees} ativos`,
      icon: <TeamOutlined style={{ color: "#1677ff" }} />,
      accent: "#1677ff",
    },
    {
      key: "companies",
      title: "Empresas",
      value: summary.totalCompanies,
      detail: `${summary.activeCompanies} ativas`,
      icon: <BankOutlined style={{ color: "#16a34a" }} />,
      accent: "#16a34a",
    },
    {
      key: "loads",
      title: "Cargas",
      value: summary.totalLoads,
      detail: "Registradas",
      icon: <FileTextOutlined style={{ color: "#f59e0b" }} />,
      accent: "#f59e0b",
    },
    {
      key: "trucks",
      title: "Caminhões",
      value: summary.totalTrucks,
      detail: "Frota cadastrada",
      icon: <CarOutlined style={{ color: "#7c3aed" }} />,
      accent: "#7c3aed",
    },
    {
      key: "trips",
      title: "Viagens",
      value: summary.totalTrips ?? 0,
      detail: `${summary.activeTrips ?? 0} em andamento`,
      icon: <CompassOutlined style={{ color: "#0891b2" }} />,
      accent: "#0891b2",
    },
    {
      key: "maintenance",
      title: "Manutenção (30d)",
      value: formatCurrency(summary.maintenanceCost ?? 0),
      detail: "Custo últimos 30 dias",
      icon: <ToolOutlined style={{ color: "#dc2626" }} />,
      accent: "#dc2626",
      isText: true,
    },
  ];

  const financialCards = [
    {
      key: "credits",
      title: "Total entradas",
      value: formatCurrency(summary.totalCredits ?? 0),
      helper: "Todas as entradas financeiras",
      accent: "#16a34a",
      icon: <RiseOutlined />,
    },
    {
      key: "debits",
      title: "Total saídas",
      value: formatCurrency(summary.totalDebits ?? 0),
      helper: "Saídas + impostos",
      accent: "#dc2626",
      icon: <FallOutlined />,
    },
    {
      key: "balance",
      title: "Saldo",
      value: formatCurrency(summary.balance ?? 0),
      helper: "Entradas − Saídas",
      accent: (summary.balance ?? 0) >= 0 ? "#16a34a" : "#dc2626",
      icon: <DollarOutlined />,
    },
    {
      key: "salary",
      title: "Folha mensal",
      value: formatCurrency(summary.totalSalaries),
      helper: `${summary.activeEmployees} funcionários ativos`,
      accent: "#1677ff",
      icon: <TeamOutlined />,
    },
  ];

  const quickActions = [
    {
      key: "employee",
      label: "Adicionar funcionário",
      icon: <PlusOutlined />,
      type: "primary",
      path: "/employee",
    },
    {
      key: "companies",
      label: "Gerenciar empresas",
      icon: <BankOutlined />,
      path: "/companies",
    },
    {
      key: "load",
      label: "Nova carga",
      icon: <FileTextOutlined />,
      path: "/load",
    },
    {
      key: "maintenance",
      label: "Manutenções",
      icon: <CarOutlined />,
      path: "/vehicle-maintenance",
    },
  ];

  const sectionCardStyle = {
    borderRadius: 20,
    border: "1px solid #e6edf7",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  };

  const statCardStyle = {
    ...sectionCardStyle,
    height: "100%",
  };

  return (
    <div
      style={{
        padding: "20px 24px",
        background: "#f5f7fa",
        minHeight: "100vh",
      }}
    >
      <Row align="middle" justify="space-between" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: "#101828" }}>
            Dashboard
          </Title>
          <Text style={{ color: "#667085" }}>
            {dayjs().format("DD/MM/YYYY HH:mm")}
          </Text>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadDashboardData}
          >
            Atualizar
          </Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {totalOverview.map((item) => (
          <Col xs={24} sm={12} xl={4} key={item.key}>
            <Card style={statCardStyle} bodyStyle={{ padding: 16 }}>
              <Space align="start" style={{ width: "100%", justifyContent: "space-between" }}>
                <div>
                  <Text style={{ color: "#667085", fontSize: 13 }}>{item.title}</Text>
                  <Title level={4} style={{ margin: "4px 0 2px", color: "#101828", fontSize: item.isText ? 16 : undefined }}>
                    {item.value}
                  </Title>
                  <Text style={{ color: "#98a2b3", fontSize: 12 }}>{item.detail}</Text>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.accent}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {item.icon}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} xl={14}>
          <Card title="Financeiro — últimos 6 meses" style={sectionCardStyle} bodyStyle={{ padding: 16 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dashboardData.charts?.monthlyData ?? []} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="credits" name="Entradas" fill="#52c41a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="debits" name="Saídas" fill="#ff4d4f" radius={[3, 3, 0, 0]} />
                <Bar dataKey="maintenance" name="Manutenção" fill="#faad14" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title="Resumo financeiro" style={sectionCardStyle} bodyStyle={{ padding: 16 }}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {financialCards.map((item) => (
                <div key={item.key} style={{ border: "1px solid #edf2f7", borderRadius: 12, padding: "12px 16px", background: "#fbfdff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <Text style={{ color: "#667085", display: "block", fontSize: 12 }}>{item.title}</Text>
                    <Text strong style={{ fontSize: 18, color: item.accent, lineHeight: 1.3 }}>{item.value}</Text>
                    <Text style={{ color: "#98a2b3", fontSize: 11, display: "block" }}>{item.helper}</Text>
                  </div>
                  <div style={{ color: item.accent, fontSize: 20 }}>{item.icon}</div>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Ações rápidas" style={sectionCardStyle} bodyStyle={{ padding: 16 }}>
            <Row gutter={[12, 12]}>
              {quickActions.map((action) => (
                <Col xs={24} sm={12} md={6} key={action.key}>
                  <Button type={action.type || "default"} icon={action.icon} onClick={() => navigate(action.path)} size="large" style={{ width: "100%", borderRadius: 12, height: 46, justifyContent: "flex-start" }}>
                    {action.label}
                  </Button>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

    </div>
  );
}

import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Spin,
  Alert,
  Button,
  Space,
  Tag,
  Progress,
} from "antd";
import {
  TeamOutlined,
  BankOutlined,
  CarOutlined,
  DollarOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;

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
      progress: employeeActivePercentage,
    },
    {
      key: "companies",
      title: "Empresas",
      value: summary.totalCompanies,
      detail: `${summary.activeCompanies} ativas`,
      icon: <BankOutlined style={{ color: "#16a34a" }} />,
      accent: "#16a34a",
      progress: companyActivePercentage,
    },
    {
      key: "loads",
      title: "Cargas",
      value: summary.totalLoads,
      detail: "Cargas registradas",
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
  ];

  const financialCards = [
    {
      key: "salary",
      title: "Folha mensal",
      value: formatCurrency(summary.totalSalaries),
      helper: `${summary.activeEmployees} funcionários em atividade`,
      accent: "#16a34a",
    },
    {
      key: "system",
      title: "Custo operacional",
      value: formatCurrency(summary.totalSalaries),
      helper: "Baseado na folha salarial atual",
      accent: "#1677ff",
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
        padding: "24px",
        background: "linear-gradient(180deg, #f6f9fc 0%, #eef3f9 100%)",
        minHeight: "100vh",
      }}
    >
      <Card
        style={{
          ...sectionCardStyle,
          marginBottom: 24,
          background:
            "linear-gradient(135deg, #0f3d8f 0%, #1677ff 55%, #69b1ff 100%)",
          color: "#fff",
          overflow: "hidden",
        }}
        bodyStyle={{ padding: 24 }}
      >
        <Row gutter={[20, 20]} align="middle" justify="space-between">
          <Col xs={24} lg={16}>
            <Text
              style={{
                color: "rgba(255,255,255,0.78)",
                display: "block",
                marginBottom: 8,
              }}
            >
              Painel executivo
            </Text>
            <Title level={2} style={{ color: "#fff", margin: 0 }}>
              Dashboard do Sistema
            </Title>
            <Paragraph
              style={{
                color: "rgba(255,255,255,0.88)",
                margin: "10px 0 0",
                maxWidth: 560,
              }}
            >
              Visão clara da operação com os principais indicadores e atalhos
              para as áreas mais usadas.
            </Paragraph>
          </Col>
          <Col xs={24} lg={8}>
            <div
              style={{
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 18,
                padding: 18,
              }}
            >
              <Space direction="vertical" size={6} style={{ width: "100%" }}>
                <Text style={{ color: "rgba(255,255,255,0.78)" }}>
                  Atualização
                </Text>
                <Text strong style={{ color: "#fff", fontSize: 18 }}>
                  {dayjs().format("DD/MM/YYYY HH:mm")}
                </Text>
                <Tag
                  color="processing"
                  style={{
                    width: "fit-content",
                    borderRadius: 999,
                    paddingInline: 10,
                    fontWeight: 600,
                  }}
                >
                  Sistema operacional
                </Tag>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[18, 18]} style={{ marginBottom: 24 }}>
        {totalOverview.map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.key}>
            <Card style={statCardStyle} bodyStyle={{ padding: 20 }}>
              <Space
                align="start"
                style={{ width: "100%", justifyContent: "space-between" }}
              >
                <div>
                  <Text style={{ color: "#667085", fontSize: 13 }}>
                    {item.title}
                  </Text>
                  <Title
                    level={3}
                    style={{ margin: "8px 0 4px", color: "#101828" }}
                  >
                    {item.value}
                  </Title>
                  <Text style={{ color: "#667085" }}>{item.detail}</Text>
                </div>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: `${item.accent}14`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
              </Space>

              {typeof item.progress === "number" && (
                <div style={{ marginTop: 16 }}>
                  <Progress
                    percent={item.progress}
                    size="small"
                    strokeColor={item.accent}
                    showInfo={false}
                  />
                  <Text style={{ color: "#98a2b3", fontSize: 12 }}>
                    {item.progress}% da base ativa
                  </Text>
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[18, 18]} style={{ marginBottom: 24 }}>
        <Col xs={24} xl={14}>
          <Card
            title="Ações rápidas"
            extra={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={loadDashboardData}
              >
                Atualizar
              </Button>
            }
            style={sectionCardStyle}
            bodyStyle={{ padding: 20 }}
          >
            <Row gutter={[12, 12]}>
              {quickActions.map((action) => (
                <Col xs={24} sm={12} key={action.key}>
                  <Button
                    type={action.type || "default"}
                    icon={action.icon}
                    onClick={() => navigate(action.path)}
                    size="large"
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      height: 46,
                      justifyContent: "flex-start",
                    }}
                  >
                    {action.label}
                  </Button>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card
            title="Resumo da operação"
            style={sectionCardStyle}
            bodyStyle={{ padding: 20 }}
          >
            <Space direction="vertical" size={18} style={{ width: "100%" }}>
              {financialCards.map((item) => (
                <div
                  key={item.key}
                  style={{
                    border: "1px solid #edf2f7",
                    borderRadius: 16,
                    padding: 16,
                    background: "#fbfdff",
                  }}
                >
                  <Text
                    style={{
                      color: "#667085",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    strong
                    style={{
                      display: "block",
                      fontSize: 24,
                      color: item.accent,
                      lineHeight: 1.2,
                    }}
                  >
                    {item.value}
                  </Text>
                  <Text style={{ color: "#98a2b3" }}>{item.helper}</Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[18, 18]}>
        <Col xs={24} lg={14}>
          <Card style={sectionCardStyle} bodyStyle={{ padding: 22 }}>
            <Space align="start" size={14}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "#e8f1ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowUpOutlined style={{ color: "#1677ff" }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, color: "#101828" }}>
                  Operação estável
                </Title>
                <Paragraph style={{ color: "#667085", margin: "8px 0 0" }}>
                  O sistema está pronto para uso diário, com acesso rápido aos
                  principais cadastros e visão resumida da operação.
                </Paragraph>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card style={sectionCardStyle} bodyStyle={{ padding: 22 }}>
            <Space align="start" size={14}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "#ecfdf3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarOutlined style={{ color: "#16a34a" }} />
              </div>
              <div>
                <Text
                  style={{
                    color: "#667085",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Última atualização
                </Text>
                <Text strong style={{ color: "#101828", fontSize: 18 }}>
                  {dayjs().format("DD/MM/YYYY HH:mm")}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

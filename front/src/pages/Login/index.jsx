import React, { useState } from "react";
import { Card, Button, Input, Form, Typography, message } from "antd";
import {
  LockOutlined,
  MailOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  LoginOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  TruckOutlined,
  CheckOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import "./styles.css";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../lib";
import { useUserContext } from "../../context/userContext";

const { Title, Text } = Typography;

export default function LoginAndRegister() {
  const [loginForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useUserContext();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const res = await api.post("/login", values);
      localStorage.setItem("token", res.data.token);
      if (res.data.user && setUser) {
        setUser(res.data.user);
      }
      message.success({
        content: "Login realizado com sucesso! Bem-vindo de volta! 🎉",
        icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
        duration: 3,
      });
      navigate("/");
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Erro desconhecido";
      if (err.response?.status === 401) {
        message.error({
          content:
            "Credenciais inválidas. Por favor, verifique seu e-mail e senha.",
          icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
          duration: 4,
        });
      } else {
        message.error({
          content: `Erro ao fazer login: ${errorMessage}`,
          icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
          duration: 4,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <aside className="login-brand fade-in" aria-hidden={false}>
          <div className="login-brand__glow login-brand__glow--1" aria-hidden />
          <div className="login-brand__glow login-brand__glow--2" aria-hidden />
          <div className="login-brand__glow login-brand__glow--3" aria-hidden />
          <div className="login-brand__grid" aria-hidden />
          <div className="login-brand__inner">
            <div className="login-brand__mark">
              <TruckOutlined className="login-brand__mark-icon" aria-hidden />
            </div>
            <p className="login-brand__eyebrow">Gestão operacional</p>
            <Title level={1} className="login-brand__title">
              Solução Logística
            </Title>
            <Text className="login-brand__lead">
              Controle frota, financeiro e fechamentos em uma plataforma segura,
              pensada para operações que não podem parar.
            </Text>
            <ul className="login-brand__features">
              <li>
                <span className="login-brand__feature-icon">
                  <LineChartOutlined aria-hidden />
                </span>
                <span>Indicadores e fechamentos com rastreabilidade</span>
              </li>
              <li>
                <span className="login-brand__feature-icon">
                  <SafetyCertificateOutlined aria-hidden />
                </span>
                <span>Acesso por perfil e permissões granulares</span>
              </li>
              <li>
                <span className="login-brand__feature-icon">
                  <CheckOutlined aria-hidden />
                </span>
                <span>Fluxos integrados de cargas, viagens e manutenção</span>
              </li>
            </ul>
            <div className="login-brand__stats" aria-hidden>
              <div className="login-brand__stat-card">
                <span className="login-brand__stat-value">100%</span>
                <span className="login-brand__stat-label">Online</span>
              </div>
              <div className="login-brand__stat-card">
                <span className="login-brand__stat-value">Multi</span>
                <span className="login-brand__stat-label">Empresas</span>
              </div>
              <div className="login-brand__stat-card">
                <span className="login-brand__stat-value">Seguro</span>
                <span className="login-brand__stat-label">JWT + RBAC</span>
              </div>
            </div>
            <p className="login-brand__footnote">
              © {new Date().getFullYear()} · Ambiente corporativo
            </p>
          </div>
        </aside>

        <main className="login-main fade-in">
          <Card className="login-card" bordered={false}>
            <div className="login-card__header">
              <div className="login-card__logo-row">
                <div className="login-card__logo-mark">
                  <TruckOutlined aria-hidden />
                </div>
                <div>
                  <Title level={4} className="login-card__title">
                    Acessar o sistema
                  </Title>
                  <Text type="secondary" className="login-card__subtitle">
                    Entre com o e-mail e a senha
                  </Text>
                </div>
              </div>
            </div>

            <div className="login-tab-panel">
              <Form
                form={loginForm}
                onFinish={handleLogin}
                layout="vertical"
                className="login-form"
              >
                <Form.Item
                  name="email"
                  label="E-mail"
                  rules={[
                    {
                      required: true,
                      message: "Por favor, insira seu e-mail!",
                    },
                    {
                      type: "email",
                      message: "Por favor, insira um e-mail válido!",
                    },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined className="input-icon" />}
                    placeholder="E-mail"
                    size="large"
                    className="custom-input"
                    autoComplete="email"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Senha"
                  rules={[
                    {
                      required: true,
                      message: "Por favor, insira sua senha!",
                    },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined className="input-icon" />}
                    placeholder="Senha"
                    size="large"
                    className="custom-input"
                    autoComplete="current-password"
                    iconRender={(visible) =>
                      visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                    }
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    size="large"
                    className="submit-button"
                    icon={<LoginOutlined />}
                  >
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </Form.Item>
              </Form>
            </div>

            <div style={{ textAlign: "center", marginTop: 16, paddingBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Ainda não tem acesso?{" "}
                <Link to="/solicitar-acesso" style={{ fontWeight: 500 }}>
                  Solicitar acesso ao sistema
                </Link>
              </Text>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Card, Tabs, Button, Input, Form, Typography, message, Spin } from "antd";
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  LoginOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import "./styles.css";
import loginImage from "../../components/assets/login.jpg";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib";
import { useUserContext } from "../../context/userContext";

const { Title, Text } = Typography;

export default function LoginAndRegister() {
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [firstUserSetup, setFirstUserSetup] = useState(false);
  const [activeTab, setActiveTab] = useState("1");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const navigate = useNavigate();
  const { setUser } = useUserContext();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/auth/bootstrap-status");
        if (!cancelled) {
          setFirstUserSetup(Boolean(res.data?.firstUserSetup));
        }
      } catch {
        if (!cancelled) setFirstUserSetup(false);
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll(".fade-in");
    elements.forEach((el, index) => {
      setTimeout(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, index * 100);
    });
  }, []);

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const handlePasswordChange = (e) => {
    const password = e.target.value;
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return "#ff4d4f";
    if (passwordStrength <= 3) return "#faad14";
    if (passwordStrength <= 4) return "#52c41a";
    return "#1890ff";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 2) return "Fraca";
    if (passwordStrength <= 3) return "Média";
    if (passwordStrength <= 4) return "Forte";
    return "Muito Forte";
  };

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

  const handleFirstAdminRegister = async (values) => {
    setLoading(true);
    try {
      await api.post("/register", {
        name: values.name,
        email: values.email,
        password: values.password,
      });
      const loginRes = await api.post("/login", {
        email: values.email,
        password: values.password,
      });
      localStorage.setItem("token", loginRes.data.token);
      if (setUser && loginRes.data.user) setUser(loginRes.data.user);
      setFirstUserSetup(false);
      message.success({
        content:
          "Primeiro administrador criado! Você já está logado.",
        icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
        duration: 4,
      });
      registerForm.resetFields();
      setPasswordStrength(0);
      navigate("/");
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || "Erro ao criar administrador.";
      if (err.response?.data?.errors) {
        err.response.data.errors.forEach((error) => {
          if (error.path.includes("password")) {
            registerForm.setFields([
              {
                name: "password",
                errors: [error.message],
              },
            ]);
          }
        });
      } else {
        message.error({
          content: errorMessage,
          icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
          duration: 4,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    setPasswordStrength(0);
  };

  useEffect(() => {
    if (!firstUserSetup) setActiveTab("1");
  }, [firstUserSetup]);

  const loginTab = {
    key: "1",
    label: (
      <span className="tab-label">
        <LoginOutlined />
        Login
      </span>
    ),
    children: (
      <div className="tab-content fade-in">
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
              placeholder="seu@email.com"
              size="large"
              className="custom-input"
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
              placeholder="Sua senha"
              size="large"
              className="custom-input"
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
          {!firstUserSetup && (
            <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
              Novas contas são criadas pelo administrador em Usuários e
              permissões.
            </Text>
          )}
        </Form>
      </div>
    ),
  };

  const firstAccessTab = {
    key: "2",
    label: (
      <span className="tab-label">
        <UserAddOutlined />
        Primeiro acesso
      </span>
    ),
    children: (
      <div className="tab-content fade-in">
        <Text type="warning" style={{ display: "block", marginBottom: 16 }}>
          Nenhum usuário cadastrado ainda. Crie o administrador que poderá
          adicionar demais usuários no sistema.
        </Text>
        <Form
        form={registerForm}
        onFinish={handleFirstAdminRegister}
        layout="vertical"
        className="register-form"
      >
        <Form.Item
          name="name"
          label="Nome Completo"
          rules={[
            {
              required: true,
              message: "Por favor, insira seu nome completo!",
            },
          ]}
        >
          <Input
            prefix={<UserOutlined className="input-icon" />}
            placeholder="Seu nome completo"
            size="large"
            className="custom-input"
          />
        </Form.Item>

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
            placeholder="seu@email.com"
            size="large"
            className="custom-input"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Senha"
          rules={[
            {
              required: true,
              message: "Por favor, insira uma senha!",
            },
            {
              min: 6,
              message: "A senha deve ter pelo menos 6 caracteres!",
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className="input-icon" />}
            placeholder="Sua senha"
            size="large"
            className="custom-input"
            onChange={handlePasswordChange}
            iconRender={(visible) =>
              visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
            }
          />
        </Form.Item>

        {passwordStrength > 0 && (
          <div className="password-strength">
            <Text className="strength-label">Força da senha:</Text>
            <div className="strength-bar">
              <div
                className="strength-fill"
                style={{
                  width: `${(passwordStrength / 5) * 100}%`,
                  backgroundColor: getPasswordStrengthColor(),
                }}
              ></div>
            </div>
            <Text
              className="strength-text"
              style={{ color: getPasswordStrengthColor() }}
            >
              {getPasswordStrengthText()}
            </Text>
          </div>
        )}

        <Form.Item
          name="confirmPassword"
          label="Confirmar Senha"
          dependencies={["password"]}
          rules={[
            {
              required: true,
              message: "Por favor, confirme sua senha!",
            },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("As senhas não coincidem!"));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className="input-icon" />}
            placeholder="Confirme sua senha"
            size="large"
            className="custom-input"
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
            icon={<UserAddOutlined />}
            block
          >
            {loading ? "Criando..." : "Criar primeiro administrador"}
          </Button>
        </Form.Item>
      </Form>
      </div>
    ),
  };

  const tabItems = firstUserSetup ? [loginTab, firstAccessTab] : [loginTab];

  return (
    <div className="login-container">
      <div className="animated-background"></div>

      <div className="left-section fade-in">
        <div className="image-overlay">
          <div className="welcome-text">
            <Title level={1} className="welcome-title">
              Bem-vindo à Solução Logística
            </Title>
            <Text className="welcome-subtitle">
              Gerencie seus veículos e operações de forma eficiente
            </Text>
          </div>
        </div>
        <div
          className="background-image"
          style={{ backgroundImage: `url(${loginImage})` }}
        ></div>
      </div>

      <div className="right-section fade-in">
        <Card className="login-card" bordered={false}>
          <div className="card-header">
            <div className="logo-container">
              <div className="logo-icon">🚛</div>
              <Title level={2} className="app-title">
                Solução Logística
              </Title>
            </div>
            <Text className="app-subtitle">
              {firstUserSetup
                ? "Crie o primeiro administrador ou faça login"
                : "Faça login para continuar"}
            </Text>
          </div>

          {bootstrapLoading ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <Spin size="large" />
            </div>
          ) : (
            <Tabs
              defaultActiveKey="1"
              centered
              activeKey={tabItems.length === 1 ? "1" : activeTab}
              onChange={handleTabChange}
              className="custom-tabs"
              items={tabItems}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

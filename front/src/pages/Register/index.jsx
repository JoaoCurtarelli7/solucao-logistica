import React, { useState } from "react";
import { Form, Input, Button, Card, Typography } from "antd";
import {
  UserOutlined,
  LockOutlined,
  ShopOutlined,
  MailOutlined,
  TruckOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import "./styles.css";

const { Title, Text } = Typography;

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      await api.post("/public/register", {
        name: values.name,
        email: values.email,
        password: values.password,
        tenantName: values.tenantName,
        cnpj: values.cnpj || null,
      });
      setSuccess(true);
    } catch (err) {
      const msg = err?.response?.data?.message || "Erro ao enviar solicitação";
      form.setFields([{ name: "email", errors: [msg] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        {/* Brand panel */}
        <aside className="reg-brand reg-fade-in" aria-hidden={false}>
          <div className="reg-brand__glow reg-brand__glow--1" aria-hidden />
          <div className="reg-brand__glow reg-brand__glow--2" aria-hidden />
          <div className="reg-brand__grid" aria-hidden />
          <div className="reg-brand__inner">
            <div className="reg-brand__mark">
              <TruckOutlined className="reg-brand__mark-icon" aria-hidden />
            </div>
            <p className="reg-brand__eyebrow">Gestão operacional</p>
            <Title level={1} className="reg-brand__title">
              Comece a usar o sistema
            </Title>
            <Text className="reg-brand__lead">
              Preencha o formulário ao lado para solicitar acesso. O administrador
              irá revisar e liberar sua conta em breve.
            </Text>
            <ol className="reg-brand__steps">
              <li>
                <span className="reg-brand__step-num">1</span>
                <span>Preencha os dados da empresa e do responsável</span>
              </li>
              <li>
                <span className="reg-brand__step-num">2</span>
                <span>Envie a solicitação — sem custo inicial</span>
              </li>
              <li>
                <span className="reg-brand__step-num">3</span>
                <span>Aguarde a aprovação e acesse o sistema completo</span>
              </li>
            </ol>
            <p className="reg-brand__footnote">
              © {new Date().getFullYear()} · Ambiente corporativo
            </p>
          </div>
        </aside>

        {/* Form panel */}
        <main className="reg-main reg-fade-in">
          <Card className="reg-card" bordered={false}>
            {success ? (
              <div className="reg-success">
                <div className="reg-success__icon">
                  <CheckCircleFilled />
                </div>
                <Title level={3} className="reg-success__title">
                  Solicitação enviada!
                </Title>
                <Text className="reg-success__sub">
                  Seus dados foram recebidos. O administrador irá analisar e você
                  receberá acesso em breve.
                </Text>
                <Link to="/login">
                  <Button type="primary" size="large" className="reg-submit-btn" block>
                    Voltar ao Login
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="reg-card__header">
                  <div className="reg-card__logo-mark">
                    <FileTextOutlined aria-hidden />
                  </div>
                  <div>
                    <Title level={4} className="reg-card__title">
                      Solicitar acesso
                    </Title>
                    <Text type="secondary" className="reg-card__subtitle">
                      Preencha os dados para criar sua conta
                    </Text>
                  </div>
                </div>

                <Form form={form} layout="vertical" onFinish={handleSubmit} size="large">
                  <p className="reg-section-label">
                    <ShopOutlined /> Dados da empresa
                  </p>

                  <Form.Item
                    name="tenantName"
                    label="Nome da empresa"
                    rules={[{ required: true, message: "Informe o nome da empresa" }]}
                  >
                    <Input
                      prefix={<ShopOutlined className="reg-input-icon" />}
                      placeholder="Ex: Transportadora Exemplo Ltda"
                      className="reg-input"
                    />
                  </Form.Item>

                  <Form.Item name="cnpj" label="CNPJ (opcional)">
                    <Input
                      prefix={<FileTextOutlined className="reg-input-icon" />}
                      placeholder="00.000.000/0001-00"
                      className="reg-input"
                    />
                  </Form.Item>

                  <p className="reg-section-label">
                    <UserOutlined /> Dados do responsável
                  </p>

                  <Form.Item
                    name="name"
                    label="Seu nome"
                    rules={[{ required: true, message: "Informe seu nome" }]}
                  >
                    <Input
                      prefix={<UserOutlined className="reg-input-icon" />}
                      placeholder="Nome completo"
                      className="reg-input"
                    />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label="E-mail"
                    rules={[
                      { required: true, message: "Informe seu e-mail" },
                      { type: "email", message: "E-mail inválido" },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined className="reg-input-icon" />}
                      placeholder="email@empresa.com"
                      className="reg-input"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Senha"
                    rules={[
                      { required: true, message: "Informe uma senha" },
                      { min: 6, message: "Mínimo 6 caracteres" },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined className="reg-input-icon" />}
                      placeholder="Mínimo 6 caracteres"
                      className="reg-input"
                    />
                  </Form.Item>

                  <Form.Item
                    name="confirmPassword"
                    label="Confirmar senha"
                    dependencies={["password"]}
                    rules={[
                      { required: true, message: "Confirme sua senha" },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("password") === value)
                            return Promise.resolve();
                          return Promise.reject(new Error("As senhas não coincidem"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined className="reg-input-icon" />}
                      placeholder="Repita a senha"
                      className="reg-input"
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    className="reg-submit-btn"
                    icon={<SendOutlined />}
                  >
                    {loading ? "Enviando..." : "Enviar solicitação"}
                  </Button>
                </Form>

                <div className="reg-footer">
                  <Text type="secondary">Já tem acesso? </Text>
                  <Link to="/login" style={{ fontWeight: 500 }}>
                    Fazer login
                  </Link>
                </div>
              </>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

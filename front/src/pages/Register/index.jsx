import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Result, Divider } from "antd";
import {
  UserOutlined,
  LockOutlined,
  ShopOutlined,
  MailOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import api from "../../lib/api";

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

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5" }}>
        <Card style={{ maxWidth: 480, width: "100%", borderRadius: 12 }}>
          <Result
            status="success"
            title="Solicitação enviada!"
            subTitle="Sua solicitação foi recebida. O administrador irá analisar e você receberá acesso em breve."
            extra={[
              <Link to="/login" key="login">
                <Button type="primary">Voltar ao Login</Button>
              </Link>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5" }}>
      <Card style={{ maxWidth: 480, width: "100%", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, color: "#1890ff", marginBottom: 8 }}>
            <TruckOutlined />
          </div>
          <Title level={3} style={{ margin: 0 }}>Solicitar Acesso</Title>
          <Text type="secondary">Preencha os dados para solicitar acesso ao sistema</Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit} size="large">
          <Divider orientation="left" plain style={{ fontSize: 13, color: "#888" }}>Dados da Empresa</Divider>

          <Form.Item
            name="tenantName"
            label="Nome da Empresa"
            rules={[{ required: true, message: "Informe o nome da empresa" }]}
          >
            <Input prefix={<ShopOutlined />} placeholder="Ex: Transportadora Exemplo Ltda" />
          </Form.Item>

          <Form.Item name="cnpj" label="CNPJ (opcional)">
            <Input prefix={<ShopOutlined />} placeholder="00.000.000/0001-00" />
          </Form.Item>

          <Divider orientation="left" plain style={{ fontSize: 13, color: "#888" }}>Dados do Responsável</Divider>

          <Form.Item
            name="name"
            label="Seu Nome"
            rules={[{ required: true, message: "Informe seu nome" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Nome completo" />
          </Form.Item>

          <Form.Item
            name="email"
            label="E-mail"
            rules={[
              { required: true, message: "Informe seu e-mail" },
              { type: "email", message: "E-mail inválido" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="email@empresa.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Senha"
            rules={[
              { required: true, message: "Informe uma senha" },
              { min: 6, message: "Mínimo 6 caracteres" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Mínimo 6 caracteres" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirmar Senha"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Confirme sua senha" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject(new Error("As senhas não coincidem"));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Repita a senha" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block style={{ marginTop: 8 }}>
            Enviar Solicitação
          </Button>
        </Form>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Text type="secondary">Já tem acesso? </Text>
          <Link to="/login">Fazer login</Link>
        </div>
      </Card>
    </div>
  );
}

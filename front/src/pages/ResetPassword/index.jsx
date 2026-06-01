import React, { useState, useEffect } from "react";
import { Card, Button, Input, Form, Typography, message, Result, Spin } from "antd";
import { LockOutlined, TruckOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../lib";

const { Title, Text } = Typography;

export default function ResetPassword() {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  useEffect(() => {
    if (!token) setTokenError(true);
  }, [token]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password: values.password });
      setDone(true);
    } catch (err) {
      const msg = err.response?.data?.message || "Erro ao redefinir senha.";
      if (err.response?.status === 400) {
        setTokenError(true);
      } else {
        message.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (tokenError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4fa" }}>
        <Result
          status="error"
          title="Link inválido ou expirado"
          subTitle="Este link de redefinição não é válido ou já expirou (validade: 15 minutos). Solicite um novo link na tela de login."
          extra={<Button type="primary" onClick={() => navigate("/login")}>Voltar ao login</Button>}
        />
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4fa" }}>
        <Result
          status="success"
          title="Senha redefinida com sucesso!"
          subTitle="Você já pode fazer login com sua nova senha."
          extra={<Button type="primary" onClick={() => navigate("/login")}>Ir para o login</Button>}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4fa" }}>
      <Card style={{ width: 420, borderRadius: 16, boxShadow: "0 20px 60px rgba(15,23,42,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(37,99,235,0.1)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <TruckOutlined style={{ fontSize: 24, color: "#2563eb" }} />
          </div>
          <Title level={4} style={{ margin: 0 }}>Criar nova senha</Title>
          <Text type="secondary">Digite e confirme sua nova senha</Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="password"
            label="Nova senha"
            rules={[
              { required: true, message: "Senha obrigatória" },
              { min: 6, message: "Mínimo 6 caracteres" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mínimo 6 caracteres"
              size="large"
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirmar nova senha"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Confirmação obrigatória" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject(new Error("As senhas não coincidem"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Repita a nova senha"
              size="large"
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ borderRadius: 10 }}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

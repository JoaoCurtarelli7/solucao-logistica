import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Input,
  Button,
  Typography,
  message,
  Divider,
  Statistic,
  Space,
  Alert,
  Spin,
  Tag,
  Avatar,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  CalendarOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  LockOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useUserContext } from "../../context/userContext";
import api from "../../lib/api";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;

function getRoleDisplayName(role) {
  if (role == null || role === "") return "Usuário";
  if (typeof role === "object" && role !== null && "name" in role) {
    return role.name ?? "Usuário";
  }
  return String(role);
}

export default function UserProfile() {
  const { user, setUser, loading: userLoading, refreshUser } = useUserContext();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [userStats, setUserStats] = useState(null);

  // Carregar dados do usuário se não estiver carregado
  useEffect(() => {
    if (!user && !userLoading) {
      refreshUser();
    }
  }, [user, userLoading, refreshUser]);

  // Carregar dados do usuário
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
      });
    }
  }, [user, form]);

  // Carregar estatísticas do usuário
  useEffect(() => {
    if (user) {
      loadUserStats();
    }
  }, [user]);

  const loadUserStats = async () => {
    try {
      const response = await api.get("/me/stats");
      setUserStats(response.data);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    form.setFieldsValue({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    form.resetFields();
  };

  const handleSave = async (values) => {
    try {
      setLoading(true);
      const response = await api.put("/me", values);

      // Atualizar dados do usuário no contexto
      setUser(response.data.user);

      message.success(
        response.data.message || "Perfil atualizado com sucesso!",
      );
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error("Erro ao atualizar perfil. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (values) => {
    try {
      setPasswordLoading(true);
      const response = await api.patch("/me/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      message.success(response.data.message || "Senha alterada com sucesso!");
      passwordForm.resetFields();
      setIsChangingPassword(false);
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error("Erro ao alterar senha. Tente novamente.");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Não informado";
    return dayjs(dateString).format("DD/MM/YYYY HH:mm");
  };

  const getInitials = (name) =>
    String(name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  const sectionCardStyle = {
    borderRadius: "18px",
    border: "1px solid #e5eef9",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  };

  const infoCardStyle = {
    height: "100%",
    borderRadius: "14px",
    border: "1px solid #e7edf5",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
  };

  const profileInfoItems = [
    {
      key: "name",
      label: "Nome completo",
      value: user?.name || "Não informado",
      icon: <UserOutlined style={{ color: "#1677ff" }} />,
    },
    {
      key: "email",
      label: "E-mail",
      value: user?.email || "Não informado",
      icon: <MailOutlined style={{ color: "#1677ff" }} />,
    },
    {
      key: "phone",
      label: "Telefone",
      value: user?.phone || "Não informado",
      icon: <PhoneOutlined style={{ color: "#1677ff" }} />,
    },
    {
      key: "address",
      label: "Endereço",
      value: user?.address || "Não informado",
      icon: <HomeOutlined style={{ color: "#1677ff" }} />,
    },
  ];

  if (userLoading || !user) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "20px" }}>Carregando perfil...</div>
      </div>
    );
  }

  const roleLabel = getRoleDisplayName(user.role);

  return (
    <div
      style={{
        padding: "24px",
        background: "linear-gradient(180deg, #f6f9fc 0%, #eef4fb 100%)",
        minHeight: "100vh",
      }}
    >
      <Card
        style={{
          ...sectionCardStyle,
          marginBottom: "24px",
          background:
            "linear-gradient(135deg, #0f3d8f 0%, #1677ff 55%, #69b1ff 100%)",
          color: "#fff",
          overflow: "hidden",
        }}
        bodyStyle={{ padding: 24 }}
      >
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={16}>
            <Space size={16} align="start">
              <Avatar
                size={72}
                style={{
                  background: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  fontSize: 26,
                  fontWeight: 700,
                  border: "2px solid rgba(255,255,255,0.35)",
                }}
              >
                {getInitials(user.name)}
              </Avatar>
              <div>
                <Text
                  style={{ color: "rgba(255,255,255,0.78)", display: "block" }}
                >
                  Área do usuário
                </Text>
                <Title level={2} style={{ color: "#fff", margin: "4px 0 8px" }}>
                  Meu Perfil
                </Title>
                <Paragraph
                  style={{ color: "rgba(255,255,255,0.88)", marginBottom: 0 }}
                >
                  Gerencie seus dados pessoais, acompanhe informações da conta e
                  mantenha sua segurança em dia.
                </Paragraph>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <div
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 16,
                padding: 16,
                backdropFilter: "blur(6px)",
              }}
            >
              <Space direction="vertical" size={6}>
                <Text style={{ color: "rgba(255,255,255,0.8)" }}>Conta</Text>
                <Text strong style={{ color: "#fff", fontSize: 18 }}>
                  {user.name}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.88)",
                    wordBreak: "break-word",
                  }}
                >
                  {user.email}
                </Text>
                <Space wrap style={{ marginTop: 8 }}>
                  <Tag color="success" style={{ borderRadius: 999 }}>
                    Ativo
                  </Tag>
                  <Tag color="processing" style={{ borderRadius: 999 }}>
                    {roleLabel}
                  </Tag>
                </Space>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <UserOutlined />
                <span>Informações do Perfil</span>
              </Space>
            }
            extra={
              !isEditing && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                >
                  Editar Perfil
                </Button>
              )
            }
            style={sectionCardStyle}
          >
            {isEditing ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                initialValues={{
                  name: user.name,
                  email: user.email,
                  phone: user.phone || "",
                  address: user.address || "",
                }}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Nome Completo"
                      name="name"
                      rules={[
                        {
                          required: true,
                          message: "Por favor, insira seu nome!",
                        },
                        {
                          min: 2,
                          message: "Nome deve ter pelo menos 2 caracteres!",
                        },
                      ]}
                    >
                      <Input
                        prefix={<UserOutlined />}
                        placeholder="Seu nome completo"
                        size="large"
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        {
                          required: true,
                          message: "Por favor, insira seu email!",
                        },
                        { type: "email", message: "Insira um email válido!" },
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined />}
                        placeholder="E-mail"
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Telefone" name="phone">
                      <Input
                        prefix={<PhoneOutlined />}
                        placeholder="(11) 99999-9999"
                        size="large"
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} sm={12}>
                    <Form.Item label="Endereço" name="address">
                      <Input
                        prefix={<HomeOutlined />}
                        placeholder="Seu endereço completo"
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider />

                <Row gutter={[16, 16]}>
                  <Col>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SaveOutlined />}
                      loading={loading}
                      size="large"
                      style={{ borderRadius: "8px" }}
                    >
                      Salvar Alterações
                    </Button>
                  </Col>
                  <Col>
                    <Button
                      onClick={handleCancel}
                      icon={<CloseOutlined />}
                      size="large"
                      style={{ borderRadius: "8px" }}
                    >
                      Cancelar
                    </Button>
                  </Col>
                </Row>
              </Form>
            ) : (
              <div>
                <Row gutter={[16, 16]}>
                  {profileInfoItems.map((item) => (
                    <Col xs={24} sm={12} key={item.key}>
                      <Card bodyStyle={{ padding: 18 }} style={infoCardStyle}>
                        <Space
                          align="start"
                          size={14}
                          style={{ width: "100%" }}
                        >
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 12,
                              background: "#eef4ff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {item.icon}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Text
                              style={{
                                display: "block",
                                fontSize: 13,
                                color: "#667085",
                                marginBottom: 4,
                              }}
                            >
                              {item.label}
                            </Text>
                            <Text
                              strong
                              style={{
                                display: "block",
                                fontSize: 16,
                                color: "#101828",
                                lineHeight: 1.45,
                                wordBreak: "break-word",
                              }}
                            >
                              {item.value}
                            </Text>
                          </div>
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>

                <Divider style={{ margin: "20px 0" }} />

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Membro desde"
                      value={formatDate(user.createdAt)}
                      prefix={<CalendarOutlined />}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Status"
                      value="Ativo"
                      valueStyle={{ color: "#52c41a" }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Tipo de Conta"
                      value={roleLabel}
                      valueStyle={{ color: "#1890ff" }}
                      prefix={<UserOutlined />}
                    />
                  </Col>
                </Row>
              </div>
            )}
          </Card>
        </Col>

        {/* Alterar Senha */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <LockOutlined />
                <span>Segurança</span>
              </Space>
            }
            style={sectionCardStyle}
          >
            {isChangingPassword ? (
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handleChangePassword}
              >
                <Form.Item
                  label="Senha Atual"
                  name="currentPassword"
                  rules={[
                    {
                      required: true,
                      message: "Por favor, insira sua senha atual!",
                    },
                  ]}
                >
                  <Input.Password placeholder="Sua senha atual" size="large" />
                </Form.Item>

                <Form.Item
                  label="Nova Senha"
                  name="newPassword"
                  rules={[
                    {
                      required: true,
                      message: "Por favor, insira a nova senha!",
                    },
                    {
                      min: 6,
                      message: "A senha deve ter pelo menos 6 caracteres!",
                    },
                  ]}
                >
                  <Input.Password placeholder="Nova senha" size="large" />
                </Form.Item>

                <Form.Item
                  label="Confirmar Nova Senha"
                  name="confirmPassword"
                  dependencies={["newPassword"]}
                  rules={[
                    {
                      required: true,
                      message: "Por favor, confirme a nova senha!",
                    },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue("newPassword") === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(
                          new Error("As senhas não correspondem!"),
                        );
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    placeholder="Confirme a nova senha"
                    size="large"
                  />
                </Form.Item>

                <Row gutter={[16, 16]}>
                  <Col>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={passwordLoading}
                      size="large"
                      style={{ borderRadius: "8px" }}
                    >
                      Alterar Senha
                    </Button>
                  </Col>
                  <Col>
                    <Button
                      onClick={() => setIsChangingPassword(false)}
                      size="large"
                      style={{ borderRadius: "8px" }}
                    >
                      Cancelar
                    </Button>
                  </Col>
                </Row>
              </Form>
            ) : (
              <div>
                <Alert
                  message="Segurança da Conta"
                  description="Mantenha sua senha segura e única. Recomendamos alterá-la regularmente."
                  type="info"
                  showIcon
                  style={{ marginBottom: "20px" }}
                />

                <Button
                  type="primary"
                  icon={<LockOutlined />}
                  onClick={() => setIsChangingPassword(true)}
                  size="large"
                  style={{ borderRadius: "8px", width: "100%" }}
                >
                  Alterar Senha
                </Button>
              </div>
            )}
          </Card>

          {/* Estatísticas do Usuário */}
          {userStats && (
            <Card
              title={
                <Space>
                  <InfoCircleOutlined />
                  <span>Estatísticas</span>
                </Space>
              }
              style={{
                ...sectionCardStyle,
                marginTop: "24px",
              }}
            >
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Último Login"
                    value={formatDate(userStats.lastLogin)}
                    valueStyle={{ fontSize: "14px" }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Perfil Atualizado"
                    value={userStats.profileUpdated ? "Sim" : "Não"}
                    valueStyle={{
                      fontSize: "14px",
                      color: userStats.profileUpdated ? "#52c41a" : "#ff4d4f",
                    }}
                  />
                </Col>
              </Row>
            </Card>
          )}
        </Col>
      </Row>

      {/* Informações Adicionais */}
      <Row style={{ marginTop: "24px" }}>
        <Col span={24}>
          <Card title="Informações do Sistema" style={sectionCardStyle}>
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={8}>
                <Tag
                  color="blue"
                  icon={<UserOutlined />}
                  style={{ borderRadius: 999, padding: "4px 10px" }}
                >
                  ID do Usuário: {user.id}
                </Tag>
              </Col>
              <Col xs={24} sm={8}>
                <Tag
                  color="green"
                  icon={<CalendarOutlined />}
                  style={{ borderRadius: 999, padding: "4px 10px" }}
                >
                  Criado em: {formatDate(user.createdAt)}
                </Tag>
              </Col>
              <Col xs={24} sm={8}>
                <Tag
                  color="orange"
                  icon={<CheckCircleOutlined />}
                  style={{ borderRadius: 999, padding: "4px 10px" }}
                >
                  Status: Ativo
                </Tag>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

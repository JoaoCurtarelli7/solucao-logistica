import React, { useEffect, useState, useCallback } from "react";
import {
  Table, Card, Typography, Tag, Button, Space, Statistic, Row, Col,
  Modal, message, Tooltip, Badge, Input, Select, Popconfirm,
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  StopOutlined, TeamOutlined, SearchOutlined, ReloadOutlined,
  UserOutlined, EyeOutlined, PauseCircleOutlined, PlayCircleOutlined,
} from "@ant-design/icons";
import api from "../../lib/api";
import { useUserContext } from "../../context/userContext";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;
const { Search } = Input;

const STATUS_LABELS = {
  active:   { text: "Ativo",      color: "success", icon: <CheckCircleOutlined /> },
  pending:  { text: "Pendente",   color: "warning", icon: <ClockCircleOutlined /> },
  inactive: { text: "Inativo",    color: "default", icon: <StopOutlined /> },
  rejected: { text: "Rejeitado",  color: "error",   icon: <CloseCircleOutlined /> },
};

export default function AdminPanel() {
  const { user } = useUserContext();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usersModal, setUsersModal] = useState({ open: false, tenant: null, users: [], loading: false });
  const [actionLoading, setActionLoading] = useState({});

  // Redirecionar se não for super admin
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate("/");
    }
  }, [user, navigate]);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/tenants");
      setTenants(res.data);
    } catch {
      message.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const handleApprove = async (tenant) => {
    setActionLoading((p) => ({ ...p, [tenant.id]: true }));
    try {
      await api.patch(`/tenants/${tenant.id}/approve`);
      message.success(`${tenant.name} aprovado com sucesso!`);
      fetchTenants();
    } catch {
      message.error("Erro ao aprovar");
    } finally {
      setActionLoading((p) => ({ ...p, [tenant.id]: false }));
    }
  };

  const handleReject = async (tenant) => {
    setActionLoading((p) => ({ ...p, [tenant.id]: true }));
    try {
      await api.patch(`/tenants/${tenant.id}/reject`);
      message.success(`${tenant.name} rejeitado`);
      fetchTenants();
    } catch {
      message.error("Erro ao rejeitar");
    } finally {
      setActionLoading((p) => ({ ...p, [tenant.id]: false }));
    }
  };

  const handleToggleStatus = async (tenant) => {
    const newStatus = tenant.status === "active" ? "inactive" : "active";
    setActionLoading((p) => ({ ...p, [tenant.id]: true }));
    try {
      await api.patch(`/tenants/${tenant.id}/status`, { status: newStatus });
      message.success(`Cliente ${newStatus === "active" ? "ativado" : "desativado"}`);
      fetchTenants();
    } catch {
      message.error("Erro ao alterar status");
    } finally {
      setActionLoading((p) => ({ ...p, [tenant.id]: false }));
    }
  };

  const openUsers = async (tenant) => {
    setUsersModal({ open: true, tenant, users: [], loading: true });
    try {
      const res = await api.get(`/tenants/${tenant.id}/users`);
      setUsersModal((p) => ({ ...p, users: res.data, loading: false }));
    } catch {
      setUsersModal((p) => ({ ...p, loading: false }));
      message.error("Erro ao carregar usuários");
    }
  };

  const stats = {
    total:    tenants.length,
    active:   tenants.filter((t) => t.status === "active").length,
    pending:  tenants.filter((t) => t.status === "pending").length,
    inactive: tenants.filter((t) => t.status === "inactive").length,
  };

  const filtered = tenants.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.cnpj?.includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const columns = [
    {
      title: "Empresa",
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          {record.cnpj && <><br /><Text type="secondary" style={{ fontSize: 12 }}>{record.cnpj}</Text></>}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => {
        const s = STATUS_LABELS[status] || { text: status, color: "default" };
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
      },
    },
    {
      title: "Usuários",
      key: "users",
      width: 90,
      render: (_, record) => (
        <Text>{record._count?.User ?? 0}</Text>
      ),
    },
    {
      title: "Empresas",
      key: "companies",
      width: 90,
      render: (_, record) => (
        <Text>{record._count?.Company ?? 0}</Text>
      ),
    },
    {
      title: "Cadastro",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (d) => new Date(d).toLocaleDateString("pt-BR"),
    },
    {
      title: "Ações",
      key: "actions",
      width: 200,
      render: (_, record) => {
        const busy = actionLoading[record.id];
        return (
          <Space size={4}>
            {record.status === "pending" && (
              <>
                <Tooltip title="Aprovar">
                  <Popconfirm
                    title={`Aprovar "${record.name}"?`}
                    onConfirm={() => handleApprove(record)}
                    okText="Sim"
                    cancelText="Não"
                  >
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      loading={busy}
                    >
                      Aprovar
                    </Button>
                  </Popconfirm>
                </Tooltip>
                <Tooltip title="Rejeitar">
                  <Popconfirm
                    title={`Rejeitar "${record.name}"?`}
                    onConfirm={() => handleReject(record)}
                    okText="Sim"
                    cancelText="Não"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger size="small" icon={<CloseCircleOutlined />} loading={busy}>
                      Rejeitar
                    </Button>
                  </Popconfirm>
                </Tooltip>
              </>
            )}

            {(record.status === "active" || record.status === "inactive") && (
              <Tooltip title={record.status === "active" ? "Desativar" : "Reativar"}>
                <Popconfirm
                  title={`${record.status === "active" ? "Desativar" : "Reativar"} "${record.name}"?`}
                  onConfirm={() => handleToggleStatus(record)}
                  okText="Sim"
                  cancelText="Não"
                >
                  <Button
                    size="small"
                    icon={record.status === "active" ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    loading={busy}
                  >
                    {record.status === "active" ? "Desativar" : "Reativar"}
                  </Button>
                </Popconfirm>
              </Tooltip>
            )}

            <Tooltip title="Ver usuários">
              <Button size="small" icon={<EyeOutlined />} onClick={() => openUsers(record)} />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Painel Administrativo</Title>
          <Text type="secondary">Gerenciamento de clientes e acessos</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchTenants} loading={loading}>
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: "#f0f5ff" }}>
            <Statistic title="Total de Clientes" value={stats.total} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: "#f6ffed" }}>
            <Statistic title="Ativos" value={stats.active} valueStyle={{ color: "#52c41a" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: "#fffbe6" }}>
            <Badge count={stats.pending} offset={[8, -4]}>
              <Statistic title="Aguardando Aprovação" value={stats.pending} valueStyle={{ color: "#faad14" }} prefix={<ClockCircleOutlined />} />
            </Badge>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: "#f5f5f5" }}>
            <Statistic title="Inativos" value={stats.inactive} valueStyle={{ color: "#999" }} prefix={<StopOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Filtros */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Search
            placeholder="Buscar por nome ou CNPJ"
            allowClear
            style={{ width: 260 }}
            prefix={<SearchOutlined />}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: "all", label: "Todos os status" },
              { value: "pending", label: "Pendentes" },
              { value: "active", label: "Ativos" },
              { value: "inactive", label: "Inativos" },
              { value: "rejected", label: "Rejeitados" },
            ]}
          />
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          locale={{ emptyText: "Nenhum cliente encontrado" }}
        />
      </Card>

      {/* Modal de usuários */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            Usuários — {usersModal.tenant?.name}
          </Space>
        }
        open={usersModal.open}
        onCancel={() => setUsersModal({ open: false, tenant: null, users: [], loading: false })}
        footer={null}
        width={600}
      >
        <Table
          dataSource={usersModal.users}
          loading={usersModal.loading}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: "Nome", dataIndex: "name", key: "name" },
            { title: "E-mail", dataIndex: "email", key: "email" },
            {
              title: "Status",
              dataIndex: "status",
              key: "status",
              render: (s) => <Tag color={s === "active" ? "success" : "default"}>{s === "active" ? "Ativo" : "Inativo"}</Tag>,
            },
            {
              title: "Perfil",
              key: "role",
              render: (_, r) => r.role?.name ?? "—",
            },
          ]}
        />
      </Modal>
    </div>
  );
}

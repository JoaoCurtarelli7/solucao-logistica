import React, { useEffect, useState, useCallback } from "react";
import {
  Table, Card, Typography, Tag, Button, Space, Statistic, Row, Col,
  Modal, message, Tooltip, Badge, Input, Select, Popconfirm, Alert, List,
  Tabs, Form, InputNumber, Divider,
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  StopOutlined, TeamOutlined, SearchOutlined, ReloadOutlined,
  UserOutlined, EyeOutlined, PauseCircleOutlined, PlayCircleOutlined,
  CrownOutlined, ExperimentOutlined, CalendarOutlined, RiseOutlined,
  WarningOutlined, DollarOutlined, EditOutlined, AppstoreOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import api from "../../lib/superAdminApi";

const { Title, Text } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;

const PLAN_PRICES = { trial: 0, basic: 149, pro: 299 };

const STATUS_LABELS = {
  active:   { text: "Ativo",      color: "success", icon: <CheckCircleOutlined /> },
  pending:  { text: "Pendente",   color: "warning", icon: <ClockCircleOutlined /> },
  inactive: { text: "Inativo",    color: "default", icon: <StopOutlined /> },
  rejected: { text: "Rejeitado",  color: "error",   icon: <CloseCircleOutlined /> },
};

const PLAN_LABELS = {
  trial: { text: "Trial",  color: "processing", icon: <ExperimentOutlined /> },
  basic: { text: "Basic",  color: "blue",       icon: <CrownOutlined /> },
  pro:   { text: "Pro",    color: "gold",       icon: <CrownOutlined /> },
};

function PlanTag({ plan, planExpiresAt }) {
  const label = PLAN_LABELS[plan] || { text: plan || "—", color: "default", icon: null };
  const expired = planExpiresAt && new Date(planExpiresAt) < new Date();
  const expiresText = planExpiresAt
    ? `${expired ? "Expirou" : "Expira"} em ${new Date(planExpiresAt).toLocaleDateString("pt-BR")}`
    : null;
  return (
    <Space direction="vertical" size={2}>
      <Tag color={expired ? "error" : label.color} icon={label.icon}>
        {expired ? "Expirado" : label.text}
      </Tag>
      {expiresText && (
        <Text type={expired ? "danger" : "secondary"} style={{ fontSize: 11 }}>
          <CalendarOutlined style={{ marginRight: 4 }} />{expiresText}
        </Text>
      )}
    </Space>
  );
}

export default function AdminPanel() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usersModal, setUsersModal] = useState({ open: false, tenant: null, users: [], loading: false });
  const [planModal, setPlanModal] = useState({ open: false, tenant: null });
  const [actionLoading, setActionLoading] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [planForm] = Form.useForm();

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
      const res = await api.patch(`/tenants/${tenant.id}/approve`);
      const trialEnd = res.data?.trialEndsAt
        ? new Date(res.data.trialEndsAt).toLocaleDateString("pt-BR")
        : null;
      message.success(trialEnd ? `${tenant.name} aprovado! Trial até ${trialEnd}.` : `${tenant.name} aprovado!`, 5);
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

  const openPlanModal = (tenant) => {
    setPlanModal({ open: true, tenant });
    planForm.setFieldsValue({ plan: tenant.plan || "trial", days: 30 });
  };

  const handleUpdatePlan = async (values) => {
    const { tenant } = planModal;
    try {
      await api.patch(`/tenants/${tenant.id}/plan`, values);
      message.success(`Plano de ${tenant.name} atualizado para ${values.plan} por ${values.days} dias`);
      setPlanModal({ open: false, tenant: null });
      fetchTenants();
    } catch {
      message.error("Erro ao atualizar plano");
    }
  };

  const now = new Date();

  const stats = {
    total:    tenants.length,
    active:   tenants.filter((t) => t.status === "active").length,
    pending:  tenants.filter((t) => t.status === "pending").length,
    inactive: tenants.filter((t) => t.status === "inactive").length,
    trial:    tenants.filter((t) => t.plan === "trial" && t.status === "active").length,
    basic:    tenants.filter((t) => t.plan === "basic" && t.status === "active").length,
    pro:      tenants.filter((t) => t.plan === "pro" && t.status === "active").length,
    expired:  tenants.filter((t) => t.planExpiresAt && new Date(t.planExpiresAt) < now).length,
    newThisMonth: tenants.filter((t) => {
      const d = new Date(t.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
    mrr: tenants
      .filter((t) => t.status === "active" && t.plan !== "trial")
      .reduce((s, t) => s + (PLAN_PRICES[t.plan] || 0), 0),
  };

  const monthlyData = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const count = tenants.filter((t) => {
        const c = new Date(t.createdAt);
        return c.getMonth() === d.getMonth() && c.getFullYear() === d.getFullYear();
      }).length;
      months.push({ label, count });
    }
    return months;
  })();

  const planDistribution = [
    { name: "Trial", value: stats.trial, fill: "#722ed1" },
    { name: "Basic", value: stats.basic, fill: "#1890ff" },
    { name: "Pro",   value: stats.pro,   fill: "#faad14" },
  ].filter((p) => p.value > 0);

  const expiringTrials = tenants.filter((t) => {
    if (!t.planExpiresAt || t.status !== "active") return false;
    const diff = (new Date(t.planExpiresAt) - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).sort((a, b) => new Date(a.planExpiresAt) - new Date(b.planExpiresAt));

  const filtered = tenants.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.cnpj?.includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const clientColumns = [
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
      width: 110,
      render: (status) => {
        const s = STATUS_LABELS[status] || { text: status, color: "default" };
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
      },
    },
    {
      title: "Usuários",
      key: "users",
      width: 80,
      align: "center",
      render: (_, r) => <Text>{r._count?.User ?? 0}</Text>,
    },
    {
      title: "Plano",
      key: "plan",
      width: 150,
      render: (_, r) => <PlanTag plan={r.plan} planExpiresAt={r.planExpiresAt} />,
    },
    {
      title: "Cadastro",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 110,
      render: (d) => new Date(d).toLocaleDateString("pt-BR"),
    },
    {
      title: "Ações",
      key: "actions",
      width: 220,
      render: (_, record) => {
        const busy = actionLoading[record.id];
        return (
          <Space size={4} wrap>
            {record.status === "pending" && (
              <>
                <Popconfirm title={`Aprovar "${record.name}"?`} onConfirm={() => handleApprove(record)} okText="Sim" cancelText="Não">
                  <Button type="primary" size="small" icon={<CheckCircleOutlined />} loading={busy}>Aprovar</Button>
                </Popconfirm>
                <Popconfirm title={`Rejeitar "${record.name}"?`} onConfirm={() => handleReject(record)} okText="Sim" cancelText="Não" okButtonProps={{ danger: true }}>
                  <Button danger size="small" icon={<CloseCircleOutlined />} loading={busy}>Rejeitar</Button>
                </Popconfirm>
              </>
            )}
            {(record.status === "active" || record.status === "inactive") && (
              <Popconfirm
                title={`${record.status === "active" ? "Desativar" : "Reativar"} "${record.name}"?`}
                onConfirm={() => handleToggleStatus(record)}
                okText="Sim" cancelText="Não"
              >
                <Button size="small" icon={record.status === "active" ? <PauseCircleOutlined /> : <PlayCircleOutlined />} loading={busy}>
                  {record.status === "active" ? "Desativar" : "Reativar"}
                </Button>
              </Popconfirm>
            )}
            <Tooltip title="Ver usuários">
              <Button size="small" icon={<EyeOutlined />} onClick={() => openUsers(record)} />
            </Tooltip>
            <Tooltip title="Alterar plano">
              <Button size="small" icon={<EditOutlined />} onClick={() => openPlanModal(record)} />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const subscriptionColumns = [
    {
      title: "Empresa",
      key: "name",
      render: (_, r) => <Text strong>{r.name}</Text>,
    },
    {
      title: "Plano atual",
      key: "plan",
      width: 160,
      render: (_, r) => <PlanTag plan={r.plan} planExpiresAt={r.planExpiresAt} />,
    },
    {
      title: "Status assinatura",
      key: "subStatus",
      width: 140,
      render: (_, r) => {
        const sub = r.Subscription;
        if (!sub) return <Tag color="default">Sem assinatura</Tag>;
        const colors = { active: "success", canceled: "error", past_due: "warning" };
        return <Tag color={colors[sub.status] || "default"}>{sub.status}</Tag>;
      },
    },
    {
      title: "Início",
      key: "startedAt",
      width: 110,
      render: (_, r) => r.Subscription?.startedAt
        ? new Date(r.Subscription.startedAt).toLocaleDateString("pt-BR")
        : "—",
    },
    {
      title: "Vencimento",
      key: "expiresAt",
      width: 120,
      render: (_, r) => {
        const exp = r.planExpiresAt;
        if (!exp) return <Text type="secondary">—</Text>;
        const expired = new Date(exp) < now;
        return (
          <Text type={expired ? "danger" : undefined}>
            {new Date(exp).toLocaleDateString("pt-BR")}
          </Text>
        );
      },
    },
    {
      title: "Mensalidade",
      key: "price",
      width: 120,
      align: "right",
      render: (_, r) => {
        const price = PLAN_PRICES[r.plan] || 0;
        return price > 0
          ? <Text strong style={{ color: "#52c41a" }}>R$ {price.toFixed(2).replace(".", ",")}</Text>
          : <Text type="secondary">Gratuito</Text>;
      },
    },
    {
      title: "Alterar plano",
      key: "changePlan",
      width: 120,
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openPlanModal(r)}>
          Alterar
        </Button>
      ),
    },
  ];

  const activePaying = tenants.filter((t) => t.status === "active" && t.plan !== "trial");
  const subStats = {
    mrr: stats.mrr,
    paying: activePaying.length,
    arr: stats.mrr * 12,
    avgTicket: activePaying.length > 0 ? stats.mrr / activePaying.length : 0,
  };

  return (
    <div style={{ padding: "24px", background: "#f5f7fa", minHeight: "100vh" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Painel Super Admin</Title>
          <Text type="secondary">Gerenciamento completo de clientes, planos e assinaturas</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchTenants} loading={loading}>Atualizar</Button>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" size="large">

        {/* ── DASHBOARD ── */}
        <TabPane tab={<span><BarChartOutlined /> Dashboard</span>} key="dashboard">
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {[
              { title: "Total Clientes", value: stats.total, color: "#1890ff", bg: "#f0f5ff", icon: <TeamOutlined /> },
              { title: "Ativos", value: stats.active, color: "#52c41a", bg: "#f6ffed", icon: <CheckCircleOutlined /> },
              { title: "Aguardando", value: stats.pending, color: "#faad14", bg: "#fffbe6", icon: <ClockCircleOutlined />, badge: true },
              { title: "Inativos", value: stats.inactive, color: "#999", bg: "#f5f5f5", icon: <StopOutlined /> },
              { title: "Em Trial", value: stats.trial, color: "#722ed1", bg: "#f9f0ff", icon: <ExperimentOutlined /> },
              { title: "Plano Expirado", value: stats.expired, color: "#f5222d", bg: "#fff1f0", icon: <ClockCircleOutlined /> },
              { title: "Novos este mês", value: stats.newThisMonth, color: "#13c2c2", bg: "#e6fffb", icon: <RiseOutlined /> },
              {
                title: "MRR",
                value: `R$ ${stats.mrr.toLocaleString("pt-BR")}`,
                color: "#52c41a",
                bg: "#f6ffed",
                icon: <DollarOutlined />,
                isText: true,
              },
            ].map(({ title, value, color, bg, icon, badge, isText }) => (
              <Col xs={12} sm={8} lg={3} key={title}>
                <Card bordered={false} style={{ background: bg }}>
                  {badge ? (
                    <Badge count={value} offset={[8, -4]}>
                      <Statistic title={title} value={value} valueStyle={{ color }} prefix={icon} />
                    </Badge>
                  ) : isText ? (
                    <Statistic title={title} value={value} valueStyle={{ color, fontSize: 18 }} prefix={icon} />
                  ) : (
                    <Statistic title={title} value={value} valueStyle={{ color }} prefix={icon} />
                  )}
                </Card>
              </Col>
            ))}
          </Row>

          {expiringTrials.length > 0 && (
            <Alert
              type="warning" showIcon icon={<WarningOutlined />}
              style={{ marginBottom: 16 }}
              message={`${expiringTrials.length} cliente${expiringTrials.length > 1 ? "s" : ""} com trial expirando em até 7 dias`}
              description={
                <List size="small" dataSource={expiringTrials} renderItem={(t) => {
                  const days = Math.ceil((new Date(t.planExpiresAt) - now) / (1000 * 60 * 60 * 24));
                  return (
                    <List.Item style={{ padding: "4px 0" }}>
                      <Text strong>{t.name}</Text>
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        {days === 0 ? "Expira hoje" : `${days} dia${days > 1 ? "s" : ""}`}
                      </Tag>
                      <Button size="small" type="link" onClick={() => openPlanModal(t)}>Alterar plano</Button>
                    </List.Item>
                  );
                }} />
              }
            />
          )}

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card title={<Space><RiseOutlined /> Novos clientes por mês (últimos 6 meses)</Space>} bordered={false}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <ReTooltip formatter={(v) => [`${v} cliente${v !== 1 ? "s" : ""}`, "Cadastros"]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {monthlyData.map((_, i) => (
                        <Cell key={i} fill={i === monthlyData.length - 1 ? "#1890ff" : "#91d5ff"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title={<Space><AppstoreOutlined /> Distribuição de planos</Space>} bordered={false}>
                {planDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {planDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Legend />
                      <ReTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
                    Nenhum cliente ativo
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* ── CLIENTES ── */}
        <TabPane
          tab={
            <span>
              <TeamOutlined />
              Clientes
              {stats.pending > 0 && (
                <Badge count={stats.pending} size="small" style={{ marginLeft: 6 }} />
              )}
            </span>
          }
          key="clients"
        >
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <Search
                placeholder="Buscar por nome ou CNPJ"
                allowClear style={{ width: 260 }}
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
              columns={clientColumns}
              dataSource={filtered}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 15, showSizeChanger: false }}
              locale={{ emptyText: "Nenhum cliente encontrado" }}
            />
          </Card>
        </TabPane>

        {/* ── ASSINATURAS ── */}
        <TabPane tab={<span><DollarOutlined /> Assinaturas</span>} key="subscriptions">
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {[
              { title: "MRR", value: `R$ ${subStats.mrr.toLocaleString("pt-BR")}`, color: "#52c41a", bg: "#f6ffed", icon: <DollarOutlined /> },
              { title: "ARR (estimado)", value: `R$ ${subStats.arr.toLocaleString("pt-BR")}`, color: "#1890ff", bg: "#f0f5ff", icon: <RiseOutlined /> },
              { title: "Clientes pagantes", value: subStats.paying, color: "#722ed1", bg: "#f9f0ff", icon: <CrownOutlined /> },
              { title: "Ticket médio", value: `R$ ${subStats.avgTicket.toFixed(2).replace(".", ",")}`, color: "#faad14", bg: "#fffbe6", icon: <DollarOutlined /> },
            ].map(({ title, value, color, bg, icon }) => (
              <Col xs={12} sm={6} key={title}>
                <Card bordered={false} style={{ background: bg }}>
                  <Statistic title={title} value={value} valueStyle={{ color, fontSize: 18 }} prefix={icon} />
                </Card>
              </Col>
            ))}
          </Row>

          <Card bordered={false}>
            <Table
              columns={subscriptionColumns}
              dataSource={tenants.filter((t) => t.status === "active")}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 15, showSizeChanger: false }}
              locale={{ emptyText: "Nenhum cliente ativo" }}
              summary={(data) => {
                const total = data.reduce((s, r) => s + (PLAN_PRICES[r.plan] || 0), 0);
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={5}>
                      <Text strong>Total MRR</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell align="right">
                      <Text strong style={{ color: "#52c41a" }}>
                        R$ {total.toFixed(2).replace(".", ",")}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell />
                  </Table.Summary.Row>
                );
              }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Modal usuários */}
      <Modal
        title={<Space><UserOutlined /> Usuários — {usersModal.tenant?.name}</Space>}
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
            { title: "Perfil", key: "role", render: (_, r) => r.role?.name ?? "—" },
          ]}
        />
      </Modal>

      {/* Modal alterar plano */}
      <Modal
        title={<Space><CrownOutlined /> Alterar plano — {planModal.tenant?.name}</Space>}
        open={planModal.open}
        onCancel={() => setPlanModal({ open: false, tenant: null })}
        footer={null}
        width={400}
      >
        <Form form={planForm} layout="vertical" onFinish={handleUpdatePlan}>
          <Form.Item name="plan" label="Plano" rules={[{ required: true }]}>
            <Select options={[
              { value: "trial", label: "Trial (gratuito)" },
              { value: "basic", label: "Basic — R$ 149/mês" },
              { value: "pro",   label: "Pro — R$ 299/mês" },
            ]} />
          </Form.Item>
          <Form.Item name="days" label="Duração (dias)" rules={[{ required: true }]}>
            <InputNumber min={1} max={3650} style={{ width: "100%" }} />
          </Form.Item>
          <Divider style={{ margin: "12px 0" }} />
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={() => setPlanModal({ open: false, tenant: null })}>Cancelar</Button>
              <Button type="primary" htmlType="submit">Salvar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

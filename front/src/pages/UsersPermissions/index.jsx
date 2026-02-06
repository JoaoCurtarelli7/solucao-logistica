import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Form,
  Input,
  Modal,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Spin,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import api from "../../lib/api";
import { usePermission } from "../../hooks/usePermission";
import { useUserContext } from "../../context/userContext";
import "./styles.css";

const { Title, Text } = Typography;

// Mapeamento de módulos para português
const moduleLabels = {
  dashboard: "Dashboard",
  users: "Usuários",
  roles: "Perfis",
  permissions: "Permissões",
  companies: "Empresas",
  employees: "Funcionários",
  trucks: "Caminhões",
  trips: "Viagens",
  tripExpenses: "Despesas de Viagem",
  maintenance: "Manutenções",
  loads: "Cargas",
  financial: "Financeiro",
  closings: "Fechamentos",
  months: "Meses",
  reports: "Relatórios",
};

// Mapeamento de ações para português
const actionLabels = {
  view: "Visualizar",
  create: "Criar",
  update: "Editar",
  delete: "Deletar",
  manage: "Gerenciar",
  export: "Exportar",
};

// Grade fixa: todos os módulos com todas as ações (view, create, update, delete, etc.)
// Assim a tela sempre mostra Criar, Editar, Deletar, Visualizar para cada módulo
const MODULES_WITH_ACTIONS = [
  { module: "dashboard", actions: ["view"] },
  { module: "users", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "roles", actions: ["view", "create", "update", "delete"] },
  { module: "permissions", actions: ["view", "create", "update", "delete"] },
  { module: "companies", actions: ["view", "create", "update", "delete"] },
  { module: "employees", actions: ["view", "create", "update", "delete"] },
  { module: "trucks", actions: ["view", "create", "update", "delete"] },
  { module: "trips", actions: ["view", "create", "update", "delete"] },
  { module: "tripExpenses", actions: ["view", "create", "update", "delete"] },
  { module: "maintenance", actions: ["view", "create", "update", "delete"] },
  { module: "loads", actions: ["view", "create", "update", "delete"] },
  { module: "financial", actions: ["view", "create", "update", "delete"] },
  { module: "closings", actions: ["view", "create", "update", "delete"] },
  { module: "months", actions: ["view", "create", "update", "delete"] },
  { module: "reports", actions: ["view", "export"] },
];

// Agrupar módulos por categoria para a UI
const MODULE_CATEGORIES = [
  {
    key: "sistema",
    label: "Sistema",
    modules: ["dashboard", "users", "roles", "permissions"],
  },
  {
    key: "gestao",
    label: "Gestão",
    modules: ["companies", "employees"],
  },
  {
    key: "operacoes",
    label: "Operações",
    modules: ["trucks", "trips", "tripExpenses", "maintenance", "loads"],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    modules: ["financial", "closings", "months"],
  },
  {
    key: "relatorios",
    label: "Relatórios",
    modules: ["reports"],
  },
];

function groupPermissions(keys) {
  const groups = {};
  keys.forEach((k) => {
    const [module] = k.split(".");
    if (!groups[module]) groups[module] = [];
    groups[module].push(k);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const labelA = moduleLabels[a] || a;
      const labelB = moduleLabels[b] || b;
      return labelA.localeCompare(labelB);
    })
    .map(([module, perms]) => ({
      module,
      moduleLabel: moduleLabels[module] || module,
      perms: perms.sort((a, b) => a.localeCompare(b)),
    }));
}

export default function UsersPermissions() {
  const { hasPermission, user } = usePermission();
  const { loading: userLoading } = useUserContext();

  const [activeTab, setActiveTab] = useState("users");

  // Shared data
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);

  // Users
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRoleId, setFilterRoleId] = useState(undefined);
  const [filterStatus, setFilterStatus] = useState(undefined);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm] = Form.useForm();

  // Roles UI
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [rolePerms, setRolePerms] = useState([]);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm] = Form.useForm();
  const [savingRolePerms, setSavingRolePerms] = useState(false);
  const [moduleSearch, setModuleSearch] = useState("");

  // Audit logs
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(20);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsAction, setLogsAction] = useState("");

  // Permissions management
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [permissionForm] = Form.useForm();

  const canManageUsers = hasPermission("users.manage");

  const permissionKeys = useMemo(
    () => permissions.map((p) => p.key),
    [permissions],
  );
  const groupedPerms = useMemo(
    () => groupPermissions(permissionKeys),
    [permissionKeys],
  );

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  );

  const filteredModulesBySearch = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return MODULES_WITH_ACTIONS;
    return MODULES_WITH_ACTIONS.filter((g) =>
      (moduleLabels[g.module] || g.module).toLowerCase().includes(q),
    );
  }, [moduleSearch]);

  const categoriesWithModules = useMemo(() => {
    return MODULE_CATEGORIES.map((cat) => ({
      ...cat,
      modules: cat.modules
        .map((modKey) =>
          filteredModulesBySearch.find((m) => m.module === modKey),
        )
        .filter(Boolean),
    })).filter((cat) => cat.modules.length > 0);
  }, [filteredModulesBySearch]);

  const toggleModulePerms = (moduleKey, checked) => {
    const g = MODULES_WITH_ACTIONS.find((m) => m.module === moduleKey);
    if (!g) return;
    const keys = g.actions.map((a) => `${moduleKey}.${a}`);
    if (checked) {
      setRolePerms((prev) => [...new Set([...prev, ...keys])]);
    } else {
      setRolePerms((prev) => prev.filter((k) => !keys.includes(k)));
    }
  };

  const loadRoles = async () => {
    const res = await api.get("/roles");
    setRoles(res.data);
    if (!selectedRoleId && res.data?.length) setSelectedRoleId(res.data[0].id);
  };

  const loadPermissions = async () => {
    const res = await api.get("/permissions");
    setPermissions(res.data);
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.get("/admin/users", {
        params: {
          search: search || undefined,
          roleId: filterRoleId || undefined,
          status: filterStatus || undefined,
        },
      });
      setUsers(res.data);
    } catch (e) {
      message.error("Erro ao carregar usuários");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadLogs = async (page = logsPage, pageSize = logsPageSize) => {
    setLogsLoading(true);
    try {
      const res = await api.get("/audit-logs", {
        params: {
          page,
          pageSize,
          action: logsAction || undefined,
        },
      });
      setLogs(res.data.items);
      setLogsTotal(res.data.total);
      setLogsPage(res.data.page);
      setLogsPageSize(res.data.pageSize);
    } catch (e) {
      message.error("Erro ao carregar logs");
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageUsers) return;
    loadRoles();
    loadPermissions();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers]);

  useEffect(() => {
    if (activeTab === "logs") loadLogs(1, logsPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!selectedRole) return;
    setRolePerms(
      Array.isArray(selectedRole.permissions) ? selectedRole.permissions : [],
    );
  }, [selectedRole]);

  if (userLoading) {
    return (
      <Card bordered={false}>
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" tip="Carregando..." />
        </div>
      </Card>
    );
  }

  if (user && !canManageUsers) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para acessar Usuários e Permissões. Peça a um administrador para atribuir o perfil com permissão 'Gerenciar usuários' ao seu usuário."
        extra={
          <Text type="secondary">
            Se você é o primeiro usuário e não tem perfil atribuído, faça logout e login novamente para que o sistema reconheça seu acesso total.
          </Text>
        }
      />
    );
  }

  const openCreateUser = () => {
    setEditingUser(null);
    userForm.resetFields();
    const adminRole = roles.find((r) => r.name === "Admin");
    userForm.setFieldsValue({
      status: "active",
      roleId: adminRole?.id ?? roles[0]?.id,
    });
    setUserModalOpen(true);
  };

  const openEditUser = (record) => {
    setEditingUser(record);
    userForm.setFieldsValue({
      name: record.name,
      email: record.email,
      roleId: record.role?.id,
      status: record.status,
    });
    setUserModalOpen(true);
  };

  const submitUser = async () => {
    const values = await userForm.validateFields();
    try {
      if (editingUser) {
        await api.put(`/admin/users/${editingUser.id}`, values);
        message.success("Usuário atualizado com sucesso");
      } else {
        const res = await api.post("/admin/users", values);
        message.success("Usuário criado com sucesso");
        if (res.data?.tempPassword) {
          Modal.info({
            title: "Senha temporária do novo usuário",
            content: (
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="E-mail">
                  {res.data.user.email}
                </Descriptions.Item>
                <Descriptions.Item label="Senha temporária">
                  <Text code copyable>
                    {res.data.tempPassword}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Observação">
                  Envie essa senha ao usuário e peça para ele trocar depois.
                </Descriptions.Item>
              </Descriptions>
            ),
          });
        }
      }
      setUserModalOpen(false);
      await loadUsers();
    } catch (e) {
      const msg = e?.response?.data?.message || "Erro ao salvar usuário";
      message.error(msg);
    }
  };

  const deactivateUser = (record) => {
    Modal.confirm({
      title: "Desativar usuário?",
      content: `O usuário "${record.name}" ficará inativo e não conseguirá acessar o sistema.`,
      okText: "Desativar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await api.patch(`/admin/users/${record.id}/status`, {
            status: "inactive",
          });
          message.success("Usuário desativado");
          await loadUsers();
        } catch (e) {
          message.error("Erro ao desativar usuário");
        }
      },
    });
  };

  const activateUser = (record) => {
    Modal.confirm({
      title: "Ativar usuário?",
      content: `O usuário "${record.name}" voltará a acessar o sistema.`,
      okText: "Ativar",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await api.patch(`/admin/users/${record.id}/status`, {
            status: "active",
          });
          message.success("Usuário ativado");
          await loadUsers();
        } catch (e) {
          message.error("Erro ao ativar usuário");
        }
      },
    });
  };

  const saveRolePermissions = async () => {
    if (!selectedRoleId) return;
    setSavingRolePerms(true);
    try {
      await api.put(`/roles/${selectedRoleId}/permissions`, {
        permissions: rolePerms,
      });
      message.success("Permissões atualizadas");
      await loadRoles();
    } catch (e) {
      message.error("Erro ao salvar permissões");
    } finally {
      setSavingRolePerms(false);
    }
  };

  const openCreateRole = () => {
    setEditingRole(null);
    roleForm.resetFields();
    setRoleModalOpen(true);
  };

  const openEditRole = () => {
    if (!selectedRole) return;
    setEditingRole(selectedRole);
    roleForm.setFieldsValue({
      name: selectedRole.name,
      description: selectedRole.description,
    });
    setRoleModalOpen(true);
  };

  const submitRole = async () => {
    const values = await roleForm.validateFields();
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, values);
        message.success("Perfil atualizado");
      } else {
        await api.post("/roles", values);
        message.success("Perfil criado");
      }
      setRoleModalOpen(false);
      await loadRoles();
    } catch (e) {
      const msg = e?.response?.data?.message || "Erro ao salvar perfil";
      message.error(msg);
    }
  };

  const userColumns = [
    { title: "Nome", dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
    {
      title: "Perfil",
      key: "role",
      render: (_, r) =>
        r.role?.name || <Text type="secondary">Sem perfil</Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v) =>
        v === "active" ? (
          <Tag color="green">Ativo</Tag>
        ) : (
          <Tag color="red">Inativo</Tag>
        ),
    },
    {
      title: "Ações",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditUser(r)}
          >
            Editar
          </Button>
          {r.status === "active" ? (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => deactivateUser(r)}
            >
              Desativar
            </Button>
          ) : (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => activateUser(r)}
            >
              Ativar
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const logsColumns = [
    {
      title: "Usuário",
      key: "user",
      render: (_, r) =>
        r.user ? (
          `${r.user.name} (${r.user.email})`
        ) : (
          <Text type="secondary">Sistema</Text>
        ),
    },
    { title: "Ação", dataIndex: "action", key: "action" },
    {
      title: "Data/Hora",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: "Detalhes",
      dataIndex: "details",
      key: "details",
      render: (v) =>
        v ? (
          <Text code ellipsis={{ tooltip: v }}>
            {v}
          </Text>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <Card bordered={false} className="users-permissions-page">
      <Row justify="space-between" align="middle" className="page-header">
        <Col>
          <h1 className="page-title">Usuários & Permissões</h1>
          <p className="page-subtitle">
            Gerencie usuários, perfis e acessos por módulo.
          </p>
        </Col>
        <Col>
          <Space size="middle" className="header-actions">
            <Button
              icon={<ReloadOutlined />}
              onClick={() =>
                activeTab === "users"
                  ? loadUsers()
                  : activeTab === "logs"
                    ? loadLogs(1, logsPageSize)
                    : loadRoles()
              }
            >
              Atualizar
            </Button>
            {activeTab === "users" ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateUser}
              >
                Novo Usuário
              </Button>
            ) : null}
            {activeTab === "roles" ? (
              <Space>
                <Button onClick={openEditRole} disabled={!selectedRole}>
                  Editar Perfil
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreateRole}
                >
                  Novo Perfil
                </Button>
              </Space>
            ) : null}
          </Space>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "permissions",
            label: "Permissões",
            children: (
              <>
                <Row gutter={12} style={{ marginBottom: 12 }}>
                  <Col span={24}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingPermission(null);
                        permissionForm.resetFields();
                        setPermissionModalOpen(true);
                      }}
                    >
                      Nova Permissão
                    </Button>
                  </Col>
                </Row>
                <Table
                  rowKey="id"
                  columns={[
                    {
                      title: "Módulo",
                      key: "module",
                      width: 150,
                      render: (_, record) => {
                        const [module] = record.key.split(".");
                        const moduleLabel = moduleLabels[module] || module;
                        return <Tag color="blue">{moduleLabel}</Tag>;
                      },
                    },
                    {
                      title: "Ação",
                      key: "action",
                      width: 150,
                      render: (_, record) => {
                        const [, action] = record.key.split(".");
                        const actionLabel = actionLabels[action] || action;
                        return <Tag color="green">{actionLabel}</Tag>;
                      },
                    },
                    {
                      title: "Chave Completa",
                      dataIndex: "key",
                      key: "key",
                      render: (key) => <Text code>{key}</Text>,
                    },
                    {
                      title: "Descrição",
                      dataIndex: "description",
                      key: "description",
                      render: (v) =>
                        v || <Text type="secondary">Sem descrição</Text>,
                    },
                    {
                      title: "Ações",
                      key: "actions",
                      width: 150,
                      render: (_, record) => (
                        <Space>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                              setEditingPermission(record);
                              const [module, action] = record.key.split(".");
                              permissionForm.setFieldsValue({
                                module,
                                action,
                                key: record.key,
                                description: record.description || "",
                              });
                              setPermissionModalOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="small"
                            danger
                            onClick={async () => {
                              Modal.confirm({
                                title: "Deletar permissão?",
                                content: `A permissão "${record.key}" será removida permanentemente.`,
                                okText: "Deletar",
                                okButtonProps: { danger: true },
                                cancelText: "Cancelar",
                                onOk: async () => {
                                  try {
                                    await api.delete(
                                      `/permissions/${record.id}`,
                                    );
                                    message.success("Permissão deletada");
                                    await loadPermissions();
                                  } catch (e) {
                                    message.error(
                                      e?.response?.data?.message ||
                                        "Erro ao deletar permissão",
                                    );
                                  }
                                },
                              });
                            }}
                          >
                            Deletar
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                  dataSource={permissions}
                  pagination={{ pageSize: 10 }}
                />
              </>
            ),
          },
          {
            key: "users",
            label: (
              <span>
                <TeamOutlined style={{ marginRight: 6 }} />
                Usuários
              </span>
            ),
            children: (
              <>
                <Row gutter={12} style={{ marginBottom: 12 }}>
                  <Col xs={24} md={10}>
                    <Input
                      placeholder="Buscar por nome ou e-mail"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onPressEnter={loadUsers}
                      allowClear
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <Select
                      placeholder="Filtrar por perfil"
                      style={{ width: "100%" }}
                      value={filterRoleId}
                      onChange={setFilterRoleId}
                      allowClear
                      options={roles.map((r) => ({
                        value: r.id,
                        label: r.name,
                      }))}
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <Select
                      placeholder="Filtrar por status"
                      style={{ width: "100%" }}
                      value={filterStatus}
                      onChange={setFilterStatus}
                      allowClear
                      options={[
                        { value: "active", label: "Ativo" },
                        { value: "inactive", label: "Inativo" },
                      ]}
                    />
                  </Col>
                  <Col xs={24} md={2}>
                    <Button type="primary" block onClick={loadUsers}>
                      Filtrar
                    </Button>
                  </Col>
                </Row>

                <Table
                  rowKey="id"
                  loading={usersLoading}
                  columns={userColumns}
                  dataSource={users}
                  pagination={{ pageSize: 10 }}
                />
              </>
            ),
          },
          {
            key: "roles",
            label: (
              <span>
                <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                Perfis
              </span>
            ),
            children: (
              <div className="roles-layout">
                <div className="roles-sidebar">
                  <Card size="small" title="Perfis" bordered>
                    {roles.map((item) => (
                      <div
                        key={item.id}
                        className={`role-item ${item.id === selectedRoleId ? "selected" : ""}`}
                        onClick={() => setSelectedRoleId(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedRoleId(item.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="role-name">{item.name}</div>
                        <div className="role-desc">
                          {item.description || "Sem descrição"}
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
                <div className="permissions-panel">
                  <Card
                    size="small"
                    title={
                      selectedRole
                        ? `Permissões: ${selectedRole.name}`
                        : "Permissões"
                    }
                    bordered
                    extra={
                      <Button
                        type="primary"
                        loading={savingRolePerms}
                        onClick={saveRolePermissions}
                        disabled={!selectedRole}
                        className="save-perms-btn"
                      >
                        Salvar permissões
                      </Button>
                    }
                  >
                    {!selectedRole ? (
                      <Result
                        status="info"
                        title="Selecione um perfil"
                        subTitle="Escolha um perfil à esquerda para editar as permissões."
                        className="select-role-placeholder"
                      />
                    ) : (
                      <>
                        <div className="module-search-wrap">
                          <Input
                            prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
                            placeholder="Buscar módulo (ex.: Financeiro, Cargas)"
                            value={moduleSearch}
                            onChange={(e) => setModuleSearch(e.target.value)}
                            allowClear
                            style={{ maxWidth: 320 }}
                          />
                        </div>
                        <Checkbox.Group
                          value={rolePerms}
                          onChange={(vals) => setRolePerms(vals)}
                          style={{ width: "100%" }}
                        >
                          <Collapse
                            defaultActiveKey={MODULE_CATEGORIES.map((c) => c.key)}
                            className="permissions-collapse"
                          >
                            {categoriesWithModules.map((cat) => (
                              <Collapse.Panel
                                header={cat.label}
                                key={cat.key}
                              >
                                {cat.modules.map((g) => {
                                  const moduleKey = g.module;
                                  const allKeys = g.actions.map(
                                    (a) => `${moduleKey}.${a}`,
                                  );
                                  const checkedCount = allKeys.filter((k) =>
                                    rolePerms.includes(k),
                                  ).length;
                                  const allChecked =
                                    checkedCount === allKeys.length;
                                  const someChecked = checkedCount > 0;
                                  return (
                                    <div
                                      key={moduleKey}
                                      className="module-perm-card"
                                    >
                                      <div className="module-header">
                                        <span className="module-title">
                                          {moduleLabels[moduleKey] || moduleKey}
                                        </span>
                                        <Space size="small">
                                          <Button
                                            type="link"
                                            size="small"
                                            onClick={() =>
                                              toggleModulePerms(
                                                moduleKey,
                                                !allChecked,
                                              )
                                            }
                                          >
                                            {allChecked
                                              ? "Desmarcar todos"
                                              : "Marcar todos"}
                                          </Button>
                                        </Space>
                                      </div>
                                      <div className="module-actions-inline">
                                        {g.actions.map((action) => {
                                          const k = `${moduleKey}.${action}`;
                                          const label =
                                            actionLabels[action] || action;
                                          return (
                                            <Checkbox key={k} value={k}>
                                              {label}
                                            </Checkbox>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </Collapse.Panel>
                            ))}
                          </Collapse>
                        </Checkbox.Group>
                      </>
                    )}
                  </Card>
                </div>
              </div>
            ),
          },
          {
            key: "logs",
            label: "Logs",
            children: (
              <>
                <Row gutter={12} style={{ marginBottom: 12 }}>
                  <Col xs={24} md={10}>
                    <Input
                      placeholder="Filtrar por ação (ex.: users.)"
                      value={logsAction}
                      onChange={(e) => setLogsAction(e.target.value)}
                      onPressEnter={() => loadLogs(1, logsPageSize)}
                      allowClear
                    />
                  </Col>
                  <Col xs={24} md={4}>
                    <Button
                      type="primary"
                      onClick={() => loadLogs(1, logsPageSize)}
                    >
                      Buscar
                    </Button>
                  </Col>
                </Row>
                <Table
                  rowKey="id"
                  loading={logsLoading}
                  columns={logsColumns}
                  dataSource={logs}
                  pagination={{
                    current: logsPage,
                    pageSize: logsPageSize,
                    total: logsTotal,
                    onChange: (p, ps) => loadLogs(p, ps),
                    showSizeChanger: true,
                  }}
                />
              </>
            ),
          },
        ]}
      />

      <Modal
        title={editingUser ? "Editar usuário" : "Novo usuário"}
        open={userModalOpen}
        onCancel={() => setUserModalOpen(false)}
        onOk={submitUser}
        okText="Salvar"
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form form={userForm} layout="vertical">
          <Form.Item
            name="name"
            label="Nome completo"
            rules={[{ required: true, message: "Informe o nome" }]}
          >
            <Input placeholder="Ex.: João da Silva" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              {
                required: true,
                type: "email",
                message: "Informe um email válido",
              },
            ]}
          >
            <Input placeholder="email@empresa.com" />
          </Form.Item>
          <Form.Item
            name="roleId"
            label="Perfil (role)"
            rules={[{ required: true, message: "Selecione um perfil" }]}
          >
            <Select
              placeholder="Selecione"
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
            />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "active", label: "Ativo" },
                { value: "inactive", label: "Inativo" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingRole ? "Editar perfil" : "Novo perfil"}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={submitRole}
        okText="Salvar"
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="name"
            label="Nome"
            rules={[{ required: true, message: "Informe o nome do perfil" }]}
          >
            <Input placeholder="Ex.: Gestor" />
          </Form.Item>
          <Form.Item name="description" label="Descrição">
            <Input placeholder="Opcional" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPermission ? "Editar permissão" : "Nova permissão"}
        open={permissionModalOpen}
        onCancel={() => {
          setPermissionModalOpen(false);
          permissionForm.resetFields();
        }}
        onOk={async () => {
          const values = await permissionForm.validateFields();
          try {
            // Se estiver criando nova permissão, gerar a chave automaticamente
            if (!editingPermission && values.module && values.action) {
              values.key = `${values.module}.${values.action}`;
            }

            if (editingPermission) {
              await api.put(`/permissions/${editingPermission.id}`, {
                key: values.key,
                description: values.description,
              });
              message.success("Permissão atualizada");
            } else {
              await api.post("/permissions", {
                key: values.key,
                description: values.description,
              });
              message.success("Permissão criada com sucesso");
            }
            setPermissionModalOpen(false);
            permissionForm.resetFields();
            await loadPermissions();
          } catch (e) {
            const msg =
              e?.response?.data?.message || "Erro ao salvar permissão";
            message.error(msg);
          }
        }}
        okText="Salvar"
        cancelText="Cancelar"
        destroyOnClose
        width={600}
      >
        <Form form={permissionForm} layout="vertical">
          {!editingPermission ? (
            <>
              <Form.Item
                name="module"
                label="Módulo"
                rules={[{ required: true, message: "Selecione o módulo" }]}
                tooltip="Selecione o módulo do sistema ao qual esta permissão se refere"
              >
                <Select
                  placeholder="Selecione o módulo"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={Object.entries(moduleLabels).map(
                    ([value, label]) => ({
                      value,
                      label,
                    }),
                  )}
                  onChange={(value) => {
                    const action = permissionForm.getFieldValue("action");
                    if (value && action) {
                      permissionForm.setFieldsValue({
                        key: `${value}.${action}`,
                        description: `${actionLabels[action] || action} ${moduleLabels[value] || value}`,
                      });
                    }
                  }}
                />
              </Form.Item>

              <Form.Item
                name="action"
                label="Ação"
                rules={[{ required: true, message: "Selecione a ação" }]}
                tooltip="Selecione a ação que esta permissão permite realizar"
              >
                <Select
                  placeholder="Selecione a ação"
                  options={Object.entries(actionLabels).map(
                    ([value, label]) => ({
                      value,
                      label:
                        value === "manage"
                          ? `${label} (todas as ações)`
                          : label,
                    }),
                  )}
                  onChange={(value) => {
                    const module = permissionForm.getFieldValue("module");
                    if (module && value) {
                      permissionForm.setFieldsValue({
                        key: `${module}.${value}`,
                        description: `${actionLabels[value] || value} ${moduleLabels[module] || module}`,
                      });
                    }
                  }}
                />
              </Form.Item>

              <Form.Item
                name="key"
                label="Chave Gerada"
                tooltip="A chave é gerada automaticamente a partir do módulo e ação selecionados"
              >
                <Input
                  disabled
                  placeholder="Será gerada automaticamente"
                  style={{ fontFamily: "monospace" }}
                />
              </Form.Item>
            </>
          ) : (
            <Form.Item
              name="key"
              label="Chave"
              rules={[
                { required: true, message: "Informe a chave da permissão" },
                {
                  pattern: /^[a-z]+\.[a-z]+$/,
                  message:
                    "Formato inválido. Use: modulo.acao (ex: users.create)",
                },
              ]}
            >
              <Input
                placeholder="Ex.: users.create"
                disabled
                style={{ fontFamily: "monospace" }}
              />
            </Form.Item>
          )}

          <Form.Item
            name="description"
            label="Descrição"
            tooltip="Descrição detalhada do que esta permissão permite fazer"
          >
            <Input.TextArea
              placeholder="Ex.: Permite criar novos usuários no sistema"
              rows={3}
              showCount
              maxLength={200}
            />
          </Form.Item>

          {!editingPermission && (
            <div
              style={{
                background: "#f0f0f0",
                padding: "12px",
                borderRadius: "4px",
                marginTop: "8px",
              }}
            >
              <Text type="secondary" style={{ fontSize: "12px" }}>
                <strong>Dica:</strong> A chave será gerada automaticamente no
                formato <Text code>módulo.ação</Text>. A descrição será sugerida
                automaticamente, mas você pode editá-la.
              </Text>
            </div>
          )}
        </Form>
      </Modal>
    </Card>
  );
}

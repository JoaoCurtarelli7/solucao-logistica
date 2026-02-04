import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Form,
  Input,
  List,
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
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import api from "../../lib/api";
import { usePermission } from "../../hooks/usePermission";

const { Title, Text } = Typography;

function groupPermissions(keys) {
  const groups = {};
  keys.forEach((k) => {
    const [module] = k.split(".");
    if (!groups[module]) groups[module] = [];
    groups[module].push(k);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, perms]) => ({
      module,
      perms: perms.sort((a, b) => a.localeCompare(b)),
    }));
}

export default function UsersPermissions() {
  const { hasPermission } = usePermission();

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

  // Audit logs
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(20);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsAction, setLogsAction] = useState("");

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
    if (!selectedRole) return;
    setRolePerms(
      Array.isArray(selectedRole.permissions) ? selectedRole.permissions : [],
    );
  }, [selectedRole]);

  if (!canManageUsers) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para acessar Usuários & Permissões."
      />
    );
  }

  const openCreateUser = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ status: "active" });
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
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            disabled={r.status !== "active"}
            onClick={() => deactivateUser(r)}
          >
            Desativar
          </Button>
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
    <Card bordered={false}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Usuários & Permissões
          </Title>
          <Text type="secondary">
            Gerencie usuários, perfis e acessos por módulo.
          </Text>
        </Col>
        <Col>
          <Space>
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
            key: "users",
            label: "Usuários",
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
            label: "Perfis (Roles)",
            children: (
              <Row gutter={12}>
                <Col xs={24} md={7}>
                  <Card size="small" title="Perfis" bordered>
                    <List
                      dataSource={roles}
                      rowKey="id"
                      renderItem={(item) => (
                        <List.Item
                          style={{
                            cursor: "pointer",
                            background:
                              item.id === selectedRoleId
                                ? "#f5f5f5"
                                : "transparent",
                            borderRadius: 6,
                            paddingInline: 8,
                          }}
                          onClick={() => setSelectedRoleId(item.id)}
                        >
                          <List.Item.Meta
                            title={item.name}
                            description={
                              item.description || (
                                <Text type="secondary">Sem descrição</Text>
                              )
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={17}>
                  <Card
                    size="small"
                    title={`Permissões${selectedRole ? `: ${selectedRole.name}` : ""}`}
                    bordered
                    extra={
                      <Button
                        type="primary"
                        loading={savingRolePerms}
                        onClick={saveRolePermissions}
                        disabled={!selectedRole}
                      >
                        Salvar permissões
                      </Button>
                    }
                  >
                    {!selectedRole ? (
                      <Result
                        status="info"
                        title="Selecione um perfil à esquerda"
                      />
                    ) : (
                      <>
                        {groupedPerms.map((g) => (
                          <Card
                            key={g.module}
                            size="small"
                            style={{ marginBottom: 12 }}
                          >
                            <Title level={5} style={{ marginTop: 0 }}>
                              {g.module}
                            </Title>
                            <Checkbox.Group
                              value={rolePerms}
                              onChange={(vals) => setRolePerms(vals)}
                            >
                              <Row gutter={[8, 8]}>
                                {g.perms.map((k) => (
                                  <Col key={k} xs={24} md={12} lg={8}>
                                    <Checkbox value={k}>{k}</Checkbox>
                                  </Col>
                                ))}
                              </Row>
                            </Checkbox.Group>
                          </Card>
                        ))}
                      </>
                    )}
                  </Card>
                </Col>
              </Row>
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
    </Card>
  );
}

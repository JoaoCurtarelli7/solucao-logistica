import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  Result,
  Row,
  Col,
  Tag,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ToolOutlined } from "@ant-design/icons";
import api from "../../../lib/api";
import { usePermission } from "../../../hooks/usePermission";

const { Title, Text } = Typography;

export default function MaintenanceServices() {
  const { hasPermission } = usePermission();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form] = Form.useForm();

  const canView = hasPermission("maintenance.view");
  const canCreate = hasPermission("maintenance.create");
  const canUpdate = hasPermission("maintenance.update");
  const canDelete = hasPermission("maintenance.delete");

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/maintenance-service-presets");
      setServices(Array.isArray(data) ? data : []);
    } catch {
      message.error("Erro ao carregar serviços de manutenção");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleCreate = () => {
    setEditingService(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingService(record);
    form.setFieldsValue({ name: record.name });
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingService) {
        await api.put(`/maintenance-service-presets/${editingService.id}`, { name: values.name.trim() });
        message.success("Serviço atualizado com sucesso");
      } else {
        await api.post("/maintenance-service-presets", { name: values.name.trim() });
        message.success("Serviço criado com sucesso");
      }
      setModalOpen(false);
      fetchServices();
    } catch (err) {
      message.error(err.response?.data?.message || "Erro ao salvar");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/maintenance-service-presets/${id}`);
      message.success("Serviço deletado com sucesso");
      fetchServices();
    } catch (err) {
      message.error(err.response?.data?.message || "Erro ao deletar");
    }
  };

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar o cadastro de serviços."
      />
    );
  }

  const columns = [
    {
      title: "Nome",
      dataIndex: "name",
      key: "name",
      render: (name, r) => (
        <Space>
          <Text strong>{name}</Text>
          {r.isDefault && <Tag color="blue">Padrão</Tag>}
        </Space>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space>
          {canUpdate && !record.isDefault && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              Editar
            </Button>
          )}
          {canDelete && !record.isDefault && (
            <Popconfirm
              title="Excluir este serviço?"
              onConfirm={() => handleDelete(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                Excluir
              </Button>
            </Popconfirm>
          )}
          {record.isDefault && <Text type="secondary">Sistema</Text>}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              <ToolOutlined style={{ marginRight: 8 }} />
              Cadastro de Serviços de Manutenção
            </Title>
            <Text type="secondary">
              Serviços disponíveis ao registrar manutenções da frota
            </Text>
          </Col>
          <Col>
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Novo Serviço
              </Button>
            )}
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={services}
          columns={columns}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} serviços`,
          }}
        />
      </Card>

      <Modal
        title={editingService ? "Editar Serviço" : "Novo Serviço"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Nome do serviço"
            rules={[{ required: true, min: 2, message: "Mínimo 2 caracteres" }]}
          >
            <Input placeholder="Ex: Troca de óleo, Revisão geral..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <Space>
              <Button type="primary" htmlType="submit">{editingService ? "Salvar" : "Criar"}</Button>
              <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

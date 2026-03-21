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
  InputNumber,
  Select,
  Result,
  Row,
  Col,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../../lib/api";
import { usePermission } from "../../../hooks/usePermission";

const { Title, Text } = Typography;
const { Option } = Select;

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function MaintenanceMonths() {
  const { hasPermission } = usePermission();
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMonth, setEditingMonth] = useState(null);
  const [form] = Form.useForm();

  const canView = hasPermission("months.view");
  const canCreate = hasPermission("months.create");
  const canUpdate = hasPermission("months.update");
  const canDelete = hasPermission("months.delete");

  const fetchMonths = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/months");
      setMonths(data || []);
    } catch {
      message.error("Erro ao carregar meses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  const handleCreate = () => {
    setEditingMonth(null);
    form.resetFields();
    form.setFieldsValue({ year: dayjs().year(), month: dayjs().month() + 1 });
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingMonth(record);
    form.setFieldsValue({ status: record.status });
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingMonth) {
        await api.put(`/months/${editingMonth.id}`, { status: values.status });
        message.success("Mês atualizado com sucesso");
      } else {
        await api.post("/months", { year: values.year, month: values.month });
        message.success("Mês criado com sucesso");
      }
      setModalOpen(false);
      fetchMonths();
    } catch (err) {
      message.error(err.response?.data?.message || "Erro ao salvar");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/months/${id}`);
      message.success("Mês deletado com sucesso");
      fetchMonths();
    } catch (err) {
      message.error(err.response?.data?.message || "Erro ao deletar");
    }
  };

  const getStatusText = (s) => (s === "fechado" ? "Fechado" : s === "cancelado" ? "Cancelado" : "Aberto");

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar o cadastro de meses."
      />
    );
  }

  const columns = [
    {
      title: "Mês/Ano",
      dataIndex: "name",
      key: "name",
      render: (_, r) => (
        <div>
          <Text strong>{r.name}</Text>
          <br />
          <Text type="secondary">{r.year}/{String(r.month).padStart(2, "0")}</Text>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s) => <Text type="secondary">{getStatusText(s)}</Text>,
    },
    {
      title: "Fechamentos",
      key: "closings",
      render: (_, r) => (
        <Text type="secondary">
          {r.Closing?.length ?? 0} fechamentos
          {r.Closing?.filter((c) => c.status === "fechado").length > 0 && (
            <> · {r.Closing.filter((c) => c.status === "fechado").length} fechados</>
          )}
        </Text>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space>
          {canUpdate && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              Editar
            </Button>
          )}
          {canDelete && (
            <Popconfirm
              title="Excluir este mês?"
              description="Não é possível excluir mês que possui fechamentos."
              onConfirm={() => handleDelete(record.id)}
              okText="Sim"
              cancelText="Não"
              disabled={record.Closing?.length > 0}
            >
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={record.Closing?.length > 0}
              >
                Excluir
              </Button>
            </Popconfirm>
          )}
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
              <CalendarOutlined style={{ marginRight: 8 }} />
              Cadastro de Meses
            </Title>
            <Text type="secondary">
              Gerencie os meses usados no sistema (fechamentos, relatórios, etc.)
            </Text>
          </Col>
          <Col>
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Novo Mês
              </Button>
            )}
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={months}
          columns={columns}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} meses`,
          }}
        />
      </Card>

      <Modal
        title={editingMonth ? "Editar Mês" : "Novo Mês"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editingMonth && (
            <>
              <Form.Item
                name="year"
                label="Ano"
                rules={[{ required: true, message: "Obrigatório" }]}
              >
                <InputNumber min={2020} max={2035} style={{ width: "100%" }} placeholder="Ex: 2026" />
              </Form.Item>
              <Form.Item
                name="month"
                label="Mês"
                rules={[{ required: true, message: "Obrigatório" }]}
              >
                <Select placeholder="Selecione o mês">
                  {MONTH_NAMES.map((name, i) => (
                    <Option key={i + 1} value={i + 1}>{name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
          {editingMonth && (
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select>
                <Option value="aberto">Aberto</Option>
                <Option value="fechado">Fechado</Option>
                <Option value="cancelado">Cancelado</Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <Space>
              <Button type="primary" htmlType="submit">{editingMonth ? "Salvar" : "Criar"}</Button>
              <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

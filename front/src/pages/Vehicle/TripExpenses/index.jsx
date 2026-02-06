import { useEffect, useState } from "react";
import {
  Card,
  Button,
  Input,
  Form,
  Table,
  Typography,
  Space,
  message,
  Popconfirm,
  DatePicker,
} from "antd";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PlusOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { api } from "../../../lib";

export default function TripExpenses() {
  const navigate = useNavigate();
  const { state } = useLocation(); // Dados da viagem selecionada
  const params = useParams();
  const [expenses, setExpenses] = useState([]);
  const [trip, setTrip] = useState(state || null);
  const [form] = Form.useForm();

  const tripId = state?.id || params?.id;

  // Carregar despesas da viagem
  const fetchExpenses = async () => {
    try {
      const response = await api.get(`/trips/${tripId}/expenses`);
      // backend responde { expenses }
      setExpenses(response.data?.expenses || []);
    } catch (error) {
      console.error(error);
      message.error("Erro ao carregar despesas");
    }
  };

  const fetchTrip = async () => {
    try {
      const response = await api.get(`/trips/${tripId}`);
      setTrip(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (tripId) {
      fetchExpenses();
      fetchTrip();
    }
  }, [tripId]);

  // Recarregar dados quando voltar da página de despesas
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Força recarregamento da listagem de viagens ao voltar
      window.dispatchEvent(new CustomEvent("reloadTrips"));
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Adicionar despesa
  const handleAddExpense = async (values) => {
    try {
      // Endpoint correto de criação é /expenses com tripId, date ISO e category
      const payload = {
        ...values,
        tripId,
        date: values?.date
          ? new Date(values.date).toLocaleDateString("pt-BR")
          : new Date().toLocaleDateString("pt-BR"),
        category: values?.category || "Outro",
      };
      const response = await api.post(`/expenses`, payload);
      setExpenses((prev) => [...prev, response.data]);
      form.resetFields();
      message.success("Despesa adicionada com sucesso!");
    } catch (error) {
      console.error(error);
      message.error("Erro ao adicionar despesa");
    }
  };

  // Deletar despesa
  const handleDeleteExpense = async (id) => {
    try {
      // Endpoint correto de exclusão é /expenses/:id
      await api.delete(`/expenses/${id}`);
      setExpenses((prev) => prev.filter((exp) => exp.id !== id));
      message.success("Despesa removida com sucesso!");
    } catch (error) {
      console.error(error);
      message.error("Erro ao remover despesa");
    }
  };

  const calculateTotal = () =>
    expenses.reduce((total, expense) => total + parseFloat(expense.amount), 0);

  const freightValue = trip?.freightValue || 0;
  const totalExpenses = calculateTotal();
  const profit = freightValue - totalExpenses;

  const columns = [
    { title: "Descrição", dataIndex: "description", key: "description" },
    {
      title: "Valor",
      dataIndex: "amount",
      key: "amount",
      render: (value) => `R$ ${parseFloat(value).toFixed(2)}`,
    },
    {
      title: "Ações",
      key: "actions",
      render: (_, record) => (
        <Popconfirm
          title="Tem certeza de que deseja excluir?"
          onConfirm={() => handleDeleteExpense(record.id)}
          okText="Sim"
          cancelText="Não"
        >
          <Button type="link" danger>
            Excluir
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      style={{
        margin: 20,
        padding: 30,
        backgroundColor: "#f7f8fa",
        borderRadius: 16,
        boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
      }}
      bordered={false}
    >
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            window.dispatchEvent(new CustomEvent("reloadTrips"));
            navigate(-1);
          }}
        >
          Voltar
        </Button>
        <Typography.Title level={2} style={{ color: "#3b4e6f", margin: 0 }}>
          Gastos da Viagem
        </Typography.Title>
      </div>
      <Typography.Paragraph style={{ fontSize: 16, color: "#6c757d" }}>
        <strong>Destino:</strong> {trip?.destination}
        <br />
        <strong>Motorista:</strong> {trip?.driver}
        <br />
        <strong>Caminhão:</strong>{" "}
        {trip?.truck ? `${trip.truck.name} (${trip.truck.plate})` : "-"}
        <br />
        <strong>Valor do Frete:</strong>{" "}
        <Typography.Text strong style={{ color: "#28a745" }}>
          R$ {freightValue.toFixed(2)}
        </Typography.Text>
      </Typography.Paragraph>

      {/* Formulário para adicionar gastos */}
      <Form
        form={form}
        layout="inline"
        onFinish={handleAddExpense}
        style={{ marginBottom: 20 }}
      >
        <Form.Item
          name="description"
          rules={[{ required: true, message: "Descrição obrigatória" }]}
          style={{ flex: 1 }}
        >
          <Input placeholder="Descrição do gasto" />
        </Form.Item>
        <Form.Item
          name="amount"
          rules={[
            { required: true, message: "Valor obrigatório" },
            { pattern: /^\d+(\.\d{1,2})?$/, message: "Insira um valor válido" },
          ]}
          style={{ flex: 1 }}
        >
          <Input placeholder="Valor (R$)" />
        </Form.Item>
        <Form.Item
          name="category"
          rules={[{ required: true, message: "Categoria obrigatória" }]}
          style={{ flex: 1 }}
        >
          <Input placeholder="Categoria (ex: Combustível)" />
        </Form.Item>
        <Form.Item
          name="date"
          rules={[{ required: true, message: "Data obrigatória" }]}
          style={{ flex: 1 }}
        >
          <DatePicker placeholder="Data (DD/MM/YYYY)" format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
            Adicionar
          </Button>
        </Form.Item>
      </Form>

      {/* Tabela de Gastos */}
      <Table
        dataSource={expenses}
        columns={columns}
        pagination={false}
        rowKey="id"
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell>Total</Table.Summary.Cell>
            <Table.Summary.Cell>
              <Typography.Text strong style={{ color: "#28a745" }}>
                R$ {totalExpenses.toFixed(2)}
              </Typography.Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />

      <Card style={{ marginTop: 20, padding: 20 }} bordered={false}>
        <Typography.Title level={4} style={{ marginBottom: 10 }}>
          Resumo Financeiro
        </Typography.Title>
        <Typography.Paragraph>
          <strong>Lucro Final:</strong>{" "}
          <Typography.Text
            type="success"
            style={{ fontSize: 20, color: "#28a745" }}
          >
            R$ {profit.toFixed(2)}
          </Typography.Text>
        </Typography.Paragraph>
      </Card>

      {/* Botão Voltar */}
      <Space style={{ marginTop: 20 }}>
        <Button
          type="default"
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            // Disparar evento para recarregar viagens
            window.dispatchEvent(new CustomEvent("reloadTrips"));
            navigate(-1);
          }}
        >
          Voltar
        </Button>
      </Space>
    </Card>
  );
}

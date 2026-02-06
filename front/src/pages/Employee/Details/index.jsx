import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Typography,
  Descriptions,
  Button,
  Table,
  Tag,
  message,
  Space,
  Divider,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Spin,
  Alert,
} from "antd";
import {
  UserOutlined,
  IdcardOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  EditOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import api from "../../../lib/api";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [transactionForm] = Form.useForm();

  // Carregar dados do funcionário
  const loadEmployee = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/employees/${id}`);
      setEmployee(response.data);
      setTransactions(response.data.Transaction || []);
    } catch (error) {
      console.error("Erro ao carregar funcionário:", error);
      message.error("Erro ao carregar dados do funcionário");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadEmployee();
    }
  }, [id]);

  // Atualizar funcionário
  const handleUpdateEmployee = async (values) => {
    try {
      const baseSalary = Number(values.baseSalary);
      if (isNaN(baseSalary) || baseSalary < 0) {
        message.error("Salário inválido");
        return;
      }
      const response = await api.put(`/employees/${id}`, {
        name: values.name,
        role: values.role,
        baseSalary,
        status: values.status,
        cpf: values.cpf || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        hireDate: values.hireDate ? values.hireDate.format("YYYY-MM-DD") : null,
      });

      setEmployee(response.data);
      setEditModalVisible(false);
      editForm.resetFields();
      message.success("Funcionário atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar funcionário:", error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error("Erro ao atualizar funcionário");
      }
    }
  };

  // Adicionar transação
  const handleAddTransaction = async (values) => {
    try {
      const response = await api.post(`/employees/${id}/transactions`, {
        type: values.type,
        amount: values.amount,
        date: values.date ? values.date.format("YYYY-MM-DD") : null,
      });

      setTransactions([response.data, ...transactions]);
      setTransactionModalVisible(false);
      transactionForm.resetFields();
      message.success("Transação adicionada com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar transação:", error);
      message.error("Erro ao adicionar transação");
    }
  };

  // Calcular saldo
  const calculateBalance = () => {
    return transactions.reduce((balance, transaction) => {
      if (transaction.type === "Crédito") {
        return balance + transaction.amount;
      } else {
        return balance - transaction.amount;
      }
    }, 0);
  };

  // Calcular estatísticas
  const calculateStats = () => {
    const credits = transactions.filter((t) => t.type === "Crédito");
    const debits = transactions.filter((t) => t.type === "Débito");

    return {
      totalCredits: credits.reduce((sum, t) => sum + t.amount, 0),
      totalDebits: debits.reduce((sum, t) => sum + t.amount, 0),
      transactionCount: transactions.length,
    };
  };

  const stats = calculateStats();
  const balance = calculateBalance();

  const transactionColumns = [
    {
      title: "Data",
      dataIndex: "date",
      key: "date",
      render: (date) => dayjs(date).format("DD/MM/YYYY"),
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
    },
    {
      title: "Tipo",
      dataIndex: "type",
      key: "type",
      render: (type) => (
        <Tag color={type === "Crédito" ? "green" : "red"}>{type}</Tag>
      ),
      filters: [
        { text: "Crédito", value: "Crédito" },
        { text: "Débito", value: "Débito" },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "Valor",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      render: (amount, record) => (
        <span
          style={{
            color: record.type === "Crédito" ? "#52c41a" : "#ff4d4f",
            fontWeight: "bold",
          }}
        >
          R$ {amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
      ),
      sorter: (a, b) => a.amount - b.amount,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "20px" }}>
          Carregando dados do funcionário...
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <Alert
        message="Funcionário não encontrado"
        description="O funcionário solicitado não foi encontrado."
        type="error"
        showIcon
        action={
          <Button size="small" onClick={() => navigate("/employee")}>
            Voltar para lista
          </Button>
        }
      />
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      {/* Cabeçalho */}
      <Card style={{ marginBottom: "20px" }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/employee")}
              style={{ marginRight: "16px" }}
            >
              Voltar
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              {employee.name}
            </Title>
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  editForm.setFieldsValue({
                    name: employee.name,
                    role: employee.role,
                    baseSalary: employee.baseSalary,
                    status: employee.status,
                    cpf: employee.cpf || "",
                    phone: employee.phone || "",
                    email: employee.email || "",
                    address: employee.address || "",
                    hireDate: employee.hireDate
                      ? dayjs(employee.hireDate)
                      : null,
                  });
                  setEditModalVisible(true);
                }}
              >
                Editar Funcionário
              </Button>
              <Button
                type="default"
                icon={<PlusOutlined />}
                onClick={() => setTransactionModalVisible(true)}
              >
                Adicionar Transação
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[20, 20]}>
        <Col span={16}>
          <Card title="Informações do Funcionário" style={{ height: "100%" }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Nome" span={2}>
                <Text strong>{employee.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Cargo">
                <Text>{employee.role}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={employee.status === "Ativo" ? "green" : "red"}>
                  {employee.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="CPF">
                {employee.cpf || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Telefone">
                {employee.phone || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Email" span={2}>
                {employee.email || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Endereço" span={2}>
                {employee.address || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Data de Contratação">
                {employee.hireDate
                  ? dayjs(employee.hireDate).format("DD/MM/YYYY")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Data de Cadastro">
                {dayjs(employee.createdAt).format("DD/MM/YYYY")}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="Resumo Financeiro" style={{ height: "100%" }}>
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <Statistic
                title="Salário Base"
                value={employee.baseSalary}
                precision={2}
                prefix="R$"
                valueStyle={{ color: "#3f8600" }}
              />
              <Statistic
                title="Saldo Atual"
                value={balance}
                precision={2}
                prefix="R$"
                valueStyle={{ color: balance >= 0 ? "#3f8600" : "#cf1322" }}
              />
              <Divider />
              <Statistic
                title="Total de Créditos"
                value={stats.totalCredits}
                precision={2}
                prefix="R$"
                valueStyle={{ color: "#3f8600" }}
              />
              <Statistic
                title="Total de Débitos"
                value={stats.totalDebits}
                precision={2}
                prefix="R$"
                valueStyle={{ color: "#cf1322" }}
              />
              <Statistic
                title="Total de Transações"
                value={stats.transactionCount}
                suffix="transações"
              />
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Tabela de Transações */}
      <Card title="Histórico de Transações" style={{ marginTop: "20px" }}>
        <Table
          dataSource={transactions}
          columns={transactionColumns}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} de ${total} transações`,
          }}
          locale={{
            emptyText: "Nenhuma transação encontrada",
          }}
        />
      </Card>

      {/* Modal de Edição */}
      <Modal
        title="Editar Funcionário"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateEmployee}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Nome"
                name="name"
                rules={[
                  { required: true, message: "Nome é obrigatório!" },
                  { min: 2, message: "Nome deve ter pelo menos 2 caracteres!" },
                ]}
              >
                <Input prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Cargo"
                name="role"
                rules={[{ required: true, message: "Cargo é obrigatório!" }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="CPF" name="cpf">
                <Input prefix={<IdcardOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Telefone" name="phone">
                <Input prefix={<PhoneOutlined />} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[{ type: "email", message: "Email inválido!" }]}
              >
                <Input prefix={<MailOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Data de Contratação" name="hireDate">
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Endereço" name="address">
            <Input prefix={<HomeOutlined />} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Salário Base"
                name="baseSalary"
                rules={[
                  { required: true, message: "Salário é obrigatório!" },
                  {
                    type: "number",
                    min: 0,
                    message: "Salário deve ser maior que zero!",
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  precision={2}
                  formatter={(value) => {
                    const val = Number(value);
                    return isNaN(val)
                      ? "R$ 0,00"
                      : `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  }}
                  parser={(value) => {
                    if (value == null || value === "") return 0;
                    const cleaned = String(value)
                      .replace(/[R$\s]/g, "")
                      .replace(/\./g, "")
                      .replace(",", ".");
                    const num = parseFloat(cleaned);
                    return isNaN(num) ? 0 : num;
                  }}
                  placeholder="0,00"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[{ required: true, message: "Status é obrigatório!" }]}
              >
                <Select>
                  <Option value="Ativo">Ativo</Option>
                  <Option value="Inativo">Inativo</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ textAlign: "right", marginTop: "20px" }}>
            <Button
              onClick={() => setEditModalVisible(false)}
              style={{ marginRight: 8 }}
            >
              Cancelar
            </Button>
            <Button type="primary" htmlType="submit">
              Salvar Alterações
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Adicionar Transação"
        open={transactionModalVisible}
        onCancel={() => setTransactionModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={transactionForm}
          layout="vertical"
          onFinish={handleAddTransaction}
        >
          <Form.Item
            label="Tipo"
            name="type"
            rules={[{ required: true, message: "Tipo é obrigatório!" }]}
          >
            <Select placeholder="Selecione o tipo">
              <Option value="Crédito">Crédito</Option>
              <Option value="Débito">Débito</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Valor"
            name="amount"
            rules={[
              { required: true, message: "Valor é obrigatório!" },
              {
                type: "number",
                min: 0.01,
                message: "Valor deve ser maior que zero!",
              },
            ]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0.01}
              step={0.01}
              formatter={(value) => `R$ ${value}`}
              parser={(value) => value.replace("R$", "")}
            />
          </Form.Item>

          <Form.Item
            label="Data"
            name="date"
            rules={[{ required: true, message: "Data é obrigatória!" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder="Data da transação (opcional)"
            />
          </Form.Item>

          <Form.Item style={{ textAlign: "right", marginTop: "20px" }}>
            <Button
              onClick={() => setTransactionModalVisible(false)}
              style={{ marginRight: 8 }}
            >
              Cancelar
            </Button>
            <Button type="primary" htmlType="submit">
              Adicionar Transação
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

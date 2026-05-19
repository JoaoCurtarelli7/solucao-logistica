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
  Popconfirm,
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
  DownloadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import api from "../../../lib/api";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import { createStandardPdf, addCompactTable } from "../../../utils/pdfTheme";

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
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [editForm] = Form.useForm();
  const [transactionForm] = Form.useForm();

  // Carregar dados do funcionário
  const loadEmployee = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/employees/${id}`, {
        params: {
          month: selectedMonth.month() + 1,
          year: selectedMonth.year(),
        },
      });
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
  }, [id, selectedMonth]);

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
        pixAccount: values.pixAccount || "",
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
      const payload = {
        type: values.type,
        amount: values.amount,
        description: values.description,
        date: values.date ? values.date.format("YYYY-MM-DD") : null,
      };

      const response = editingTransaction
        ? await api.put(
            `/employees/${id}/transactions/${editingTransaction.id}`,
            payload,
          )
        : await api.post(`/employees/${id}/transactions`, payload);

      if (editingTransaction) {
        message.success("Transação atualizada com sucesso!");
      } else {
        message.success("Transação adicionada com sucesso!");
      }
      setTransactionModalVisible(false);
      setEditingTransaction(null);
      transactionForm.resetFields();
      await loadEmployee();
    } catch (error) {
      console.error("Erro ao adicionar transação:", error);
      message.error(
        editingTransaction
          ? "Erro ao atualizar transação"
          : "Erro ao adicionar transação",
      );
    }
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    transactionForm.setFieldsValue({
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description || "",
      date: transaction.date ? dayjs(transaction.date) : null,
    });
    setTransactionModalVisible(true);
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      await api.delete(`/employees/${id}/transactions/${transactionId}`);
      await loadEmployee();
      message.success("Transação removida com sucesso!");
    } catch (error) {
      console.error("Erro ao remover transação:", error);
      message.error("Erro ao remover transação");
    }
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

  const saldoTotalSalario =
    employee?.financialSummary?.salaryTotalBalance ??
    (employee?.baseSalary || 0) + stats.totalCredits - stats.totalDebits;

  const sortByDate = (arr) =>
    [...arr].sort((a, b) => new Date(a.date) - new Date(b.date));

  const credits = sortByDate(transactions.filter((t) => t.type === "Crédito"));
  const debits = sortByDate(transactions.filter((t) => t.type === "Débito"));

  const makeColumns = (type) => [
    {
      title: "Data",
      dataIndex: "date",
      key: "date",
      width: 100,
      render: (date) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Descrição",
      dataIndex: "description",
      key: "description",
      render: (description) => description || "-",
    },
    {
      title: "Valor",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      width: 120,
      render: (amount) => (
        <span
          style={{
            color: type === "Crédito" ? "#52c41a" : "#ff4d4f",
            fontWeight: "bold",
          }}
        >
          {Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditTransaction(record)}
          />
          <Popconfirm
            title="Remover transação?"
            onConfirm={() => handleDeleteTransaction(record.id)}
            okText="Remover"
            cancelText="Cancelar"
            okType="danger"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const exportTransactionsPdf = () => {
    try {
      const { doc } = createStandardPdf({
        title: "Extrato Financeiro do Funcionário",
        companyName: "Solução Logística",
        subtitle: `Funcionário: ${employee.name || "-"} | Competência: ${selectedMonth.format("MM/YYYY")}`,
      });

      const fmtBRL = (v) =>
        Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

      const y1 = addCompactTable(doc, {
        startY: 45,
        head: ["Campo", "Valor"],
        body: [
          ["Cargo", employee.role || "-"],
          ["CPF", employee.cpf || "-"],
          ["Conta Pix", employee.pixAccount || "-"],
          ["Salário Base", fmtBRL(employee.baseSalary)],
          ["Total Créditos", fmtBRL(stats.totalCredits)],
          ["Total Débitos", fmtBRL(stats.totalDebits)],
          ["Totalizador do Salário", fmtBRL(saldoTotalSalario)],
        ],
      });

      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text("Créditos", 14, y1 + 10);
      doc.setFont(undefined, "normal");

      const y2 = addCompactTable(doc, {
        startY: y1 + 14,
        head: ["Data", "Descrição", "Valor"],
        body: credits.map((t) => [
          t.date ? dayjs(t.date).format("DD/MM/YYYY") : "-",
          t.description || "-",
          fmtBRL(t.amount),
        ]),
      });

      doc.setFont(undefined, "bold");
      doc.text("Débitos", 14, y2 + 10);
      doc.setFont(undefined, "normal");

      addCompactTable(doc, {
        startY: y2 + 14,
        head: ["Data", "Descrição", "Valor"],
        body: debits.map((t) => [
          t.date ? dayjs(t.date).format("DD/MM/YYYY") : "-",
          t.description || "-",
          fmtBRL(t.amount),
        ]),
      });

      const finalY = (doc.lastAutoTable?.finalY || 120) + 24;
      doc.setFontSize(10);
      doc.text("Assinatura do responsável:", 14, finalY);
      doc.line(14, finalY + 14, 120, finalY + 14);

      doc.save(`funcionario_${employee.id}_extrato_${dayjs().format("YYYY-MM-DD_HH-mm")}.pdf`);
      message.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF do funcionário:", error);
      message.error("Erro ao exportar PDF");
    }
  };

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
            <Text type="secondary">
              Competência selecionada: {selectedMonth.format("MM/YYYY")}
            </Text>
          </Col>
          <Col>
            <Space>
              <DatePicker
                picker="month"
                allowClear={false}
                value={selectedMonth}
                format="MM/YYYY"
                onChange={(value) => {
                  if (value) setSelectedMonth(value);
                }}
              />
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
                    pixAccount: employee.pixAccount || "",
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
                onClick={() => {
                  setEditingTransaction(null);
                  transactionForm.resetFields();
                  setTransactionModalVisible(true);
                }}
              >
                Adicionar Transação
              </Button>
              <Button
                type="default"
                icon={<DownloadOutlined />}
                onClick={exportTransactionsPdf}
              >
                Exportar PDF
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
              <Descriptions.Item label="Conta Pix" span={2}>
                {employee.pixAccount || "-"}
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
                title="Saldo Total do Salário"
                value={saldoTotalSalario}
                precision={2}
                prefix="R$"
                valueStyle={{ color: saldoTotalSalario >= 0 ? "#3f8600" : "#cf1322" }}
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

      <Card title="Histórico de Salários por Mês" style={{ marginTop: "20px" }}>
        <Table
          dataSource={employee?.monthlyHistory || []}
          rowKey={(record) => `${record.year}-${record.month}`}
          pagination={{ pageSize: 6 }}
          columns={[
            {
              title: "Competência",
              key: "monthYear",
              render: (_, record) =>
                `${String(record.month).padStart(2, "0")}/${record.year}`,
            },
            {
              title: "Créditos",
              dataIndex: "totalCredits",
              align: "right",
              render: (value) =>
                `R$ ${Number(value || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}`,
            },
            {
              title: "Débitos",
              dataIndex: "totalDebits",
              align: "right",
              render: (value) =>
                `R$ ${Number(value || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}`,
            },
            {
              title: "Saldo do Salário",
              dataIndex: "salaryTotalBalance",
              align: "right",
              render: (value) => (
                <span style={{ color: value >= 0 ? "#3f8600" : "#cf1322", fontWeight: 600 }}>
                  {`R$ ${Number(value || 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}`}
                </span>
              ),
            },
          ]}
          locale={{ emptyText: "Sem histórico mensal ainda" }}
        />
      </Card>

      <Card style={{ marginTop: "20px", border: "2px solid #1677ff" }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              Totalizador Final do Salário
            </Title>
            <Text type="secondary">Salário base + créditos - débitos</Text>
          </Col>
          <Col>
            <Title
              level={3}
              style={{
                margin: 0,
                color: saldoTotalSalario >= 0 ? "#3f8600" : "#cf1322",
              }}
            >
              R$ {saldoTotalSalario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </Title>
          </Col>
        </Row>
      </Card>

      <Row gutter={[20, 20]} style={{ marginTop: "20px" }}>
        <Col xs={24} md={12}>
          <Card
            title={
              <span style={{ color: "#3f8600" }}>
                Créditos — {credits.length} lançamento{credits.length !== 1 ? "s" : ""}
              </span>
            }
            extra={
              <Text strong style={{ color: "#3f8600" }}>
                {stats.totalCredits.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })}
              </Text>
            }
          >
            <Table
              dataSource={credits}
              columns={makeColumns("Crédito")}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              locale={{ emptyText: "Nenhum crédito encontrado" }}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title={
              <span style={{ color: "#cf1322" }}>
                Débitos — {debits.length} lançamento{debits.length !== 1 ? "s" : ""}
              </span>
            }
            extra={
              <Text strong style={{ color: "#cf1322" }}>
                {stats.totalDebits.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })}
              </Text>
            }
          >
            <Table
              dataSource={debits}
              columns={makeColumns("Débito")}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              locale={{ emptyText: "Nenhum débito encontrado" }}
            />
          </Card>
        </Col>
      </Row>

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

          <Form.Item label="Conta Pix" name="pixAccount">
            <Input placeholder="Chave Pix (email, CPF, telefone ou aleatória)" />
          </Form.Item>

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
        title={editingTransaction ? "Editar Transação" : "Adicionar Transação"}
        open={transactionModalVisible}
        onCancel={() => {
          setTransactionModalVisible(false);
          setEditingTransaction(null);
          transactionForm.resetFields();
        }}
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
            label="Descrição da transação"
            name="description"
            rules={[{ required: true, message: "Descrição é obrigatória!" }]}
          >
            <Input placeholder="Ex: Adiantamento, desconto INSS, bônus, etc." />
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
              formatter={(value) => {
                const parsed = Number.parseFloat(
                  String(value ?? "0").replace(",", "."),
                );
                if (Number.isNaN(parsed)) return "R$ 0,00";
                return parsed.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  minimumFractionDigits: 2,
                });
              }}
              parser={(value) => {
                if (value == null || value === "") return 0;
                const cleaned = String(value)
                  .replace(/[R$\s]/g, "")
                  .replace(/\./g, "")
                  .replace(",", ".");
                const num = Number.parseFloat(cleaned);
                return Number.isNaN(num) ? 0 : num;
              }}
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
              {editingTransaction ? "Salvar Alterações" : "Adicionar Transação"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

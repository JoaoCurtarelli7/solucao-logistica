import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
  Result,
} from "antd";
import { CalculatorOutlined, CheckOutlined, EyeOutlined, FilePdfOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { createStandardPdf, addCompactTable } from "../../utils/pdfTheme";
import { api } from "../../lib";
import { usePermission } from "../../hooks/usePermission";

const { Text, Title } = Typography;

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toMoney = (value) => Number(value || 0).toFixed(2);

export default function LoadBillingClosing() {
  const { hasPermission } = usePermission();
  const canView = hasPermission("closings.view");
  const canCreate = hasPermission("closings.create");
  const canUpdate = hasPermission("closings.update");

  const [months, setMonths] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loads, setLoads] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (selectedMonth) loadClosings(selectedMonth);
  }, [selectedMonth]);

  const loadBaseData = async () => {
    try {
      const [monthsRes, companiesRes] = await Promise.all([api.get("/months"), api.get("/companies")]);
      const monthList = Array.isArray(monthsRes.data) ? monthsRes.data : [];
      setMonths(monthList);
      setCompanies(companiesRes.data || []);
      if (!selectedMonth && monthList.length > 0) {
        const sorted = [...monthList].sort((a, b) => b.year - a.year || b.month - a.month);
        setSelectedMonth(sorted[0].id);
      }
    } catch {
      message.error("Erro ao carregar dados iniciais");
    }
  };

  const loadClosings = async (monthId) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/load-billing-closings?monthId=${monthId}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      message.error(error.response?.data?.message || "Erro ao carregar fechamentos de carga");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    form.resetFields();
    const monthData = months.find((m) => m.id === selectedMonth);
    if (monthData) {
      form.setFieldsValue({ name: `Faturamento ${monthData.name}`, closingType: "month" });
    }
    setIsModalOpen(true);
  };

  const buildRangeByType = (values) => {
    const type = values?.closingType;
    const monthPicker = values?.monthPicker ? dayjs(values.monthPicker) : null;
    if (monthPicker && monthPicker.isValid()) {
      if (type === "month") {
        return [monthPicker.startOf("month"), monthPicker.endOf("month")];
      }
      if (type === "first_half") {
        return [monthPicker.startOf("month"), monthPicker.date(15)];
      }
      if (type === "second_half") {
        return [monthPicker.date(16), monthPicker.endOf("month")];
      }
    }
    if (type === "custom" && values?.range?.[0] && values?.range?.[1]) {
      return [values.range[0], values.range[1]];
    }
    return [null, null];
  };

  const onCreate = async (values) => {
    try {
      setCreating(true);
      const [start, end] = buildRangeByType(values);
      if (!start || !end) {
        message.warning("Selecione um período válido para criar o fechamento.");
        return;
      }
      const payload = {
        monthId: selectedMonth,
        companyId: values.companyId,
        name: values.name,
        startDate: start.format("DD/MM/YYYY"),
        endDate: end.format("DD/MM/YYYY"),
      };
      await api.post("/load-billing-closings", payload);
      message.success("Fechamento de carga criado com sucesso");
      setIsModalOpen(false);
      form.resetFields();
      loadClosings(selectedMonth);
    } catch (error) {
      message.error(error.response?.data?.message || "Erro ao criar fechamento de carga");
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (row) => {
    try {
      setDetailOpen(true);
      setDetailLoading(true);
      const { data } = await api.get(`/load-billing-closings/${row.id}/loads`);
      setDetail(data.closing);
      setLoads(data.loads || []);
    } catch {
      message.error("Erro ao carregar detalhe do fechamento");
    } finally {
      setDetailLoading(false);
    }
  };

  const recalculate = async (id) => {
    try {
      await api.post(`/load-billing-closings/${id}/recalculate`);
      message.success("Fechamento recalculado com sucesso");
      loadClosings(selectedMonth);
    } catch {
      message.error("Erro ao recalcular fechamento");
    }
  };

  const finalize = async (id) => {
    try {
      await api.post(`/load-billing-closings/${id}/finalize`);
      message.success("Fechamento de carga finalizado. O valor foi registrado como entrada no caixa.");
      loadClosings(selectedMonth);
      setDetailOpen(false);
    } catch (err) {
      message.error(err.response?.data?.message || "Erro ao finalizar fechamento de carga");
    }
  };

  const exportDetailPdf = () => {
    if (!detail) {
      message.warning("Abra um fechamento para exportar.");
      return;
    }
    const period = `${dayjs(detail.startDate).format("DD/MM/YYYY")} a ${dayjs(detail.endDate).format("DD/MM/YYYY")}`;
    const { doc } = createStandardPdf({
      title: "Fechamento de Cargas - Faturamento",
      companyName: detail.Company?.name || "-",
      subtitle: `Período: ${period}`,
    });

    const y1 = addCompactTable(doc, {
      startY: 45,
      head: ["Total Cargas", "Valor Bruto (Base Comissão)", "Frete Total", "Comissão a Cobrar", "Taxa (%)"],
      body: [[
        String(detail.totalLoads || 0),
        formatCurrency(detail.totalGrossValue),
        formatCurrency(detail.totalFreight),
        formatCurrency(detail.totalCommission),
        `${Number(detail.commissionRate || 0).toFixed(2)}%`,
      ]],
    });
    addCompactTable(doc, {
      startY: y1 + 6,
      head: ["Data", "Carga", "Entregas", "Peso (kg)", "Valor Total", "Frete"],
      body: (loads || []).map((l) => [
        dayjs(l.date).format("DD/MM/YYYY"),
        l.loadingNumber || "-",
        String(l.deliveries || 0),
        Number(l.cargoWeight || 0).toLocaleString("pt-BR"),
        formatCurrency(l.totalValue),
        formatCurrency(l.totalFreight),
      ]),
    });

    const safeName = String(detail.name || "fechamento").replace(/[^\w\d-_]+/g, "_");
    doc.save(`fechamento_cargas_${safeName}.pdf`);
  };

  const columns = useMemo(
    () => [
      {
        title: "Nome",
        dataIndex: "name",
        key: "name",
        width: 220,
        ellipsis: true,
        render: (_, record) => (
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary">{record.Company?.name}</Text>
          </div>
        ),
      },
      {
        title: "Período",
        key: "period",
        width: 170,
        render: (_, record) => (
          <Text>
            {dayjs(record.startDate).format("DD/MM/YYYY")} até {dayjs(record.endDate).format("DD/MM/YYYY")}
          </Text>
        ),
      },
      {
        title: "Cargas",
        dataIndex: "totalLoads",
        key: "totalLoads",
        align: "right",
        width: 80,
      },
      {
        title: "Valor Bruto",
        dataIndex: "totalGrossValue",
        key: "totalGrossValue",
        align: "right",
        width: 130,
        render: (v) => <Text>{formatCurrency(v)}</Text>,
      },
      {
        title: "Comissão a Cobrar",
        key: "commission",
        align: "right",
        width: 150,
        render: (_, record) => (
          <Text>
            {record.commissionRate?.toFixed(2)}% ({formatCurrency(record.totalCommission)})
          </Text>
        ),
      },
      {
        title: "Valor a Cobrar",
        dataIndex: "billingTotal",
        key: "billingTotal",
        align: "right",
        width: 130,
        render: (v) => <Text strong>{formatCurrency(v)}</Text>,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 90,
        render: (s) => <Tag color={s === "fechado" ? "green" : "blue"}>{s}</Tag>,
      },
      {
        title: "Ações",
        key: "actions",
        width: 120,
        render: (_, record) => (
          <Space>
            <Button icon={<EyeOutlined />} size="small" onClick={() => openDetail(record)} />
            {canUpdate && record.status === "aberto" && (
              <Popconfirm
                title="Finalizar este fechamento?"
                description="O valor a cobrar será registrado como entrada no fechamento de caixa do mês."
                onConfirm={() => finalize(record.id)}
                okText="Sim, finalizar"
                cancelText="Cancelar"
              >
                <Button type="primary" size="small" icon={<CheckOutlined />}>
                  Finalizar
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [canUpdate],
  );

  const loadColumns = [
    { title: "Data da Carga", dataIndex: "date", key: "date", width: 120, render: (d) => dayjs(d).format("DD/MM/YYYY") },
    { title: "Nº Carga", dataIndex: "loadingNumber", key: "loadingNumber", width: 120, ellipsis: true },
    { title: "Entregas", dataIndex: "deliveries", key: "deliveries", width: 90, align: "right" },
    {
      title: "Peso (kg)",
      dataIndex: "cargoWeight",
      key: "cargoWeight",
      width: 110,
      align: "right",
      render: (v) => Number(v || 0).toLocaleString("pt-BR"),
    },
    {
      title: "Valor Total",
      dataIndex: "totalValue",
      key: "totalValue",
      width: 130,
      align: "right",
      render: (v) => formatCurrency(v),
    },
    {
      title: "Comissão",
      key: "commissionValue",
      width: 120,
      align: "right",
      render: (_, row) => {
        const rate = Number(detail?.commissionRate || 0);
        const totalValue = Number(row?.totalValue || 0);
        const value = (totalValue * rate) / 100;
        return formatCurrency(value);
      },
    },
  ];

  if (!canView) {
    return <Result status="403" title="Acesso negado" subTitle="Você não tem permissão para visualizar fechamentos de carga." />;
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.loads += Number(r.totalLoads || 0);
      acc.gross += Number(r.totalGrossValue || 0);
      acc.commission += Number(r.totalCommission || 0);
      acc.billing += Number(r.billingTotal || 0);
      return acc;
    },
    { loads: 0, gross: 0, commission: 0, billing: 0 },
  );

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" gutter={12}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              <CalculatorOutlined /> Fechamento de Cargas (Faturamento)
            </Title>
            <Text type="secondary">Módulo separado para cobrança de cliente baseado em cargas e comissão.</Text>
          </Col>
          <Col>
            <Space>
              <Select
                style={{ width: 220 }}
                placeholder="Selecione o mês"
                value={selectedMonth}
                onChange={setSelectedMonth}
              >
                {months.map((m) => (
                  <Select.Option key={m.id} value={m.id}>
                    {m.name}
                  </Select.Option>
                ))}
              </Select>
              {canCreate && (
                <Button type="primary" onClick={openCreate} disabled={!selectedMonth}>
                  Novo Fechamento de Carga
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        {!selectedMonth && <Alert type="info" showIcon message="Selecione um mês para visualizar os fechamentos." />}
        {selectedMonth && (
          <>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={6}>
                <Statistic title="Total de Cargas" value={totals.loads} />
              </Col>
              <Col span={6}>
                <Statistic title="Valor Bruto" value={totals.gross} precision={2} suffix="R$" />
              </Col>
              <Col span={6}>
                <Statistic title="Comissão a Cobrar" value={totals.commission} precision={2} suffix="R$" />
              </Col>
              <Col span={6}>
                <Statistic title="Valor a Cobrar" value={totals.billing} precision={2} suffix="R$" />
              </Col>
            </Row>
            <Table
              rowKey="id"
              dataSource={rows}
              columns={columns}
              loading={loading}
              locale={{ emptyText: "Nenhum fechamento de carga para o mês selecionado." }}
              size="small"
              tableLayout="fixed"
              scroll={{ x: 900 }}
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
          </>
        )}
      </Card>

      <Modal
        title="Novo Fechamento de Carga"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item name="name" label="Nome" rules={[{ required: true, message: "Nome obrigatório" }]}>
            <Input placeholder="Ex: Faturamento 1ª quinzena fev/2026" />
          </Form.Item>
          <Form.Item name="companyId" label="Empresa" rules={[{ required: true, message: "Empresa obrigatória" }]}>
            <Select placeholder="Selecione a empresa" showSearch optionFilterProp="children">
              {companies.map((c) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="closingType"
            label="Tipo de Fechamento"
            initialValue="month"
            rules={[{ required: true, message: "Selecione o tipo de fechamento" }]}
          >
            <Select>
              <Select.Option value="month">Mês Completo</Select.Option>
              <Select.Option value="first_half">1ª Quinzena</Select.Option>
              <Select.Option value="second_half">2ª Quinzena</Select.Option>
              <Select.Option value="custom">Período Personalizado</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue, setFieldsValue }) => {
              const closingType = getFieldValue("closingType");
              if (closingType === "custom") {
                return (
                  <Form.Item
                    name="range"
                    label="Período Personalizado"
                    rules={[{ required: true, message: "Selecione data inicial e final" }]}
                  >
                    <DatePicker.RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                );
              }
              return (
                <Form.Item
                  name="monthPicker"
                  label="Mês Base"
                  rules={[{ required: true, message: "Selecione o mês base" }]}
                >
                  <DatePicker
                    picker="month"
                    style={{ width: "100%" }}
                    format="MM/YYYY"
                    onChange={(date) => {
                      if (!date) return;
                      const label =
                        closingType === "first_half"
                          ? `Faturamento 1ª quinzena ${date.format("MMM/YYYY")}`
                          : closingType === "second_half"
                            ? `Faturamento 2ª quinzena ${date.format("MMM/YYYY")}`
                            : `Faturamento ${date.format("MMMM/YYYY")}`;
                      setFieldsValue({ name: label });
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Button htmlType="submit" type="primary" block loading={creating}>
            Criar
          </Button>
        </Form>
      </Modal>

      <Modal
        title={detail?.name || "Visualizar fechamento"}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          canUpdate && detail?.status === "aberto" ? (
            <Popconfirm
              title="Finalizar este fechamento?"
              description="O valor a cobrar será registrado como entrada no fechamento de caixa do mês."
              onConfirm={() => detail && finalize(detail.id)}
              okText="Sim, finalizar"
              cancelText="Cancelar"
            >
              <Button type="primary" icon={<CheckOutlined />}>
                Finalizar e registrar entrada no caixa
              </Button>
            </Popconfirm>
          ) : null
        }
        width={1100}
      >
        <Row justify="end" style={{ marginBottom: 10 }}>
          <Button icon={<FilePdfOutlined />} type="primary" onClick={exportDetailPdf} disabled={!detail}>
            Exportar PDF
          </Button>
        </Row>
        <Card size="small" style={{ marginBottom: 12, background: "#fafcff", borderColor: "#e6f0ff" }}>
          <Row gutter={12} align="middle">
            <Col span={24}>
              <Text type="secondary">
                Empresa: <Text strong>{detail?.Company?.name || "-"}</Text> | Período:{" "}
                <Text strong>
                  {detail?.startDate ? dayjs(detail.startDate).format("DD/MM/YYYY") : "-"} até{" "}
                  {detail?.endDate ? dayjs(detail.endDate).format("DD/MM/YYYY") : "-"}
                </Text>
              </Text>
            </Col>
          </Row>
          <Row gutter={12} style={{ marginTop: 12 }}>
            <Col span={8}>
              <Statistic title="Total Cargas" value={detail?.totalLoads || 0} />
            </Col>
            <Col span={8}>
              <Statistic title="Valor Bruto" value={detail?.totalGrossValue || 0} precision={2} suffix="R$" />
            </Col>
            <Col span={8}>
              <Statistic title="Comissão a Cobrar" value={detail?.billingTotal || 0} precision={2} suffix="R$" />
            </Col>
          </Row>
          <Row style={{ marginTop: 8 }}>
            <Col span={24}>
              <Tag color="blue" style={{ padding: "4px 8px" }}>
                Comissão: {toMoney(detail?.totalGrossValue)} x {toMoney(detail?.commissionRate)}% ={" "}
                <strong>{formatCurrency(detail?.totalCommission)}</strong>
              </Tag>
            </Col>
          </Row>
        </Card>
        <Table
          rowKey="id"
          loading={detailLoading}
          dataSource={loads}
          columns={loadColumns}
          size="small"
          tableLayout="fixed"
          scroll={{ x: 980, y: 420 }}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          locale={{ emptyText: "Nenhuma carga encontrada para este fechamento." }}
        />
      </Modal>
    </div>
  );
}

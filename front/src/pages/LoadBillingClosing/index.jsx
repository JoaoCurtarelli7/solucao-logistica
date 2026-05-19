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
import {
  CalculatorOutlined,
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { createStandardPdf, addCompactTable } from "../../utils/pdfTheme";
import { api } from "../../lib";
import { usePermission } from "../../hooks/usePermission";

const { Text, Title } = Typography;

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const toMoney = (value) => Number(value || 0).toFixed(2);

const DOCUMENT_TYPES = [
  { value: "CTE", label: "CT-e" },
  { value: "NF", label: "Nota Fiscal" },
  { value: "FATURA", label: "Fatura" },
  { value: "OUTRO", label: "Outro" },
];

export default function LoadBillingClosing() {
  const { hasPermission } = usePermission();
  const canView = hasPermission("closings.view");
  const canCreate = hasPermission("closings.create");
  const canUpdate = hasPermission("closings.update");
  const canDelete = hasPermission("closings.delete");

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

  // Filtros
  const [filterDateRange, setFilterDateRange] = useState(null);
  const [filterLoadNumber, setFilterLoadNumber] = useState("");
  const [sortOrder, setSortOrder] = useState("createdAt");

  // Modal doc
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docForm] = Form.useForm();
  const [editingDocRow, setEditingDocRow] = useState(null);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (selectedMonth) loadClosings(selectedMonth);
  }, [selectedMonth]);

  const loadBaseData = async () => {
    try {
      const [monthsRes, companiesRes] = await Promise.all([
        api.get("/months"),
        api.get("/companies"),
      ]);
      const monthList = Array.isArray(monthsRes.data) ? monthsRes.data : [];
      setMonths(monthList);
      setCompanies(companiesRes.data || []);
      if (!selectedMonth && monthList.length > 0) {
        const sorted = [...monthList].sort(
          (a, b) => b.year - a.year || b.month - a.month,
        );
        setSelectedMonth(sorted[0].id);
      }
    } catch {
      message.error("Erro ao carregar dados iniciais");
    }
  };

  const loadClosings = async (monthId) => {
    try {
      setLoading(true);
      const { data } = await api.get(
        `/load-billing-closings?monthId=${monthId}&orderBy=${sortOrder}`,
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      message.error(
        error.response?.data?.message ||
          "Erro ao carregar fechamentos de carga",
      );
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    form.resetFields();
    const monthData = months.find((m) => m.id === selectedMonth);
    if (monthData) {
      form.setFieldsValue({
        name: `Faturamento ${monthData.name}`,
        closingType: "month",
      });
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
      return [
        dayjs(values.range[0]).startOf("day"),
        dayjs(values.range[1]).endOf("day"),
      ];
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
        documentType: values.documentType || null,
        documentNumber: values.documentNumber || null,
      };
      await api.post("/load-billing-closings", payload);
      message.success("Fechamento de carga criado com sucesso");
      setIsModalOpen(false);
      form.resetFields();
      loadClosings(selectedMonth);
    } catch (error) {
      message.error(
        error.response?.data?.message || "Erro ao criar fechamento de carga",
      );
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/load-billing-closings/${id}`);
      message.success("Fechamento excluído com sucesso");
      loadClosings(selectedMonth);
    } catch (error) {
      message.error(
        error.response?.data?.message || "Erro ao excluir fechamento",
      );
    }
  };

  const openDocModal = (row) => {
    setEditingDocRow(row);
    docForm.setFieldsValue({
      documentType: row.documentType || null,
      documentNumber: row.documentNumber || "",
    });
    setDocModalOpen(true);
  };

  const onSaveDoc = async (values) => {
    try {
      await api.patch(`/load-billing-closings/${editingDocRow.id}/document`, {
        documentType: values.documentType || null,
        documentNumber: values.documentNumber || null,
      });
      message.success("Documento vinculado com sucesso");
      setDocModalOpen(false);
      loadClosings(selectedMonth);
    } catch {
      message.error("Erro ao salvar documento");
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
      message.success(
        "Fechamento de carga finalizado. O valor foi registrado como entrada no caixa.",
      );
      loadClosings(selectedMonth);
      setDetailOpen(false);
    } catch (err) {
      message.error(
        err.response?.data?.message || "Erro ao finalizar fechamento de carga",
      );
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
      head: [
        "Total Cargas",
        "Entregas",
        "Peso Total (kg)",
        "Valor Bruto",
        "Comissão s/ bruto",
        "Custos adicionais",
        "Valor a cobrar",
        "Taxa (%)",
      ],
      body: [
        [
          String(detail.totalLoads || 0),
          String(detail.totalDeliveries || 0),
          Number(detail.totalWeight || 0).toLocaleString("pt-BR"),
          formatCurrency(detail.totalGrossValue),
          formatCurrency(detail.totalCommission),
          formatCurrency(detail.totalAdditionalCosts),
          formatCurrency(detail.billingTotal),
          `${Number(detail.commissionRate || 0).toFixed(2)}%`,
        ],
      ],
    });

    if (detail.documentType || detail.documentNumber) {
      doc.setFontSize(9);
      doc.text(
        `Documento: ${detail.documentType || ""} nº ${detail.documentNumber || ""}`,
        14,
        y1 + 4,
      );
    }

    addCompactTable(doc, {
      startY: y1 + (detail.documentType || detail.documentNumber ? 10 : 6),
      head: [
        "Data",
        "Carga",
        "Entregas",
        "Peso (kg)",
        "Valor Total",
        "Comissão",
        "Adicionais",
        "Total a cobrar",
      ],
      body: (loads || []).map((l) => {
        const rate = Number(detail.commissionRate || 0);
        const tv = Number(l.totalValue || 0);
        const com = (tv * rate) / 100;
        const add = Number(l.additionalCosts || 0);
        return [
          dayjs(l.date).format("DD/MM/YYYY"),
          l.loadingNumber || "-",
          String(l.deliveries || 0),
          Number(l.cargoWeight || 0).toLocaleString("pt-BR"),
          formatCurrency(l.totalValue),
          formatCurrency(com),
          formatCurrency(add),
          formatCurrency(l.totalFreight ?? com + add),
        ];
      }),
    });

    const safeName = String(detail.name || "fechamento").replace(
      /[^\w\d-_]+/g,
      "_",
    );
    doc.save(`fechamento_cargas_${safeName}.pdf`);
  };

  // Filtragem local dos rows
  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (filterDateRange?.[0] && filterDateRange?.[1]) {
      const from = filterDateRange[0].startOf("day");
      const to = filterDateRange[1].endOf("day");
      result = result.filter((r) => {
        const start = dayjs(r.startDate);
        const end = dayjs(r.endDate);
        return (
          (start.isAfter(from) || start.isSame(from)) &&
          (end.isBefore(to) || end.isSame(to))
        );
      });
    }

    if (filterLoadNumber.trim()) {
      const q = filterLoadNumber.toLowerCase();
      result = result.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.documentNumber?.toLowerCase().includes(q),
      );
    }

    if (sortOrder === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortOrder === "company")
      result.sort((a, b) =>
        (a.Company?.name || "").localeCompare(b.Company?.name || ""),
      );
    else if (sortOrder === "startDate")
      result.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    else result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return result;
  }, [rows, filterDateRange, filterLoadNumber, sortOrder]);

  const columns = useMemo(
    () => [
      {
        title: "Nome",
        dataIndex: "name",
        key: "name",
        width: 200,
        ellipsis: true,
        render: (_, record) => (
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary">{record.Company?.name}</Text>
            {(record.documentType || record.documentNumber) && (
              <div>
                <Tag color="blue" style={{ fontSize: 11, marginTop: 2 }}>
                  {record.documentType} {record.documentNumber}
                </Tag>
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Período",
        key: "period",
        width: 170,
        render: (_, record) => (
          <Text>
            {dayjs(record.startDate).format("DD/MM/YYYY")} até{" "}
            {dayjs(record.endDate).format("DD/MM/YYYY")}
          </Text>
        ),
      },
      {
        title: "Cargas",
        dataIndex: "totalLoads",
        key: "totalLoads",
        align: "right",
        width: 70,
      },
      {
        title: "Entregas",
        dataIndex: "totalDeliveries",
        key: "totalDeliveries",
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
            {record.commissionRate?.toFixed(2)}% (
            {formatCurrency(record.totalCommission)})
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
        render: (s) => (
          <Tag color={s === "fechado" ? "green" : "blue"}>{s}</Tag>
        ),
      },
      {
        title: "Ações",
        key: "actions",
        width: 150,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EyeOutlined />}
              size="small"
              title="Visualizar"
              onClick={() => openDetail(record)}
            />
            {canUpdate && (
              <Button
                icon={<EditOutlined />}
                size="small"
                title="Vincular documento"
                onClick={() => openDocModal(record)}
              />
            )}
            {canUpdate && record.status === "aberto" && (
              <Popconfirm
                title="Finalizar este fechamento?"
                description="O valor a cobrar será registrado como entrada no fechamento de caixa do mês."
                onConfirm={() => finalize(record.id)}
                okText="Sim, finalizar"
                cancelText="Cancelar"
              >
                <Button type="primary" size="small" icon={<CheckOutlined />} title="Finalizar" />
              </Popconfirm>
            )}
            {canDelete && record.status !== "fechado" && (
              <Popconfirm
                title="Excluir este fechamento?"
                description="Esta ação não pode ser desfeita."
                onConfirm={() => onDelete(record.id)}
                okText="Sim, excluir"
                cancelText="Cancelar"
              >
                <Button danger icon={<DeleteOutlined />} size="small" title="Excluir" />
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [canUpdate, canDelete],
  );

  const loadColumns = [
    {
      title: "Data da Carga",
      dataIndex: "date",
      key: "date",
      width: 120,
      render: (d) => dayjs(d).format("DD/MM/YYYY"),
    },
    {
      title: "Nº Carga",
      dataIndex: "loadingNumber",
      key: "loadingNumber",
      width: 120,
      ellipsis: true,
    },
    {
      title: "Entregas",
      dataIndex: "deliveries",
      key: "deliveries",
      width: 90,
      align: "right",
    },
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
      width: 120,
      align: "right",
      render: (v) => formatCurrency(v),
    },
    {
      title: "Comissão",
      key: "commissionValue",
      width: 110,
      align: "right",
      render: (_, row) => {
        const rate = Number(detail?.commissionRate || 0);
        const totalValue = Number(row?.totalValue || 0);
        const value = (totalValue * rate) / 100;
        return formatCurrency(value);
      },
    },
    {
      title: "Adicionais",
      dataIndex: "additionalCosts",
      key: "additionalCosts",
      width: 100,
      align: "right",
      render: (v) => formatCurrency(v),
    },
    {
      title: "Total a cobrar",
      key: "lineTotal",
      width: 120,
      align: "right",
      render: (_, row) => {
        const rate = Number(detail?.commissionRate || 0);
        const totalValue = Number(row?.totalValue || 0);
        const com = (totalValue * rate) / 100;
        const add = Number(row?.additionalCosts || 0);
        return formatCurrency(Number(row?.totalFreight ?? com + add));
      },
    },
  ];

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar fechamentos de carga."
      />
    );
  }

  const totals = filteredRows.reduce(
    (acc, r) => {
      acc.loads += Number(r.totalLoads || 0);
      acc.deliveries += Number(r.totalDeliveries || 0);
      acc.gross += Number(r.totalGrossValue || 0);
      acc.commission += Number(r.totalCommission || 0);
      acc.additional += Number(r.totalAdditionalCosts || 0);
      acc.billing += Number(r.billingTotal || 0);
      return acc;
    },
    { loads: 0, deliveries: 0, gross: 0, commission: 0, additional: 0, billing: 0 },
  );

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" gutter={12}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              <CalculatorOutlined /> Fechamento de Cargas (Faturamento)
            </Title>
            <Text type="secondary">
              Módulo separado para cobrança de cliente baseado em cargas e comissão.
            </Text>
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
                <Button
                  type="primary"
                  onClick={openCreate}
                  disabled={!selectedMonth}
                >
                  Novo Fechamento de Carga
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        {!selectedMonth && (
          <Alert
            type="info"
            showIcon
            message="Selecione um mês para visualizar os fechamentos."
          />
        )}
        {selectedMonth && (
          <>
            {/* Filtros */}
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col>
                <DatePicker.RangePicker
                  format="DD/MM/YYYY"
                  placeholder={["Data início", "Data fim"]}
                  value={filterDateRange}
                  onChange={setFilterDateRange}
                  allowClear
                />
              </Col>
              <Col>
                <Input.Search
                  placeholder="Buscar por nome ou nº documento"
                  value={filterLoadNumber}
                  onChange={(e) => setFilterLoadNumber(e.target.value)}
                  allowClear
                  style={{ width: 260 }}
                />
              </Col>
              <Col>
                <Select
                  value={sortOrder}
                  onChange={setSortOrder}
                  style={{ width: 180 }}
                >
                  <Select.Option value="createdAt">Ordem de lançamento</Select.Option>
                  <Select.Option value="startDate">Por data</Select.Option>
                  <Select.Option value="name">Alfabético</Select.Option>
                  <Select.Option value="company">Por empresa</Select.Option>
                </Select>
              </Col>
            </Row>

            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={3}>
                <Statistic title="Total de Cargas" value={totals.loads} />
              </Col>
              <Col span={3}>
                <Statistic title="Entregas" value={totals.deliveries} />
              </Col>
              <Col span={5}>
                <Statistic
                  title="Valor Bruto"
                  value={totals.gross}
                  formatter={(v) => formatCurrency(v)}
                />
              </Col>
              <Col span={5}>
                <Statistic
                  title="Comissão (s/ bruto)"
                  value={totals.commission}
                  formatter={(v) => formatCurrency(v)}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="Custos adicionais"
                  value={totals.additional}
                  formatter={(v) => formatCurrency(v)}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="Valor a Cobrar"
                  value={totals.billing}
                  formatter={(v) => formatCurrency(v)}
                />
              </Col>
            </Row>
            <Table
              rowKey="id"
              dataSource={filteredRows}
              columns={columns}
              loading={loading}
              locale={{
                emptyText: "Nenhum fechamento de carga para o mês selecionado.",
              }}
              size="small"
              tableLayout="fixed"
              scroll={{ x: 1100 }}
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
          </>
        )}
      </Card>

      {/* Modal criar */}
      <Modal
        title="Novo Fechamento de Carga"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item
            name="name"
            label="Nome"
            rules={[{ required: true, message: "Nome obrigatório" }]}
          >
            <Input placeholder="Ex: Faturamento 1ª quinzena fev/2026" />
          </Form.Item>
          <Form.Item
            name="companyId"
            label="Empresa"
            rules={[{ required: true, message: "Empresa obrigatória" }]}
          >
            <Select
              placeholder="Selecione a empresa"
              showSearch
              optionFilterProp="children"
            >
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
                    <DatePicker.RangePicker
                      style={{ width: "100%" }}
                      format="DD/MM/YYYY"
                    />
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

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="documentType" label="Tipo de Documento">
                <Select placeholder="Selecione (opcional)" allowClear>
                  {DOCUMENT_TYPES.map((d) => (
                    <Select.Option key={d.value} value={d.value}>
                      {d.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="documentNumber" label="Número do Documento">
                <Input placeholder="Ex: 001234" />
              </Form.Item>
            </Col>
          </Row>

          <Button htmlType="submit" type="primary" block loading={creating}>
            Criar
          </Button>
        </Form>
      </Modal>

      {/* Modal vincular documento */}
      <Modal
        title="Vincular Documento ao Fechamento"
        open={docModalOpen}
        onCancel={() => setDocModalOpen(false)}
        footer={null}
        width={420}
      >
        <Form form={docForm} layout="vertical" onFinish={onSaveDoc}>
          <Form.Item name="documentType" label="Tipo de Documento">
            <Select placeholder="Selecione" allowClear>
              {DOCUMENT_TYPES.map((d) => (
                <Select.Option key={d.value} value={d.value}>
                  {d.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="documentNumber" label="Número do Documento">
            <Input placeholder="Ex: 001234" />
          </Form.Item>
          <Button htmlType="submit" type="primary" block>
            Salvar
          </Button>
        </Form>
      </Modal>

      {/* Modal visualizar detalhe */}
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
          <Button
            icon={<FilePdfOutlined />}
            type="primary"
            onClick={exportDetailPdf}
            disabled={!detail}
          >
            Exportar PDF
          </Button>
        </Row>
        <Card
          size="small"
          style={{ marginBottom: 12, background: "#fafcff", borderColor: "#e6f0ff" }}
        >
          <Row gutter={12} align="middle">
            <Col span={24}>
              <Text type="secondary">
                Empresa: <Text strong>{detail?.Company?.name || "-"}</Text> |
                Período:{" "}
                <Text strong>
                  {detail?.startDate
                    ? dayjs(detail.startDate).format("DD/MM/YYYY")
                    : "-"}{" "}
                  até{" "}
                  {detail?.endDate
                    ? dayjs(detail.endDate).format("DD/MM/YYYY")
                    : "-"}
                </Text>
                {(detail?.documentType || detail?.documentNumber) && (
                  <>
                    {" | "}
                    Documento:{" "}
                    <Text strong>
                      {detail?.documentType} nº {detail?.documentNumber}
                    </Text>
                  </>
                )}
              </Text>
            </Col>
          </Row>
          <Row gutter={12} style={{ marginTop: 12 }}>
            <Col span={4}>
              <Statistic title="Total Cargas" value={detail?.totalLoads || 0} />
            </Col>
            <Col span={4}>
              <Statistic title="Entregas" value={detail?.totalDeliveries || 0} />
            </Col>
            <Col span={4}>
              <Statistic
                title="Peso Total (kg)"
                value={Number(detail?.totalWeight || 0).toLocaleString("pt-BR")}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Valor Bruto"
                value={detail?.totalGrossValue || 0}
                formatter={(v) => formatCurrency(v)}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Comissão (s/ bruto)"
                value={detail?.totalCommission || 0}
                formatter={(v) => formatCurrency(v)}
              />
            </Col>
          </Row>
          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col span={6}>
              <Statistic
                title="Custos adicionais"
                value={detail?.totalAdditionalCosts || 0}
                formatter={(v) => formatCurrency(v)}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Valor a cobrar"
                value={detail?.billingTotal || 0}
                formatter={(v) => formatCurrency(v)}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: 8 }}>
            <Col span={24}>
              <Tag color="blue" style={{ padding: "4px 8px" }}>
                Comissão: {toMoney(detail?.totalGrossValue)} ×{" "}
                {toMoney(detail?.commissionRate)}% ={" "}
                <strong>{formatCurrency(detail?.totalCommission)}</strong>
                {" · "}
                Adicionais:{" "}
                <strong>{formatCurrency(detail?.totalAdditionalCosts)}</strong>
                {" · "}
                Total: <strong>{formatCurrency(detail?.billingTotal)}</strong>
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

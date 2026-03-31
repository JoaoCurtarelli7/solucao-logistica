import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  message,
  Popconfirm,
  Space,
  DatePicker,
  Select,
  Input,
  Tooltip,
  Result,
  Typography,
  Tag,
  Row,
  Col,
} from "antd";
import * as XLSX from "xlsx";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  ApartmentOutlined,
  DollarOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import CustomModalLoad from "../../../components/Modal/Load";
import api from "../../../lib/api";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { usePermission } from "@/hooks/usePermission";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

export default function LoadCompanies() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoad, setEditingLoad] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<any>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "recent" | "old">(
    "all",
  );

  const canView = hasPermission("loads.view");
  const canCreate = hasPermission("loads.create");
  const canUpdate = hasPermission("loads.update");
  const canDelete = hasPermission("loads.delete");

  useEffect(() => {
    fetchCompanies();
    fetchAllLoads();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get("/companies");
      setCompanies(response.data);
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
      message.error("Erro ao carregar empresas");
    }
  };

  const mapLoadRow = (load: any) => {
    const totalValue = Number(load.totalValue || 0);
    const companyCommission = Number(load.Company?.commission || 0);
    const commissionValue = Number(
      ((totalValue * companyCommission) / 100).toFixed(2),
    );
    const frete4 = Number(load.freight4 ?? commissionValue);
    const additionalCosts = Number(load.additionalCosts ?? 0);
    const somaTotalFrete = Number(
      load.totalFreight ?? frete4 + additionalCosts,
    );

    return {
      key: load.id,
      id: load.id,
      data: dayjs(load.date).format("DD/MM/YYYY"),
      numeroCarregamento: load.loadingNumber,
      entregas: load.deliveries,
      pesoCarga: load.cargoWeight,
      valorTotal: totalValue,
      frete4,
      additionalCosts,
      somaTotalFrete,
      commissionRate: companyCommission,
      observacoes: load.observations || "",
      companyId: load.companyId,
      companyName: load.Company?.name || "",
      companyCnpj: load.Company?.cnpj || "",
      rawData: load,
    };
  };

  const fetchAllLoads = async () => {
    setLoading(true);
    try {
      const response = await api.get("/loads");
      const formattedData = response.data.map(mapLoadRow);
      setData(formattedData);
    } catch (error) {
      console.error("Erro ao buscar cargas:", error);
      message.error("Erro ao carregar cargas");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLoad = async (newLoad: any) => {
    try {
      const loadData = {
        companyId: Number(newLoad.companyId),
        date: dayjs(newLoad.data, "DD/MM/YYYY").toDate(),
        loadingNumber: newLoad.numeroCarregamento,
        deliveries: Number(newLoad.entregas),
        cargoWeight: Number(newLoad.pesoCarga),
        totalValue: Number(newLoad.valorTotal),
        freight4: Number(newLoad.frete4),
        totalFreight: Number(newLoad.somaTotalFrete),
        additionalCosts: Number(newLoad.additionalCosts ?? 0),
        additionalCostsNote: newLoad.additionalCostsNote?.trim() || undefined,
        observations: newLoad.observacoes?.trim() || undefined,
      };

      await api.post("/loads", loadData);
      message.success(
        "Carga cadastrada! Preencha para adicionar outra ou clique em Cancelar para fechar.",
      );
      fetchAllLoads();
      // Mantém o modal aberto para cadastrar mais cargas
    } catch (error: any) {
      console.error("Erro ao criar carga:", error);
      message.error(error.response?.data?.message || "Erro ao criar carga");
    }
  };

  const handleEditLoad = async (updatedLoad: any) => {
    try {
      const loadData = {
        companyId: Number(updatedLoad.companyId),
        date: dayjs(updatedLoad.data, "DD/MM/YYYY").toDate(),
        loadingNumber: updatedLoad.numeroCarregamento,
        deliveries: Number(updatedLoad.entregas),
        cargoWeight: Number(updatedLoad.pesoCarga),
        totalValue: Number(updatedLoad.valorTotal),
        freight4: Number(updatedLoad.frete4),
        totalFreight: Number(updatedLoad.somaTotalFrete),
        additionalCosts: Number(updatedLoad.additionalCosts ?? 0),
        additionalCostsNote:
          updatedLoad.additionalCostsNote?.trim() || undefined,
        observations: updatedLoad.observacoes?.trim() || undefined,
      };

      await api.put(`/loads/${editingLoad.id}`, loadData);
      message.success("Carga atualizada com sucesso!");
      fetchAllLoads();
      setEditingLoad(null);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Erro ao atualizar carga:", error);
      message.error(error.response?.data?.message || "Erro ao atualizar carga");
    }
  };

  const handleDeleteLoad = async (loadId: number) => {
    try {
      await api.delete(`/loads/${loadId}`);
      message.success("Carga excluída com sucesso!");
      fetchAllLoads();
    } catch (error) {
      console.error("Erro ao excluir carga:", error);
      message.error("Erro ao excluir carga");
    }
  };

  const handleEdit = (record: any) => {
    setEditingLoad(record);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingLoad(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setEditingLoad(null);
    setIsModalOpen(false);
  };

  const handleViewCompany = (companyId: number) => {
    navigate(`/load/${companyId}`);
  };

  const handleCompanyChange = (value: number | null) => {
    setSelectedCompany(value);
  };

  const handleDateRangeChange = (dates: any) => {
    setDateRange(dates);
  };

  const handleSearch = () => {
    if (!dateRange) {
      message.warning("Selecione um período para buscar");
      return;
    }

    const startDate = dateRange[0].toDate();
    const endDate = dateRange[1].toDate();

    const params: any = { startDate, endDate };
    if (selectedCompany) params.companyId = selectedCompany;

    api
      .get("/loads/period", { params })
      .then((response) => {
        const formattedData = response.data.map(mapLoadRow);
        setData(formattedData);
        message.success(
          `${formattedData.length} cargas encontradas no período selecionado`,
        );
      })
      .catch((error) => {
        console.error("Erro na busca por período:", error);
        message.error("Erro ao buscar cargas por período");
      });
  };

  const handleStatusFilterChange = (value: "all" | "recent" | "old") => {
    setStatusFilter(value);
  };

  const filteredData = data.filter((item) => {
    const numero = String(item.numeroCarregamento ?? "");
    const obs = String(item.observacoes ?? "");
    const company = String(item.companyName ?? "");

    const matchesSearch =
      numero.toLowerCase().includes(searchText.toLowerCase()) ||
      obs.toLowerCase().includes(searchText.toLowerCase()) ||
      company.toLowerCase().includes(searchText.toLowerCase());

    const matchesCompany =
      !selectedCompany || item.companyId === selectedCompany;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "recent" &&
        dayjs(item.data, "DD/MM/YYYY").isAfter(dayjs().subtract(30, "days"))) ||
      (statusFilter === "old" &&
        dayjs(item.data, "DD/MM/YYYY").isBefore(dayjs().subtract(30, "days")));

    return matchesSearch && matchesCompany && matchesStatus;
  });

  const companyFilterOptions = Array.from(
    new Map(
      data
        .map((i) => [i.companyId, { text: i.companyName, value: i.companyId }])
        .filter(([_, obj]) => (obj as any).text),
    ).values(),
  ) as { text: string; value: number }[];

  const columns: any[] = [
    {
      title: "Data",
      dataIndex: "data",
      key: "data",
      align: "center",
      width: 100,
      sorter: (a: any, b: any) =>
        dayjs(a.data, "DD/MM/YYYY").unix() - dayjs(b.data, "DD/MM/YYYY").unix(),
    },
    {
      title: "Empresa",
      key: "company",
      align: "left",
      width: 220,
      render: (_: any, record: any) => {
        return (
          <div>
            <div style={{ fontWeight: "bold" }}>
              {record.rawData.Company?.name || "-"}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {record.rawData.Company?.cnpj || ""}
            </div>
          </div>
        );
      },
      filters: companyFilterOptions,
      onFilter: (value: any, record: any) => record.companyId === value,
    },
    {
      title: "Número do Carregamento",
      dataIndex: "numeroCarregamento",
      key: "numeroCarregamento",
      align: "center",
      width: 150,
    },
    {
      title: "Entregas",
      dataIndex: "entregas",
      key: "entregas",
      align: "center",
      width: 80,
    },
    {
      title: "Peso (kg)",
      dataIndex: "pesoCarga",
      key: "pesoCarga",
      align: "center",
      width: 100,
      render: (value: number) =>
        Number(value || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        }),
    },
    {
      title: "Valor Total",
      dataIndex: "valorTotal",
      key: "valorTotal",
      align: "right",
      width: 120,
      render: (value: number) =>
        `R$ ${Number(value || 0)
          .toFixed(2)
          .replace(".", ",")}`,
      sorter: (a: any, b: any) => a.valorTotal - b.valorTotal,
    },
    {
      title: "Comissão",
      dataIndex: "frete4",
      key: "frete4",
      align: "right",
      width: 100,
      render: (value: number) =>
        `R$ ${Number(value || 0)
          .toFixed(2)
          .replace(".", ",")}`,
    },
    {
      title: "Custos adicionais",
      dataIndex: "additionalCosts",
      key: "additionalCosts",
      align: "right",
      width: 110,
      render: (value: number) =>
        `R$ ${Number(value || 0)
          .toFixed(2)
          .replace(".", ",")}`,
    },
    {
      title: "Total a cobrar",
      dataIndex: "somaTotalFrete",
      key: "somaTotalFrete",
      align: "right",
      width: 110,
      render: (value: number) =>
        `R$ ${Number(value || 0)
          .toFixed(2)
          .replace(".", ",")}`,
    },
    {
      title: "Comissão (%)",
      dataIndex: "commissionRate",
      key: "commissionRate",
      align: "center",
      width: 110,
      render: (value: number) => `${Number(value || 0).toFixed(2)}%`,
    },
    {
      title: "Observações",
      dataIndex: "observacoes",
      key: "observacoes",
      align: "left",
      width: 200,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text || "-"}</span>
        </Tooltip>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      align: "center",
      width: 200,
      fixed: "right",
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewCompany(record.companyId)}
          >
            Ver Empresa
          </Button>

          {canUpdate && (
            <Button
              type="default"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            >
              Editar
            </Button>
          )}

          {canDelete && (
            <Popconfirm
              title="Tem certeza que deseja excluir esta carga?"
              onConfirm={() => handleDeleteLoad(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
                size="small"
              >
                Excluir
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      message.warning("Não há dados para exportar");
      return;
    }

    const wb = XLSX.utils.book_new();
    const fileName = selectedCompany
      ? `Cargas_${companies.find((c) => c.id === selectedCompany)?.name}_${dayjs().format("DD-MM-YYYY")}.xlsx`
      : `Todas_Cargas_${dayjs().format("DD-MM-YYYY")}.xlsx`;

    const headerData: any[] = [["RELATÓRIO DE CARGAS"], []];

    if (selectedCompany) {
      headerData[0].push(
        `Empresa: ${companies.find((c) => c.id === selectedCompany)?.name}`,
      );
    }

    if (dateRange) {
      headerData.push([
        `Período: ${dateRange[0].format("DD/MM/YYYY")} a ${dateRange[1].format("DD/MM/YYYY")}`,
      ]);
    }

    headerData.push([]);

    const titles = columns
      .filter((col) => col.key !== "actions")
      .map((col) => col.title);
    headerData.push(titles);

    const tableData = filteredData.map((item) => {
      return columns
        .filter((col) => col.key !== "actions")
        .map((col) => {
          if (col.dataIndex) return item[col.dataIndex] ?? "";
          if (col.key === "company") {
            const name = item.rawData.Company?.name || "";
            const cnpj = item.rawData.Company?.cnpj || "";
            return `${name}${name && cnpj ? " - " : ""}${cnpj}`;
          }
          return "";
        });
    });

    const finalData = [...headerData, ...tableData];

    const ws = XLSX.utils.aoa_to_sheet(finalData);
    XLSX.utils.book_append_sheet(wb, ws, "Cargas");
    XLSX.writeFile(wb, fileName);
  };

  const calculateTotals = () => {
    return {
      totalValue: filteredData.reduce(
        (sum, item) => sum + Number(item.valorTotal || 0),
        0,
      ),
      totalFreight: filteredData.reduce(
        (sum, item) => sum + Number(item.frete4 || 0),
        0,
      ),
      totalAdditional: filteredData.reduce(
        (sum, item) => sum + Number(item.additionalCosts || 0),
        0,
      ),
      totalToBill: filteredData.reduce(
        (sum, item) => sum + Number(item.somaTotalFrete || 0),
        0,
      ),
      totalPeso: filteredData.reduce(
        (sum, item) => sum + Number(item.pesoCarga || 0),
        0,
      ),
      totalEntregas: filteredData.reduce(
        (sum, item) => sum + Number(item.entregas || 0),
        0,
      ),
    };
  };

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar cargas."
      />
    );
  }

  const totals = calculateTotals();

  const sectionCardStyle = {
    borderRadius: 20,
    border: "1px solid #e6edf7",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  };

  const summaryCards = [
    {
      key: "loads",
      title: "Cargas listadas",
      value: filteredData.length,
      helper: selectedCompany ? "Filtro por empresa aplicado" : "Todas as empresas",
      accent: "#1677ff",
      icon: <TruckOutlined style={{ color: "#1677ff" }} />,
    },
    {
      key: "value",
      title: "Valor total",
      value: `R$ ${totals.totalValue.toFixed(2).replace(".", ",")}`,
      helper: "Soma bruta das cargas",
      accent: "#16a34a",
      icon: <DollarOutlined style={{ color: "#16a34a" }} />,
    },
    {
      key: "companies",
      title: "Empresas visíveis",
      value: new Set(filteredData.map((item) => item.companyId)).size,
      helper: "Empresas no resultado atual",
      accent: "#7c3aed",
      icon: <ApartmentOutlined style={{ color: "#7c3aed" }} />,
    },
  ];

  return (
    <div
      style={{
        padding: "24px",
        background: "linear-gradient(180deg, #f6f9fc 0%, #eef3f9 100%)",
        minHeight: "100vh",
      }}
    >
      <Card
        style={{
          ...sectionCardStyle,
          marginBottom: 20,
          background:
            "linear-gradient(135deg, #0f3d8f 0%, #1677ff 55%, #69b1ff 100%)",
          color: "#fff",
          overflow: "hidden",
        }}
        bodyStyle={{ padding: 24 }}
      >
        <Row gutter={[20, 20]} align="middle" justify="space-between">
          <Col xs={24} lg={16}>
            <Text style={{ color: "rgba(255,255,255,0.78)", display: "block" }}>
              Visão consolidada
            </Text>
            <Title level={2} style={{ color: "#fff", margin: "4px 0 8px" }}>
              Cargas e pedidos
            </Title>
            <Paragraph
              style={{ color: "rgba(255,255,255,0.88)", marginBottom: 0 }}
            >
              Acompanhe todas as empresas em uma única visão, com filtros rápidos,
              resumo financeiro e acesso direto aos detalhes.
            </Paragraph>
          </Col>
          <Col xs={24} lg={8}>
            <div
              style={{
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 18,
                padding: 18,
              }}
            >
              <Space direction="vertical" size={6}>
                <Text style={{ color: "rgba(255,255,255,0.78)" }}>
                  Filtro atual
                </Text>
                <Text strong style={{ color: "#fff", fontSize: 18 }}>
                  {selectedCompany
                    ? companies.find((company) => company.id === selectedCompany)
                        ?.name || "Empresa"
                    : "Todas as empresas"}
                </Text>
                <Tag
                  color="processing"
                  style={{ borderRadius: 999, width: "fit-content" }}
                >
                  {filteredData.length} registros exibidos
                </Tag>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {summaryCards.map((item) => (
          <Col xs={24} md={8} key={item.key}>
            <Card style={sectionCardStyle} bodyStyle={{ padding: 20 }}>
              <Space
                align="start"
                style={{ width: "100%", justifyContent: "space-between" }}
              >
                <div>
                  <Text style={{ color: "#667085", fontSize: 13 }}>
                    {item.title}
                  </Text>
                  <Title
                    level={3}
                    style={{ margin: "8px 0 4px", color: item.accent }}
                  >
                    {item.value}
                  </Title>
                  <Text style={{ color: "#98a2b3" }}>{item.helper}</Text>
                </div>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: `${item.accent}14`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.icon}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        style={{ ...sectionCardStyle, marginBottom: 20 }}
        bodyStyle={{ padding: 20 }}
      >
        <div style={{ marginBottom: 20 }}>

        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <Select
            placeholder="Filtrar por empresa"
            value={selectedCompany}
            onChange={handleCompanyChange}
            style={{ width: 250 }}
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.children as string)
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            {companies.map((company) => (
              <Option key={company.id} value={company.id}>
                {company.name} - {company.cnpj}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="Filtrar por status"
            value={statusFilter}
            onChange={handleStatusFilterChange}
            style={{ width: 150 }}
          >
            <Option value="all">Todas</Option>
            <Option value="recent">Últimos 30 dias</Option>
            <Option value="old">Mais de 30 dias</Option>
          </Select>

          <RangePicker
            placeholder={["Data Início", "Data Fim"]}
            onChange={handleDateRangeChange}
            value={dateRange}
            format="DD/MM/YYYY"
          />

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            disabled={!dateRange}
          >
            Buscar por Período
          </Button>

          <Button
            type="default"
            onClick={fetchAllLoads}
            icon={<ReloadOutlined />}
          >
            Carregar Todas
          </Button>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <Input.Search
            placeholder="Buscar por número de carregamento, observações ou empresa"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 400 }}
            allowClear
          />

          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Adicionar Carga
            </Button>
          )}

          <Button
            type="default"
            onClick={exportToExcel}
            disabled={filteredData.length === 0}
            icon={<FileExcelOutlined />}
          >
            Exportar para Excel
          </Button>
        </div>

        {/* Resumo */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 16,
            padding: "16px",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "24px", fontWeight: "bold", color: "#1890ff" }}
            >
              {filteredData.length}
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              Total de Cargas
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "24px", fontWeight: "bold", color: "#52c41a" }}
            >
              R$ {totals.totalValue.toFixed(2).replace(".", ",")}
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>Valor Total</div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "24px", fontWeight: "bold", color: "#fa8c16" }}
            >
              R$ {totals.totalFreight.toFixed(2).replace(".", ",")}
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              Comissão (s/ valor)
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "24px", fontWeight: "bold", color: "#eb2f96" }}
            >
              R$ {totals.totalAdditional.toFixed(2).replace(".", ",")}
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              Custos adicionais
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "24px", fontWeight: "bold", color: "#13c2c2" }}
            >
              R$ {totals.totalToBill.toFixed(2).replace(".", ",")}
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              Total a cobrar
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "24px", fontWeight: "bold", color: "#722ed1" }}
            >
              {totals.totalPeso.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}{" "}
              kg
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>Peso Total</div>
          </div>
        </div>
        </div>
      </Card>

      <Card style={sectionCardStyle} bodyStyle={{ padding: 12 }}>
        <Table
          dataSource={filteredData}
          columns={columns}
          pagination={{
            pageSize: 25,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} de ${total} cargas`,
          }}
          loading={loading}
          scroll={{ x: 1680 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}>
                <strong>Totais:</strong>
              </Table.Summary.Cell>

              <Table.Summary.Cell index={4} align="right">
                <strong>
                  {totals.totalPeso.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  kg
                </strong>
              </Table.Summary.Cell>

              <Table.Summary.Cell index={5} align="right">
                <strong>
                  R$ {totals.totalValue.toFixed(2).replace(".", ",")}
                </strong>
              </Table.Summary.Cell>

              <Table.Summary.Cell index={6} align="right">
                <strong>
                  R$ {totals.totalFreight.toFixed(2).replace(".", ",")}
                </strong>
              </Table.Summary.Cell>

              <Table.Summary.Cell index={7} align="right">
                <strong>
                  R$ {totals.totalAdditional.toFixed(2).replace(".", ",")}
                </strong>
              </Table.Summary.Cell>

              <Table.Summary.Cell index={8} align="right">
                <strong>
                  R$ {totals.totalToBill.toFixed(2).replace(".", ",")}
                </strong>
              </Table.Summary.Cell>

              <Table.Summary.Cell index={9} colSpan={2} />
            </Table.Summary.Row>
          )}
        />
      </Card>

      <CustomModalLoad
        isVisible={isModalOpen}
        onClose={handleModalClose}
        onSubmit={editingLoad ? handleEditLoad : handleAddLoad}
        editingLoad={editingLoad}
        companies={companies}
        selectedCompany={null}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Space,
  DatePicker,
  Select,
  Table,
  Statistic, Tabs,
  Tag,
  Divider, message
} from 'antd'
import {
  DownloadOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
  BarChartOutlined,
  TeamOutlined,
  BankOutlined,
  CarOutlined,
  DollarOutlined,
  FileTextOutlined,
  ToolOutlined,
  CompassOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
dayjs.locale('pt-br')
import {
  exportEmployeeReport,
  exportCompanyReport,
  exportLoadsReport,
  exportMaintenanceReport,
  exportFinancialReport,
  exportTripsReport
} from '../../utils/exportUtils'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { TabPane } = Tabs

export default function Reports() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [reportData, setReportData] = useState({})
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    status: 'todos',
    type: 'todos',
    companyId: 'todos',
    truckId: 'todos'
  })

  // Estados para diferentes tipos de relatórios
  const [employeesData, setEmployeesData] = useState(null)
  const [companiesData, setCompaniesData] = useState(null)
  const [loadsData, setLoadsData] = useState(null)
  const [maintenanceData, setMaintenanceData] = useState(null)
  const [financialData, setFinancialData] = useState(null)
  const [tripsData, setTripsData] = useState(null)

  useEffect(() => {
    loadSystemOverview()
  }, [])

  const loadSystemOverview = async () => {
    try {
      setLoading(true)
      const response = await api.get('/reports/system-overview')
      setReportData(response.data)
    } catch (error) {
      console.error('Erro ao carregar visão geral:', error)
      message.error('Erro ao carregar dados do sistema')
    } finally {
      setLoading(false)
    }
  }

  const loadEmployeeReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filters.status !== 'todos') params.append('status', filters.status)
      if (filters.startDate) params.append('startDate', filters.startDate.format('YYYY-MM-DD'))
      if (filters.endDate) params.append('endDate', filters.endDate.format('YYYY-MM-DD'))

      const response = await api.get(`/reports/employees?${params.toString()}`)
      setEmployeesData(response.data)

      if (response.data.employees && response.data.employees.length > 0) {
        message.success(`Relatório de funcionários carregado! ${response.data.employees.length} registros encontrados.`)
      } else {
        message.info('Relatório de funcionários carregado! Nenhum registro encontrado com os filtros aplicados.')
      }
    } catch (error) {
      console.error('Erro ao carregar relatório de funcionários:', error)
      message.error('Erro ao carregar relatório de funcionários')
      setEmployeesData({ employees: [], summary: { total: 0, active: 0, inactive: 0, totalSalary: 0 } })
    } finally {
      setLoading(false)
    }
  }

  const loadCompanyReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filters.status !== 'todos') params.append('status', filters.status)
      if (filters.startDate) params.append('startDate', filters.startDate.format('YYYY-MM-DD'))
      if (filters.endDate) params.append('endDate', filters.endDate.format('YYYY-MM-DD'))

      const response = await api.get(`/reports/companies?${params.toString()}`)
      setCompaniesData(response.data)

      if (response.data.companies && response.data.companies.length > 0) {
        message.success(`Relatório de empresas carregado! ${response.data.companies.length} registros encontrados.`)
      } else {
        message.info('Relatório de empresas carregado! Nenhum registro encontrado com os filtros aplicados.')
      }
    } catch (error) {
      console.error('Erro ao carregar relatório de empresas:', error)
      message.error('Erro ao carregar relatório de empresas')
      setCompaniesData({ companies: [], summary: { total: 0, active: 0, inactive: 0 } })
    } finally {
      setLoading(false)
    }
  }

  const loadLoadsReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filters.status !== 'todos') params.append('status', filters.status)
      if (filters.companyId !== 'todos') params.append('companyId', filters.companyId)
      if (filters.startDate) params.append('startDate', filters.startDate.format('YYYY-MM-DD'))
      if (filters.endDate) params.append('endDate', filters.endDate.format('YYYY-MM-DD'))

      const response = await api.get(`/reports/loads?${params.toString()}`)
      setLoadsData(response.data)

      if (response.data.loads && response.data.loads.length > 0) {
        message.success(`Relatório de cargas carregado! ${response.data.loads.length} registros encontrados.`)
      } else {
        message.info('Relatório de cargas carregado! Nenhum registro encontrado com os filtros aplicados.')
      }
    } catch (error) {
      console.error('Erro ao carregar relatório de cargas:', error)
      message.error('Erro ao carregar relatório de cargas')
      setLoadsData({ loads: [], summary: { total: 0, totalValue: 0, byStatus: {} } })
    } finally {
      setLoading(false)
    }
  }

  const loadMaintenanceReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filters.truckId !== 'todos') params.append('truckId', filters.truckId)
      if (filters.startDate) params.append('startDate', filters.startDate.format('YYYY-MM-DD'))
      if (filters.endDate) params.append('endDate', filters.endDate.format('YYYY-MM-DD'))

      const response = await api.get(`/reports/maintenance?${params.toString()}`)
      setMaintenanceData(response.data)

      if (response.data.maintenance && response.data.maintenance.length > 0) {
        message.success(`Relatório de manutenções carregado! ${response.data.maintenance.length} registros encontrados.`)
      } else {
        message.info('Relatório de manutenções carregado! Nenhum registro encontrado com os filtros aplicados.')
      }
    } catch (error) {
      console.error('Erro ao carregar relatório de manutenções:', error)
      message.error('Erro ao carregar relatório de manutenções')
      setMaintenanceData({ maintenance: [], summary: { total: 0, totalCost: 0, averageCost: 0 } })
    } finally {
      setLoading(false)
    }
  }

  const loadFinancialReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filters.type !== 'todos') params.append('type', filters.type)
      if (filters.startDate) params.append('startDate', filters.startDate.format('YYYY-MM-DD'))
      if (filters.endDate) params.append('endDate', filters.endDate.format('YYYY-MM-DD'))

      const response = await api.get(`/reports/financial?${params.toString()}`)
      setFinancialData(response.data)

      if (response.data.transactions && response.data.transactions.length > 0) {
        message.success(`Relatório financeiro carregado! ${response.data.transactions.length} registros encontrados.`)
      } else {
        message.info('Relatório financeiro carregado! Nenhum registro encontrado com os filtros aplicados.')
      }
    } catch (error) {
      console.error('Erro ao carregar relatório financeiro:', error)
      message.error('Erro ao carregar relatório financeiro')
      setFinancialData({ transactions: [], summary: { total: 0, totalCredits: 0, totalDebits: 0, balance: 0 } })
    } finally {
      setLoading(false)
    }
  }

  const loadTripsReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filters.status !== 'todos') params.append('status', filters.status)
      if (filters.truckId !== 'todos') params.append('truckId', filters.truckId)
      if (filters.startDate) params.append('startDate', filters.startDate.format('YYYY-MM-DD'))
      if (filters.endDate) params.append('endDate', filters.endDate.format('YYYY-MM-DD'))

      const response = await api.get(`/reports/trips?${params.toString()}`)
      setTripsData(response.data)

      if (response.data.trips && response.data.trips.length > 0) {
        message.success(`Relatório de viagens carregado! ${response.data.trips.length} registros encontrados.`)
      } else {
        message.info('Relatório de viagens carregado! Nenhum registro encontrado com os filtros aplicados.')
      }
    } catch (error) {
      console.error('Erro ao carregar relatório de viagens:', error)
      message.error('Erro ao carregar relatório de viagens')
      setTripsData({ trips: [], summary: { total: 0, totalExpenses: 0, byStatus: {} } })
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      startDate: null,
      endDate: null,
      status: 'todos',
      type: 'todos',
      companyId: 'todos',
      truckId: 'todos'
    })
  }

  const exportReport = (format, reportType) => {
    try {
      message.loading(`Exportando relatório ${reportType} em ${format.toUpperCase()}...`, 0)

      let data = []
      let exportFunction = null

      switch (reportType) {
        case 'funcionários':
          data = employeesData?.employees || []
          exportFunction = exportEmployeeReport
          break
        case 'empresas':
          data = companiesData?.companies || []
          exportFunction = exportCompanyReport
          break
        case 'cargas':
          data = loadsData?.loads || []
          exportFunction = exportLoadsReport
          break
        case 'manutenções':
          data = maintenanceData?.maintenance || []
          exportFunction = exportMaintenanceReport
          break
        case 'financeiro':
          data = financialData?.transactions || []
          exportFunction = exportFinancialReport
          break
        case 'viagens':
          data = tripsData?.trips || []
          exportFunction = exportTripsReport
          break
        default:
          message.destroy()
          message.error('Tipo de relatório não encontrado')
          return
      }

      if (exportFunction) {
        try {
          exportFunction(data, format)
          message.destroy()
          if (data.length === 0) {
            message.info(`Relatório ${reportType} exportado em ${format.toUpperCase()} (sem dados).`)
          } else {
            message.success(`Relatório ${reportType} exportado em ${format.toUpperCase()} com sucesso! ${data.length} registros.`)
          }
        } catch (exportError) {
          message.destroy()
          console.error('Erro na função de exportação:', exportError)
          message.error(`Erro ao gerar ${format.toUpperCase()}: ${exportError.message || 'Erro desconhecido'}`)
        }
      }
    } catch (error) {
      message.destroy()
      console.error('Erro ao exportar relatório:', error)
      message.error(`Erro ao exportar relatório: ${error.message || 'Erro desconhecido'}`)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    return dayjs(date).format('DD/MM/YYYY')
  }

  const formatDateTime = (date) => {
    if (!date) return 'N/A'
    return dayjs(date).format('DD/MM/YYYY HH:mm')
  }

  // Colunas para tabelas de relatórios
  const employeeColumns = [
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'CPF', dataIndex: 'cpf', key: 'cpf' },
    { title: 'Cargo', dataIndex: 'role', key: 'role' },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status) => <Tag color={status === 'Ativo' ? 'green' : 'red'}>{status}</Tag>
    },
    {
      title: 'Salário Base', dataIndex: 'baseSalary', key: 'baseSalary',
      render: (value) => formatCurrency(value)
    },
    {
      title: 'Data Contratação', dataIndex: 'hireDate', key: 'hireDate',
      render: (date) => formatDate(date)
    }
  ]

  const companyColumns = [
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'CNPJ', dataIndex: 'cnpj', key: 'cnpj' },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status) => <Tag color={status === 'Ativo' ? 'green' : 'red'}>{status}</Tag>
    },
    {
      title: 'Cargas', dataIndex: 'loads', key: 'loads',
      render: (loads) => loads?.length || 0
    },
    {
      title: 'Data Criação', dataIndex: 'createdAt', key: 'createdAt',
      render: (_, record) => {
        return formatDate(record.dateRegistration)}
    }
  ]

  const loadsColumns = [
    { title: 'Número da Carga', dataIndex: 'loadingNumber', key: 'loadingNumber' },
    { 
      title: 'Empresa', 
      dataIndex: ['Company', 'name'], 
      key: 'company',
      render: (name, record) => record.Company?.name || 'N/A'
    },
    { title: 'Entregas', dataIndex: 'deliveries', key: 'deliveries' },
    {
      title: 'Peso (kg)', dataIndex: 'cargoWeight', key: 'cargoWeight',
      render: (weight) => `${weight || 0} kg`
    },
    {
      title: 'Valor Total', dataIndex: 'totalValue', key: 'totalValue',
      render: (value) => formatCurrency(value)
    },
    {
      title: 'Data', dataIndex: 'date', key: 'date',
      render: (date) => formatDate(date)
    }
  ]

  const maintenanceColumns = [
    { title: 'Serviço', dataIndex: 'service', key: 'service' },
    { 
      title: 'Caminhão', 
      dataIndex: ['Truck', 'plate'], 
      key: 'truck',
      render: (plate, record) => record.Truck?.plate || 'N/A'
    },
    {
      title: 'Data', dataIndex: 'date', key: 'date',
      render: (date) => formatDate(date)
    },
    {
      title: 'Valor', dataIndex: 'value', key: 'value',
      render: (value) => formatCurrency(value)
    },
    { title: 'KM', dataIndex: 'km', key: 'km' }
  ]

  const financialColumns = [
    {
      title: 'Data', dataIndex: 'date', key: 'date',
      render: (date) => formatDate(date)
    },
    {
      title: 'Tipo', dataIndex: 'type', key: 'type',
      render: (type) => <Tag color={type === 'Crédito' ? 'green' : 'red'}>{type}</Tag>
    },
    {
      title: 'Valor', dataIndex: 'amount', key: 'amount',
      render: (value) => formatCurrency(value)
    },
    { 
      title: 'Funcionário', 
      dataIndex: ['Employee', 'name'], 
      key: 'employee',
      render: (name, record) => record.Employee?.name || 'N/A'
    }
  ]

  const tripsColumns = [
    { title: 'Destino', dataIndex: 'destination', key: 'destination' },
    { title: 'Motorista', dataIndex: 'driver', key: 'driver' },
    { 
      title: 'Caminhão', 
      dataIndex: ['Truck', 'plate'], 
      key: 'truck',
      render: (plate, record) => record.Truck?.plate || 'N/A'
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status) => <Tag color={status === 'Concluída' ? 'green' : 'orange'}>{status}</Tag>
    },
    {
      title: 'Data', dataIndex: 'date', key: 'date',
      render: (date) => formatDate(date)
    }
  ]

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
          📊 Sistema de Relatórios
        </Title>
        <Text type="secondary">
          Gere relatórios detalhados de todas as áreas do sistema
        </Text>
      </div>

      {/* Filtros Gerais */}
      <Card title="Filtros de Período" style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Text strong>Período:</Text>
            <RangePicker
              style={{ width: '100%', marginTop: 8 }}
              format="DD/MM/YYYY"
              inputReadOnly
              value={[filters.startDate, filters.endDate]}
              onChange={(dates) => {
                handleFilterChange('startDate', dates?.[0] || null)
                handleFilterChange('endDate', dates?.[1] || null)
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong>Status:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
            >
              <Option value="todos">Todos</Option>
              <Option value="Ativo">Ativo</Option>
              <Option value="Inativo">Inativo</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong>Tipo:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={filters.type}
              onChange={(value) => handleFilterChange('type', value)}
            >
              <Option value="todos">Todos</Option>
              <Option value="Crédito">Crédito</Option>
              <Option value="Débito">Débito</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <Button
                type="primary"
                icon={<FilterOutlined />}
                onClick={() => {
                  if (activeTab === 'employees') loadEmployeeReport()
                  else if (activeTab === 'companies') loadCompanyReport()
                  else if (activeTab === 'loads') loadLoadsReport()
                  else if (activeTab === 'maintenance') loadMaintenanceReport()
                  else if (activeTab === 'financial') loadFinancialReport()
                  else if (activeTab === 'trips') loadTripsReport()
                }}
                loading={loading}
              >
                Aplicar Filtros
              </Button>
              <Button icon={<ReloadOutlined />} onClick={clearFilters}>
                Limpar
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Abas de Relatórios */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        style={{ marginBottom: '24px' }}
      >
        {/* Visão Geral do Sistema */}
        <TabPane
          tab={
            <span>
              <BarChartOutlined />
              Visão Geral
            </span>
          }
          key="overview"
        >
          <Card>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Funcionários"
                    value={reportData.summary?.totalEmployees || 0}
                    prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
                    suffix={
                      <Tag color="green" style={{ marginLeft: 8 }}>
                        {reportData.summary?.activeEmployees || 0} ativos
                      </Tag>
                    }
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Empresas"
                    value={reportData.summary?.totalCompanies || 0}
                    prefix={<BankOutlined style={{ color: '#52c41a' }} />}
                    suffix={
                      <Tag color="blue" style={{ marginLeft: 8 }}>
                        {reportData.summary?.activeCompanies || 0} ativas
                      </Tag>
                    }
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Cargas"
                    value={reportData.summary?.totalLoads || 0}
                    prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Caminhões"
                    value={reportData.summary?.totalTrucks || 0}
                    prefix={<CarOutlined style={{ color: '#722ed1' }} />}
                  />
                </Card>
              </Col>
            </Row>

            <Divider />

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Manutenções"
                    value={reportData.summary?.totalMaintenance || 0}
                    prefix={<ToolOutlined style={{ color: '#faad14' }} />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Transações"
                    value={reportData.summary?.totalTransactions || 0}
                    prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Funcionários Inativos"
                    value={reportData.summary?.inactiveEmployees || 0}
                    prefix={<TeamOutlined style={{ color: '#ff4d4f' }} />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Empresas Inativas"
                    value={reportData.summary?.inactiveCompanies || 0}
                    prefix={<BankOutlined style={{ color: '#ff4d4f' }} />}
                  />
                </Card>
              </Col>
            </Row>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={loadSystemOverview}
                loading={loading}
              >
                Atualizar Dados
              </Button>
            </div>
          </Card>
        </TabPane>

        {/* Relatório de Funcionários */}
        <TabPane
          tab={
            <span>
              <TeamOutlined />
              Funcionários
            </span>
          }
          key="employees"
        >
          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={loadEmployeeReport}
                  loading={loading}
                >
                  Gerar Relatório
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('pdf', 'funcionários')}
                >
                  Exportar PDF
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('excel', 'funcionários')}
                >
                  Exportar Excel
                </Button>
              </Space>
            </div>

            {employeesData && (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                  <Col xs={24} sm={8}>
                    <Statistic title="Total" value={employeesData.summary?.total || 0} />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Ativos"
                      value={employeesData.summary?.active || 0}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Total Salários"
                      value={formatCurrency(employeesData.summary?.totalSalary || 0)}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                </Row>

                <Table
                  columns={employeeColumns}
                  dataSource={employeesData.employees || []}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: true }}
                  locale={{
                    emptyText: 'Nenhum funcionário encontrado com os filtros aplicados'
                  }}
                />
              </>
            )}
          </Card>
        </TabPane>

        {/* Relatório de Empresas */}
        <TabPane
          tab={
            <span>
              <BankOutlined />
              Empresas
            </span>
          }
          key="companies"
        >
          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={loadCompanyReport}
                  loading={loading}
                >
                  Gerar Relatório
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('pdf', 'empresas')}
                >
                  Exportar PDF
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('excel', 'empresas')}
                >
                  Exportar Excel
                </Button>
              </Space>
            </div>

            {companiesData && (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                  <Col xs={24} sm={8}>
                    <Statistic title="Total" value={companiesData.summary?.total || 0} />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Ativas"
                      value={companiesData.summary?.active || 0}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Inativas"
                      value={companiesData.summary?.inactive || 0}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Col>
                </Row>

                <Table
                  columns={companyColumns}
                  dataSource={companiesData.companies || []}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: true }}
                  locale={{
                    emptyText: 'Nenhuma empresa encontrada com os filtros aplicados'
                  }}
                />
              </>
            )}
          </Card>
        </TabPane>

        {/* Relatório de Cargas */}
        <TabPane
          tab={
            <span>
              <FileTextOutlined />
              Cargas
            </span>
          }
          key="loads"
        >
          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={loadLoadsReport}
                  loading={loading}
                >
                  Gerar Relatório
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('pdf', 'cargas')}
                >
                  Exportar PDF
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('excel', 'cargas')}
                >
                  Exportar Excel
                </Button>
              </Space>
            </div>

            {loadsData && (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                  <Col xs={24} sm={8}>
                    <Statistic title="Total" value={loadsData.summary?.total || 0} />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Valor Total"
                      value={formatCurrency(loadsData.summary?.totalValue || 0)}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Por Status"
                      value={Object.keys(loadsData.summary?.byStatus || {}).length}
                      suffix="status"
                    />
                  </Col>
                </Row>

                <Table
                  columns={loadsColumns}
                  dataSource={loadsData.loads || []}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: true }}
                  locale={{
                    emptyText: 'Nenhuma carga encontrada com os filtros aplicados'
                  }}
                />
              </>
            )}
          </Card>
        </TabPane>

        {/* Relatório de Manutenções */}
        <TabPane
          tab={
            <span>
              <ToolOutlined />
              Manutenções
            </span>
          }
          key="maintenance"
        >
          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={loadMaintenanceReport}
                  loading={loading}
                >
                  Gerar Relatório
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('pdf', 'manutenções')}
                >
                  Exportar PDF
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('excel', 'manutenções')}
                >
                  Exportar Excel
                </Button>
              </Space>
            </div>

            {maintenanceData && (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                  <Col xs={24} sm={8}>
                    <Statistic title="Total" value={maintenanceData.summary?.total || 0} />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Custo Total"
                      value={formatCurrency(maintenanceData.summary?.totalCost || 0)}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Custo Médio"
                      value={formatCurrency(maintenanceData.summary?.averageCost || 0)}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Col>
                </Row>

                <Table
                  columns={maintenanceColumns}
                  dataSource={maintenanceData.maintenance || []}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: true }}
                  locale={{
                    emptyText: 'Nenhuma manutenção encontrada com os filtros aplicados'
                  }}
                />
              </>
            )}
          </Card>
        </TabPane>

        {/* Relatório Financeiro */}
        <TabPane
          tab={
            <span>
              <DollarOutlined />
              Financeiro
            </span>
          }
          key="financial"
        >
          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={loadFinancialReport}
                  loading={loading}
                >
                  Gerar Relatório
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('pdf', 'financeiro')}
                >
                  Exportar PDF
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('excel', 'financeiro')}
                >
                  Exportar Excel
                </Button>
              </Space>
            </div>

            {financialData && (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                  <Col xs={24} sm={6}>
                    <Statistic title="Total" value={financialData.summary?.total || 0} />
                  </Col>
                  <Col xs={24} sm={6}>
                    <Statistic
                      title="Total Créditos"
                      value={formatCurrency(financialData.summary?.totalCredits || 0)}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col xs={24} sm={6}>
                    <Statistic
                      title="Total Débitos"
                      value={formatCurrency(financialData.summary?.totalDebits || 0)}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Col>
                  <Col xs={24} sm={6}>
                    <Statistic
                      title="Saldo"
                      value={formatCurrency(financialData.summary?.balance || 0)}
                      valueStyle={{
                        color: (financialData.summary?.balance || 0) >= 0 ? '#52c41a' : '#ff4d4f'
                      }}
                    />
                  </Col>
                </Row>

                <Table
                  columns={financialColumns}
                  dataSource={financialData.transactions || []}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: true }}
                  locale={{
                    emptyText: 'Nenhuma transação encontrada com os filtros aplicados'
                  }}
                />
              </>
            )}
          </Card>
        </TabPane>

        {/* Relatório de Viagens */}
        <TabPane
          tab={
            <span>
              <CompassOutlined />
              Viagens
            </span>
          }
          key="trips"
        >
          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={loadTripsReport}
                  loading={loading}
                >
                  Gerar Relatório
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('pdf', 'viagens')}
                >
                  Exportar PDF
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => exportReport('excel', 'viagens')}
                >
                  Exportar Excel
                </Button>
              </Space>
            </div>

            {tripsData && (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                  <Col xs={24} sm={8}>
                    <Statistic title="Total" value={tripsData.summary?.total || 0} />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Total Despesas"
                      value={formatCurrency(tripsData.summary?.totalExpenses || 0)}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Por Status"
                      value={Object.keys(tripsData.summary?.byStatus || {}).length}
                      suffix="status"
                    />
                  </Col>
                </Row>

                <Table
                  columns={tripsColumns}
                  dataSource={tripsData.trips || []}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: true }}
                  locale={{
                    emptyText: 'Nenhuma viagem encontrada com os filtros aplicados'
                  }}
                />
              </>
            )}
          </Card>
        </TabPane>
      </Tabs>

      {/* Rodapé */}
      <div style={{ textAlign: 'center', marginTop: '32px', padding: '16px' }}>
        <Text type="secondary">
          Sistema de Relatórios - Última atualização: {formatDateTime(new Date())}
        </Text>
      </div>
    </div>
  )
}

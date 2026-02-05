import React, { useState, useEffect } from 'react'
import {
  Table,
  Row,
  Col,
  Card,
  Typography,
  Button,
  Select,
  DatePicker,
  Statistic,
  Space,
  Tag,
  Alert,
  Tooltip,
  Progress,
  message,
  Popconfirm,
  Result
} from 'antd'
import {
  PlusOutlined,
  DownloadOutlined,
  EyeOutlined,
  DollarOutlined,
  RiseOutlined,
  ArrowDownOutlined,
  CalculatorOutlined,
  DeleteOutlined,
  EditOutlined
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import CustomModal from '../../components/Modal/Closing'
import api from '../../lib/api'
import { usePermission } from '../../hooks/usePermission'
import './styles.css'

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

export default function Closing() {
  const [searchParams] = useSearchParams()
  const { hasPermission } = usePermission()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentType, setCurrentType] = useState('')
  const [editingEntry, setEditingEntry] = useState(null)
  const [periodType, setPeriodType] = useState('month')
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [companies, setCompanies] = useState([])
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState([])
  const [closingId, setClosingId] = useState(null)
  const [closingData, setClosingData] = useState(null)

  const canView = hasPermission('financial.view')
  const canCreate = hasPermission('financial.create')
  const canUpdate = hasPermission('financial.update')
  const canDelete = hasPermission('financial.delete')

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar entradas financeiras."
      />
    )
  }

  useEffect(() => {
    fetchCompanies()
    fetchMonths()
    
    // Verificar se há closingId na URL
    const closingIdParam = searchParams.get('closingId')
    if (closingIdParam) {
      setClosingId(parseInt(closingIdParam))
      fetchClosingData(parseInt(closingIdParam))
    }
  }, [searchParams])

  useEffect(() => {
    if (selectedPeriod && !closingId) {
      fetchFinancialData()
    }
  }, [selectedPeriod, selectedCompany, closingId])

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies')
      setCompanies(response.data)
    } catch (error) {
      message.error('Erro ao carregar empresas')
    }
  }

  const fetchMonths = async () => {
    try {
      const response = await api.get('/months')
      setMonths(response.data)
    } catch (error) {
      message.error('Erro ao carregar meses')
    }
  }

  const fetchClosingData = async (id) => {
    try {
      setLoading(true)
      const response = await api.get(`/closings/${id}/entries`)
      setClosingData(response.data.closing)
      setEntries(response.data.entries || [])
    } catch (error) {
      console.error('Erro ao carregar dados do fechamento:', error)
      message.error('Erro ao carregar dados do fechamento')
    } finally {
      setLoading(false)
    }
  }

  const fetchFinancialData = async () => {
    if (!selectedPeriod) return

    setLoading(true)
    try {
      let startDate, endDate

      switch (periodType) {
        case 'week':
          startDate = selectedPeriod[0].format('YYYY-MM-DD')
          endDate = selectedPeriod[1].format('YYYY-MM-DD')
          break
        case 'biweekly':
          startDate = selectedPeriod[0].format('YYYY-MM-DD')
          endDate = selectedPeriod[1].format('YYYY-MM-DD')
          break
        case 'month':
          startDate = selectedPeriod.startOf('month').format('YYYY-MM-DD')
          endDate = selectedPeriod.endOf('month').format('YYYY-MM-DD')
          break
        case 'api-month':
          const month = months.find(m => m.id === selectedPeriod)
          if (month) {
            startDate = dayjs().year(month.year).month(month.month - 1).startOf('month').format('YYYY-MM-DD')
            endDate = dayjs().year(month.year).month(month.month - 1).endOf('month').format('YYYY-MM-DD')
          } else {
            return
          }
          break
        case 'period':
          startDate = selectedPeriod[0].format('YYYY-MM-DD')
          endDate = selectedPeriod[1].format('YYYY-MM-DD')
          break
        default:
          return
      }

      const params = {
        startDate,
        endDate,
        ...(selectedCompany && { companyId: selectedCompany })
      }

      const response = await api.get('/financial/entries', { params })
      setEntries(response.data.entries || [])
    } catch (error) {
      message.error('Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (values) => {
    try {
      const entryData = {
        ...values,
        companyId: selectedCompany || null,
        closingId: closingId || null
      }

      if (editingEntry) {
        await api.put(`/financial/entries/${editingEntry.id}`, entryData)
        message.success('Entrada financeira atualizada com sucesso!')
      } else {
        await api.post('/financial/entries', entryData)
        message.success('Entrada financeira criada com sucesso!')
      }

      if (closingId) {
        fetchClosingData(closingId)
      } else {
        fetchFinancialData()
      }
      setIsModalOpen(false)
      setEditingEntry(null)
    } catch (error) {
      console.error('Erro ao salvar entrada financeira:', error)
      
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.message).join(', ')
        message.error(`Erro de validação: ${errorMessages}`)
      } else if (error.response?.data?.message) {
        message.error(error.response.data.message)
      } else {
        message.error('Erro ao salvar entrada financeira')
      }
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/financial/entries/${id}`)
      message.success('Entrada financeira deletada com sucesso!')
      
      if (closingId) {
        fetchClosingData(closingId)
      } else {
        fetchFinancialData()
      }
    } catch (error) {
      console.error('Erro ao deletar entrada financeira:', error)
      message.error('Erro ao deletar entrada financeira')
    }
  }

  const handleEdit = (entry) => {
    setEditingEntry(entry)
    setCurrentType(entry.type)
    setIsModalOpen(true)
  }

  const openModal = (type) => {
    setCurrentType(type)
    setEditingEntry(null)
    setIsModalOpen(true)
  }

  const handlePeriodChange = (value) => {
    setPeriodType(value)
    setSelectedPeriod(null)
  }

  const handleDateChange = (dates) => {
    setSelectedPeriod(dates)
  }

  const getPeriodLabel = () => {
    if (!selectedPeriod) return 'Período não selecionado'
    
    switch (periodType) {
      case 'week':
        return `Semana: ${selectedPeriod[0].format('DD/MM')} a ${selectedPeriod[1].format('DD/MM/YYYY')}`
      case 'biweekly':
        return `Quinzena: ${selectedPeriod[0].format('DD/MM')} a ${selectedPeriod[1].format('DD/MM/YYYY')}`
      case 'month':
        return `Mês: ${selectedPeriod.format('MMMM/YYYY')}`
      case 'api-month':
        const month = months.find(m => m.id === selectedPeriod)
        return month ? `Mês: ${month.name}` : 'Mês não encontrado'
      case 'period':
        return `Período: ${selectedPeriod[0].format('DD/MM/YYYY')} a ${selectedPeriod[1].format('DD/MM/YYYY')}`
      default:
        return 'Período selecionado'
    }
  }

  // Filtrar entradas por tipo
  const entradas = entries.filter(entry => entry.type === 'entrada')
  const saidas = entries.filter(entry => entry.type === 'saida')
  const impostos = entries.filter(entry => entry.type === 'imposto')

  // Calcular totais
  const totalEntradas = entradas.reduce((sum, item) => sum + item.amount, 0)
  const totalSaidas = saidas.reduce((sum, item) => sum + item.amount, 0)
  const totalImpostos = impostos.reduce((sum, item) => sum + item.amount, 0)
  const saldo = totalEntradas - totalSaidas - totalImpostos
  const margemLucro = totalEntradas > 0 ? ((saldo / totalEntradas) * 100) : 0

  const exportToExcel = () => {
    if (entries.length === 0) {
      message.warning('Não há dados para exportar')
      return
    }

    const workbook = XLSX.utils.book_new()
    const periodLabel = getPeriodLabel()
    const companyName = companies.find(c => c.id === selectedCompany)?.name || 'Todas as Empresas'

    const worksheetData = [
      [`RELATÓRIO DE FECHAMENTO FINANCEIRO - ${periodLabel}`],
      [`Empresa: ${companyName}`],
      [''],
      ['RESUMO EXECUTIVO'],
      ['Total Entradas', `R$ ${totalEntradas.toFixed(2).replace('.', ',')}`],
      ['Total Saídas', `R$ ${totalSaidas.toFixed(2).replace('.', ',')}`],
      ['Total Impostos', `R$ ${totalImpostos.toFixed(2).replace('.', ',')}`],
      ['Saldo', `R$ ${saldo.toFixed(2).replace('.', ',')}`],
      ['Margem de Lucro', `${margemLucro.toFixed(2)}%`],
      [''],
      ['ENTRADAS'],
      ['Descrição', 'Categoria', 'Data', 'Valor', 'Empresa'],
      ...entradas.map(({ description, category, date, amount, company }) => [
        description, 
        category, 
        dayjs(date).format('DD/MM/YYYY'), 
        `R$ ${amount.toFixed(2).replace('.', ',')}`,
        company?.name || 'N/A'
      ]),
      [''],
      ['SAÍDAS'],
      ['Descrição', 'Categoria', 'Data', 'Valor', 'Empresa'],
      ...saidas.map(({ description, category, date, amount, company }) => [
        description, 
        category, 
        dayjs(date).format('DD/MM/YYYY'), 
        `R$ ${amount.toFixed(2).replace('.', ',')}`,
        company?.name || 'N/A'
      ]),
      [''],
      ['IMPOSTOS'],
      ['Nome', 'Categoria', 'Data', 'Valor', 'Empresa'],
      ...impostos.map(({ description, category, date, amount, company }) => [
        description, 
        category, 
        dayjs(date).format('DD/MM/YYYY'), 
        `R$ ${amount.toFixed(2).replace('.', ',')}`,
        company?.name || 'N/A'
      ]),
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fechamento Financeiro')
    XLSX.writeFile(workbook, `Fechamento_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
  }

  const createColumns = (type) => [
    {
      title: type === 'imposto' ? 'Imposto' : 'Descrição',
      dataIndex: 'description',
      key: 'description',
      width: '35%',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.category}
          </Text>
        </div>
      )
    },
    {
      title: 'Data',
      dataIndex: 'date',
      key: 'date',
      width: '20%',
      render: (date) => dayjs(date).format('DD/MM/YYYY')
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      key: 'amount',
      width: '25%',
      align: 'right',
      render: (valor) => (
        <Text strong style={{ 
          color: type === 'entrada' ? '#52c41a' : '#ff4d4f',
          fontSize: '16px'
        }}>
          R$ {valor.toFixed(2).replace('.', ',')}
        </Text>
      )
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '20%',
      render: (_, record) => (
        <Space>
          {canUpdate && (
            <Tooltip title="Editar">
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                size="small"
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Tem certeza que deseja deletar esta entrada?"
              onConfirm={() => handleDelete(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Tooltip title="Deletar">
                <Button 
                  type="text" 
                  danger
                  icon={<DeleteOutlined />} 
                  size="small"
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div className="closing-container">
      {/* Header com seleção de período */}
      <Card className="period-selector-card">
        <Row gutter={[16, 16]} align="middle">
          <Col span={6}>
            <Title level={3} style={{ margin: 0 }}>
              <CalculatorOutlined style={{ marginRight: 8 }} />
              {closingData ? `Fechamento: ${closingData.name}` : 'Fechamento Financeiro'}
            </Title>
            {closingData && (
              <Text type="secondary">
                Período: {dayjs(closingData.startDate).format('DD/MM/YYYY')} a {dayjs(closingData.endDate).format('DD/MM/YYYY')}
              </Text>
            )}
          </Col>
          {!closingData && (
            <>
              <Col span={4}>
                <Select
                  value={periodType}
                  onChange={handlePeriodChange}
                  style={{ width: '100%' }}
                  placeholder="Tipo de período"
                >
                  <Option value="week">Semana</Option>
                  <Option value="biweekly">Quinzena</Option>
                  <Option value="month">Mês</Option>
                  <Option value="api-month">Mês (API)</Option>
                  <Option value="period">Período Personalizado</Option>
                </Select>
              </Col>
              <Col span={6}>
                {periodType === 'period' ? (
                  <RangePicker
                    style={{ width: '100%' }}
                    onChange={handleDateChange}
                    placeholder={['Data Início', 'Data Fim']}
                  />
                ) : periodType === 'month' ? (
                  <DatePicker
                    picker="month"
                    style={{ width: '100%' }}
                    onChange={handleDateChange}
                    placeholder="Selecione o mês"
                    format="MM/YYYY"
                  />
                ) : periodType === 'api-month' ? (
                  <Select
                    style={{ width: '100%' }}
                    onChange={handleDateChange}
                    placeholder="Selecione o mês"
                    showSearch
                    optionFilterProp="children"
                  >
                    {months.map(month => (
                      <Option key={month.id} value={month.id}>
                        {month.name}
                      </Option>
                    ))}
                  </Select>
                ) : (
                  <DatePicker
                    picker={periodType === 'week' ? 'week' : 'date'}
                    onChange={handleDateChange}
                    placeholder={`Selecione a ${periodType === 'week' ? 'semana' : 'data'}`}
                    format="DD/MM/YYYY"
                  />
                )}
              </Col>
              <Col span={4}>
                <Select
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  style={{ width: '100%' }}
                  placeholder="Empresa"
                  allowClear
                >
                  {companies.map(company => (
                    <Option key={company.id} value={company.id}>
                      {company.name}
                    </Option>
                  ))}
                </Select>
              </Col>
            </>
          )}
          {canCreate && (
            <Col span={closingData ? 18 : 4}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => openModal('entrada')}
                style={{ width: closingData ? '200px' : '100%' }}
              >
                Nova Entrada
              </Button>
            </Col>
          )}
        </Row>
        
        {selectedPeriod && (
          <Alert
            message={getPeriodLabel()}
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Cards de resumo */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card className="summary-card entrada">
            <Statistic
              title="Total Entradas"
              value={totalEntradas}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              prefix={<RiseOutlined />}
              suffix="R$"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="summary-card saida">
            <Statistic
              title="Total Saídas"
              value={totalSaidas}
              precision={2}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ArrowDownOutlined />}
              suffix="R$"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="summary-card imposto">
            <Statistic
              title="Total Impostos"
              value={totalImpostos}
              precision={2}
              valueStyle={{ color: '#faad14' }}
              prefix={<DollarOutlined />}
              suffix="R$"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="summary-card saldo">
            <Statistic
              title="Saldo"
              value={saldo}
              precision={2}
              valueStyle={{ color: saldo >= 0 ? '#52c41a' : '#ff4d4f' }}
              prefix={<DollarOutlined />}
              suffix="R$"
            />
            <Progress 
              percent={Math.min(Math.abs(margemLucro), 100)} 
              size="small" 
              status={margemLucro >= 0 ? 'success' : 'exception'}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabelas principais */}
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card
            title={
              <span>
                <RiseOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                Entradas
                <Tag color="green" style={{ marginLeft: 8 }}>
                  {entradas.length} itens
                </Tag>
              </span>
            }
            className="data-card entrada"
            extra={
              canCreate && (
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<PlusOutlined />}
                  onClick={() => openModal('entrada')}
                >
                  Adicionar
                </Button>
              )
            }
          >
            <Table
              dataSource={entradas}
              columns={createColumns('entrada')}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
              loading={loading}
            />
          </Card>
        </Col>

        <Col span={8}>
            <Card
            title={
              <span>
                <ArrowDownOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                Saídas
                <Tag color="red" style={{ marginLeft: 8 }}>
                  {saidas.length} itens
                </Tag>
              </span>
            }
            className="data-card saida"
            extra={
              <Button 
                type="primary" 
                size="small" 
                icon={<PlusOutlined />}
                onClick={() => openModal('saida')}
              >
                Adicionar
              </Button>
            }
            >
              <Table
              dataSource={saidas}
              columns={createColumns('saida')}
                pagination={false}
                size="small"
              scroll={{ y: 300 }}
              loading={loading}
              />
            </Card>
          </Col>

        <Col span={8}>
          <Card
            title={
              <span>
                <DollarOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Impostos
                <Tag color="orange" style={{ marginLeft: 8 }}>
                  {impostos.length} itens
                </Tag>
              </span>
            }
            className="data-card imposto"
            extra={
              <Button 
                type="primary" 
                size="small" 
                icon={<PlusOutlined />}
                onClick={() => openModal('imposto')}
              >
                Adicionar
              </Button>
            }
          >
            <Table
              dataSource={impostos}
              columns={createColumns('imposto')}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* Resumo final */}
      <Card className="final-summary-card">
        <Row gutter={[16, 16]} align="middle">
          <Col span={8}>
            <div className="summary-item">
              <Text strong>Margem de Lucro:</Text>
              <Tag 
                color={margemLucro >= 0 ? 'green' : 'red'} 
                style={{ fontSize: '16px', padding: '4px 12px' }}
              >
                {margemLucro >= 0 ? '+' : ''}{margemLucro.toFixed(2)}%
              </Tag>
            </div>
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <div className="summary-item">
              <Text strong>Período:</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {getPeriodLabel()}
              </Text>
            </div>
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button 
                type="default" 
                icon={<EyeOutlined />}
                onClick={() => {}}
              >
                Visualizar
              </Button>
              <Button 
                type="primary" 
                icon={<DownloadOutlined />}
                onClick={exportToExcel}
                disabled={entries.length === 0}
              >
                Exportar Excel
        </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Modal */}
      <CustomModal
        isVisible={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingEntry(null)
        }}
        onSubmit={handleAdd}
        title={`${editingEntry ? 'Editar' : 'Adicionar'} ${currentType === 'entrada' ? 'Entrada' : currentType === 'saida' ? 'Saída' : 'Imposto'}`}
        type={currentType}
        editingEntry={editingEntry}
      />
    </div>
  )
}

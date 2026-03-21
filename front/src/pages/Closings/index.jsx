import React, { useState, useEffect } from 'react'
import {
  Table,
  Row,
  Col,
  Card,
  Typography,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Statistic,
  Alert,
  Result
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined, CalculatorOutlined,
  LockOutlined,
  UnlockOutlined,
  CalendarOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
import api from '../../lib/api'
import { usePermission } from '../../hooks/usePermission'
import './styles.css'

// Configurar dayjs para português
dayjs.locale('pt-br')

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

export default function Closings() {
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const [closings, setClosings] = useState([])
  const [months, setMonths] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClosing, setEditingClosing] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [form] = Form.useForm()

  const parseDateSafe = (value) => {
    if (!value) return null
    const parsed = dayjs(value)
    if (parsed.isValid()) return parsed
    if (typeof value === 'string' && value.includes('/')) {
      const [dd, mm, yyyy] = value.split('/')
      const isoLike = `${yyyy}-${mm}-${dd}`
      const fromBr = dayjs(isoLike)
      if (fromBr.isValid()) return fromBr
    }
    return null
  }

  const formatDateSafe = (value) => {
    const d = parseDateSafe(value)
    return d ? d.format('DD/MM/YYYY') : '-'
  }

  const resolveDatesFromForm = (values) => {
    const type = values?.closingType
    const monthBase = values?.monthPicker ? dayjs(values.monthPicker) : null

    if (monthBase && monthBase.isValid()) {
      if (type === 'month') {
        return {
          startDate: monthBase.startOf('month'),
          endDate: monthBase.endOf('month')
        }
      }
      if (type === 'first_half') {
        return {
          startDate: monthBase.startOf('month'),
          endDate: monthBase.date(15)
        }
      }
      if (type === 'second_half') {
        return {
          startDate: monthBase.date(16),
          endDate: monthBase.endOf('month')
        }
      }
    }

    const startDate = parseDateSafe(values?.startDate)
    const endDate = parseDateSafe(values?.endDate)
    return { startDate, endDate }
  }

  const canViewClosings = hasPermission('closings.view')
  const canCreateClosings = hasPermission('closings.create')
  const canUpdateClosings = hasPermission('closings.update')
  const canDeleteClosings = hasPermission('closings.delete')
  const canViewMonths = hasPermission('months.view')

  if (!canViewClosings) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para acessar o fechamento de caixa."
      />
    )
  }

  useEffect(() => {
    loadMonths()
    loadCompanies()
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      loadClosings()
    }
  }, [selectedMonth])

  const loadMonths = async () => {
    if (!canViewMonths) {
      setMonths([])
      return
    }
    try {
      const response = await api.get('/months')
      setMonths(response.data || [])
    } catch (error) {
      if (error?.response?.status === 403) {
        setMonths([])
      } else {
        message.error('Erro ao carregar meses')
      }
    }
  }

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies')
      setCompanies(response.data)
    } catch (error) {
      message.error('Erro ao carregar empresas')
    }
  }

  const loadClosings = async () => {
    if (!selectedMonth) return

    try {
      setLoading(true)
      const response = await api.get(`/closings?monthId=${selectedMonth}`)
      setClosings(response.data)
    } catch (error) {
      message.error('Erro ao carregar fechamentos')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClosing = async (values) => {
    try {
      // Remover campos que não vão para o backend
      const { closingType, monthPicker, ...closingData } = values
      const resolved = resolveDatesFromForm(values)
      
      // Preparar dados para envio
      const submitData = {
        ...closingData,
        monthId: selectedMonth,
        startDate: resolved.startDate ? resolved.startDate.format('DD/MM/YYYY') : null,
        endDate: resolved.endDate ? resolved.endDate.format('DD/MM/YYYY') : null
      }
      
      // Se não há datas, usar datas padrão do mês selecionado
      if (!submitData.startDate || !submitData.endDate) {
        const monthData = months.find(m => m.id === selectedMonth);
        if (monthData) {
          const year = monthData.year;
          const month = monthData.month;
          submitData.startDate = `01/${month.toString().padStart(2, '0')}/${year}`;
          submitData.endDate = `${new Date(year, month, 0).getDate()}/${month.toString().padStart(2, '0')}/${year}`;
        }
      }
      
      await api.post('/closings', submitData)
      message.success('Fechamento criado com sucesso!')
      setIsModalOpen(false)
      form.resetFields()
      loadClosings()
    } catch (error) {
      console.error('Erro ao criar fechamento:', error)
      message.error(error.response?.data?.message || 'Erro ao criar fechamento')
    }
  }

  const handleUpdateClosing = async (values) => {
    try {
      // Remover campos que não vão para o backend
      const { closingType, monthPicker, ...closingData } = values
      const resolved = resolveDatesFromForm(values)
      
      // Preparar dados para envio
      const submitData = {
        ...closingData,
        startDate: resolved.startDate ? resolved.startDate.format('DD/MM/YYYY') : null,
        endDate: resolved.endDate ? resolved.endDate.format('DD/MM/YYYY') : null
      }
      
      await api.put(`/closings/${editingClosing.id}`, submitData)
      message.success('Fechamento atualizado com sucesso!')
      setIsModalOpen(false)
      setEditingClosing(null)
      form.resetFields()
      loadClosings()
    } catch (error) {
      console.error('Erro ao atualizar fechamento:', error)
      message.error('Erro ao atualizar fechamento')
    }
  }

  const handleDeleteClosing = async (id) => {
    try {
      await api.delete(`/closings/${id}`)
      message.success('Fechamento deletado com sucesso!')
      loadClosings()
    } catch (error) {
      message.error(error.response?.data?.message || 'Erro ao deletar fechamento')
    }
  }

  const handleCloseClosing = async (id) => {
    try {
      await api.post(`/closings/${id}/close`)
      message.success('Fechamento fechado com sucesso!')
      loadClosings()
    } catch (error) {
      message.error('Erro ao fechar fechamento')
    }
  }

  const handleReopenClosing = async (id) => {
    try {
      await api.post(`/closings/${id}/reopen`)
      message.success('Fechamento reaberto com sucesso!')
      loadClosings()
    } catch (error) {
      message.error('Erro ao reabrir fechamento')
    }
  }

  const handleEdit = (closing) => {
    setEditingClosing(closing)
    
    // Determinar o tipo de fechamento baseado nas datas
    let startDate = parseDateSafe(closing.startDate)
    let endDate = parseDateSafe(closing.endDate)
    
    let closingType = 'custom'
    if (startDate && endDate) {
      const startOfMonth = startDate.startOf('month')
      const endOfMonth = endDate.endOf('month')
      if (startDate.isSame(startOfMonth, 'day') && endDate.isSame(endOfMonth, 'day')) {
        closingType = 'month'
      } else if (startDate.isSame(startOfMonth, 'day') && endDate.date() === 15) {
        closingType = 'first_half'
      } else if (startDate.date() === 16 && endDate.isSame(endOfMonth, 'day')) {
        closingType = 'second_half'
      }
    } else {
      const lowerName = String(closing?.name || '').toLowerCase()
      if (lowerName.includes('1ª quinzena') || lowerName.includes('1a quinzena')) {
        closingType = 'first_half'
      } else if (lowerName.includes('2ª quinzena') || lowerName.includes('2a quinzena')) {
        closingType = 'second_half'
      } else if (lowerName.includes('mês') || lowerName.includes('mes')) {
        closingType = 'month'
      }

      const monthNum = closing?.Month?.month ?? closing?.monthNumber
      const monthYear = closing?.Month?.year ?? closing?.monthYear
      if (monthNum && monthYear && closingType !== 'custom') {
        const base = dayjs(`${monthYear}-${String(monthNum).padStart(2, '0')}-01`)
        if (closingType === 'month') {
          startDate = base.startOf('month')
          endDate = base.endOf('month')
        } else if (closingType === 'first_half') {
          startDate = base.startOf('month')
          endDate = base.date(15)
        } else if (closingType === 'second_half') {
          startDate = base.date(16)
          endDate = base.endOf('month')
        }
      }
    }
    
    form.setFieldsValue({
      name: closing.name,
      closingType: closingType,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      companyId: closing.companyId,
      monthPicker: closingType !== 'custom' && startDate ? startDate : undefined
    })
    setIsModalOpen(true)
  }

  const openModal = () => {
    setEditingClosing(null)
    form.resetFields()
    setIsModalOpen(true)
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'aberto': return 'Aberto'
      case 'fechado': return 'Fechado'
      case 'cancelado': return 'Cancelado'
      default: return status
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'aberto': return 'blue'
      case 'fechado': return 'green'
      case 'cancelado': return 'red'
      default: return 'default'
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const columns = [
    {
      title: 'Nome',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary">
            {record.companyName || record.Company?.name || 'Todas as empresas'}
          </Text>
        </div>
      )
    },
    {
      title: 'Período',
      key: 'period',
      render: (_, record) => (
        <div>
          <Text>{formatDateSafe(record.startDate)}</Text>
          <br />
          <Text type="secondary">até</Text>
          <br />
          <Text>{formatDateSafe(record.endDate)}</Text>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'Entradas',
      dataIndex: 'totalEntries',
      key: 'totalEntries',
      align: 'right',
      render: (value) => (
        <Text style={{ color: '#52c41a' }}>
          {formatCurrency(value || 0)}
        </Text>
      )
    },
    {
      title: 'Saídas',
      dataIndex: 'totalExpenses',
      key: 'totalExpenses',
      align: 'right',
      render: (value) => (
        <Text style={{ color: '#ff4d4f' }}>
          {formatCurrency(value || 0)}
        </Text>
      )
    },
    {
      title: 'Impostos',
      dataIndex: 'totalTaxes',
      key: 'totalTaxes',
      align: 'right',
      render: (value) => (
        <Text style={{ color: '#faad14' }}>
          {formatCurrency(value || 0)}
        </Text>
      )
    },
    {
      title: 'Saldo',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (value) => (
        <Text strong style={{ 
          color: value >= 0 ? '#52c41a' : '#ff4d4f' 
        }}>
          {formatCurrency(value || 0)}
        </Text>
      )
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => navigate(`/closing?closingId=${record.id}`)}
            title="Ver entradas financeiras"
          />

          {canUpdateClosings && (
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
              disabled={record.status === 'fechado'}
              title="Editar"
            />
          )}
          {canUpdateClosings && record.status === 'aberto' && (
            <Button
              type="text"
              icon={<LockOutlined />}
              size="small"
              onClick={() => handleCloseClosing(record.id)}
              title="Fechar fechamento"
            />
          )}
          {canUpdateClosings && record.status === 'fechado' && (
            <Button
              type="text"
              icon={<UnlockOutlined />}
              size="small"
              onClick={() => handleReopenClosing(record.id)}
              title="Reabrir fechamento"
            />
          )}
          {canDeleteClosings && (
            <Popconfirm
              title="Tem certeza que deseja deletar este fechamento?"
              description="Esta ação não pode ser desfeita."
              onConfirm={() => handleDeleteClosing(record.id)}
              okText="Sim"
              cancelText="Não"
              disabled={record.status === 'fechado'}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
                disabled={record.status === 'fechado'}
                title={record.status === 'fechado' ? "Não é possível deletar fechamento fechado" : "Deletar"}
              />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const selectedMonthData = months.find(m => m.id === selectedMonth)

  return (
    <div className="closings-container">
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              Fechamentos
            </Title>
            <Text type="secondary">
              Gerencie os fechamentos financeiros por período
            </Text>
          </Col>
          <Col>
            <Space>
              <Select
                placeholder="Selecione um mês"
                value={selectedMonth}
                onChange={setSelectedMonth}
                style={{ width: 220 }}
              >
                {months.map(month => (
                  <Option key={month.id} value={month.id}>
                    {month.name}
                  </Option>
                ))}
              </Select>
              {selectedMonth && canCreateClosings && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openModal}
                >
                  Novo Fechamento
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        {!selectedMonth && (
          <Alert
            message="Selecione um mês"
            description={canViewMonths
              ? "Cadastre os meses em Manutenção → Cadastro de Meses. Depois escolha um mês aqui para visualizar e gerenciar os fechamentos."
              : "Você precisa da permissão 'Visualizar meses' para listar os meses. Cadastre os meses em Manutenção → Cadastro de Meses (se tiver permissão)."}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {selectedMonth && selectedMonthData && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Mês Selecionado"
                    value={selectedMonthData.name}
                    prefix={<CalendarOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Total Fechamentos"
                    value={closings.length}
                    prefix={<CalculatorOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Fechados"
                    value={closings.filter(c => c.status === 'fechado').length}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Abertos"
                    value={closings.filter(c => c.status === 'aberto').length}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
            </Row>

            <Table
              columns={columns}
              dataSource={closings}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} fechamentos`
              }}
            />
          </>
        )}
      </Card>

      {(canCreateClosings || canUpdateClosings) && (
        <Modal
          title={editingClosing ? 'Editar Fechamento' : 'Novo Fechamento'}
          open={isModalOpen}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingClosing(null)
            form.resetFields()
          }}
          footer={null}
          width={600}
        >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingClosing ? handleUpdateClosing : handleCreateClosing}
        >
          <Form.Item
            label="Tipo de Fechamento"
            name="closingType"
            rules={[{ required: true, message: 'Tipo é obrigatório' }]}
            initialValue="month"
          >
            <Select placeholder="Selecione o tipo de fechamento">
              <Option value="month">Mês Completo</Option>
              <Option value="first_half">1ª Quinzena</Option>
              <Option value="second_half">2ª Quinzena</Option>
              <Option value="custom">Período Personalizado</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Nome do Fechamento"
            name="name"
            rules={[{ required: true, message: 'Nome é obrigatório' }]}
          >
            <Input placeholder="Ex: Janeiro 2024, 1ª Quinzena Jan, etc." />
          </Form.Item>

          <Form.Item
            label="Empresa"
            name="companyId"
          >
            <Select placeholder="Selecione uma empresa (opcional)" allowClear>
              <Option value={null}>Nenhuma (todas as empresas)</Option>
              {companies.map(company => (
                <Option key={company.id} value={company.id}>
                  {company.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.closingType !== currentValues.closingType
            }
          >
            {({ getFieldValue }) => {
              const closingType = getFieldValue('closingType')
              
              if (closingType === 'month') {
                return (
                  <Form.Item
                    label="Mês"
                    name="monthPicker"
                    rules={[{ required: true, message: 'Mês é obrigatório' }]}
                  >
                    <DatePicker
                      picker="month"
                      style={{ width: '100%' }}
                      placeholder="Selecione o mês"
                      format="MM/YYYY"
                      onChange={(date) => {
                        if (date) {
                          const startDate = date.startOf('month')
                          const endDate = date.endOf('month')
                          form.setFieldsValue({
                            startDate: startDate,
                            endDate: endDate,
                            name: `${date.format('MMMM YYYY')}`
                          })
                        }
                      }}
                    />
                  </Form.Item>
                )
              }
              
              if (closingType === 'first_half') {
                return (
                  <Form.Item
                    label="Mês"
                    name="monthPicker"
                    rules={[{ required: true, message: 'Mês é obrigatório' }]}
                  >
                    <DatePicker
                      picker="month"
                      style={{ width: '100%' }}
                      placeholder="Selecione o mês"
                      format="MM/YYYY"
                      onChange={(date) => {
                        if (date) {
                          const startDate = date.startOf('month')
                          const endDate = date.date(15)
                          form.setFieldsValue({
                            startDate: startDate,
                            endDate: endDate,
                            name: `1ª Quinzena ${date.format('MMM YYYY')}`
                          })
                        }
                      }}
                    />
                  </Form.Item>
                )
              }
              
              if (closingType === 'second_half') {
                return (
                  <Form.Item
                    label="Mês"
                    name="monthPicker"
                    rules={[{ required: true, message: 'Mês é obrigatório' }]}
                  >
                    <DatePicker
                      picker="month"
                      style={{ width: '100%' }}
                      placeholder="Selecione o mês"
                      format="MM/YYYY"
                      onChange={(date) => {
                        if (date) {
                          const startDate = date.date(16)
                          const endDate = date.endOf('month')
                          form.setFieldsValue({
                            startDate: startDate,
                            endDate: endDate,
                            name: `2ª Quinzena ${date.format('MMM YYYY')}`
                          })
                        }
                      }}
                    />
                  </Form.Item>
                )
              }
              
              if (closingType === 'custom') {
                return (
                  <>
                    <Form.Item
                      label="Data Início"
                      name="startDate"
                      rules={[{ required: true, message: 'Data início é obrigatória' }]}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        placeholder="Selecione a data início"
                        format="DD/MM/YYYY"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Data Fim"
                      name="endDate"
                      rules={[{ required: true, message: 'Data fim é obrigatória' }]}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        placeholder="Selecione a data fim"
                        format="DD/MM/YYYY"
                      />
                    </Form.Item>
                  </>
                )
              }
              
              return null
            }}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingClosing ? 'Atualizar' : 'Criar'}
              </Button>
              <Button onClick={() => {
                setIsModalOpen(false)
                setEditingClosing(null)
                form.resetFields()
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
        </Modal>
      )}

    </div>
  )
}

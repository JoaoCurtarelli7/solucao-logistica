import React, { useEffect, useState } from 'react'
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
} from 'antd'
import * as XLSX from 'xlsx'
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import CustomModalLoad from '../../../components/Modal/Load'
import api from '../../../lib/api'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { usePermission } from '@/hooks/usePermission'

const { RangePicker } = DatePicker
const { Option } = Select

export default function LoadCompanies() {
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLoad, setEditingLoad] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<any>(null)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'recent' | 'old'>(
    'all',
  )

  const canView = hasPermission('loads.view')
  const canCreate = hasPermission('loads.create')
  const canUpdate = hasPermission('loads.update')
  const canDelete = hasPermission('loads.delete')

  useEffect(() => {
    fetchCompanies()
    fetchAllLoads()
  }, [])

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies')
      setCompanies(response.data)
    } catch (error) {
      console.error('Erro ao buscar empresas:', error)
      message.error('Erro ao carregar empresas')
    }
  }

  const mapLoadRow = (load: any) => ({
    key: load.id,
    id: load.id,
    data: dayjs(load.date).format('DD/MM/YYYY'),
    numeroCarregamento: load.loadingNumber,
    entregas: load.deliveries,
    pesoCarga: load.cargoWeight,
    valorTotal: load.totalValue,
    frete4: load.freight4,
    somaTotalFrete: load.totalFreight,
    observacoes: load.observations || '',
    companyId: load.companyId,
    companyName: load.Company?.name || '', // <-- Company com C maiúsculo
    companyCnpj: load.Company?.cnpj || '',
    rawData: load, // mantém o objeto original (com .Company)
  })

  const fetchAllLoads = async () => {
    setLoading(true)
    try {
      const response = await api.get('/loads')
      const formattedData = response.data.map(mapLoadRow)
      setData(formattedData)
    } catch (error) {
      console.error('Erro ao buscar cargas:', error)
      message.error('Erro ao carregar cargas')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLoad = async (newLoad: any) => {
    try {
      const loadData = {
        companyId: Number(newLoad.companyId), // garante número
        date: dayjs(newLoad.data, 'DD/MM/YYYY').toDate(),
        loadingNumber: newLoad.numeroCarregamento,
        deliveries: Number(newLoad.entregas),
        cargoWeight: Number(newLoad.pesoCarga),
        totalValue: Number(newLoad.valorTotal),
        freight4: Number(newLoad.frete4),
        totalFreight: Number(newLoad.somaTotalFrete),
        observations: newLoad.observacoes?.trim() || undefined,
      }

      await api.post('/loads', loadData)
      message.success('Carga criada com sucesso!')
      fetchAllLoads()
      setIsModalOpen(false)
    } catch (error: any) {
      console.error('Erro ao criar carga:', error)
      message.error(error.response?.data?.message || 'Erro ao criar carga')
    }
  }

  const handleEditLoad = async (updatedLoad: any) => {
    try {
      const loadData = {
        companyId: Number(updatedLoad.companyId),
        date: dayjs(updatedLoad.data, 'DD/MM/YYYY').toDate(),
        loadingNumber: updatedLoad.numeroCarregamento,
        deliveries: Number(updatedLoad.entregas),
        cargoWeight: Number(updatedLoad.pesoCarga),
        totalValue: Number(updatedLoad.valorTotal),
        freight4: Number(updatedLoad.frete4),
        totalFreight: Number(updatedLoad.somaTotalFrete),
        observations: updatedLoad.observacoes?.trim() || undefined,
      }

      await api.put(`/loads/${editingLoad.id}`, loadData)
      message.success('Carga atualizada com sucesso!')
      fetchAllLoads()
      setEditingLoad(null)
      setIsModalOpen(false)
    } catch (error: any) {
      console.error('Erro ao atualizar carga:', error)
      message.error(error.response?.data?.message || 'Erro ao atualizar carga')
    }
  }

  const handleDeleteLoad = async (loadId: number) => {
    try {
      await api.delete(`/loads/${loadId}`)
      message.success('Carga excluída com sucesso!')
      fetchAllLoads()
    } catch (error) {
      console.error('Erro ao excluir carga:', error)
      message.error('Erro ao excluir carga')
    }
  }

  const handleEdit = (record: any) => {
    setEditingLoad(record)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingLoad(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setEditingLoad(null)
    setIsModalOpen(false)
  }

  const handleViewCompany = (companyId: number) => {
    // ajuste a rota conforme seu router
    navigate(`/load/${companyId}`)
  }

  const handleCompanyChange = (value: number | null) => {
    setSelectedCompany(value)
  }

  const handleDateRangeChange = (dates: any) => {
    setDateRange(dates)
  }

  const handleSearch = () => {
    if (!dateRange) {
      message.warning('Selecione um período para buscar')
      return
    }

    const startDate = dateRange[0].toDate()
    const endDate = dateRange[1].toDate()

    const params: any = { startDate, endDate }
    if (selectedCompany) params.companyId = selectedCompany

    api
      .get('/loads/period', { params })
      .then((response) => {
        const formattedData = response.data.map(mapLoadRow)
        setData(formattedData)
        message.success(
          `${formattedData.length} cargas encontradas no período selecionado`,
        )
      })
      .catch((error) => {
        console.error('Erro na busca por período:', error)
        message.error('Erro ao buscar cargas por período')
      })
  }

  const handleStatusFilterChange = (value: 'all' | 'recent' | 'old') => {
    setStatusFilter(value)
  }

  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.numeroCarregamento
        .toLowerCase()
        .includes(searchText.toLowerCase()) ||
      item.observacoes.toLowerCase().includes(searchText.toLowerCase()) ||
      item.companyName.toLowerCase().includes(searchText.toLowerCase())

    const matchesCompany =
      !selectedCompany || item.companyId === selectedCompany

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'recent' &&
        dayjs(item.data, 'DD/MM/YYYY').isAfter(dayjs().subtract(30, 'days'))) ||
      (statusFilter === 'old' &&
        dayjs(item.data, 'DD/MM/YYYY').isBefore(dayjs().subtract(30, 'days')))

    return matchesSearch && matchesCompany && matchesStatus
  })

  const companyFilterOptions = Array.from(
    new Map(
      data
        .map((i) => [i.companyId, { text: i.companyName, value: i.companyId }])
        .filter(([_, obj]) => (obj as any).text), // remove vazios
    ).values(),
  ) as { text: string; value: number }[]

  const columns: any[] = [
    {
      title: 'Data',
      dataIndex: 'data',
      key: 'data',
      align: 'center',
      width: 100,
      sorter: (a: any, b: any) =>
        dayjs(a.data, 'DD/MM/YYYY').unix() - dayjs(b.data, 'DD/MM/YYYY').unix(),
    },
    {
      title: 'Empresa',
      key: 'company',
      align: 'left',
      width: 220,
      render: (_: any, record: any) => {
        return (
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {record.rawData.Company?.name || '-'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.rawData.Company?.cnpj || ''}
            </div>
          </div>
        )
      },
      filters: companyFilterOptions,
      onFilter: (value: any, record: any) => record.companyId === value,
    },
    {
      title: 'Número do Carregamento',
      dataIndex: 'numeroCarregamento',
      key: 'numeroCarregamento',
      align: 'center',
      width: 150,
    },
    {
      title: 'Entregas',
      dataIndex: 'entregas',
      key: 'entregas',
      align: 'center',
      width: 80,
    },
    {
      title: 'Peso (kg)',
      dataIndex: 'pesoCarga',
      key: 'pesoCarga',
      align: 'center',
      width: 100,
      render: (value: number) =>
        value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    },
    {
      title: 'Valor Total',
      dataIndex: 'valorTotal',
      key: 'valorTotal',
      align: 'right',
      width: 120,
      render: (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`,
      sorter: (a: any, b: any) => a.valorTotal - b.valorTotal,
    },
    {
      title: 'Frete 4%',
      dataIndex: 'frete4',
      key: 'frete4',
      align: 'right',
      width: 100,
      render: (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`,
    },
    {
      title: 'Total Frete',
      dataIndex: 'somaTotalFrete',
      key: 'somaTotalFrete',
      align: 'right',
      width: 120,
      render: (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`,
      sorter: (a: any, b: any) => a.somaTotalFrete - b.somaTotalFrete,
    },
    {
      title: 'Observações',
      dataIndex: 'observacoes',
      key: 'observacoes',
      align: 'left',
      width: 200,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      align: 'center',
      width: 200,
      fixed: 'right',
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
  ]

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      message.warning('Não há dados para exportar')
      return
    }

    const wb = XLSX.utils.book_new()
    const fileName = selectedCompany
      ? `Cargas_${companies.find((c) => c.id === selectedCompany)?.name}_${dayjs().format('DD-MM-YYYY')}.xlsx`
      : `Todas_Cargas_${dayjs().format('DD-MM-YYYY')}.xlsx`

    const headerData: any[] = [['RELATÓRIO DE CARGAS'], []]

    if (selectedCompany) {
      headerData[0].push(
        `Empresa: ${companies.find((c) => c.id === selectedCompany)?.name}`,
      )
    }

    if (dateRange) {
      headerData.push([
        `Período: ${dateRange[0].format('DD/MM/YYYY')} a ${dateRange[1].format('DD/MM/YYYY')}`,
      ])
    }

    headerData.push([])

    const titles = columns
      .filter((col) => col.key !== 'actions')
      .map((col) => col.title)
    headerData.push(titles)

    const tableData = filteredData.map((item) => {
      return columns
        .filter((col) => col.key !== 'actions')
        .map((col) => {
          if (col.dataIndex) return item[col.dataIndex] ?? ''
          if (col.key === 'company') {
            const name = item.rawData.Company?.name || ''
            const cnpj = item.rawData.Company?.cnpj || ''
            return `${name}${name && cnpj ? ' - ' : ''}${cnpj}`
          }
          return ''
        })
    })

    const finalData = [...headerData, ...tableData]

    const ws = XLSX.utils.aoa_to_sheet(finalData)
    XLSX.utils.book_append_sheet(wb, ws, 'Cargas')
    XLSX.writeFile(wb, fileName)
  }

  const calculateTotals = () => {
    return {
      totalValue: filteredData.reduce((sum, item) => sum + item.valorTotal, 0),
      totalFreight: filteredData.reduce(
        (sum, item) => sum + item.somaTotalFrete,
        0,
      ),
      totalFrete4: filteredData.reduce((sum, item) => sum + item.frete4, 0),
      totalPeso: filteredData.reduce((sum, item) => sum + item.pesoCarga, 0),
      totalEntregas: filteredData.reduce((sum, item) => sum + item.entregas, 0),
    }
  }

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar cargas."
      />
    )
  }

  const totals = calculateTotals()

  return (
    <Card style={{ margin: '20px', padding: '20px' }} bordered>
      <div style={{ marginBottom: 20 }}>
        <h1>Visão Geral de Cargas - Todas as Empresas</h1>

        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
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
            placeholder={['Data Início', 'Data Fim']}
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

          <Button type="default" onClick={fetchAllLoads}>
            Carregar Todas
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
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
          >
            Exportar para Excel
          </Button>
        </div>

        {/* Resumo */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 16,
            padding: '16px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}
            >
              {filteredData.length}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              Total de Cargas
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}
            >
              R$ {totals.totalValue.toFixed(2).replace('.', ',')}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>Valor Total</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}
            >
              R$ {totals.totalFreight.toFixed(2).replace('.', ',')}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>Total Frete</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}
            >
              {totals.totalPeso.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}{' '}
              kg
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>Peso Total</div>
          </div>
        </div>
      </div>

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
        scroll={{ x: 1400 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4}>
              <strong>Totais:</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">
              <strong>
                {totals.totalPeso.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}{' '}
                kg
              </strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right">
              <strong>
                R$ {totals.totalValue.toFixed(2).replace('.', ',')}
              </strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right">
              <strong>
                R$ {totals.totalFrete4.toFixed(2).replace('.', ',')}
              </strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right">
              <strong>
                R$ {totals.totalFreight.toFixed(2).replace('.', ',')}
              </strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={8} colSpan={2} />
          </Table.Summary.Row>
        )}
      />

      <CustomModalLoad
        isVisible={isModalOpen}
        onClose={handleModalClose}
        onSubmit={editingLoad ? handleEditLoad : handleAddLoad}
        editingLoad={editingLoad}
        companies={companies}
        selectedCompany={null}
      />
    </Card>
  )
}

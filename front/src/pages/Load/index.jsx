import React, { useEffect, useState } from 'react'
import { Card, Table, Button, message, Popconfirm, Space, DatePicker, Select, Input } from 'antd'
import { useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import CustomModalLoad from '../../components/Modal/Load'
import api from '../../lib/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select

export default function Load() {
  const { id: companyId } = useParams()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLoad, setEditingLoad] = useState(null)
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(companyId ? parseInt(companyId) : null)
  const [dateRange, setDateRange] = useState(null)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    fetchCompanies()
    if (selectedCompany) {
      fetchLoads()
    }
  }, [selectedCompany])

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies')
      setCompanies(response.data)
    } catch (error) {
      console.error('Erro ao buscar empresas:', error)
      message.error('Erro ao carregar empresas: ' + (error.response?.data?.message || error.message))
    }
  }

  const fetchLoads = async () => {
    if (!selectedCompany) return
    
    setLoading(true)
    try {
      let url = '/loads'
      if (selectedCompany) {
        url = `/loads/company/${selectedCompany}`
      }
      
      const response = await api.get(url)
      const formattedData = response.data.map(load => ({
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
        companyName: load.company?.name || '',
        rawData: load
      }))
      setData(formattedData)
    } catch (error) {
      console.error('Erro ao buscar cargas:', error)
      message.error('Erro ao carregar cargas')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLoad = async (newLoad) => {
    try {
      const loadData = {
        ...newLoad,
        companyId: selectedCompany,
        date: dayjs(newLoad.data, 'DD/MM/YYYY').toDate(),
        loadingNumber: newLoad.numeroCarregamento,
        deliveries: newLoad.entregas,
        cargoWeight: newLoad.pesoCarga,
        totalValue: newLoad.valorTotal,
        freight4: newLoad.frete4,
        totalFreight: newLoad.somaTotalFrete,
        observations: newLoad.observacoes
      }

      await api.post('/loads', loadData)
      message.success('Carga criada com sucesso!')
      fetchLoads()
      setIsModalOpen(false)
    } catch (error) {
      console.error('Erro ao criar carga:', error)
      message.error(error.response?.data?.message || 'Erro ao criar carga')
    }
  }

  const handleEditLoad = async (updatedLoad) => {
    try {
      const loadData = {
        ...updatedLoad,
        companyId: selectedCompany,
        date: dayjs(updatedLoad.data, 'DD/MM/YYYY').toDate(),
        loadingNumber: updatedLoad.numeroCarregamento,
        deliveries: updatedLoad.entregas,
        cargoWeight: updatedLoad.pesoCarga,
        totalValue: updatedLoad.valorTotal,
        freight4: updatedLoad.frete4,
        totalFreight: updatedLoad.somaTotalFrete,
        observations: updatedLoad.observacoes
      }

      await api.put(`/loads/${editingLoad.id}`, loadData)
      message.success('Carga atualizada com sucesso!')
      fetchLoads()
      setEditingLoad(null)
      setIsModalOpen(false)
    } catch (error) {
      console.error('Erro ao atualizar carga:', error)
      message.error(error.response?.data?.message || 'Erro ao atualizar carga')
    }
  }

  const handleDeleteLoad = async (loadId) => {
    try {
      await api.delete(`/loads/${loadId}`)
      message.success('Carga excluída com sucesso!')
      fetchLoads()
    } catch (error) {
      console.error('Erro ao excluir carga:', error)
      message.error('Erro ao excluir carga')
    }
  }

  const handleEdit = (record) => {
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

  const handleCompanyChange = (value) => {
    setSelectedCompany(value)
    setDateRange(null)
    setSearchText('')
  }

  const handleDateRangeChange = (dates) => {
    setDateRange(dates)
  }

  const handleSearch = () => {
    if (!dateRange || !selectedCompany) {
      message.warning('Selecione uma empresa e um período para buscar')
      return
    }

    const startDate = dateRange[0].toDate()
    const endDate = dateRange[1].toDate()

    api.get('/loads/period', {
      params: {
        startDate,
        endDate,
        companyId: selectedCompany
      }
    }).then(response => {
      const formattedData = response.data.map(load => ({
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
        companyName: load.company?.name || '',
        rawData: load
      }))
      setData(formattedData)
      message.success(`${formattedData.length} cargas encontradas no período selecionado`)
    }).catch(error => {
      console.error('Erro na busca por período:', error)
      message.error('Erro ao buscar cargas por período')
    })
  }

  const filteredData = data.filter(item =>
    item.numeroCarregamento.toLowerCase().includes(searchText.toLowerCase()) ||
    item.observacoes.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    { title: 'Data', dataIndex: 'data', key: 'data', align: 'center', width: 100 },
    {
      title: 'Número do Carregamento',
      dataIndex: 'numeroCarregamento',
      key: 'numeroCarregamento',
      align: 'center',
      width: 150,
    },
    {
      title: 'Quantidade de Entregas',
      dataIndex: 'entregas',
      key: 'entregas',
      align: 'center',
      width: 120,
    },
    {
      title: 'Peso da Carga (kg)',
      dataIndex: 'pesoCarga',
      key: 'pesoCarga',
      align: 'center',
      width: 120,
    },
    {
      title: 'Valor Total',
      dataIndex: 'valorTotal',
      key: 'valorTotal',
      align: 'right',
      width: 120,
      render: (value) => `R$ ${value.toFixed(2).replace('.', ',')}`,
    },
    {
      title: 'Valor do Frete 4%',
      dataIndex: 'frete4',
      key: 'frete4',
      align: 'right',
      width: 120,
      render: (value) => `R$ ${value.toFixed(2).replace('.', ',')}`,
    },
    {
      title: 'Soma Total Frete',
      dataIndex: 'somaTotalFrete',
      key: 'somaTotalFrete',
      align: 'right',
      width: 120,
      render: (value) => `R$ ${value.toFixed(2).replace('.', ',')}`,
    },
    {
      title: 'Observações',
      dataIndex: 'observacoes',
      key: 'observacoes',
      align: 'left',
      width: 200,
    },
    {
      title: 'Ações',
      key: 'actions',
      align: 'center',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            Editar
          </Button>
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
        </Space>
      ),
    },
  ]

  const exportToExcel = () => {
    if (data.length === 0) {
      message.warning('Não há dados para exportar')
      return
    }

    const wb = XLSX.utils.book_new()
    const companyName = companies.find(c => c.id === selectedCompany)?.name || 'Empresa'

    const headerData = [[`CARGAS DA EMPRESA: ${companyName}`], []]

    const titles = columns.filter(col => col.key !== 'actions').map((col) => col.title)
    headerData.push(titles)

    const tableData = filteredData.map((item) => {
      return columns.filter(col => col.key !== 'actions').map((col) => {
        if (col.render) {
          return col.render(item[col.dataIndex], item)
        }
        return item[col.dataIndex] || ''
      })
    })

    const finalData = [...headerData, ...tableData]

    const ws = XLSX.utils.aoa_to_sheet(finalData)
    XLSX.utils.book_append_sheet(wb, ws, 'Cargas')

    ws.A1.s = { font: { bold: true, sz: 16 } }

    XLSX.writeFile(wb, `Cargas_${companyName}_${dayjs().format('DD-MM-YYYY')}.xlsx`)
  }

  const calculateTotalFreight = () => {
    return filteredData
      .reduce((sum, item) => sum + item.somaTotalFrete, 0)
  }

  const calculateTotalValue = () => {
    return filteredData
      .reduce((sum, item) => sum + item.valorTotal, 0)
  }

  return (
    <Card style={{ margin: '20px', padding: '20px' }} bordered>
      <div style={{ marginBottom: 20 }}>
        <h1>Gerenciamento de Cargas</h1>
        
        {/* Debug: Mostrar empresas carregadas */}
        <div style={{ 
          backgroundColor: '#f0f0f0', 
          padding: '10px', 
          marginBottom: '10px', 
          borderRadius: '5px',
          fontSize: '12px'
        }}>
          <strong>Debug:</strong> Empresas carregadas: {companies.length} | 
          Empresa selecionada: {selectedCompany || 'Nenhuma'} |
          Cargas carregadas: {data.length}
        </div>
        
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            placeholder="Selecione uma empresa"
            value={selectedCompany}
            onChange={handleCompanyChange}
            style={{ width: 250 }}
            showSearch
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {companies.map(company => (
              <Option key={company.id} value={company.id}>
                {company.name} - {company.cnpj}
              </Option>
            ))}
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
            disabled={!dateRange || !selectedCompany}
          >
            Buscar por Período
          </Button>

          <Button
            type="default"
            onClick={fetchLoads}
            disabled={!selectedCompany}
          >
            Carregar Todas
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Input.Search
            placeholder="Buscar por número de carregamento ou observações"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            disabled={!selectedCompany}
          >
            Adicionar Carga
          </Button>

          <Button
            type="default"
            onClick={exportToExcel}
            disabled={filteredData.length === 0}
          >
            Exportar para Excel
          </Button>
        </div>
      </div>

      {selectedCompany && (
        <Table
          dataSource={filteredData}
          columns={columns}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} de ${total} cargas`,
          }}
          loading={loading}
          scroll={{ x: 1200 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}>
                <strong>Totais:</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <strong>
                  R$ {calculateTotalValue().toFixed(2).replace('.', ',')}
                </strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <strong>
                  R$ {filteredData.reduce((sum, item) => sum + item.frete4, 0).toFixed(2).replace('.', ',')}
                </strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">
                <strong>
                  R$ {calculateTotalFreight().toFixed(2).replace('.', ',')}
                </strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} colSpan={2} />
            </Table.Summary.Row>
          )}
        />
      )}

      <CustomModalLoad
        isVisible={isModalOpen}
        onClose={handleModalClose}
        onSubmit={editingLoad ? handleEditLoad : handleAddLoad}
        editingLoad={editingLoad}
        companies={companies}
        selectedCompany={selectedCompany}
      />
    </Card>
  )
}

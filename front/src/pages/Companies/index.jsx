import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Table,
    Tag,
    Button,
    Card,
    Input,
    Space,
    Typography,
    message,
    Popconfirm,
    Result,
} from 'antd'
import AddCompanyModal from '../../components/Modal/Companies'
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa'
import api from '../../lib/api'
import { usePermission } from '../../hooks/usePermission'

const { Title } = Typography

export default function CompanyList() {
  const { hasPermission } = usePermission()
  const [searchText, setSearchText] = useState('')
  const [filteredData, setFilteredData] = useState([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null) 
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  const canView = hasPermission('companies.view')
  const canCreate = hasPermission('companies.create')
  const canUpdate = hasPermission('companies.update')
  const canDelete = hasPermission('companies.delete')

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar empresas."
      />
    )
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const response = await api.get('/companies')
      setData(response.data)
      setFilteredData(response.data)
    } catch (error) {
      console.error('Erro ao buscar empresas:', error)
      message.error('Erro ao carregar empresas: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (searchText) {
      const filtered = data.filter((item) =>
        item.name.toLowerCase().includes(searchText.toLowerCase()) ||
        item.cnpj.includes(searchText) ||
        item.type.toLowerCase().includes(searchText.toLowerCase())
      )
      setFilteredData(filtered)
    } else {
      setFilteredData(data)
    }
  }, [searchText, data])

  const handleEdit = useCallback((company) => {
    setEditingCompany(company)
    setIsModalVisible(true)
  }, [])

  const handleRemove = useCallback(
    async (id) => {
      try {
        await api.delete(`/company/${id}`)
        const updatedData = data.filter((company) => company.id !== id)
        setData(updatedData)
        message.success('Empresa removida com sucesso!')
      } catch (error) {
        console.error('Erro ao remover empresa:', error)
        message.error('Erro ao remover empresa: ' + (error.response?.data?.message || error.message))
      }
    },
    [data],
  )

  const handleAddCompany = () => {
    console.log('➕ Botão Adicionar Empresa clicado');
    setEditingCompany(null)
    setIsModalVisible(true)
    console.log('🔍 Estado após clicar:', { editingCompany: null, isModalVisible: true });
  }

  const handleModalClose = () => {
    console.log('❌ Fechando modal');
    setIsModalVisible(false)
    setEditingCompany(null)
  }

  const handleCompanySaved = () => {
    console.log('✅ Empresa salva, recarregando lista...');
    fetchCompanies() // Recarrega a lista após salvar
    handleModalClose()
  }

  const columns = useMemo(
    () => [
      {
        title: 'Nome',
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => a.name.localeCompare(b.name),
        width: 200,
      },
      {
        title: 'Tipo',
        dataIndex: 'type',
        key: 'type',
        sorter: (a, b) => a.type.localeCompare(b.type),
        width: 150,
      },
      {
        title: 'CNPJ',
        dataIndex: 'cnpj',
        key: 'cnpj',
        width: 150,
      },
      {
        title: 'Data de Cadastro',
        dataIndex: 'dateRegistration',
        key: 'dateRegistration',
        render: (dateRegistration) =>
          new Date(dateRegistration).toLocaleDateString('pt-BR'),
        sorter: (a, b) =>
          new Date(a.dateRegistration) - new Date(b.dateRegistration),
        width: 150,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (status) =>
          status === 'Ativo' ? (
            <Tag color="green">{status}</Tag>
          ) : (
            <Tag color="red">{status}</Tag>
          ),
        width: 100,
      },
      {
        title: 'Comissão',
        dataIndex: 'commission',
        key: 'commission',
        render: (commission) => `${commission}%`,
        width: 100,
      },
      {
        title: 'Responsável',
        dataIndex: 'responsible',
        key: 'responsible',
        width: 150,
      },
      {
        title: 'Ações',
        key: 'actions',
        width: 120,
        render: (_, record) => (
          <Space>
            {canUpdate && (
              <Button
                type="primary"
                icon={<FaEdit />}
                size="small"
                onClick={() => handleEdit(record)}
              >
                Editar
              </Button>
            )}
            {canDelete && (
              <Popconfirm
                title="Tem certeza que deseja excluir esta empresa?"
                onConfirm={() => handleRemove(record.id)}
                okText="Sim"
                cancelText="Não"
              >
                <Button
                  type="primary"
                  danger
                  icon={<FaTrash />}
                  size="small"
                >
                  Excluir
                </Button>
              </Popconfirm>
            )}
            {!canUpdate && !canDelete && <span>-</span>}
          </Space>
        ),
      },
    ],
    [handleEdit, handleRemove],
  )

  return (
    <Card
      style={{
        margin: '20px',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      }}
      bordered
    >
      <Title level={3} style={{ color: '#333', marginBottom: '20px' }}>
        Gerenciamento de Empresas
      </Title>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <Input
          placeholder="Pesquisar por nome, CNPJ ou tipo"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: '300px' }}
          allowClear
        />

        {canCreate && (
          <Button
            type="primary"
            icon={<FaPlus />}
            onClick={handleAddCompany}
          >
            Adicionar Empresa
          </Button>
        )}
      </div>

      <Table
        dataSource={filteredData}
        columns={columns}
        pagination={{ 
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} de ${total} empresas`,
        }}
        loading={loading}
        bordered
        style={{ fontFamily: 'Arial, sans-serif' }}
        rowKey="id"
        scroll={{ x: 1200 }}
      />

      {canCreate || canUpdate ? (
        <AddCompanyModal
          isModalVisible={isModalVisible}
          setIsModalVisible={setIsModalVisible}
          onCompanySaved={handleCompanySaved}
          editingCompany={editingCompany}
          setEditingCompany={setEditingCompany}
        />
      ) : null}
    </Card>
  )
}

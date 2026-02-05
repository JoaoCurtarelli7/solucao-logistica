import React, { useCallback, useEffect, useState } from 'react'
import { Card, Table, Button, Tag, Typography, message, Input, Select, Row, Col, Space, Tooltip, Popconfirm, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import AddEmployeeModal from '../../components/Modal/Employee'
import api from '../../lib/api'
import { FaEdit, FaTrash, FaSearch, FaEye, FaPlus } from 'react-icons/fa'
import dayjs from 'dayjs'
import { usePermission } from '../../hooks/usePermission'

const { Title } = Typography
const { Search } = Input
const { Option } = Select

export default function EmployeeList() {
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const [data, setData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const canView = hasPermission('employees.view')
  const canCreate = hasPermission('employees.create')
  const canUpdate = hasPermission('employees.update')
  const canDelete = hasPermission('employees.delete')

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar funcionários."
      />
    )
  }

  // Carrega a lista de funcionários
  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/employees')
      setData(response.data)
      setFilteredData(response.data)
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error)
      message.error('Erro ao carregar funcionários')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  // Filtra os dados baseado no texto de busca e status
  useEffect(() => {
    let filtered = data

    if (searchText) {
      filtered = filtered.filter(employee =>
        employee.name.toLowerCase().includes(searchText.toLowerCase()) ||
        employee.role.toLowerCase().includes(searchText.toLowerCase()) ||
        (employee.cpf && employee.cpf.includes(searchText)) ||
        (employee.email && employee.email.toLowerCase().includes(searchText.toLowerCase()))
      )
    }

    if (statusFilter) {
      filtered = filtered.filter(employee => employee.status === statusFilter)
    }

    setFilteredData(filtered)
  }, [data, searchText, statusFilter])

  const addEmployee = (newEmployee) => {
    if (editingEmployee) {
      const updatedData = data.map((employee) =>
        employee.id === newEmployee.id ? newEmployee : employee,
      )
      setData(updatedData)
    } else {
      setData([newEmployee, ...data])
    }
  }

  const handleRemove = useCallback(
    async (id) => {
      try {
        await api.delete(`/employees/${id}`)
        const updatedData = data.filter((employee) => employee.id !== id)
        setData(updatedData)
        message.success('Funcionário removido com sucesso!')
      } catch (error) {
        console.error('Erro ao remover funcionário:', error)
        message.error('Erro ao remover funcionário')
      }
    },
    [data],
  )

  const handleSearch = (value) => {
    setSearchText(value)
  }

  const handleStatusFilter = (value) => {
    setStatusFilter(value)
  }

  const clearFilters = () => {
    setSearchText('')
    setStatusFilter('')
  }

  const columns = [
    {
      title: 'Nome',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{name}</div>
          {record.cpf && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              CPF: {record.cpf}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Cargo',
      dataIndex: 'role',
      key: 'role',
      sorter: (a, b) => a.role.localeCompare(b.role),
    },
    {
      title: 'Contato',
      key: 'contact',
      render: (_, record) => (
        <div>
          {record.phone && (
            <div style={{ fontSize: '12px' }}>
              📞 {record.phone}
            </div>
          )}
          {record.email && (
            <div style={{ fontSize: '12px', color: '#1890ff' }}>
              ✉️ {record.email}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Salário Base',
      dataIndex: 'baseSalary',
      key: 'baseSalary',
      align: 'right',
      sorter: (a, b) => a.baseSalary - b.baseSalary,
      render: (value) => (
        <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Ativo', value: 'Ativo' },
        { text: 'Inativo', value: 'Inativo' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) =>
        status === 'Ativo' ? (
          <Tag color="green">{status}</Tag>
        ) : (
          <Tag color="red">{status}</Tag>
        ),
    },
    {
      title: 'Data Contratação',
      dataIndex: 'hireDate',
      key: 'hireDate',
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Ações',
      key: 'acoes',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="Ver Detalhes">
            <Button
              type="link"
              icon={<FaEye />}
              onClick={() => navigate(`/employee/${record.id}`)}
            >
              Detalhes
            </Button>
          </Tooltip>

          {canUpdate && (
            <Tooltip title="Editar">
              <Button
                type="link"
                icon={<FaEdit />}
                onClick={() => setEditingEmployee(record)}
              >
                Editar
              </Button>
            </Tooltip>
          )}

          {canDelete && (
            <Tooltip title="Excluir">
              <Popconfirm
                title="Tem certeza que deseja excluir este funcionário?"
                description="Esta ação não pode ser desfeita."
                onConfirm={() => handleRemove(record.id)}
                okText="Sim"
                cancelText="Não"
                okType="danger"
              >
                <Button
                  type="link"
                  danger
                  icon={<FaTrash />}
                >
                  Excluir
                </Button>
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Title level={3} style={{ color: '#333', margin: 0 }}>
          Gestão de Funcionários
        </Title>
        {canCreate && (
          <AddEmployeeModal
            addEmployee={addEmployee}
            editingEmployee={editingEmployee}
            setEditingEmployee={setEditingEmployee}
          />
        )}
      </div>

      <Row gutter={16} style={{ marginBottom: '20px' }}>
        <Col span={8}>
          <Search
            placeholder="Buscar por nome, cargo, CPF ou email..."
            allowClear
            enterButton={<FaSearch />}
            size="large"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
          />
        </Col>
        <Col span={4}>
          <Select
            placeholder="Filtrar por status"
            style={{ width: '100%' }}
            size="large"
            value={statusFilter}
            onChange={handleStatusFilter}
            allowClear
          >
            <Option value="Ativo">Ativo</Option>
            <Option value="Inativo">Inativo</Option>
          </Select>
        </Col>
        <Col span={4}>
          <Button
            size="large"
            onClick={clearFilters}
            disabled={!searchText && !statusFilter}
          >
            Limpar Filtros
          </Button>
        </Col>
        <Col span={8} style={{ textAlign: 'right' }}>
          <span style={{ color: '#666' }}>
            Total: <strong>{filteredData.length}</strong> funcionário(s)
          </span>
        </Col>
      </Row>

      <Table
        dataSource={filteredData}
        columns={columns}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} de ${total} funcionários`,
        }}
        style={{ fontFamily: 'Arial, sans-serif' }}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
      />
    </Card>
  )
}

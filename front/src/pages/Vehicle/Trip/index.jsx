import { useEffect, useState } from 'react'
import {
  Card,
  Button,
  Table,
  Typography,
  Space,
  Popconfirm,
  message,
  Result,
  Tag,
  Row,
  Col,
  Statistic,
} from 'antd'
import TripModal from '../../../components/Modal/Trip'
import {
  PlusCircleOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { FaTrash, FaDollarSign, FaEdit } from 'react-icons/fa'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../lib'
import dayjs from 'dayjs'
import { usePermission } from '../../../hooks/usePermission'

const { Title } = Typography

const STATUS_CONFIG = {
  em_andamento: {
    label: 'Em andamento',
    color: 'processing',
    icon: <ClockCircleOutlined />,
  },
  concluida: { label: 'Concluída', color: 'success', icon: <CheckCircleOutlined /> },
  cancelada: { label: 'Cancelada', color: 'default', icon: null },
}

export default function TripList() {
  const navigate = useNavigate()
  const { id: truckId } = useParams()
  const { hasPermission } = usePermission()

  const [trips, setTrips] = useState([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [currentTrip, setCurrentTrip] = useState(null)

  const canView = hasPermission('trips.view')
  const canCreate = hasPermission('trips.create')
  const canUpdate = hasPermission('trips.update')
  const canDelete = hasPermission('trips.delete')

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar viagens."
      />
    )
  }

  const fetchTrips = async () => {
    try {
      const url = truckId ? `/trucks/${truckId}/trips` : '/trips'
      const response = await api.get(url)

      const list = Array.isArray(response.data)
        ? response.data
        : response.data?.trips || []

      setTrips(list)
      localStorage.setItem('tripsData', JSON.stringify(list))
    } catch (error) {
      console.error(error)

      const savedData = localStorage.getItem('tripsData')
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData)
          setTrips(parsedData)
          message.warning('Dados carregados do cache devido a erro na conexão')
        } catch (parseError) {
          console.error('Erro ao parsear dados salvos:', parseError)
          message.error('Erro ao carregar viagens')
        }
      } else {
        message.error('Erro ao carregar viagens')
      }
    }
  }

  useEffect(() => {
    fetchTrips()
  }, [truckId])

  useEffect(() => {
    const handleReloadTrips = () => fetchTrips()
    window.addEventListener('reloadTrips', handleReloadTrips)
    return () => window.removeEventListener('reloadTrips', handleReloadTrips)
  }, [])

  useEffect(() => {
    const handleFocus = () => fetchTrips()

    const handleVisibilityChange = () => {
      if (!document.hidden) fetchTrips()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const buildPayload = (values) => {
    return {
      ...values,
      origin: values?.origin || undefined,
      date: values?.date?.toDate
        ? values.date.toDate().toISOString()
        : values?.date
          ? new Date(values.date).toISOString()
          : undefined,
      estimatedArrival: values?.estimatedArrival?.toDate
        ? values.estimatedArrival.toDate().toISOString()
        : values?.estimatedArrival
          ? new Date(values.estimatedArrival).toISOString()
          : undefined,
      truckId: truckId ? Number(truckId) : values?.truckId,
    }
  }

  const handleAddTrip = async (values) => {
    try {
      const payload = buildPayload(values)
      const response = await api.post('/trips', payload)
      setTrips((prev) => [...prev, response.data])
      setIsModalVisible(false)
      message.success('Viagem adicionada com sucesso!')
      fetchTrips()
    } catch (error) {
      console.error(error)
      const msg = error.response?.data?.message || 'Erro ao adicionar viagem'
      message.error(msg)
    }
  }

  const handleEditTrip = (trip) => {
    setCurrentTrip(trip)
    setIsModalVisible(true)
  }

  const handleEditSubmit = async (values) => {
    try {
      const payload = buildPayload(values)
      const response = await api.put(`/trips/${currentTrip.id}`, payload)
      setTrips((prev) =>
        prev.map((trip) => (trip.id === currentTrip.id ? response.data : trip)),
      )
      setCurrentTrip(null)
      setIsModalVisible(false)
      message.success('Viagem atualizada com sucesso!')
      fetchTrips()
    } catch (error) {
      console.error(error)
      message.error('Erro ao atualizar viagem')
    }
  }

  const handleDeleteTrip = async (id) => {
    try {
      const trip = trips.find((t) => t.id === id)
      const expenses = trip?.TripExpense ?? trip?.expenses ?? []

      if (trip && expenses.length > 0) {
        message.error(
          'Não é possível deletar uma viagem que possui despesas vinculadas. Remova as despesas primeiro.',
        )
        return
      }

      await api.delete(`/trips/${id}`)
      setTrips((prev) => prev.filter((trip) => trip.id !== id))
      message.success('Viagem removida com sucesso!')
      fetchTrips()
    } catch (error) {
      console.error(error)
      if (error.response?.data?.message) {
        message.error(error.response.data.message)
      } else {
        message.error('Erro ao remover viagem')
      }
    }
  }

  const columns = [
    {
      title: 'Rota',
      key: 'route',
      width: 220,
      render: (_, record) => {
        const origin = record.origin?.trim()
        const dest = record.destination?.trim() || '-'
        const route = origin ? `${origin} → ${dest}` : dest
        return <span title={route}>{route}</span>
      },
    },
    { title: 'Motorista', dataIndex: 'driver', key: 'driver', width: 140 },
    {
      title: 'Data saída',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Previsão chegada',
      dataIndex: 'estimatedArrival',
      key: 'estimatedArrival',
      width: 140,
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY HH:mm') : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => {
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.em_andamento
        return (
          <Tag color={cfg.color} icon={cfg.icon}>
            {cfg.label}
          </Tag>
        )
      },
    },
    {
      title: 'Frete',
      dataIndex: 'freightValue',
      key: 'freightValue',
      width: 100,
      align: 'right',
      render: (value) =>
        value != null
          ? `R$ ${Number(value).toFixed(2).replace('.', ',')}`
          : '—',
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<FaDollarSign />}
            title="Despesas"
            onClick={() => {
              localStorage.setItem('tripsData', JSON.stringify(trips))
              navigate(`/vehicle/trip-expenses/${record.id}`, { state: record })
            }}
          />

          {canUpdate && (
            <Button
              type="link"
              size="small"
              icon={<FaEdit />}
              title="Editar"
              onClick={() => handleEditTrip(record)}
            />
          )}

          {canDelete && (
            <Popconfirm
              title="Excluir esta viagem?"
              onConfirm={() => handleDeleteTrip(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<FaTrash />}
                title="Excluir"
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const stats = {
    total: trips.length,
    emAndamento: trips.filter((t) => t.status === 'em_andamento').length,
    concluidas: trips.filter((t) => t.status === 'concluida').length,
  }

  return (
    <Card style={{ margin: 20, padding: 24 }} bordered>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <Title level={2} style={{ margin: 0 }}>
            Viagens
          </Title>

          {canCreate && (
            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              onClick={() => {
                setCurrentTrip(null)
                setIsModalVisible(true)
              }}
            >
              Nova viagem
            </Button>
          )}
        </div>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic
                title="Total de viagens"
                value={stats.total}
                prefix={<CarOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic
                title="Em andamento"
                value={stats.emAndamento}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic
                title="Concluídas"
                value={stats.concluidas}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Table
          dataSource={trips}
          columns={columns}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} viagens`,
          }}
          rowKey="id"
          scroll={{ x: 900 }}
        />

        {(canCreate || canUpdate) && (
          <TripModal
            visible={isModalVisible}
            onCancel={() => setIsModalVisible(false)}
            onSubmit={currentTrip ? handleEditSubmit : handleAddTrip}
            initialValues={currentTrip}
          />
        )}
      </Space>
    </Card>
  )
}

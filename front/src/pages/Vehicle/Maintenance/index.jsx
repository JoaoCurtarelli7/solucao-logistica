import { useCallback, useEffect, useState } from 'react'
import { Card, Table, Typography, Button, message, Result, Row, Col, Tag, Space } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import VehicleMaintenanceModal from '../../../components/Modal/MainTenanceVehicle'
import { FaEdit, FaTrash } from 'react-icons/fa'
import { api } from '../../../lib'
import dayjs from 'dayjs'
import { usePermission } from '../../../hooks/usePermission'

const { Title } = Typography

export default function VehicleMaintenanceList() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = usePermission()

  const [maintenanceData, setMaintenanceData] = useState([])
  const [truck, setTruck] = useState(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState(null)

  const canView = hasPermission('maintenance.view')
  const canCreate = hasPermission('maintenance.create')
  const canUpdate = hasPermission('maintenance.update')
  const canDelete = hasPermission('maintenance.delete')

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar manutenções."
      />
    )
  }

  const fetchMaintenance = useCallback(async () => {
    try {
      const truckResponse = await api.get(`/trucks/${id}`)
      setTruck(truckResponse.data)

      const response = await api.get(`/trucks/${id}/maintenances`)

      const arr = Array.isArray(response.data?.maintenances)
        ? response.data.maintenances
        : Array.isArray(response.data)
          ? response.data
          : []

      setMaintenanceData(arr)
    } catch (error) {
      console.error('Erro ao carregar manutenções:', error)
      message.error('Erro ao carregar manutenções')
      setMaintenanceData([])
    }
  }, [id])

  const getStatus = (dateValue) => {
    if (!dateValue) return { label: 'Sem data', color: 'default' }
    const days = dayjs(dateValue).startOf('day').diff(dayjs().startOf('day'), 'day')
    if (days < 0) return { label: 'Vencido', color: 'red' }
    if (days <= 30) return { label: `Vence em ${days}d`, color: 'orange' }
    return { label: 'Em dia', color: 'green' }
  }

  useEffect(() => {
    fetchMaintenance()
  }, [fetchMaintenance])

  const handleAddMaintenance = async (values) => {
    try {
      const payload = {
        date: values?.data
          ? dayjs(values.data, 'DD/MM/YYYY').toDate().toISOString()
          : undefined,
        service: values?.servico,
        km: values?.km,
        value: values?.valor,
        notes: values?.observacao,
      }

      const response = await api.post(`/trucks/${id}/maintenances`, payload)

      setMaintenanceData((prev) => [...prev, response.data])
      setIsModalVisible(false)
      message.success('Manutenção adicionada com sucesso!')
      fetchMaintenance()
    } catch (error) {
      console.error(error)
      message.error('Erro ao adicionar manutenção')
    }
  }

  const handleEditMaintenance = async (values) => {
    try {
      const payload = {
        date: values?.data
          ? dayjs(values.data, 'DD/MM/YYYY').toDate().toISOString()
          : undefined,
        service: values?.servico,
        km: values?.km,
        value: values?.valor,
        notes: values?.observacao,
      }

      const response = await api.put(
        `/maintenances/${editingMaintenance.id}`,
        payload,
      )

      setMaintenanceData((prev) =>
        prev.map((item) =>
          item.id === editingMaintenance.id ? response.data : item,
        ),
      )

      setIsModalVisible(false)
      setEditingMaintenance(null)
      message.success('Manutenção atualizada com sucesso!')
      fetchMaintenance()
    } catch (error) {
      console.error(error)
      message.error('Erro ao atualizar manutenção')
    }
  }

  const handleDelete = async (maintenanceId) => {
    try {
      await api.delete(`/maintenances/${maintenanceId}`)
      setMaintenanceData((prev) =>
        prev.filter((item) => item.id !== maintenanceId),
      )
      message.success('Manutenção removida com sucesso!')
      fetchMaintenance()
    } catch (error) {
      console.error(error)
      message.error('Erro ao remover manutenção')
    }
  }

  const handleEdit = (record) => {
    setEditingMaintenance(record)
    setIsModalVisible(true)
  }

  const columns = [
    {
      title: 'Data',
      dataIndex: 'date',
      key: 'date',
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY') : '-'),
    },
    { title: 'Serviço Realizado', dataIndex: 'service', key: 'service' },
    { title: 'KM', dataIndex: 'km', key: 'km', align: 'right' },
    {
      title: 'Valor (R$)',
      dataIndex: 'value',
      key: 'value',
      align: 'right',
      render: (value) =>
        Number(value || 0).toFixed(2).replace('.', ','),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <>
          {canUpdate && (
            <FaEdit
              onClick={() => handleEdit(record)}
              style={{ cursor: 'pointer', marginRight: '10px' }}
            />
          )}
          {canDelete && (
            <FaTrash
              onClick={() => handleDelete(record.id)}
              style={{ cursor: 'pointer' }}
            />
          )}
        </>
      ),
    },
  ]

  const totalGasto = Array.isArray(maintenanceData)
    ? maintenanceData.reduce((acc, curr) => acc + Number(curr.value || 0), 0)
    : 0

  return (
    <Card style={{ margin: '20px', padding: '20px' }} bordered>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/vehicle-maintenance')}
          >
            Voltar
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            Manutenção do Caminhão #{id}
          </Title>
        </div>

        {canCreate && (
          <Button type="primary" onClick={() => setIsModalVisible(true)}>
            Adicionar Manutenção
          </Button>
        )}
      </div>

      <Card title="Alertas de Vencimento da Frota" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col span={24}>
            <Space size={[8, 8]} wrap>
              <Tag color={getStatus(truck?.docExpiry).color}>
                Documento: {getStatus(truck?.docExpiry).label}
              </Tag>
              <Tag color={getStatus(truck?.insuranceExpiry).color}>
                Seguro: {getStatus(truck?.insuranceExpiry).label}
              </Tag>
              <Tag color={getStatus(truck?.tachographCalibrationExpiry).color}>
                Tacógrafo: {getStatus(truck?.tachographCalibrationExpiry).label}
              </Tag>
              <Tag color={getStatus(truck?.oilChangeEngineDate).color}>
                Óleo Motor: {getStatus(truck?.oilChangeEngineDate).label}
              </Tag>
              <Tag color={getStatus(truck?.oilChangeGearboxDate).color}>
                Óleo Caixa: {getStatus(truck?.oilChangeGearboxDate).label}
              </Tag>
              <Tag color={getStatus(truck?.oilChangeDifferentialDate).color}>
                Óleo Diferencial: {getStatus(truck?.oilChangeDifferentialDate).label}
              </Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        dataSource={Array.isArray(maintenanceData) ? maintenanceData : []}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        footer={() => (
          <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
            Total Gasto: R$ {totalGasto.toFixed(2).replace('.', ',')}
          </div>
        )}
      />

      {(canCreate || canUpdate) && (
        <VehicleMaintenanceModal
          visible={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false)
            setEditingMaintenance(null)
          }}
          onAddMaintenance={handleAddMaintenance}
          onEditMaintenance={handleEditMaintenance}
          editingMaintenance={editingMaintenance}
        />
      )}
    </Card>
  )
}

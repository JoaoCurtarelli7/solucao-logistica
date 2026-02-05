import { useEffect, useState } from "react";
import {
    Card,
    Button,
    Row,
    Col,
    message,
    Typography,
    Table,
    Space,
    Tag,
    Popconfirm,
    Tooltip,
    Statistic,
    Progress,
    Result
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ToolOutlined,
    CarOutlined,
    EyeOutlined,
    CalendarOutlined,
    DollarOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import AddVehicleModal from "../../components/Modal/Vehicle";
import { api } from "../../lib";
import { usePermission } from "../../hooks/usePermission";

const { Title, Text } = Typography;

export default function VehicleList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState(null);

  const canView = hasPermission('trucks.view');
  const canCreate = hasPermission('trucks.create');
  const canUpdate = hasPermission('trucks.update');
  const canDelete = hasPermission('trucks.delete');

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar caminhões."
      />
    );
  }

  // Carregar caminhões
  const loadTrucks = async () => {
    setLoading(true);
    try {
      const response = await api.get("/trucks");
      setData(response.data.trucks || []);
    } catch (error) {
      console.error("Erro ao carregar os caminhões:", error);
      message.error("Erro ao carregar os caminhões");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrucks();
  }, []);

  // Adicionar ou editar caminhão
  const handleSaveVehicle = async (values) => {
    try {
      if (currentVehicle?.id) {
        // Editar
        const response = await api.put(`/trucks/${currentVehicle.id}`, values);
        setData((prev) =>
          prev.map((v) => (v.id === currentVehicle.id ? response.data : v))
        );
        message.success("Caminhão atualizado com sucesso!");
      } else {
        // Adicionar
        const response = await api.post("/trucks", values);
        setData((prev) => [...prev, response.data]);
        message.success("Caminhão adicionado com sucesso!");
      }

      setIsModalVisible(false);
      setCurrentVehicle(null);
      loadTrucks(); // Recarregar dados
    } catch (error) {
      console.error("Erro ao salvar caminhão:", error);
      message.error(error.response?.data?.message || "Erro ao salvar caminhão");
    }
  };

  // Deletar caminhão
  const handleDeleteVehicle = async (id) => {
    try {
      await api.delete(`/trucks/${id}`);
      message.success("Caminhão deletado com sucesso!");
      loadTrucks(); // Recarregar dados
    } catch (error) {
      console.error("Erro ao deletar caminhão:", error);
      message.error(error.response?.data?.message || "Erro ao deletar caminhão");
    }
  };

  // Calcular estatísticas
  const totalTrucks = data.length;
  const activeTrucks = data.filter(truck => {
    const docExpiry = dayjs(truck.docExpiry);
    const today = dayjs();
    return docExpiry.isAfter(today);
  }).length;
  const expiredDocs = totalTrucks - activeTrucks;

  // Colunas da tabela
  const columns = [
    {
      title: 'Caminhão',
      key: 'truck',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: '16px' }}>{record.name}</div>
          <Text type="secondary">{record.brand} - {record.year}</Text>
        </div>
      ),
    },
    {
      title: 'Placa',
      dataIndex: 'plate',
      key: 'plate',
      render: (plate) => (
        <Tag color="blue" style={{ fontSize: '14px', fontWeight: 'bold' }}>
          {plate}
        </Tag>
      ),
    },
    {
      title: 'Documentação',
      key: 'docExpiry',
      render: (_, record) => {
        const docExpiry = dayjs(record.docExpiry);
        const today = dayjs();
        const daysUntilExpiry = docExpiry.diff(today, 'day');
        
        let color = 'green';
        let status = 'Válida';
        
        if (daysUntilExpiry < 0) {
          color = 'red';
          status = 'Expirada';
        } else if (daysUntilExpiry <= 30) {
          color = 'orange';
          status = 'Expira em breve';
        }
        
        return (
          <div>
            <Tag color={color}>{status}</Tag>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              {record.docExpiry ? dayjs(record.docExpiry).format('DD/MM/YYYY') : 'N/A'}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Manutenções',
      key: 'maintenances',
      render: (_, record) => (
        <div>
          <Text strong>{record.maintenances?.length || 0}</Text>
          <div style={{ fontSize: '12px' }}>
            Última: {record.maintenances?.[0]?.date ? 
              dayjs(record.maintenances[0].date).format('DD/MM/YYYY') : 'N/A'}
          </div>
        </div>
      ),
    },
    {
      title: 'Viagens',
      key: 'trips',
      render: (_, record) => (
        <div>
          <Text strong>{record.trips?.length || 0}</Text>
          <div style={{ fontSize: '12px' }}>
            Última: {record.trips?.[0]?.date ? 
              dayjs(record.trips[0].date).format('DD/MM/YYYY') : 'N/A'}
          </div>
        </div>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Ver detalhes">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => navigate(`/vehicle-maintenance/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Manutenção">
            <Button 
              type="text" 
              icon={<ToolOutlined />} 
              onClick={() => navigate(`/vehicle-maintenance/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Viagens">
            <Button 
              type="text" 
              icon={<CarOutlined />} 
              onClick={() => navigate(`/vehicle-trip/${record.id}`)}
            />
          </Tooltip>
          {canUpdate && (
            <Tooltip title="Editar">
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => {
                  setCurrentVehicle(record);
                  setIsModalVisible(true);
                }}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Tem certeza que deseja deletar este caminhão?"
              onConfirm={() => handleDeleteVehicle(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Tooltip title="Deletar">
                <Button 
                  type="text" 
                  danger
                  icon={<DeleteOutlined />} 
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header com estatísticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total de Caminhões"
              value={totalTrucks}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Documentação Válida"
              value={activeTrucks}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Documentação Expirada"
              value={expiredDocs}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Taxa de Validade"
              value={totalTrucks > 0 ? Math.round((activeTrucks / totalTrucks) * 100) : 0}
              suffix="%"
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <Progress 
              percent={totalTrucks > 0 ? Math.round((activeTrucks / totalTrucks) * 100) : 0} 
              size="small" 
              status={expiredDocs === 0 ? 'success' : 'exception'}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabela de caminhões */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>Lista de Caminhões</Title>
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setCurrentVehicle(null);
                setIsModalVisible(true);
              }}
            >
              Adicionar Caminhão
            </Button>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} caminhões`,
          }}
              />
            </Card>

      {/* Modal */}
      {(canCreate || canUpdate) && (
        <AddVehicleModal
          visible={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            setCurrentVehicle(null);
          }}
          onSave={handleSaveVehicle}
          vehicle={currentVehicle}
        />
      )}
    </div>
  );
}

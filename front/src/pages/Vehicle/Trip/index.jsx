import { useEffect, useState } from 'react';
import { Card, Button, Table, Typography, Space, Popconfirm, message, Result } from 'antd';
import TripModal from '../../../components/Modal/Trip';
import { PlusCircleOutlined } from '@ant-design/icons';
import { FaTrash, FaDollarSign, FaEdit } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../lib';
import dayjs from 'dayjs';
import { usePermission } from '../../../hooks/usePermission';

const { Title } = Typography;

export default function TripList() {
  const navigate = useNavigate();
  const { id: truckId } = useParams();
  const { hasPermission } = usePermission();
  const [trips, setTrips] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentTrip, setCurrentTrip] = useState(null);

  const canView = hasPermission('trips.view');
  const canCreate = hasPermission('trips.create');
  const canUpdate = hasPermission('trips.update');
  const canDelete = hasPermission('trips.delete');

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar viagens."
      />
    );
  }

  // Carregar todas as viagens
  const fetchTrips = async () => {
    try {
      const url = truckId ? `/trucks/${truckId}/trips` : '/trips';
      const response = await api.get(url);
      // aceita { trips } ou array direto
      const list = Array.isArray(response.data) ? response.data : (response.data?.trips || []);
      setTrips(list);
      // Salvar dados no localStorage para backup
      localStorage.setItem('tripsData', JSON.stringify(list));
    } catch (error) {
      console.error(error);
      // Tentar restaurar dados do localStorage em caso de erro
      const savedData = localStorage.getItem('tripsData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          setTrips(parsedData);
          message.warning('Dados carregados do cache devido a erro na conexão');
        } catch (parseError) {
          console.error('Erro ao parsear dados salvos:', parseError);
          message.error('Erro ao carregar viagens');
        }
      } else {
        message.error('Erro ao carregar viagens');
      }
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [truckId]);

  // Escutar evento de recarregamento quando voltar das despesas
  useEffect(() => {
    const handleReloadTrips = () => {
      fetchTrips();
    };
    
    window.addEventListener('reloadTrips', handleReloadTrips);
    return () => window.removeEventListener('reloadTrips', handleReloadTrips);
  }, []);

  // Recarregar dados quando a janela ganha foco (volta de outra tela)
  useEffect(() => {
    const handleFocus = () => {
      fetchTrips();
    };
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchTrips();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Adicionar viagem
  const handleAddTrip = async (values) => {
    try {
      // garantir data ISO e associar ao caminhão quando filtrado por truckId
      const payload = {
        ...values,
        date: values?.date?.toDate ? values.date.toDate().toISOString() : (values?.date ? new Date(values.date).toISOString() : undefined),
        truckId: truckId ? Number(truckId) : undefined,
      };
      const response = await api.post('/trips', payload);
      setTrips((prev) => [...prev, response.data]);
      setIsModalVisible(false);
      message.success('Viagem adicionada com sucesso!');
    } catch (error) {
      console.error(error);
      message.error('Erro ao adicionar viagem');
    }
  };

  // Editar viagem
  const handleEditTrip = (trip) => {
    setCurrentTrip(trip);
    setIsModalVisible(true);
  };

  const handleEditSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        date: values?.date?.toDate ? values.date.toDate().toISOString() : (values?.date ? new Date(values.date).toISOString() : undefined),
        truckId: truckId ? Number(truckId) : values?.truckId,
      };
      const response = await api.put(`/trips/${currentTrip.id}`, payload);
      setTrips((prev) =>
        prev.map((trip) => (trip.id === currentTrip.id ? response.data : trip))
      );
      setCurrentTrip(null);
      setIsModalVisible(false);
      message.success('Viagem atualizada com sucesso!');
    } catch (error) {
      console.error(error);
      message.error('Erro ao atualizar viagem');
    }
  };

  // Deletar viagem
  const handleDeleteTrip = async (id) => {
    try {
      // Verificar se a viagem tem despesas antes de deletar
      const trip = trips.find(t => t.id === id);
      if (trip && trip.expenses && trip.expenses.length > 0) {
        message.error('Não é possível deletar uma viagem que possui despesas vinculadas. Remova as despesas primeiro.');
        return;
      }
      
      await api.delete(`/trips/${id}`);
      setTrips((prev) => prev.filter((trip) => trip.id !== id));
      message.success('Viagem removida com sucesso!');
    } catch (error) {
      console.error(error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error('Erro ao remover viagem');
      }
    }
  };

  const columns = [
    { title: 'Destino', dataIndex: 'destination', key: 'destination' },
    { title: 'Motorista', dataIndex: 'driver', key: 'driver' },
    { 
      title: 'Data', 
      dataIndex: 'date', 
      key: 'date',
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-'
    },
    { 
      title: 'Caminhão', 
      dataIndex: 'truck', 
      key: 'truck',
      render: (truck) => (truck ? `${truck.name} (${truck.plate})` : '-')
    },
    { 
      title: 'Valor do Frete', 
      dataIndex: 'freightValue', 
      key: 'freightValue',
      render: (value) => value ? `R$ ${value.toFixed(2).replace('.', ',')}` : '-',
      align: 'right'
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <>
          <FaDollarSign
            style={{ cursor: 'pointer', marginRight: 10 }}
            onClick={() => {
              // Salvar dados atuais antes de navegar
              localStorage.setItem('tripsData', JSON.stringify(trips));
              navigate(`/vehicle/trip-expenses/${record.id}`, { state: record });
            }}
          />
          {canUpdate && (
            <FaEdit
              style={{ cursor: 'pointer', marginRight: 10 }}
              onClick={() => handleEditTrip(record)}
            />
          )}
          {canDelete && (
            <Popconfirm
              title="Tem certeza de que deseja excluir?"
              onConfirm={() => handleDeleteTrip(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <FaTrash style={{ cursor: 'pointer' }} />
            </Popconfirm>
          )}
        </>
      ),
    },
  ];

  return (
    <Card style={{ margin: 20, padding: 20 }} bordered>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Title level={2}>Lista de Viagens</Title>

        {canCreate && (
          <Button
            type="primary"
            style={{ marginBottom: 16 }}
            icon={<PlusCircleOutlined />}
            onClick={() => {
              setCurrentTrip(null);
              setIsModalVisible(true);
            }}
          >
            Adicionar Viagem
          </Button>
        )}

        <Table dataSource={trips} columns={columns} pagination={{ pageSize: 5 }} rowKey="id" />

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
  );
}

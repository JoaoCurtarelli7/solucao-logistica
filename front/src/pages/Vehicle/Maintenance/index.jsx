import { useCallback, useEffect, useState } from 'react';
import { Card, Table, Typography, Button, message, Result } from 'antd';
import { useParams } from 'react-router-dom';
import VehicleMaintenanceModal from '../../../components/Modal/MainTenanceVehicle';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { api } from '../../../lib';
import dayjs from 'dayjs';
import { usePermission } from '../../../hooks/usePermission';

const { Title } = Typography;

export default function VehicleMaintenanceList() {
  const { id } = useParams();
  const { hasPermission } = usePermission();
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState(null);

  const canView = hasPermission('maintenance.view');
  const canCreate = hasPermission('maintenance.create');
  const canUpdate = hasPermission('maintenance.update');
  const canDelete = hasPermission('maintenance.delete');

  if (!canView) {
    return (
      <Result
        status="403"
        title="Acesso negado"
        subTitle="Você não tem permissão para visualizar manutenções."
      />
    );
  }


  const fetchMaintenance = useCallback(async () => {
    try {
      const response = await api.get(`/trucks/${id}/maintenances`);
  
      // backend responde { maintenances }
      const arr = Array.isArray(response.data.maintenances)
        ? response.data.maintenances
        : [];
  
      setMaintenanceData(arr);
    } catch (error) {
      console.error('Erro ao carregar manutenções:', error);
      message.error('Erro ao carregar manutenções');
      setMaintenanceData([]);
    }
  }, [id]);
  
  const totalGasto = Array.isArray(maintenanceData)
  ? maintenanceData.reduce((acc, curr) => acc + (curr.valor || 0), 0)
  : 0;

  useEffect(() => {
    fetchMaintenance();
  }, [id]);

  // Adicionar manutenção
  const handleAddMaintenance = async (values) => {
    try {
      // mapear campos para o backend: data->date, servico->service, valor->value
      const payload = {
        date: values?.data ? dayjs(values.data, 'DD/MM/YYYY').toDate().toISOString() : undefined,
        service: values?.servico,
        km: values?.km,
        value: values?.valor,
        notes: values?.observacao,
      };
      const response = await api.post(`/trucks/${id}/maintenances`, payload);
      setMaintenanceData((prev) => [...prev, response.data]);
      setIsModalVisible(false);
      message.success('Manutenção adicionada com sucesso!');
    } catch (error) {
      console.error(error);
      message.error('Erro ao adicionar manutenção');
    }
  };

  // Editar manutenção
  const handleEditMaintenance = async (values) => {
    try {
      const payload = {
        date: values?.data ? dayjs(values.data, 'DD/MM/YYYY').toDate().toISOString() : undefined,
        service: values?.servico,
        km: values?.km,
        value: values?.valor,
        notes: values?.observacao,
      };
      // backend de update é /maintenances/:id
      const response = await api.put(
        `/maintenances/${editingMaintenance.id}`,
        payload
      );
      setMaintenanceData((prev) =>
        prev.map((item) =>
          item.id === editingMaintenance.id ? response.data : item
        )
      );
      setIsModalVisible(false);
      setEditingMaintenance(null);
      message.success('Manutenção atualizada com sucesso!');
    } catch (error) {
      console.error(error);
      message.error('Erro ao atualizar manutenção');
    }
  };

  // Deletar manutenção
  const handleDelete = async (maintenanceId) => {
    try {
      // backend de delete é /maintenances/:id
      await api.delete(`/maintenances/${maintenanceId}`);
      setMaintenanceData((prev) =>
        prev.filter((item) => item.id !== maintenanceId)
      );
      message.success('Manutenção removida com sucesso!');
    } catch (error) {
      console.error(error);
      message.error('Erro ao remover manutenção');
    }
  };

  const handleEdit = (record) => {
    setEditingMaintenance(record);
    setIsModalVisible(true);
  };

  const columns = [
    { 
      title: 'Data', 
      dataIndex: 'date', 
      key: 'date',
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-'
    },
    { title: 'Serviço Realizado', dataIndex: 'service', key: 'service' },
    { title: 'KM', dataIndex: 'km', key: 'km', align: 'right' },
    { title: 'Valor (R$)', dataIndex: 'value', key: 'value', align: 'right' },
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
  ];

  return (
    <Card style={{ margin: '20px', padding: '20px' }} bordered>
      <Title level={3}>Manutenção do Caminhão #{id}</Title>

      {canCreate && (
        <Button
          type="primary"
          style={{ marginBottom: 16 }}
          onClick={() => setIsModalVisible(true)}
        >
          Adicionar Manutenção
        </Button>
      )}

      <Table
        dataSource={Array.isArray(maintenanceData) ? maintenanceData : []}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        footer={() => (
          <div style={{ textAlign: "right", fontWeight: "bold" }}>
            Total Gasto: R$ {maintenanceData.reduce((acc, curr) => acc + (curr.value || 0), 0).toFixed(2)}
          </div>
        )}
      />


      {(canCreate || canUpdate) && (
        <VehicleMaintenanceModal
          visible={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          onAddMaintenance={handleAddMaintenance}
          onEditMaintenance={handleEditMaintenance}
          editingMaintenance={editingMaintenance}
        />
      )}
    </Card>
  );
}

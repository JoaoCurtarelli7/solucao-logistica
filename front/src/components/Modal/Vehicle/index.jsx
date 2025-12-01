import { useEffect } from "react";
import { Modal, Form, Input, InputNumber, DatePicker, Row, Col } from "antd";
import dayjs from "dayjs";

export default function AddVehicleModal({ visible, onCancel, onSave, vehicle }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (vehicle) {
      form.setFieldsValue({
        ...vehicle,
        docExpiry: vehicle.docExpiry ? dayjs(vehicle.docExpiry) : null,
      });
    } else {
      form.resetFields();
    }
  }, [vehicle, form]);

  const handleOk = () => {
    form.validateFields()
      .then((values) => {
        const formattedValues = {
          ...values,
          docExpiry: values.docExpiry ? values.docExpiry.format('YYYY-MM-DD') : null,
        };
        onSave(formattedValues);
        form.resetFields();
      })
      .catch(() => {
        // validação falhou
      });
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={vehicle ? "Editar Caminhão" : "Adicionar Caminhão"}
      visible={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={vehicle ? "Atualizar" : "Adicionar"}
      cancelText="Cancelar"
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              name="name" 
              label="Nome do Caminhão" 
              rules={[{ required: true, message: 'Nome é obrigatório' }]}
            >
              <Input placeholder="Ex: Caminhão 01" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item 
              name="plate" 
              label="Placa" 
              rules={[{ required: true, message: 'Placa é obrigatória' }]}
            >
              <Input placeholder="Ex: ABC-1234" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              name="brand" 
              label="Marca" 
              rules={[{ required: true, message: 'Marca é obrigatória' }]}
            >
              <Input placeholder="Ex: Mercedes, Volvo, Scania" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item 
              name="year" 
              label="Ano" 
              rules={[{ required: true, message: 'Ano é obrigatório' }]}
            >
              <InputNumber 
                style={{ width: "100%" }} 
                min={1900} 
                max={2100} 
                placeholder="Ex: 2020"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              name="docExpiry" 
              label="Vencimento do Documento" 
              rules={[{ required: true, message: 'Data de vencimento é obrigatória' }]}
            >
              <DatePicker 
                style={{ width: "100%" }} 
                format="DD/MM/YYYY"
                placeholder="Selecione a data"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item 
              name="renavam" 
              label="Renavam" 
              rules={[{ required: true, message: 'Renavam é obrigatório' }]}
            >
              <Input placeholder="Ex: 12345678901" />
            </Form.Item>
          </Col>
        </Row>

      </Form>
    </Modal>
  );
}

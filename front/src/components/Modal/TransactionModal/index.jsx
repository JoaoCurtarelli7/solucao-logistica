import React from "react";
import { Modal, Form, Input, Button, Select, InputNumber } from "antd";

const { Option } = Select;

export default function AddTransactionModal({
  visible,
  onCancel,
  onAddTransaction,
}) {
  const [form] = Form.useForm();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onAddTransaction(values); // Chama a função para adicionar a transação
      form.resetFields();
    } catch (error) {
      console.error("Erro ao adicionar transação:", error);
    }
  };

  return (
    <Modal
      title="Adicionar Transação"
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancelar
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          Adicionar
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Tipo"
          name="type"
          rules={[{ required: true, message: "Por favor, selecione o tipo!" }]}
        >
          <Select placeholder="Selecione o tipo">
            <Option value="Crédito">Crédito</Option>
            <Option value="Débito">Débito</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Valor"
          name="amount"
          rules={[{ required: true, message: "Por favor, insira o valor!" }]}
        >
          <InputNumber
            style={{ width: "100%" }}
            min={0}
            precision={2}
            formatter={(value) => {
              const val = Number.parseFloat(value)
              return isNaN(val)
                ? 'R$ 0,00'
                : val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
            }}
            parser={(value) => {
              if (value == null || value === '') return 0
              const cleaned = String(value).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
              const num = parseFloat(cleaned)
              return isNaN(num) ? 0 : num
            }}
          />
        </Form.Item>

        <Form.Item
          label="Descrição"
          name="description"
          rules={[
            { required: true, message: "Por favor, insira a descrição!" },
          ]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}

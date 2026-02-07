import React, { useEffect } from 'react'
import { Modal, Form, Input, DatePicker, InputNumber, Select } from 'antd'
import dayjs from 'dayjs'

export default function TripModal({
  visible,
  onCancel,
  onSubmit,
  initialValues,
}) {
  const [form] = Form.useForm()

  // Preenche ou limpa os campos ao abrir o modal
  useEffect(() => {
    if (!visible) return
    if (initialValues) {
      form.setFieldsValue({
        origin: initialValues.origin || '',
        destination: initialValues.destination,
        driver: initialValues.driver,
        date: initialValues.date ? dayjs(initialValues.date) : null,
        estimatedArrival: initialValues.estimatedArrival ? dayjs(initialValues.estimatedArrival) : null,
        freightValue: initialValues.freightValue,
        status: initialValues.status || 'em_andamento',
        notes: initialValues.notes || ''
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'em_andamento' })
    }
  }, [initialValues, visible, form])

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        form.resetFields()
        onSubmit(values) // Envia os dados preenchidos ao editar
      })
      .catch((info) => {
        console.error('Erro ao validar formulário:', info)
      })
  }

  return (
    <Modal
      title={initialValues ? 'Editar Viagem' : 'Cadastrar Nova Viagem'}
      visible={visible}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Salvar"
      cancelText="Cancelar"
    >
      <Form form={form} layout="vertical" style={{ paddingTop: 8 }}>
        <Form.Item label="Origem" name="origin">
          <Input placeholder="Cidade/região de partida (ex: São Paulo)" />
        </Form.Item>

        <Form.Item
          label="Destino"
          name="destination"
          rules={[{ required: true, message: 'Por favor, insira o destino!' }]}
        >
          <Input placeholder="Cidade/região de destino" />
        </Form.Item>

        <Form.Item
          label="Motorista"
          name="driver"
          rules={[
            {
              required: true,
              message: 'Por favor, insira o nome do motorista!',
            },
          ]}
        >
          <Input placeholder="Nome do motorista" />
        </Form.Item>

        <Form.Item
          label="Data da Viagem"
          name="date"
          rules={[
            { required: true, message: 'Por favor, insira a data da viagem!' },
          ]}
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Previsão de chegada"
          name="estimatedArrival"
          tooltip="Data e hora previstas para chegada ao destino"
        >
          <DatePicker
            showTime
            format="DD/MM/YYYY HH:mm"
            style={{ width: '100%' }}
            placeholder="Selecione data e hora"
          />
        </Form.Item>

        <Form.Item
          label="Valor do frete"
          name="freightValue"
          rules={[
            { required: true, message: 'Por favor, insira o valor do frete!' },
          ]}
        >
          <InputNumber
            placeholder="Valor (R$)"
            min={0}
            style={{ width: '100%' }}
            formatter={(value) =>
              `R$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
            }
            parser={(value) => value.replace(/[R$\s.]/g, '')}
          />
        </Form.Item>

        <Form.Item label="Status" name="status" initialValue="em_andamento">
          <Select
            options={[
              { value: 'em_andamento', label: 'Em andamento' },
              { value: 'concluida', label: 'Concluída' },
              { value: 'cancelada', label: 'Cancelada' },
            ]}
          />
        </Form.Item>

        <Form.Item label="Observações" name="notes">
          <Input.TextArea rows={3} placeholder="Observações da viagem" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

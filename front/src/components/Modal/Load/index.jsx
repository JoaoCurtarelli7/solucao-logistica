import React, { useEffect } from 'react'
import { Modal, Form, Input, DatePicker, Select, InputNumber } from 'antd'
import dayjs from 'dayjs'

const { Option } = Select

const formatCurrency = (value) => {
  if (!value) return ''
  const cleanValue = value.toString().replace(/[^\d]/g, '').padStart(3, '0')
  return `R$ ${cleanValue.slice(0, -2) || '0'},${cleanValue.slice(-2)}`
}

const parseCurrency = (value) => {
  if (!value) return 0
  return parseFloat(value.toString().replace(/[^\d,]/g, '').replace(',', '.')) || 0
}

export default function CustomModalLoad({ 
  isVisible, 
  onClose, 
  onSubmit, 
  editingLoad, 
  companies, 
  selectedCompany 
}) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (editingLoad && isVisible) {
      form.setFieldsValue({
        data: dayjs(editingLoad.data, 'DD/MM/YYYY'),
        numeroCarregamento: editingLoad.numeroCarregamento,
        entregas: editingLoad.entregas,
        pesoCarga: editingLoad.pesoCarga,
        valorTotal: editingLoad.valorTotal,
        frete4: editingLoad.frete4,
        somaTotalFrete: editingLoad.somaTotalFrete,
        observacoes: editingLoad.observacoes,
        companyId: editingLoad.companyId
      })
    } else if (isVisible) {
      form.resetFields()
      if (selectedCompany) {
        form.setFieldsValue({ companyId: selectedCompany })
      }
    }
  }, [editingLoad, isVisible, form, selectedCompany])

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        const valorTotal = parseFloat(values.valorTotal) || 0
        const frete4 = valorTotal * 0.04
        const somaTotalFrete = frete4
        const formattedValues = {
          ...values,
          data: values.data.format('DD/MM/YYYY'),
          pesoCarga: parseFloat(values.pesoCarga) || 0,
          valorTotal,
          frete4,
          somaTotalFrete,
          entregas: parseInt(values.entregas) || 0,
          companyId: values.companyId || selectedCompany
        }
        onSubmit(formattedValues)
        form.resetFields()
      })
      .catch((info) => console.error('Validation failed:', info))
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  const calculateFrete4 = (valorTotal) => {
    if (!valorTotal) return 0
    const num = parseFloat(valorTotal) * 0.04
    return Math.round(num * 100) / 100
  }

  const handleValorTotalChange = (value) => {
    const frete4 = calculateFrete4(value)
    form.setFieldsValue({ 
      frete4: frete4,
      somaTotalFrete: frete4 
    })
  }

  const isEditing = !!editingLoad

  return (
    <Modal
      visible={isVisible}
      title={isEditing ? "Editar Carga" : "Adicionar Nova Carga"}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={isEditing ? "Atualizar" : "Salvar"}
      cancelText="Cancelar"
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="companyId"
          label="Empresa"
          rules={[{ required: true, message: 'Por favor, selecione a empresa' }]}
        >
          <Select
            placeholder="Selecione a empresa"
            disabled={!!selectedCompany}
            showSearch
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {companies && companies.length > 0 ? companies.map(company => (
              <Option key={company.id} value={company.id}>
                {company.name} - {company.cnpj}
              </Option>
            )) : (
              <Option value="" disabled>Nenhuma empresa disponível</Option>
            )}
          </Select>
        </Form.Item>

        <Form.Item
          name="data"
          label="Data"
          rules={[{ required: true, message: 'Por favor, insira a data' }]}
        >
          <DatePicker 
            format="DD/MM/YYYY" 
            style={{ width: '100%' }}
            placeholder="Selecione a data"
          />
        </Form.Item>

        <Form.Item
          name="numeroCarregamento"
          label="Número do Carregamento"
          rules={[
            {
              required: true,
              message: 'Por favor, insira o número do carregamento',
            },
          ]}
        >
          <Input placeholder="Ex: 578656" />
        </Form.Item>

        <Form.Item
          name="entregas"
          label="Quantidade de Entregas"
          rules={[
            {
              required: true,
              message: 'Por favor, insira a quantidade de entregas',
            },
          ]}
        >
          <InputNumber 
            min={1} 
            style={{ width: '100%' }} 
            placeholder="Ex: 1"
          />
        </Form.Item>

        <Form.Item
          name="pesoCarga"
          label="Peso da Carga (kg)"
          rules={[
            { required: true, message: 'Por favor, insira o peso da carga' },
            { type: 'number', min: 0.01, message: 'O peso deve ser maior que zero' }
          ]}
        >
          <InputNumber 
            min={0.01} 
            step={0.01} 
            style={{ width: '100%' }} 
            placeholder="Ex: 8077.07"
          />
        </Form.Item>

        <Form.Item
          name="valorTotal"
          label="Valor Total"
          rules={[
            { required: true, message: 'Por favor, insira o valor total' },
            { type: 'number', min: 0.01, message: 'O valor deve ser maior que zero' }
          ]}
        >
          <InputNumber
            min={0.01}
            step={0.01}
            style={{ width: '100%' }}
            placeholder="R$ 0,00"
            formatter={(value) => `R$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            parser={(value) => value.replace(/R\$\s?|(\.*)/g, '').replace(',', '.').replace(/\s/g, '')}
            onChange={handleValorTotalChange}
          />
        </Form.Item>

        <Form.Item
          name="frete4"
          label="Valor do Frete 4%"
          rules={[{ type: 'number', min: 0, message: 'O frete deve ser maior ou igual a zero' }]}
        >
          <InputNumber
            min={0}
            step={0.01}
            style={{ width: '100%' }}
            placeholder="R$ 0,00"
            formatter={(value) => `R$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            parser={(value) => value.replace(/R\$\s?|(\.*)/g, '').replace(',', '.').replace(/\s/g, '')}
          />
        </Form.Item>

        <Form.Item
          name="somaTotalFrete"
          label="Soma Total Frete"
          rules={[{ type: 'number', min: 0, message: 'O frete total deve ser maior ou igual a zero' }]}
        >
          <InputNumber
            min={0}
            step={0.01}
            style={{ width: '100%' }}
            placeholder="R$ 0,00"
            formatter={(value) => `R$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            parser={(value) => value.replace(/R\$\s?|(\.*)/g, '').replace(',', '.').replace(/\s/g, '')}
          />
        </Form.Item>

        <Form.Item name="observacoes" label="Observações">
          <Input.TextArea rows={3} placeholder="Observações adicionais..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}

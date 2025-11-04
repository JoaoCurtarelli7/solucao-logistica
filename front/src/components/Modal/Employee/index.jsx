import React, { useState } from 'react'
import { Modal, Form, Input, Button, Select, InputNumber, DatePicker, message, Row, Col } from 'antd'
import { UserOutlined, IdcardOutlined, PhoneOutlined, MailOutlined, HomeOutlined } from '@ant-design/icons'
import api from '../../../lib/api'
import dayjs from 'dayjs'

const { Option } = Select

export default function AddEmployeeModal({
  addEmployee,
  editingEmployee,
  setEditingEmployee,
}) {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  // Abre o modal e preenche os campos se estiver editando
  const showModal = () => {
    setIsModalVisible(true)
    if (editingEmployee) {
      form.setFieldsValue({
        nome: editingEmployee.name,
        cargo: editingEmployee.role,
        salarioBase: editingEmployee.baseSalary,
        status: editingEmployee.status,
        cpf: editingEmployee.cpf || '',
        telefone: editingEmployee.phone || '',
        email: editingEmployee.email || '',
        endereco: editingEmployee.address || '',
        dataContratacao: editingEmployee.hireDate ? dayjs(editingEmployee.hireDate) : null,
      })
    } else {
      form.resetFields()
    }
  }

  // Efeito para abrir modal quando editingEmployee muda
  React.useEffect(() => {
    if (editingEmployee) {
      showModal()
    }
  }, [editingEmployee])

  // Fecha o modal e limpa o estado de edição
  const handleCancel = () => {
    setIsModalVisible(false)
    setEditingEmployee(null)
    form.resetFields()
  }

  const handleOk = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()

      const employeeData = {
        name: values.nome,
        role: values.cargo,
        baseSalary: values.salarioBase,
        status: values.status,
        cpf: values.cpf || '',
        phone: values.telefone || '',
        email: values.email || '',
        address: values.endereco || '',
        hireDate: values.dataContratacao ? values.dataContratacao.format('YYYY-MM-DD') : null,
      }

      if (editingEmployee) {
        const response = await api.put(`/employees/${editingEmployee.id}`, employeeData)
        addEmployee(response.data)
        message.success('Funcionário atualizado com sucesso!')
      } else {
        const response = await api.post('/employees', employeeData)
        addEmployee(response.data)
        message.success('Funcionário adicionado com sucesso!')
      }

      setIsModalVisible(false)
      setEditingEmployee(null)
      form.resetFields()
    } catch (error) {
      console.error('Erro ao salvar funcionário:', error)
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.message).join(', ')
        message.error(`Erro de validação: ${errorMessages}`)
      } else if (error.response?.data?.message) {
        message.error(error.response.data.message)
      } else {
        message.error('Erro ao salvar funcionário. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCPF = (value) => {
    if (!value) return value
    const v = value.replace(/\D/g, '')
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return value
  }

  const formatPhone = (value) => {
    if (!value) return value
    const v = value.replace(/\D/g, '')
    if (v.length <= 11) {
      return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
    return value
  }

  return (
    <div>
      <Button 
        type="primary" 
        onClick={showModal} 
        icon={<UserOutlined />}
      >
        {editingEmployee ? 'Editar Funcionário' : 'Adicionar Funcionário'}
      </Button>
      <Modal
        title={editingEmployee ? 'Editar Funcionário' : 'Adicionar Funcionário'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        footer={null}
        width={700}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" name="add_employee_form">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Nome Completo"
                name="nome"
                rules={[
                  {
                    required: true,
                    message: 'Por favor, insira o nome do funcionário!',
                  },
                  {
                    min: 2,
                    message: 'Nome deve ter pelo menos 2 caracteres!',
                  },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="Nome completo" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Cargo"
                name="cargo"
                rules={[
                  {
                    required: true,
                    message: 'Por favor, insira o cargo do funcionário!',
                  },
                ]}
              >
                <Input placeholder="Cargo/função" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="CPF"
                name="cpf"
                rules={[
                  {
                    pattern: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
                    message: 'CPF deve estar no formato: 000.000.000-00',
                  },
                ]}
              >
                <Input
                  prefix={<IdcardOutlined />}
                  placeholder="000.000.000-00"
                  onChange={(e) => {
                    const formatted = formatCPF(e.target.value)
                    form.setFieldsValue({ cpf: formatted })
                  }}
                  maxLength={14}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Telefone"
                name="telefone"
                rules={[
                  {
                    pattern: /^\(\d{2}\) \d{5}-\d{4}$/,
                    message: 'Telefone deve estar no formato: (00) 00000-0000',
                  },
                ]}
              >
                <Input
                  prefix={<PhoneOutlined />}
                  placeholder="(00) 00000-0000"
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value)
                    form.setFieldsValue({ telefone: formatted })
                  }}
                  maxLength={15}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[{ required: true, message: 'Por favor, insira um email válido!' }]}
              >
                <Input prefix={<MailOutlined />} placeholder="email@exemplo.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Data de Contratação"
                name="dataContratacao"
                rules={[
                  { required: true, message: 'Por favor, selecione a data de contratação!' },
                ]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Selecione a data"
                  format="DD/MM/YYYY"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Endereço"
            name="endereco"
          >
            <Input prefix={<HomeOutlined />} placeholder="Endereço completo" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Salário Base"
                name="salarioBase"
                rules={[
                  { required: true, message: 'Por favor, insira o salário base!' },
                  { type: 'number', min: 0, message: 'Salário deve ser maior que zero!' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  formatter={(value) => {
                    const val = Number.parseFloat(value)
                    return isNaN(val) ? 'R$ 0,00' : val?.toLocaleString('pt-BR', {
                      style: 'currency',
                      minimumFractionDigits: 2,
                      currency: 'BRL'
                    })
                  }}
                  parser={(value) => {
                    const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.')
                    return cleaned === '' ? 0 : cleaned
                  }}
                  placeholder="0,00"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[
                  { required: true, message: 'Por favor, selecione o status!' },
                ]}
              >
                <Select placeholder="Selecione o status">
                  <Option value="Ativo">Ativo</Option>
                  <Option value="Inativo">Inativo</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: '20px', textAlign: 'right' }}>
            <Button onClick={handleCancel} style={{ marginRight: 8 }}>
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              onClick={handleOk}
              loading={loading}
            >
              {editingEmployee ? 'Salvar Alterações' : 'Adicionar Funcionário'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

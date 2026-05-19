import React, { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  DatePicker,
  AutoComplete,
  Divider,
  Space,
  message,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { api } from '../../../lib'
import { usePermission } from '../../../hooks/usePermission'

export default function VehicleMaintenanceModal({
  visible,
  onCancel,
  onAddMaintenance,
  onEditMaintenance,
  editingMaintenance,
}) {
  const [form] = Form.useForm()
  const [presets, setPresets] = useState([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')

  const { hasPermission } = usePermission()
  const canCreatePreset = hasPermission('maintenance.create')

  const loadPresets = async () => {
    try {
      setLoadingPresets(true)
      const { data } = await api.get('/maintenance-service-presets')
      setPresets(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      const apiMsg = e.response?.data?.message
      const net =
        e.code === 'ERR_NETWORK' || e.message === 'Network Error'
          ? ' Não foi possível conectar ao servidor (verifique se o backend está rodando e a URL em VITE_API_URL).'
          : ''
      message.error(
        apiMsg ||
          (net ? `Erro de rede.${net}` : null) ||
          e.message ||
          'Não foi possível carregar o catálogo de serviços',
      )
    } finally {
      setLoadingPresets(false)
    }
  }

  useEffect(() => {
    if (visible) {
      loadPresets()
    }
  }, [visible])

  useEffect(() => {
    if (editingMaintenance) {
      form.setFieldsValue({
        data: editingMaintenance.date ? dayjs(editingMaintenance.date) : null,
        servico: editingMaintenance.service,
        km: editingMaintenance.km,
        valor: editingMaintenance.value,
        observacao: editingMaintenance.notes || '',
      })
    } else if (visible) {
      form.resetFields()
    }
  }, [editingMaintenance, form, visible])

  const autoCompleteOptions = useMemo(() => {
    const base = presets.map((p) => ({ value: p.name, label: p.name }))
    const names = new Set(base.map((o) => o.value))
    if (editingMaintenance?.service && !names.has(editingMaintenance.service)) {
      return [
        { value: editingMaintenance.service, label: editingMaintenance.service },
        ...base,
      ]
    }
    return base
  }, [presets, editingMaintenance])

  const handleAddPreset = async () => {
    const n = newPresetName.trim()
    if (n.length < 2) {
      message.warning('Digite pelo menos 2 caracteres para o novo serviço')
      return
    }
    if (!canCreatePreset) {
      message.warning('Você não tem permissão para adicionar serviços ao catálogo')
      return
    }
    try {
      await api.post('/maintenance-service-presets', { name: n })
      message.success('Serviço salvo no catálogo')
      setNewPresetName('')
      await loadPresets()
      form.setFieldsValue({ servico: n })
    } catch (error) {
      console.error(error)
      message.error(error.response?.data?.message || 'Erro ao salvar serviço no catálogo')
    }
  }

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        const formattedValues = {
          ...values,
          data: values.data ? values.data.format('DD/MM/YYYY') : null,
        }
        if (editingMaintenance) {
          onEditMaintenance(formattedValues)
        } else {
          onAddMaintenance(formattedValues)
        }
        form.resetFields()
        setNewPresetName('')
      })
      .catch(() => {})
  }

  const handleModalCancel = () => {
    form.resetFields()
    setNewPresetName('')
    onCancel()
  }

  return (
    <Modal
      title={editingMaintenance ? 'Editar Manutenção' : 'Adicionar Manutenção'}
      open={visible}
      onOk={handleOk}
      onCancel={handleModalCancel}
      okText={editingMaintenance ? 'Salvar' : 'Adicionar'}
      cancelText="Cancelar"
      footer={[
        <Button key="back" onClick={handleModalCancel}>
          Cancelar
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          {editingMaintenance ? 'Salvar' : 'Adicionar'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" name="maintenanceForm" style={{ paddingTop: 8 }}>
        <Form.Item
          name="data"
          label="Data"
          rules={[
            {
              required: true,
              message: 'Por favor, insira a data da manutenção',
            },
          ]}
        >
          <DatePicker
            style={{ width: '100%' }}
            format="DD/MM/YYYY"
            placeholder="Selecione a data"
          />
        </Form.Item>
        <Form.Item
          name="servico"
          label="Serviço realizado"
          rules={[
            {
              required: true,
              message: 'Selecione, busque ou digite o serviço realizado',
            },
          ]}
        >
          <AutoComplete
            style={{ width: '100%' }}
            allowClear
            options={autoCompleteOptions}
            placeholder={
              loadingPresets
                ? 'Carregando catálogo...'
                : 'Escolha da lista, busque ou digite outro serviço'
            }
            filterOption={(inputValue, option) =>
              (option?.label ?? option?.value ?? '')
                .toString()
                .toLowerCase()
                .includes(inputValue.toLowerCase())
            }
            notFoundContent={loadingPresets ? 'Carregando...' : null}
            dropdownRender={(menu) => (
              <>
                {menu}
                {canCreatePreset && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div
                      style={{ padding: '0 8px 8px' }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        Salvar novo serviço no catálogo (aparece na lista depois)
                      </Typography.Text>
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          placeholder="Ex: Troca do cardan"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                        <Button type="primary" onClick={handleAddPreset}>
                          Salvar no catálogo
                        </Button>
                      </Space.Compact>
                    </div>
                  </>
                )}
              </>
            )}
          />
        </Form.Item>
        <Form.Item
          name="km"
          label="KM"
          rules={[{ required: true, message: 'Por favor, insira o KM' }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="Ex: 120000" />
        </Form.Item>
        <Form.Item
          name="valor"
          label="Valor (R$)"
          rules={[{ required: true, message: 'Por favor, insira o valor' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            step={0.01}
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
        <Form.Item name="observacao" label="Observação">
          <Input.TextArea rows={3} placeholder="Observações adicionais" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

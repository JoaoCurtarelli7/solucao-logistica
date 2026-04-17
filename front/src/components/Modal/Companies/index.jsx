import React, { useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Button,
  InputNumber,
  message,
  DatePicker,
  Select,
} from "antd";
import dayjs from "dayjs";
import api from "../../../lib/api";

const { Option } = Select;

export default function AddCompanyModal({
  isModalVisible,
  setIsModalVisible,
  onCompanySaved,
  editingCompany,
  setEditingCompany,
}) {
  const [form] = Form.useForm();

  // debug removido

  useEffect(() => {
    // debug removido

    if (editingCompany) {
      const formattedCompany = {
        ...editingCompany,
        dateRegistration: dayjs(editingCompany.dateRegistration),
      };
      form.setFieldsValue(formattedCompany);
    } else {
      form.resetFields();
      // Definir valores padrão para nova empresa
      form.setFieldsValue({
        status: "Ativo",
        commission: 0,
        dateRegistration: dayjs(),
      });
    }
  }, [editingCompany, form]);

  const handleSubmit = async (values) => {
    try {
      // Validação adicional
      if (
        !values.name ||
        !values.type ||
        !values.cnpj ||
        !values.responsible ||
        !values.dateRegistration
      ) {
        message.error("Por favor, preencha todos os campos obrigatórios!");
        return;
      }

      const formattedValues = {
        ...values,
        dateRegistration: values.dateRegistration.format("YYYY-MM-DD"),
      };

      if (editingCompany) {
        // Atualizar empresa existente
        await api.put(`/company/${editingCompany.id}`, formattedValues);
        message.success("Empresa atualizada com sucesso!");
      } else {
        // Criar nova empresa
        const response = await api.post("/company", formattedValues);
        message.success("Empresa cadastrada com sucesso!");
      }

      onCompanySaved();
    } catch (error) {
      console.error("❌ Erro ao salvar empresa:", error);
      console.error("❌ Detalhes do erro:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      message.error(
        error.response?.data?.message ||
          "Erro ao salvar empresa. Tente novamente.",
      );
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setIsModalVisible(false);
    setEditingCompany(null);
  };

  return (
    <Modal
      title={editingCompany ? "Editar Empresa" : "Cadastrar Nova Empresa"}
      open={isModalVisible}
      onCancel={handleCancel}
      footer={null}
      width={600}
      destroyOnClose={true}
    >
      {/* debug removido */}
      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item
          label="Nome da Empresa"
          name="name"
          rules={[
            { required: true, message: "Por favor, insira o nome da empresa!" },
            { min: 2, message: "O nome deve ter pelo menos 2 caracteres!" },
          ]}
        >
          <Input placeholder="Ex: Transportadora ABC Ltda" />
        </Form.Item>

        <Form.Item
          label="Tipo de Empresa"
          name="type"
          rules={[
            { required: true, message: "Por favor, insira o tipo da empresa!" },
          ]}
        >
          <Select placeholder="Selecione o tipo">
            <Option value="Transportadora">Transportadora</Option>
            <Option value="Cliente">Cliente</Option>
            <Option value="Fornecedor">Fornecedor</Option>
            <Option value="Parceiro">Parceiro</Option>
            <Option value="Outro">Outro</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="CNPJ"
          name="cnpj"
          rules={[
            { required: true, message: "Por favor, insira o CNPJ!" },
            {
              pattern: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
              message: "CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX!",
            },
          ]}
        >
          <Input placeholder="XX.XXX.XXX/XXXX-XX" />
        </Form.Item>

        <Form.Item
          label="Responsável"
          name="responsible"
          rules={[
            { required: true, message: "Por favor, insira o responsável!" },
          ]}
        >
          <Input placeholder="Nome do responsável pela empresa" />
        </Form.Item>

        <Form.Item
          label="Comissão (%)"
          name="commission"
          rules={[
            {
              required: true,
              message: "Por favor, insira a porcentagem de comissão!",
            },
            {
              type: "number",
              min: 0,
              max: 100,
              message: "Comissão deve ser entre 0% e 100%!",
            },
          ]}
        >
          <InputNumber
            min={0}
            max={100}
            style={{ width: "100%" }}
            placeholder="0"
            formatter={(value) => `${value}%`}
            parser={(value) => value.replace("%", "")}
          />
        </Form.Item>

        <Form.Item
          label="Data de Cadastro"
          name="dateRegistration"
          rules={[
            {
              required: true,
              message: "Por favor, insira a data de cadastro!",
            },
          ]}
        >
          <DatePicker
            format="DD/MM/YYYY"
            style={{ width: "100%" }}
            placeholder="Selecione a data"
          />
        </Form.Item>

        <Form.Item
          label="Status"
          name="status"
          rules={[
            {
              required: true,
              message: "Por favor, selecione o status da empresa!",
            },
          ]}
        >
          <Select placeholder="Selecione o status">
            <Option value="Ativo">Ativo</Option>
            <Option value="Inativo">Inativo</Option>
          </Select>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
          <Button
            type="default"
            onClick={handleCancel}
            style={{ marginRight: 8 }}
          >
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit">
            {editingCompany ? "Salvar Alterações" : "Cadastrar Empresa"}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}

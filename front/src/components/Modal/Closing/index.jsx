import React, { useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  message,
} from "antd";
import dayjs from "dayjs";

const { Option } = Select;

export default function CustomModal({
  isVisible,
  onClose,
  onSubmit,
  title,
  type,
  editingEntry,
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (isVisible) {
      if (editingEntry) {
        // Preencher formulário com dados da entrada sendo editada
        form.setFieldsValue({
          description: editingEntry.description,
          category: editingEntry.category,
          amount: editingEntry.amount,
          date: dayjs(editingEntry.date),
          observations: editingEntry.observations,
        });
      } else {
        // Limpar formulário para nova entrada
        form.resetFields();
        form.setFieldsValue({
          date: dayjs(),
          category: getDefaultCategory(type),
        });
      }
    }
  }, [isVisible, editingEntry, type, form]);

  const getDefaultCategory = (type) => {
    switch (type) {
      case "entrada":
        return "Fretes";
      case "saida":
        return "Operacional";
      case "imposto":
        return "Tributos";
      default:
        return "";
    }
  };

  const getCategories = (type) => {
    switch (type) {
      case "entrada":
        return ["Fretes", "Serviços", "Comissões", "Outros"];
      case "saida":
        return [
          "Folha de Pagamento",
          "Operacional",
          "Administrativo",
          "Marketing",
          "Outros",
        ];
      case "imposto":
        return ["Tributos", "FGTS", "INSS", "IRRF", "ISS", "ICMS", "Outros"];
      default:
        return [];
    }
  };

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        const formattedValues = {
          description: values.description,
          amount: parseFloat(values.amount),
          category: values.category,
          date: values.date.format("DD/MM/YYYY"),
          type: type,
          observations: values.observations || null,
        };

        // Validar se o valor é válido
        if (isNaN(formattedValues.amount) || formattedValues.amount <= 0) {
          message.error("Valor deve ser maior que zero");
          return;
        }

        // Validar se a data é válida
        if (!values.date || !values.date.isValid()) {
          message.error("Data inválida");
          return;
        }

        onSubmit(formattedValues);
        form.resetFields();
        onClose();
      })
      .catch((info) => {
        console.error("Erro na validação do formulário:", info);
        if (info.errorFields && info.errorFields.length > 0) {
          const firstError = info.errorFields[0].errors[0];
          message.error(firstError);
        } else if (info.message) {
          message.error(info.message);
        } else {
          message.error("Erro na validação do formulário");
        }
      });
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const getFieldLabel = (type, field) => {
    if (field === "description") {
      return type === "entrada"
        ? "Descrição da Entrada"
        : type === "saida"
          ? "Descrição da Despesa"
          : "Nome do Imposto";
    }
    if (field === "amount") {
      return "Valor (R$)";
    }
    if (field === "category") {
      return "Categoria";
    }
    if (field === "date") {
      return "Data";
    }
    return field;
  };

  return (
    <Modal
      open={isVisible}
      title={title}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={editingEntry ? "Atualizar" : "Salvar"}
      cancelText="Cancelar"
      width={500}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="description"
          label={getFieldLabel(type, "description")}
          rules={[
            { required: true, message: "Por favor, insira a descrição." },
            {
              min: 3,
              message: "A descrição deve ter pelo menos 3 caracteres.",
            },
          ]}
        >
          <Input
            placeholder={
              type === "entrada"
                ? "Ex: Fretes - 1ª Quinzena"
                : type === "saida"
                  ? "Ex: Combustível"
                  : "Ex: FGTS"
            }
          />
        </Form.Item>

        <Form.Item
          name="category"
          label={getFieldLabel(type, "category")}
          rules={[
            { required: true, message: "Por favor, selecione a categoria." },
          ]}
        >
          <Select placeholder="Selecione a categoria">
            {getCategories(type).map((cat) => (
              <Option key={cat} value={cat}>
                {cat}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="amount"
          label={getFieldLabel(type, "amount")}
          rules={[
            { required: true, message: "Por favor, insira o valor." },
            {
              type: "number",
              min: 0.01,
              message: "O valor deve ser maior que zero.",
            },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            placeholder="0,00"
            min={0.01}
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
            onChange={(value) => {
              // Garantir que o valor seja um número válido
              if (value && !isNaN(value)) {
                form.setFieldsValue({ amount: value });
              }
            }}
          />
        </Form.Item>

        <Form.Item
          name="date"
          label={getFieldLabel(type, "date")}
          rules={[{ required: true, message: "Por favor, selecione a data." }]}
        >
          <DatePicker
            style={{ width: "100%" }}
            format="DD/MM/YYYY"
            placeholder="Selecione a data"
          />
        </Form.Item>

        <Form.Item name="observations" label="Observações">
          <Input.TextArea
            rows={3}
            placeholder={`Observações adicionais sobre a ${type === "entrada" ? "entrada" : type === "saida" ? "despesa" : "imposto"}...`}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

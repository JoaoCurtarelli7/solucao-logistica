import React, { useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  InputNumber,
  Button,
  Space,
  Divider,
  Typography,
} from "antd";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;

// Formata número para exibição: R$ 1.234,56 (ponto milhar, vírgula decimal)
const formatCurrencyDisplay = (value) => {
  if (value == null || value === "") return "";
  const num = Number(value);
  if (isNaN(num)) return "";
  const [intPart, decPart] = num.toFixed(2).split(".");
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${withDots},${decPart}`;
};

// Digitar só números = valor em reais com 2 decimais (ex: 123456 → 1234,56)
const parseCurrencyFromInput = (inputStr) => {
  const digits = String(inputStr || "").replace(/\D/g, "");
  if (!digits) return undefined;
  const cents = parseInt(digits, 10);
  return cents / 100;
};

// Input controlado: mostra formatado e interpreta digitação como centavos
function CurrencyInput({
  value,
  onChange,
  onValueChange,
  placeholder,
  readOnly,
  ...rest
}) {
  const display = formatCurrencyDisplay(value);
  const handleChange = (e) => {
    const num = parseCurrencyFromInput(e.target.value);
    const newVal = num !== undefined ? num : undefined;
    onChange?.(newVal);
    onValueChange?.(newVal);
  };
  return (
    <Input
      {...rest}
      value={display}
      onChange={handleChange}
      placeholder={placeholder || "R$ 0,00"}
      readOnly={readOnly}
    />
  );
}

export default function CustomModalLoad({
  isVisible,
  onClose,
  onSubmit,
  editingLoad,
  companies,
  selectedCompany,
}) {
  const [form] = Form.useForm();

  const getCompanyCommissionRate = (companyId) => {
    const id = Number(companyId);
    if (!id || !Array.isArray(companies)) return 0;
    const company = companies.find((c) => Number(c.id) === id);
    return Number(company?.commission || 0);
  };

  const calcCommissionValue = (valorTotal, rate) => {
    const base = Number(valorTotal || 0);
    const pct = Number(rate || 0);
    const value = base * (pct / 100);
    return Math.round(value * 100) / 100;
  };

  const recalcTotals = (valorTotal, companyId, custosAdicionais) => {
    const rate = getCompanyCommissionRate(companyId);
    const frete4 = calcCommissionValue(valorTotal, rate);
    const add = Math.max(0, Number(custosAdicionais) || 0);
    const somaTotalFrete = Math.round((frete4 + add) * 100) / 100;
    form.setFieldsValue({ frete4, somaTotalFrete });
  };

  useEffect(() => {
    if (editingLoad && isVisible) {
      const raw = editingLoad.rawData || {};
      const add = Number(
        raw.additionalCosts ?? editingLoad.additionalCosts ?? 0,
      );
      form.setFieldsValue({
        data: dayjs(editingLoad.data, "DD/MM/YYYY"),
        numeroCarregamento: editingLoad.numeroCarregamento,
        entregas: editingLoad.entregas,
        pesoCarga: editingLoad.pesoCarga,
        valorTotal: editingLoad.valorTotal,
        custosAdicionais: add,
        detalheCustosAdicionais:
          raw.additionalCostsNote || editingLoad.additionalCostsNote || "",
        frete4: editingLoad.frete4,
        somaTotalFrete: editingLoad.somaTotalFrete,
        observacoes: editingLoad.observacoes,
        companyId: editingLoad.companyId,
      });
    } else if (isVisible) {
      form.resetFields();
      if (selectedCompany) {
        form.setFieldsValue({
          companyId: selectedCompany,
          custosAdicionais: 0,
          data: dayjs(),
        });
      } else {
        form.setFieldsValue({ custosAdicionais: 0 });
      }
    }
  }, [editingLoad, isVisible, form, selectedCompany]);

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        onSubmit(buildFormattedValues(values));
        form.resetFields();
        // Ao adicionar (não editar), mantém empresa e data para cadastrar outra carga em seguida
        if (!editingLoad && selectedCompany) {
          form.setFieldsValue({
            companyId: selectedCompany,
            data: dayjs(),
            custosAdicionais: 0,
          });
        }
      })
      .catch((info) => console.error("Validation failed:", info));
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const buildFormattedValues = (values) => {
    const valorTotal = parseFloat(values.valorTotal) || 0;
    const companyId = values.companyId || selectedCompany;
    const rate = getCompanyCommissionRate(companyId);
    const frete4 = calcCommissionValue(valorTotal, rate);
    const additionalCosts = Math.max(
      0,
      parseFloat(values.custosAdicionais) || 0,
    );
    const somaTotalFrete = Math.round((frete4 + additionalCosts) * 100) / 100;
    return {
      ...values,
      data: values.data.format("DD/MM/YYYY"),
      pesoCarga: parseFloat(values.pesoCarga) || 0,
      valorTotal,
      frete4,
      somaTotalFrete,
      additionalCosts,
      additionalCostsNote: values.detalheCustosAdicionais?.trim() || undefined,
      commissionRate: rate,
      entregas: parseInt(values.entregas) || 0,
      companyId,
    };
  };

  const handleSaveAndClose = () => {
    form
      .validateFields()
      .then((values) => {
        onSubmit(buildFormattedValues(values));
        form.resetFields();
        onClose();
      })
      .catch((info) => console.error("Validation failed:", info));
  };

  const handleValorTotalChange = (value) => {
    const currentCompanyId = form.getFieldValue("companyId") || selectedCompany;
    const custos = form.getFieldValue("custosAdicionais") || 0;
    recalcTotals(value, currentCompanyId, custos);
  };

  const handleCustosAdicionaisChange = () => {
    const valorTotal = form.getFieldValue("valorTotal");
    const currentCompanyId = form.getFieldValue("companyId") || selectedCompany;
    const custos = form.getFieldValue("custosAdicionais") || 0;
    recalcTotals(valorTotal, currentCompanyId, custos);
  };

  const handleCompanyChange = (companyId) => {
    const valorTotal = form.getFieldValue("valorTotal");
    const custos = form.getFieldValue("custosAdicionais") || 0;
    if (valorTotal !== undefined) {
      recalcTotals(valorTotal, companyId, custos);
    }
  };

  const selectedCompanyId = form.getFieldValue("companyId") || selectedCompany;
  const currentRate = getCompanyCommissionRate(selectedCompanyId);

  const isEditing = !!editingLoad;

  const footer = isEditing ? undefined : (
    <Space>
      <Button onClick={handleCancel}>Cancelar</Button>
      <Button onClick={handleSaveAndClose}>Salvar e fechar</Button>
      <Button type="primary" onClick={handleOk}>
        Salvar e adicionar outro
      </Button>
    </Space>
  );

  return (
    <Modal
      visible={isVisible}
      title={isEditing ? "Editar Carga" : "Adicionar Nova Carga"}
      onOk={isEditing ? handleOk : undefined}
      onCancel={handleCancel}
      okText={isEditing ? "Atualizar" : undefined}
      cancelText="Cancelar"
      footer={footer}
      width={720}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="companyId"
          label="Empresa"
          rules={[
            { required: true, message: "Por favor, selecione a empresa" },
          ]}
        >
          <Select
            placeholder="Selecione a empresa"
            disabled={!!selectedCompany}
            onChange={handleCompanyChange}
            showSearch
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {companies && companies.length > 0 ? (
              companies.map((company) => (
                <Option key={company.id} value={company.id}>
                  {company.name} - {company.cnpj}
                </Option>
              ))
            ) : (
              <Option value="" disabled>
                Nenhuma empresa disponível
              </Option>
            )}
          </Select>
        </Form.Item>

        <Form.Item
          name="data"
          label="Data"
          rules={[{ required: true, message: "Por favor, insira a data" }]}
        >
          <DatePicker
            format="DD/MM/YYYY"
            style={{ width: "100%" }}
            placeholder="Selecione a data"
          />
        </Form.Item>

        <Form.Item
          name="numeroCarregamento"
          label="Número do Carregamento"
          rules={[
            {
              required: true,
              message: "Por favor, insira o número do carregamento",
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
              message: "Por favor, insira a quantidade de entregas",
            },
          ]}
        >
          <InputNumber min={1} style={{ width: "100%" }} placeholder="Ex: 1" />
        </Form.Item>

        <Form.Item
          name="pesoCarga"
          label="Peso da Carga (kg)"
          rules={[
            { required: true, message: "Por favor, insira o peso da carga" },
            {
              type: "number",
              min: 0.01,
              message: "O peso deve ser maior que zero",
            },
          ]}
        >
          <InputNumber
            min={0.01}
            step={0.01}
            style={{ width: "100%" }}
            placeholder="Ex: 8077 ou 8077,07"
            formatter={(value) => {
              if (value == null || value === "") return "";
              const num = Number(value);
              if (isNaN(num)) return value;
              return Number.isInteger(num) ? String(num) : String(num);
            }}
            parser={(value) => {
              if (value == null || value === "") return undefined;
              const str = String(value).replace(",", ".");
              const num = parseFloat(str);
              return isNaN(num) ? undefined : num;
            }}
          />
        </Form.Item>

        <Form.Item
          name="valorTotal"
          label="Valor Total da Carga"
          rules={[
            { required: true, message: "Por favor, insira o valor total" },
            {
              type: "number",
              min: 0.01,
              message: "O valor deve ser maior que zero",
            },
          ]}
        >
          <CurrencyInput
            style={{ width: "100%" }}
            onValueChange={handleValorTotalChange}
          />
        </Form.Item>

        <Form.Item
          name="frete4"
          label={`Comissão (${currentRate.toFixed(2)}% sobre o valor total)`}
          rules={[
            {
              type: "number",
              min: 0,
              message: "O valor deve ser maior ou igual a zero",
            },
          ]}
        >
          <CurrencyInput style={{ width: "100%" }} readOnly />
        </Form.Item>

        <Divider orientation="left" plain>
          <Text type="secondary">
            Custos adicionais (cobrados junto com a comissão)
          </Text>
        </Divider>
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          Inclua aqui despesas repassadas ao cliente: descarga, pedágio,
          estadia, taxas diversas etc. Esse valor entra no total a cobrar e no
          fechamento de cargas.
        </Text>

        <Form.Item
          name="custosAdicionais"
          label="Total de custos adicionais"
          initialValue={0}
          rules={[{ type: "number", min: 0, message: "Não pode ser negativo" }]}
        >
          <CurrencyInput
            style={{ width: "100%" }}
            onValueChange={handleCustosAdicionaisChange}
            placeholder="R$ 0,00"
          />
        </Form.Item>

        <Form.Item
          name="detalheCustosAdicionais"
          label="Detalhar custos (opcional)"
        >
          <Input.TextArea
            rows={2}
            placeholder="Ex.: descarga R$ X + pedágio R$ Y..."
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="somaTotalFrete"
          label="Total a cobrar (comissão + custos adicionais)"
          rules={[
            {
              type: "number",
              min: 0,
              message: "O total deve ser maior ou igual a zero",
            },
          ]}
        >
          <CurrencyInput style={{ width: "100%" }} readOnly />
        </Form.Item>

        <Form.Item name="observacoes" label="Observações gerais da carga">
          <Input.TextArea
            rows={3}
            placeholder="Observações adicionais sobre a carga..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

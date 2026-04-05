import React, { useEffect, useRef, useState } from "react";
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
  Upload,
  Alert,
  message,
  Tag,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import api from "../../../lib/api";
import { usePermission } from "@/hooks/usePermission";

dayjs.extend(customParseFormat);

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
  const [aiLoading, setAiLoading] = useState(false);
  /** Nomes dos campos do Form que ainda mostram tag "sugerido pela IA" */
  const [aiFieldTags, setAiFieldTags] = useState(() => new Set());
  /** Lista vinda da IA do que o usuário ainda precisa preencher */
  const [aiMissingList, setAiMissingList] = useState([]);
  const skipClearAiTagsRef = useRef(false);
  const { hasPermission } = usePermission();
  const canSuggestFromPdf = hasPermission("loads.create");

  const labelWithAi = (text, fieldName) =>
    aiFieldTags.has(fieldName) ? (
      <span>
        {text}{" "}
        <Tag color="processing" style={{ marginLeft: 6, fontSize: 11 }}>
          sugerido pela IA — pode editar
        </Tag>
      </span>
    ) : (
      text
    );

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

  const parseDateBr = (s) => {
    if (!s || typeof s !== "string") return dayjs();
    const d = dayjs(s.trim(), "DD/MM/YYYY", true);
    return d.isValid() ? d : dayjs();
  };

  /**
   * Preenche apenas o que a IA encontrou; o restante o usuário digita manualmente.
   * Não sobrescreve campos com vazio quando a IA não achou o dado.
   */
  const applySuggestionToForm = (s) => {
    const highlights = new Set();
    const patch = {};

    if (
      s.matchedCompanyId != null &&
      !Number.isNaN(Number(s.matchedCompanyId))
    ) {
      patch.companyId = Number(s.matchedCompanyId);
      highlights.add("companyId");
    } else if (selectedCompany && !form.getFieldValue("companyId")) {
      patch.companyId = selectedCompany;
    }

    if (s.date != null && String(s.date).trim() !== "") {
      patch.data = parseDateBr(String(s.date).trim());
      highlights.add("data");
    }

    if (s.loadingNumber != null && String(s.loadingNumber).trim() !== "") {
      patch.numeroCarregamento = String(s.loadingNumber).trim();
      highlights.add("numeroCarregamento");
    }

    if (
      s.deliveries != null &&
      !Number.isNaN(Number(s.deliveries)) &&
      Number(s.deliveries) >= 1
    ) {
      patch.entregas = Math.max(1, Math.floor(Number(s.deliveries)));
      highlights.add("entregas");
    }

    if (
      s.cargoWeight != null &&
      !Number.isNaN(Number(s.cargoWeight)) &&
      Number(s.cargoWeight) > 0
    ) {
      patch.pesoCarga = Number(s.cargoWeight);
      highlights.add("pesoCarga");
    }

    if (
      s.totalValue != null &&
      !Number.isNaN(Number(s.totalValue)) &&
      Number(s.totalValue) > 0
    ) {
      patch.valorTotal = Number(s.totalValue);
      highlights.add("valorTotal");
    }

    if (
      s.additionalCosts != null &&
      !Number.isNaN(Number(s.additionalCosts)) &&
      Number(s.additionalCosts) >= 0
    ) {
      patch.custosAdicionais = Math.max(0, Number(s.additionalCosts));
      highlights.add("custosAdicionais");
    }

    if (
      s.additionalCostsNote != null &&
      String(s.additionalCostsNote).trim() !== ""
    ) {
      patch.detalheCustosAdicionais = String(s.additionalCostsNote).trim();
      highlights.add("detalheCustosAdicionais");
    }

    if (s.observations != null && String(s.observations).trim() !== "") {
      patch.observacoes = String(s.observations).trim();
      highlights.add("observacoes");
    }

    skipClearAiTagsRef.current = true;
    form.setFieldsValue(patch);
    setAiFieldTags(highlights);
    setAiMissingList(
      Array.isArray(s.missingImportant)
        ? s.missingImportant.filter((x) => String(x).trim() !== "")
        : [],
    );
    setTimeout(() => {
      skipClearAiTagsRef.current = false;
    }, 0);

    const vtForRecalc =
      patch.valorTotal !== undefined
        ? patch.valorTotal
        : form.getFieldValue("valorTotal");
    const custosForRecalc =
      patch.custosAdicionais !== undefined
        ? patch.custosAdicionais
        : form.getFieldValue("custosAdicionais") ?? 0;
    const cidForRecalc =
      patch.companyId !== undefined
        ? patch.companyId
        : form.getFieldValue("companyId") ?? selectedCompany;
    if (vtForRecalc != null && cidForRecalc) {
      recalcTotals(vtForRecalc, cidForRecalc, custosForRecalc);
    }
  };

  const handlePdfForAi = async (options) => {
    const { file, onError, onSuccess } = options;
    const raw = file?.originFileObj ?? file;
    if (!raw) {
      onError?.(new Error("Arquivo inválido"));
      return;
    }
    setAiLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", raw);
      const { data } = await api.post("/loads/suggest-from-pdf", fd);
      const s = data.suggestion || {};
      applySuggestionToForm(s);
      if (data.warning) {
        message.warning(data.warning);
      } else {
        message.success(
          "Sugestão aplicada nos campos encontrados. Edite o que precisar e complete o que faltar antes de salvar.",
        );
      }
      onSuccess?.(data, raw);
    } catch (err) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Não foi possível analisar o PDF.";
      if (status === 503) {
        message.warning(msg);
      } else {
        message.error(msg);
      }
      onError?.(err);
    } finally {
      setAiLoading(false);
    }
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
      setAiFieldTags(new Set());
      setAiMissingList([]);
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
        setAiFieldTags(new Set());
        setAiMissingList([]);
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
    setAiFieldTags(new Set());
    setAiMissingList([]);
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
        setAiFieldTags(new Set());
        setAiMissingList([]);
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
      open={isVisible}
      title={isEditing ? "Editar Carga" : "Adicionar Nova Carga"}
      onOk={isEditing ? handleOk : undefined}
      onCancel={handleCancel}
      okText={isEditing ? "Atualizar" : undefined}
      cancelText="Cancelar"
      footer={footer}
      width={720}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changed) => {
          if (skipClearAiTagsRef.current) return;
          const keys = Object.keys(changed);
          if (keys.length === 0) return;
          setAiFieldTags((prev) => {
            const next = new Set(prev);
            keys.forEach((k) => next.delete(k));
            return next;
          });
        }}
      >
        {!isEditing && canSuggestFromPdf && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Preencher automaticamente a partir do PDF"
              description="Envie o PDF com texto selecionável. A IA só preenche o que conseguir identificar; o restante você digita abaixo. Todos os campos continuam editáveis."
            />
            <Upload.Dragger
              name="file"
              multiple={false}
              maxCount={1}
              accept=".pdf,application/pdf"
              showUploadList={{ showRemoveIcon: true }}
              disabled={aiLoading}
              customRequest={handlePdfForAi}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                {aiLoading
                  ? "Analisando documento…"
                  : "Clique ou arraste o PDF para esta área"}
              </p>
              <p className="ant-upload-hint">Apenas PDF · máx. 15 MB</p>
            </Upload.Dragger>
            <Divider style={{ marginTop: 16, marginBottom: 16 }} />
          </>
        )}
        {!isEditing && aiMissingList.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Complete manualmente o que a IA não encontrou"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
                {aiMissingList.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            }
          />
        )}
        <Form.Item
          name="companyId"
          label={labelWithAi("Empresa", "companyId")}
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
          label={labelWithAi("Data", "data")}
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
          label={labelWithAi("Número do Carregamento", "numeroCarregamento")}
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
          label={labelWithAi("Quantidade de Entregas", "entregas")}
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
          label={labelWithAi("Peso da Carga (kg)", "pesoCarga")}
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
          label={labelWithAi("Valor Total da Carga", "valorTotal")}
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
          label={labelWithAi("Total de custos adicionais", "custosAdicionais")}
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
          label={labelWithAi(
            "Detalhar custos (opcional)",
            "detalheCustosAdicionais",
          )}
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

        <Form.Item
          name="observacoes"
          label={labelWithAi("Observações gerais da carga", "observacoes")}
        >
          <Input.TextArea
            rows={3}
            placeholder="Observações adicionais sobre a carga..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

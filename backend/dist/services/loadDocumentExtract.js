"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeCompanyMatch = exports.suggestLoadWithOpenAI = exports.suggestLoadFallback = exports.extractTextFromPdfBuffer = exports.matchCompanyByCnpj = void 0;
const openai_1 = __importDefault(require("openai"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const zod_1 = require("zod");
const suggestedSchema = zod_1.z.object({
    loadingNumber: zod_1.z.string().nullable().optional(),
    /** Data no formato DD/MM/AAAA */
    date: zod_1.z.string().nullable().optional(),
    deliveries: zod_1.z.number().nullable().optional(),
    /** Peso em kg */
    cargoWeight: zod_1.z.number().nullable().optional(),
    /** Valor total da carga em reais (número) */
    totalValue: zod_1.z.number().nullable().optional(),
    additionalCosts: zod_1.z.number().nullable().optional(),
    additionalCostsNote: zod_1.z.string().nullable().optional(),
    observations: zod_1.z.string().nullable().optional(),
    /** CNPJ do emissor/transportador quando identificável (só dígitos ou formatado) */
    emitterCnpj: zod_1.z.string().nullable().optional(),
    /** id da empresa na lista fornecida, se houver correspondência clara */
    matchedCompanyId: zod_1.z.number().nullable().optional(),
    confidence: zod_1.z.number().min(0).max(1).nullable().optional(),
    /** Quais campos a IA conseguiu preencher (referência; o cliente também infere pelos valores) */
    filledFields: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    /** O que o usuário ainda precisa informar manualmente (frases curtas em português) */
    missingImportant: zod_1.z.array(zod_1.z.string()).nullable().optional(),
});
function normalizeCnpj(s) {
    return String(s || "").replace(/\D/g, "");
}
function matchCompanyByCnpj(emitterCnpj, companies) {
    const digits = normalizeCnpj(emitterCnpj || "");
    if (digits.length < 14)
        return null;
    const found = companies.find((c) => normalizeCnpj(c.cnpj) === digits);
    return found?.id ?? null;
}
exports.matchCompanyByCnpj = matchCompanyByCnpj;
async function extractTextFromPdfBuffer(buffer) {
    const result = await (0, pdf_parse_1.default)(buffer);
    return String(result.text || "")
        .replace(/\r\n/g, "\n")
        .trim();
}
exports.extractTextFromPdfBuffer = extractTextFromPdfBuffer;
function parseBrNumber(value) {
    if (!value)
        return null;
    const cleaned = String(value)
        .replace(/[^\d,.-]/g, "")
        .replace(/\.(?=\d{3}(?:\D|$))/g, "")
        .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}
function matchFirst(text, patterns) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1])
            return String(match[1]).trim();
    }
    return null;
}
function collectObservation(text, label, pattern) {
    const match = text.match(pattern);
    if (!match?.[1])
        return null;
    return `${label}: ${String(match[1]).trim()}`;
}
function getNonEmptyLines(text) {
    return text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}
function findLabelValue(lines, labelPattern, valuePattern, lookAhead = 8) {
    const index = lines.findIndex((line) => labelPattern.test(line));
    if (index === -1)
        return null;
    for (let i = index + 1; i < Math.min(lines.length, index + 1 + lookAhead); i += 1) {
        const line = lines[i];
        const match = line.match(valuePattern);
        if (match?.[1])
            return match[1].trim();
        if (valuePattern.test(line))
            return line.trim();
    }
    return null;
}
function findWeightKg(lines) {
    const index = lines.findIndex((line) => /Peso Total do Carregamento/i.test(line));
    if (index === -1)
        return null;
    const candidates = [];
    for (let i = index + 1; i < Math.min(lines.length, index + 16); i += 1) {
        const line = lines[i];
        const inline = line.match(/([\d.,]+)\s*Kg/i);
        if (inline?.[1])
            return parseBrNumber(inline[1]);
        const numeric = parseBrNumber(line);
        if (numeric != null && numeric > 0)
            candidates.push(numeric);
        if (/^Kg$/i.test(line) && candidates.length > 0) {
            return Math.max(...candidates);
        }
    }
    return null;
}
function findWeightFromText(text) {
    return (parseBrNumber(matchFirst(text, [/([\d.,]+)\s*Kg/i, /([\d.,]+)\nKg/i])) ||
        null);
}
function findMoneyAfterLabel(lines, labelPattern, lookAhead = 12) {
    const index = lines.findIndex((line) => labelPattern.test(line));
    if (index === -1)
        return null;
    let best = null;
    for (let i = index + 1; i < Math.min(lines.length, index + 1 + lookAhead); i += 1) {
        const value = parseBrNumber(lines[i]);
        if (value != null && value > 0)
            best = value;
    }
    return best;
}
function findSummaryTotal(lines) {
    const totalIndex = lines.findIndex((line) => /^Total$/i.test(line));
    if (totalIndex === -1)
        return null;
    for (let i = totalIndex + 1; i < Math.min(lines.length, totalIndex + 8); i += 1) {
        const value = parseBrNumber(lines[i]);
        if (value != null && value > 0)
            return value;
    }
    return null;
}
function suggestLoadFallback(params) {
    const text = params.pdfText;
    const lines = getNonEmptyLines(text);
    const loadingNumber = findLabelValue(lines, /Resumo do Carregamento/i, /^(\d{4,})$/) ||
        matchFirst(text, [
            /Resumo do Carregamento[:\s]*\n+\s*(\d{4,})/i,
            /Carregamento:\s*(\d{4,})/i,
            /Carregamento\s+(\d{4,})/i,
            /\n(\d{6,})\nFilial:/i,
            /\b(\d{6,})\b/,
        ]);
    const date = findLabelValue(lines, /Data sa[íi]da/i, /(\d{2}\/\d{2}\/\d{4})/) ||
        matchFirst(text, [
            /Data sa[íi]da:\s*(\d{2}\/\d{2}\/\d{4})/i,
            /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/,
        ]);
    const deliveriesRaw = findLabelValue(lines, /Qtde de Entregas/i, /^(\d+)$/) ||
        findLabelValue(lines, /Qtd\.?\s*entregas/i, /^(\d+)$/) ||
        matchFirst(text, [
            /Qtde de Entregas\s*:?\s*(\d+)/i,
            /Qtd\.?\s*entregas:\s*(\d+)/i,
            /Total de entregas do carregamento:\s*(\d+)/i,
        ]);
    const cargoWeight = findWeightKg(lines) || findWeightFromText(text);
    const totalValue = findMoneyAfterLabel(lines, /Vl\.\s*L[íi]quido a Receber/i) ||
        findMoneyAfterLabel(lines, /Valor Total/i) ||
        findSummaryTotal(lines) ||
        parseBrNumber(matchFirst(text, [
            /Vl\.\s*L[íi]quido a Receber\s*:?\s*([\d.,]+)/i,
            /Valor Total\s*:?\s*([\d.,]+)/i,
            /Valor\s+Total\s+[:\t ]+([\d.,]+)/i,
        ]));
    const emitterCnpj = matchFirst(text, [
        /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/,
    ]);
    const observations = [
        collectObservation(text, "Filial", /Filial:?\s*([^\n]+)/i),
        collectObservation(text, "Destino", /Destino:?\s*([^\n]+)/i),
        collectObservation(text, "Motorista", /Motorista:?\s*([^\n]+)/i),
        collectObservation(text, "Placa", /Placa:?\s*([A-Z0-9-]+)/i),
        collectObservation(text, "Qtd. notas", /Qtd\.?\s*notas:\s*(\d+)/i),
    ]
        .filter(Boolean)
        .join(" | ");
    const deliveries = deliveriesRaw ? Number(deliveriesRaw) : null;
    const filledFields = [];
    const missingImportant = [];
    if (loadingNumber)
        filledFields.push("loadingNumber");
    else
        missingImportant.push("número do carregamento");
    if (date)
        filledFields.push("date");
    else
        missingImportant.push("data da carga");
    if (deliveries != null)
        filledFields.push("deliveries");
    else
        missingImportant.push("quantidade de entregas");
    if (cargoWeight != null)
        filledFields.push("cargoWeight");
    else
        missingImportant.push("peso da carga");
    if (totalValue != null)
        filledFields.push("totalValue");
    else
        missingImportant.push("valor total");
    if (observations)
        filledFields.push("observations");
    return {
        loadingNumber,
        date,
        deliveries,
        cargoWeight,
        totalValue,
        additionalCosts: null,
        additionalCostsNote: null,
        observations: observations || null,
        emitterCnpj,
        matchedCompanyId: matchCompanyByCnpj(emitterCnpj, params.companies),
        confidence: 0.45,
        filledFields,
        missingImportant,
    };
}
exports.suggestLoadFallback = suggestLoadFallback;
const SYSTEM_PROMPT = `Você é um assistente que extrai dados de documentos logísticos brasileiros (resumo de carregamento, romaneio, consulta de carregamento, notas fiscais relacionadas a transporte).

Tarefa: ler o texto fornecido e devolver APENAS um objeto JSON com os campos abaixo. Use null quando não houver informação confiável.

Campos do JSON:
- "loadingNumber": string — número do carregamento (ex.: 1398646, 653028). Remova espaços.
- "date": string — data do carregamento ou saída no formato DD/MM/AAAA.
- "deliveries": number — quantidade de entregas (Qtde de Entregas, entregas, etc.).
- "cargoWeight": number — peso total em kg (número decimal; se estiver "682,44 Kg" use 682.44).
- "totalValue": number — valor total da carga em reais (número; se houver "Valor Total" ou valor principal da carga, use esse; troque vírgula decimal por ponto internamente no raciocínio, no JSON use número).
- "additionalCosts": number — custos extras explícitos (pedágio, descarga cobrada à parte) se claramente separados do valor principal; senão null.
- "additionalCostsNote": string — breve descrição desses custos se houver.
- "observations": string — observações úteis: filial, motorista, placa, quantidade de notas, destino, etc. (uma linha ou curto parágrafo).
- "emitterCnpj": string — CNPJ do transportador/emissor/empresa do documento, só dígitos (14 caracteres) se encontrar.
- "matchedCompanyId": number — se a lista de empresas fornecida contiver claramente a mesma razão social/CNPJ do documento, use o id dessa empresa; senão null.
- "confidence": number entre 0 e 1 — sua confiança geral na extração.
- "filledFields": array de strings — apenas estes valores: "company", "date", "loadingNumber", "deliveries", "cargoWeight", "totalValue", "additionalCosts", "additionalCostsNote", "observations". Liste um campo só se você preencheu o valor correspondente no JSON com dados confiáveis (não null).
- "missingImportant": array de strings — em português, liste o que NÃO foi possível encontrar ou ficou duvidoso e o usuário deve preencher manualmente (ex.: "data da carga", "valor total", "empresa", "número do carregamento"). Se vazio, use [].

Regras:
- Priorize rótulos como "Resumo do Carregamento", "Carregamento:", "Data saída", "Peso Total", "Qtde de Entregas", "Valor Total".
- Ignore totais de boletos duplicatas se forem apenas cobrança e não o valor da carga, a menos que seja o único "Valor Total" claro.
- Se houver várias datas, prefira a data de saída do carregamento ou a data principal do resumo.
- Nunca invente valores: use null nos campos que não estiverem claros no texto. O usuário completará depois.
- Em "filledFields" e "missingImportant" seja coerente: se totalValue for null, inclua "valor total" ou similar em "missingImportant" e não inclua "totalValue" em "filledFields".`;
async function suggestLoadWithOpenAI(params) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
        throw new Error("OPENAI_API_KEY não configurada no servidor");
    }
    const client = new openai_1.default({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const truncated = params.pdfText.slice(0, 14000);
    const companiesJson = JSON.stringify(params.companies.map((c) => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
    })), null, 0);
    const completion = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        temperature: 0.1,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: `Empresas cadastradas (use apenas estes ids em matchedCompanyId):\n${companiesJson}\n\n--- TEXTO DO PDF ---\n${truncated}`,
            },
        ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw)
        throw new Error("Resposta vazia do modelo");
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error("JSON inválido retornado pelo modelo");
    }
    const safe = suggestedSchema.safeParse(parsed);
    if (!safe.success) {
        throw new Error("Estrutura de dados inválida na resposta da IA");
    }
    return safe.data;
}
exports.suggestLoadWithOpenAI = suggestLoadWithOpenAI;
function mergeCompanyMatch(suggestion, companies) {
    const ids = new Set(companies.map((c) => c.id));
    if (suggestion.matchedCompanyId != null &&
        ids.has(suggestion.matchedCompanyId)) {
        return suggestion.matchedCompanyId;
    }
    return matchCompanyByCnpj(suggestion.emitterCnpj, companies);
}
exports.mergeCompanyMatch = mergeCompanyMatch;

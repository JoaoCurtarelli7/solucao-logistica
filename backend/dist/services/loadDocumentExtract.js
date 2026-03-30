"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchCompanyByCnpj = matchCompanyByCnpj;
exports.extractTextFromPdfBuffer = extractTextFromPdfBuffer;
exports.suggestLoadWithOpenAI = suggestLoadWithOpenAI;
exports.mergeCompanyMatch = mergeCompanyMatch;
const openai_1 = __importDefault(require("openai"));
const pdf_parse_1 = require("pdf-parse");
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
async function extractTextFromPdfBuffer(buffer) {
    const parser = new pdf_parse_1.PDFParse({ data: new Uint8Array(buffer) });
    try {
        const result = await parser.getText();
        const text = String(result.text || "")
            .replace(/\r\n/g, "\n")
            .trim();
        return text;
    }
    finally {
        await parser.destroy().catch(() => undefined);
    }
}
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
function mergeCompanyMatch(suggestion, companies) {
    const ids = new Set(companies.map((c) => c.id));
    if (suggestion.matchedCompanyId != null &&
        ids.has(suggestion.matchedCompanyId)) {
        return suggestion.matchedCompanyId;
    }
    return matchCompanyByCnpj(suggestion.emitterCnpj, companies);
}

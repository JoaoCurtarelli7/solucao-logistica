"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDocumentAiRoutes = loadDocumentAiRoutes;
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionMiddleware_1 = require("../middlewares/permissionMiddleware");
const prisma_1 = require("../lib/prisma");
const loadDocumentExtract_1 = require("../services/loadDocumentExtract");
const MAX_BYTES = 15 * 1024 * 1024;
async function loadDocumentAiRoutes(app) {
    app.addHook("preHandler", authMiddleware_1.authMiddleware);
    app.post("/loads/suggest-from-pdf", {
        preHandler: (0, permissionMiddleware_1.requirePermission)("loads.create"),
    }, async (req, rep) => {
        try {
            const data = await req.file();
            if (!data) {
                return rep
                    .code(400)
                    .send({ message: 'Envie um arquivo PDF no campo "file".' });
            }
            const mime = data.mimetype || "";
            if (!mime.includes("pdf") &&
                !data.filename?.toLowerCase().endsWith(".pdf")) {
                return rep
                    .code(400)
                    .send({ message: "Apenas arquivos PDF são aceitos." });
            }
            const buffer = await data.toBuffer();
            if (buffer.length === 0) {
                return rep.code(400).send({ message: "Arquivo vazio." });
            }
            if (buffer.length > MAX_BYTES) {
                return rep
                    .code(400)
                    .send({ message: "PDF muito grande (máximo 15 MB)." });
            }
            const pdfText = await (0, loadDocumentExtract_1.extractTextFromPdfBuffer)(buffer);
            if (pdfText.length < 40) {
                return rep.code(422).send({
                    message: "Não foi possível extrair texto suficiente do PDF. Se for um documento só imagem (escaneado), use um PDF com texto selecionável ou gere o arquivo a partir do sistema de origem.",
                    rawTextPreview: pdfText.slice(0, 500),
                });
            }
            const companies = await prisma_1.prisma.company.findMany({
                select: { id: true, name: true, cnpj: true },
                orderBy: { name: "asc" },
            });
            const suggestion = await (0, loadDocumentExtract_1.suggestLoadWithOpenAI)({
                pdfText,
                companies,
            });
            const matchedCompanyId = (0, loadDocumentExtract_1.mergeCompanyMatch)(suggestion, companies);
            return rep.send({
                suggestion: {
                    ...suggestion,
                    matchedCompanyId,
                },
                rawTextPreview: pdfText.slice(0, 1200),
            });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("OPENAI_API_KEY")) {
                return rep.code(503).send({
                    message: "Extração por IA não está configurada. Defina a variável de ambiente OPENAI_API_KEY no servidor.",
                });
            }
            app.log.error(e);
            return rep.code(500).send({
                message: "Erro ao processar o PDF. Tente outro arquivo ou preencha manualmente.",
                detail: process.env.NODE_ENV === "development" ? msg : undefined,
            });
        }
    });
}

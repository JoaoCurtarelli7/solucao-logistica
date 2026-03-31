import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "../types/fastify";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/permissionMiddleware";
import { prisma } from "../lib/prisma";
import {
  extractTextFromPdfBuffer,
  mergeCompanyMatch,
  suggestLoadFallback,
  suggestLoadWithOpenAI,
} from "../services/loadDocumentExtract";

const MAX_BYTES = 15 * 1024 * 1024;

export async function loadDocumentAiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post(
    "/loads/suggest-from-pdf",
    {
      preHandler: requirePermission("loads.create"),
    },
    async (req: FastifyRequest, rep: FastifyReply) => {
      try {
        const data = await req.file();
        if (!data) {
          return rep
            .code(400)
            .send({ message: 'Envie um arquivo PDF no campo "file".' });
        }

        const mime = data.mimetype || "";
        if (
          !mime.includes("pdf") &&
          !data.filename?.toLowerCase().endsWith(".pdf")
        ) {
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

        const pdfText = await extractTextFromPdfBuffer(buffer);
        if (pdfText.length < 40) {
          return rep.code(422).send({
            message:
              "Não foi possível extrair texto suficiente do PDF. Se for um documento só imagem (escaneado), use um PDF com texto selecionável ou gere o arquivo a partir do sistema de origem.",
            rawTextPreview: pdfText.slice(0, 500),
          });
        }

        const companies = await prisma.company.findMany({
          select: { id: true, name: true, cnpj: true },
          orderBy: { name: "asc" },
        });

        let suggestion;
        let warning: string | undefined;
        try {
          suggestion = await suggestLoadWithOpenAI({
            pdfText,
            companies,
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          const code =
            typeof e === "object" && e && "code" in e
              ? String((e as { code?: unknown }).code)
              : "";
          const status =
            typeof e === "object" && e && "status" in e
              ? Number((e as { status?: unknown }).status)
              : 0;

          if (
            msg.includes("OPENAI_API_KEY") ||
            code === "insufficient_quota" ||
            status === 429 ||
            /quota|rate limit|429/i.test(msg)
          ) {
            suggestion = suggestLoadFallback({
              pdfText,
              companies,
            });
            warning =
              code === "insufficient_quota" || /quota/i.test(msg)
                ? "A IA está sem cota no momento. Usei uma leitura local do PDF e preenchi apenas o que consegui identificar."
                : "A IA não respondeu no momento. Usei uma leitura local do PDF e preenchi apenas o que consegui identificar.";
          } else {
            throw e;
          }
        }

        const matchedCompanyId = mergeCompanyMatch(suggestion, companies);

        return rep.send({
          suggestion: {
            ...suggestion,
            matchedCompanyId,
          },
          rawTextPreview: pdfText.slice(0, 1200),
          warning,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("OPENAI_API_KEY")) {
          return rep.code(503).send({
            message:
              "Extração por IA não está configurada. Defina a variável de ambiente OPENAI_API_KEY no servidor.",
          });
        }
        app.log.error(e);
        return rep.code(500).send({
          message:
            "Erro ao processar o PDF. Tente outro arquivo ou preencha manualmente.",
          detail: process.env.NODE_ENV === "development" ? msg : undefined,
        });
      }
    },
  );
}

import fastifyCors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastify from "fastify";
import type { FastifyRequest } from "fastify/types/request";

import { companyRoutes } from "./routes/company";
import { employeeRoutes } from "./routes/employee";
import { authRoutes } from "./routes/auth";
import { loadRoutes } from "./routes/load";
import { loadDocumentAiRoutes } from "./routes/loadDocumentAi";
import { userRoutes } from "./routes/user";
import { financialRoutes } from "./routes/financial";
import { dashboardRoutes } from "./routes/dashboard";
import { reportRoutes } from "./routes/reports";
import { monthRoutes } from "./routes/month";
import { closingRoutes } from "./routes/closing";
import { loadBillingClosingRoutes } from "./routes/loadBillingClosing";

import { truckRoutes } from "./routes/truck";
import { tripRoutes } from "./routes/trip";
import { tripExpenseRoutes } from "./routes/tripExpense";
import { maintenanceRoutes } from "./routes/maintenance";
import { maintenanceServicePresetRoutes } from "./routes/maintenanceServicePreset";
import { rbacRoutes } from "./routes/rbac";
import { tenantRoutes } from "./routes/tenant";

export const app = fastify({ logger: true });

app.register(swagger, {
  openapi: {
    info: {
      title: "Derlei Sistema API",
      description: "API do sistema de gestão de frotas e logística",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
});

app.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: { docExpansion: "list", deepLinking: false },
  staticCSP: true,
});

app.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: "1 minute",
  keyGenerator: (req: FastifyRequest) =>
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip,
  errorResponseBuilder: (_req: FastifyRequest, context: { ttl: number }) => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: `Muitas requisições. Tente novamente em ${Math.ceil(context.ttl / 1000)} segundos.`,
  }),
});

// CORS: lista de origens permitidas (variável CORS_ORIGIN no DigitalOcean)
const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*");
}

// Responde ao preflight (OPTIONS) manualmente para garantir CORS atrás de proxy
app.addHook("onRequest", async (request, reply) => {
  const origin = request.headers.origin;
  if (!isOriginAllowed(origin)) return;

  reply.header("Access-Control-Allow-Origin", origin);
  reply.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Max-Age", "86400");

  if (request.method === "OPTIONS") {
    return reply.code(204).send();
  }
});

app.register(multipart, {
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.register(fastifyCors, {
  origin: (
    origin: string | undefined,
    cb: (err: Error | null, allow?: string | boolean) => void,
  ) => {
    if (origin && isOriginAllowed(origin)) {
      cb(null, origin);
    } else if (!origin && ALLOWED_ORIGINS.length > 0) {
      cb(null, ALLOWED_ORIGINS[0]);
    } else {
      cb(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
  preflight: true,
});

app.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}));

app.register(companyRoutes);
app.register(employeeRoutes);
app.register(authRoutes);
app.register(loadRoutes);
app.register(loadDocumentAiRoutes);
app.register(userRoutes);
app.register(financialRoutes);
app.register(dashboardRoutes);
app.register(reportRoutes);
app.register(monthRoutes);
app.register(closingRoutes);
app.register(loadBillingClosingRoutes);
app.register(truckRoutes);
app.register(maintenanceRoutes);
app.register(maintenanceServicePresetRoutes);
app.register(tripRoutes);
app.register(tripExpenseRoutes);
app.register(rbacRoutes);
app.register(tenantRoutes);

export default app;

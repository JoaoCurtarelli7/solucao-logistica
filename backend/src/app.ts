import fastifyCors from "@fastify/cors";
import fastify from "fastify";

import { companyRoutes } from "./routes/company";
import { employeeRoutes } from "./routes/employee";
import { authRoutes } from "./routes/auth";
import { loadRoutes } from "./routes/load";
import { userRoutes } from "./routes/user";
import { financialRoutes } from "./routes/financial";
import { dashboardRoutes } from "./routes/dashboard";
import { reportRoutes } from "./routes/reports";
import { monthRoutes } from "./routes/month";
import { closingRoutes } from "./routes/closing";

import { truckRoutes } from "./routes/truck";
import { tripRoutes } from "./routes/trip";
import { tripExpenseRoutes } from "./routes/tripExpense";
import { maintenanceRoutes } from "./routes/maintenance";
import { rbacRoutes } from "./routes/rbac";

export const app = fastify({
  logger: true,
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

app.register(companyRoutes);
app.register(employeeRoutes);
app.register(authRoutes);
app.register(loadRoutes);
app.register(userRoutes);
app.register(financialRoutes);
app.register(dashboardRoutes);
app.register(reportRoutes);
app.register(monthRoutes);
app.register(closingRoutes);
app.register(truckRoutes);
app.register(maintenanceRoutes);
app.register(tripRoutes);
app.register(tripExpenseRoutes);
app.register(rbacRoutes);

export default app;

import fastifyCors from "@fastify/cors";
import fastify from 'fastify'

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

export const app = fastify({
  logger: true,
});

app.register(fastifyCors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
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

export default app;

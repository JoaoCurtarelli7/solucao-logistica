"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("@fastify/cors"));
const fastify_1 = __importDefault(require("fastify"));
const company_1 = require("./routes/company");
const employee_1 = require("./routes/employee");
const auth_1 = require("./routes/auth");
const load_1 = require("./routes/load");
const user_1 = require("./routes/user");
const financial_1 = require("./routes/financial");
const dashboard_1 = require("./routes/dashboard");
const reports_1 = require("./routes/reports");
const month_1 = require("./routes/month");
const closing_1 = require("./routes/closing");
const truck_1 = require("./routes/truck");
const trip_1 = require("./routes/trip");
const tripExpense_1 = require("./routes/tripExpense");
const maintenance_1 = require("./routes/maintenance");
const rbac_1 = require("./routes/rbac");
exports.app = (0, fastify_1.default)({
    logger: true,
});
// CORS: lista de origens permitidas (variável CORS_ORIGIN no DigitalOcean)
const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"];
function isOriginAllowed(origin) {
    if (!origin)
        return false;
    return ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*");
}
// Responde ao preflight (OPTIONS) manualmente para garantir CORS atrás de proxy
exports.app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (!isOriginAllowed(origin))
        return;
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header("Access-Control-Max-Age", "86400");
    if (request.method === "OPTIONS") {
        return reply.code(204).send();
    }
});
exports.app.register(cors_1.default, {
    origin: (origin, cb) => {
        if (origin && isOriginAllowed(origin)) {
            cb(null, origin);
        }
        else if (!origin && ALLOWED_ORIGINS.length > 0) {
            cb(null, ALLOWED_ORIGINS[0]);
        }
        else {
            cb(null, false);
        }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
    preflight: true,
});
exports.app.register(company_1.companyRoutes);
exports.app.register(employee_1.employeeRoutes);
exports.app.register(auth_1.authRoutes);
exports.app.register(load_1.loadRoutes);
exports.app.register(user_1.userRoutes);
exports.app.register(financial_1.financialRoutes);
exports.app.register(dashboard_1.dashboardRoutes);
exports.app.register(reports_1.reportRoutes);
exports.app.register(month_1.monthRoutes);
exports.app.register(closing_1.closingRoutes);
exports.app.register(truck_1.truckRoutes);
exports.app.register(maintenance_1.maintenanceRoutes);
exports.app.register(trip_1.tripRoutes);
exports.app.register(tripExpense_1.tripExpenseRoutes);
exports.app.register(rbac_1.rbacRoutes);
exports.default = exports.app;

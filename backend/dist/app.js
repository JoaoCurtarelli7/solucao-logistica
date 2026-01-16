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
exports.app = (0, fastify_1.default)({
    logger: true,
});
exports.app.register(cors_1.default, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
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
exports.default = exports.app;

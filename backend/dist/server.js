"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const initializeServer = async () => {
    const port = Number(process.env.PORT) || 3333;
    await app_1.default.listen({
        host: "0.0.0.0",
        port: port,
    }).catch((err) => {
        console.error("Erro ao iniciar servidor:", err);
        process.exit(1);
    });
};
initializeServer();

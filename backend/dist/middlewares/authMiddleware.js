"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
async function authMiddleware(req, rep) {
    try {
        const auth = req.headers?.authorization;
        if (!auth) {
            return rep.status(401).send({ message: 'Token ausente' });
        }
        const parts = auth.split(" ");
        if (parts.length !== 2 || parts[0] !== "Bearer") {
            return rep.status(401).send({ message: "Formato de token inválido. Use: Bearer <token>" });
        }
        const token = parts[1];
        if (!token) {
            return rep.status(401).send({ message: "Token ausente" });
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, "secreta-chave");
            if (!decoded.userId) {
                return rep.status(401).send({ message: "Token inválido - userId não encontrado" });
            }
            req.user = { id: decoded.userId };
            // Não retorna nada, continua para o próximo handler
        }
        catch (jwtError) {
            console.error("Erro ao verificar token:", jwtError.message);
            if (jwtError.name === 'TokenExpiredError') {
                return rep.status(401).send({ message: "Token expirado" });
            }
            if (jwtError.name === 'JsonWebTokenError') {
                return rep.status(401).send({ message: "Token inválido" });
            }
            return rep.status(401).send({ message: "Token inválido ou expirado" });
        }
    }
    catch (error) {
        console.error("Erro no middleware de autenticação:", error.message);
        return rep.status(401).send({ message: "Erro na autenticação" });
    }
}

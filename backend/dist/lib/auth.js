"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePasswords = comparePasswords;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const SALT_ROUNDS = 10;
// Gera um hash seguro da senha
async function hashPassword(password) {
    return bcrypt_1.default.hash(password, SALT_ROUNDS);
}
// Verifica se a senha está correta
async function comparePasswords(password, hash) {
    return bcrypt_1.default.compare(password, hash);
}
// Gera um token JWT válido por 1 hora
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}
// Verifica e decodifica o token JWT
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
}

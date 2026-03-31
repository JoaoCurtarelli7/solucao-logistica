"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = exports.comparePasswords = exports.hashPassword = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const SALT_ROUNDS = 10;
// Gera um hash seguro da senha
async function hashPassword(password) {
    return bcrypt_1.default.hash(password, SALT_ROUNDS);
}
exports.hashPassword = hashPassword;
// Verifica se a senha está correta
async function comparePasswords(password, hash) {
    return bcrypt_1.default.compare(password, hash);
}
exports.comparePasswords = comparePasswords;
// Gera um token JWT válido por 1 hora
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}
exports.generateToken = generateToken;
// Verifica e decodifica o token JWT
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
}
exports.verifyToken = verifyToken;

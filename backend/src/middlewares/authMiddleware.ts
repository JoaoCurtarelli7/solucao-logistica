import type { FastifyReply, FastifyRequest } from 'fastify'
import jwt from "jsonwebtoken";

export async function authMiddleware(req: FastifyRequest, rep: FastifyReply) {
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
      const decoded: any = jwt.verify(token, "secreta-chave");
      
      if (!decoded.userId) {
        return rep.status(401).send({ message: "Token inválido - userId não encontrado" });
      }

      req.user = { id: decoded.userId };
      // Não retorna nada, continua para o próximo handler
    } catch (jwtError: any) {
      console.error("Erro ao verificar token:", jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return rep.status(401).send({ message: "Token expirado" });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return rep.status(401).send({ message: "Token inválido" });
      }

      return rep.status(401).send({ message: "Token inválido ou expirado" });
    }
  } catch (error: any) {
    console.error("Erro no middleware de autenticação:", error.message);
    return rep.status(401).send({ message: "Erro na autenticação" });
  }
}

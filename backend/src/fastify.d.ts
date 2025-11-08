declare module 'fastify' {
  interface FastifyRequest {
    body: unknown
    user?: {
      id: number
    }
  }
}


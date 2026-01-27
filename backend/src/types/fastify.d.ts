// Re-export Fastify types to make them available as named exports
export type {
  FastifyInstance,
} from 'fastify/types/instance';

export type {
  FastifyReply,
} from 'fastify/types/reply';

export type {
  FastifyRequest,
} from 'fastify/types/request';

// Extend FastifyRequest to include user property
declare module 'fastify/types/request' {
  interface FastifyRequest {
    user?: {
      id: number;
    };
  }
}

// Declare module for fastify default export to work with export =
declare module 'fastify' {
  import type { FastifyInstance, FastifyServerOptions } from 'fastify/types/instance';
  import type { FastifyBaseLogger } from 'fastify/types/logger';
  import type { FastifyTypeProviderDefault } from 'fastify/types/type-provider';
  import type { RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression } from 'fastify/types/utils';
  
  function fastify<
    Server extends RawServerDefault = RawServerDefault,
    Logger extends FastifyBaseLogger = FastifyBaseLogger,
  >(options?: FastifyServerOptions<Server, Logger>): FastifyInstance<Server, RawRequestDefaultExpression<Server>, RawReplyDefaultExpression<Server>, Logger, FastifyTypeProviderDefault> & PromiseLike<FastifyInstance<Server, RawRequestDefaultExpression<Server>, RawReplyDefaultExpression<Server>, Logger, FastifyTypeProviderDefault>>;
  
  export = fastify;
}

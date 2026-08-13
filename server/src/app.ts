import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import { normalizeSearchText } from '../../shared/normalize.js';
import type { CatalogRepository } from './catalog/types.js';
import { CatalogSearchIndex } from './search/catalog-index.js';

export interface ServerOptions {
  allowedOrigins?: string[];
  logger?: boolean;
}

export async function buildServer(repository: CatalogRepository, options: ServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, requestTimeout: 2_000 });
  const allowedOrigins = new Set(options.allowedOrigins ?? ['https://store.steampowered.com', 'https://steamloopback.host']);
  await app.register(cors, {
    credentials: false,
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.has(origin));
    },
    methods: ['GET', 'OPTIONS'],
  });

  const index = new CatalogSearchIndex(repository);
  app.get('/health', async () => ({ ok: true, games: index.refresh() }));
  app.get('/api/search', async (request, reply) => {
    const raw = request.query;
    if (typeof raw !== 'object' || raw === null) return reply.code(400).send({ error: 'invalid query' });
    const queryRecord = raw as Record<string, unknown>;
    if (typeof queryRecord.q !== 'string' || !normalizeSearchText(queryRecord.q)) {
      return reply.code(400).send({ error: 'q must be a non-empty string' });
    }
    const parsedLimit = queryRecord.limit === undefined ? 10 : Number(queryRecord.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return reply.code(400).send({ error: 'limit must be an integer from 1 to 50' });
    }
    const query = normalizeSearchText(queryRecord.q).slice(0, 100);
    return index.search(query, parsedLimit);
  });

  app.addHook('onClose', async () => repository.close());
  return app;
}

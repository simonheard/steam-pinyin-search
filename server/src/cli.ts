import { buildServer } from './app.js';
import { SqliteCatalogRepository } from './catalog/sqlite-repository.js';
import { readServerConfig } from './config.js';

const config = readServerConfig();
const repository = new SqliteCatalogRepository(config.databasePath);
const app = await buildServer(repository, { allowedOrigins: config.allowedOrigins, logger: true });
await app.listen({ host: config.host, port: config.port });

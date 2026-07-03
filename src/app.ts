import { randomUUID } from 'node:crypto';
import express, { type Request } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { pool } from './config/database.js';
import { env } from './config/env.js';
import { openApiDocument } from './docs/openapi.js';
import { errorHandler } from './middlewares/error-handler.middleware.js';
import { notFound } from './middlewares/not-found.middleware.js';
import { PeopleRepository } from './repositories/people.repository.js';
import { createRouter } from './routes/index.js';
import { PeopleService } from './services/people.service.js';
import type { PeopleRepository as PeopleRepositoryContract } from './types/people.types.js';
import { logger } from './utils/logger.js';

export function createApp(repository?: PeopleRepositoryContract): express.Express {
  const app = express();
  const peopleRepository = repository ?? new PeopleRepository(pool);
  const peopleService = new PeopleService(peopleRepository);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });
  app.use(
    pinoHttp({
      logger,
      genReqId: (req: Request) => req.requestId ?? randomUUID(),
      customProps: (req) => ({
        requestId: req.requestId
      })
    })
  );
  app.use(
    express.json({
      limit: env.JSON_BODY_LIMIT,
      strict: false,
      verify: (req, _res, buffer) => {
        const expressRequest = req as Request;
        expressRequest.rawBody = buffer.toString('utf8');
      }
    })
  );
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/docs.json', (_req, res) => {
    res.status(200).json(openApiDocument);
  });
  app.use(createRouter(peopleService));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

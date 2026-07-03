import { Router } from 'express';
import type { PeopleService } from '../services/people.service.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

export function createHealthRouter(peopleService: PeopleService): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'api-detector-personas',
      timestamp: new Date().toISOString()
    });
  });

  router.get(
    '/health/db',
    asyncHandler(async (_req, res) => {
      try {
        await peopleService.healthCheck();
        res.status(200).json({
          status: 'ok',
          service: 'api-detector-personas',
          database: 'ok',
          timestamp: new Date().toISOString()
        });
      } catch {
        res.status(503).json({
          status: 'error',
          service: 'api-detector-personas',
          database: 'unavailable',
          timestamp: new Date().toISOString()
        });
      }
    })
  );

  return router;
}

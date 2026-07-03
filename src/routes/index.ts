import { Router } from 'express';
import type { PeopleService } from '../services/people.service.js';
import { createHealthRouter } from './health.routes.js';
import { createPeopleRouter } from './people.routes.js';

export function createRouter(peopleService: PeopleService): Router {
  const router = Router();

  router.use(createHealthRouter(peopleService));
  router.use('/api', createPeopleRouter(peopleService));

  return router;
}

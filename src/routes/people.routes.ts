import { Router } from 'express';
import { PeopleController } from '../controllers/people.controller.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { optionalApiKey } from '../middlewares/optional-api-key.middleware.js';
import type { PeopleService } from '../services/people.service.js';

export function createPeopleRouter(peopleService: PeopleService): Router {
  const router = Router();
  const controller = new PeopleController(peopleService);

  router.post('/people', optionalApiKey, asyncHandler(controller.create));
  router.get('/people', optionalApiKey, asyncHandler(controller.list));
  router.get('/people/:id', optionalApiKey, asyncHandler(controller.findById));

  return router;
}

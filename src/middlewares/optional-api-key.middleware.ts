import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

export const optionalApiKey: RequestHandler = (req, res, next) => {
  if (env.PEOPLE_API_KEY.trim().length === 0) {
    next();
    return;
  }

  if (req.header('X-API-Key') === env.PEOPLE_API_KEY) {
    next();
    return;
  }

  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'API key inválida o ausente'
    }
  });
};

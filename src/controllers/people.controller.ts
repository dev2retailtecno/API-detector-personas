import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import type { JsonObject } from '../types/people.types.js';
import { PeopleService } from '../services/people.service.js';

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    device_id: z.string().min(1).max(150).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional()
  })
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      new Date(query.from).getTime() <= new Date(query.to).getTime(),
    {
      message: 'El parámetro from debe ser anterior o igual a to',
      path: ['from']
    }
  );

export class PeopleController {
  public constructor(private readonly peopleService: PeopleService) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    const payload = ensureJsonObject(req);
    const result = await this.peopleService.receive(payload);

    if (result.duplicate) {
      res.status(200).json({
        success: true,
        message: 'Evento recibido anteriormente',
        duplicate: true,
        warnings: result.warnings
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Datos recibidos y almacenados',
      duplicate: false,
      data: result.data,
      warnings: result.warnings
    });
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const parsedQuery = listQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      throw new AppError(400, 'INVALID_QUERY', 'Los parámetros de consulta no son válidos', {
        issues: parsedQuery.error.issues
      });
    }

    const result = await this.peopleService.list({
      page: parsedQuery.data.page,
      limit: parsedQuery.data.limit,
      device_id: parsedQuery.data.device_id,
      from: parsedQuery.data.from === undefined ? undefined : new Date(parsedQuery.data.from),
      to: parsedQuery.data.to === undefined ? undefined : new Date(parsedQuery.data.to)
    });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  };

  public findById = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new AppError(400, 'INVALID_QUERY', 'El id debe ser un entero positivo');
    }

    const data = await this.peopleService.findById(id);

    res.status(200).json({
      success: true,
      data
    });
  };
}

function ensureJsonObject(req: Request): JsonObject {
  if (req.rawBody !== undefined && req.rawBody.trim().length === 0) {
    throw new AppError(400, 'INVALID_PAYLOAD', 'El cuerpo debe ser un objeto JSON');
  }

  const body = req.body as unknown;

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'INVALID_PAYLOAD', 'El cuerpo debe ser un objeto JSON');
  }

  return body as JsonObject;
}

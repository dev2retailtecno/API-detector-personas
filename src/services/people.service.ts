import { AppError } from '../errors/app-error.js';
import type {
  JsonObject,
  ListPeopleFilters,
  PeopleCountPublicRecord,
  PeopleCountRecord,
  PeopleRepository
} from '../types/people.types.js';
import { createPayloadHash } from '../utils/payload-hash.js';
import { PeoplePayloadNormalizerService } from './people-payload-normalizer.service.js';

export class PeopleService {
  public constructor(
    private readonly peopleRepository: PeopleRepository,
    private readonly normalizer = new PeoplePayloadNormalizerService()
  ) {}

  public async receive(payload: JsonObject): Promise<{
    duplicate: boolean;
    data?: PeopleCountPublicRecord;
    warnings: string[];
  }> {
    const normalizedPayload = this.normalizer.normalize(payload);
    const payloadHash = createPayloadHash(normalizedPayload);
    const result = await this.peopleRepository.create({
      ...normalizedPayload,
      payload_hash: payloadHash
    });

    if (result.duplicate || result.record === null) {
      return {
        duplicate: true,
        warnings: normalizedPayload.warnings
      };
    }

    return {
      duplicate: false,
      data: toPublicRecord(result.record),
      warnings: normalizedPayload.warnings
    };
  }

  public async list(filters: ListPeopleFilters): Promise<{
    data: PeopleCountPublicRecord[];
    pagination: {
      page: number;
      limit: number;
      total_items: number;
      total_pages: number;
    };
  }> {
    const result = await this.peopleRepository.list(filters);

    return {
      data: result.data.map(toPublicRecord),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total_items: result.totalItems,
        total_pages: Math.ceil(result.totalItems / filters.limit)
      }
    };
  }

  public async findById(id: number): Promise<Record<string, unknown>> {
    const record = await this.peopleRepository.findById(id);

    if (record === null) {
      throw new AppError(404, 'NOT_FOUND', 'No se encontró el evento solicitado');
    }

    return {
      ...toPublicRecord(record),
      raw_payload: record.raw_payload
    };
  }

  public async healthCheck(): Promise<void> {
    await this.peopleRepository.healthCheck();
  }
}

function toPublicRecord(record: PeopleCountRecord): PeopleCountPublicRecord {
  return {
    id: Number(record.id),
    device_id: record.device_id,
    timestamp: record.fecha.toISOString(),
    entradas: record.entradas,
    salidas: record.salidas,
    total: record.total,
    created_at: record.created_at.toISOString()
  };
}

import { createHash } from 'node:crypto';
import type { NormalizedPeoplePayload } from '../types/people.types.js';
import { stableJsonStringify } from './stable-json.js';

export function createPayloadHash(payload: NormalizedPeoplePayload): string {
  const hashSource = {
    device_id: payload.device_id,
    timestamp: payload.timestamp.toISOString(),
    entradas: payload.entradas,
    salidas: payload.salidas,
    raw_payload: payload.raw_payload
  };

  return createHash('sha256').update(stableJsonStringify(hashSource)).digest('hex');
}

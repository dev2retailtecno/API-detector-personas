import { AppError } from '../errors/app-error.js';
import type { JsonObject, NormalizedPeoplePayload } from '../types/people.types.js';

const MAX_DEPTH = 8;

const DEVICE_ALIASES = [
  'devEUI',
  'dev_eui',
  'deviceEUI',
  'deviceName',
  'device_name',
  'deviceId',
  'device_id',
  'serialNumber',
  'serial_number',
  'serial',
  'eui'
];

const TIMESTAMP_ALIASES = [
  'time',
  'timestamp',
  'dateTime',
  'datetime',
  'eventTime',
  'event_time',
  'receivedAt',
  'received_at'
];

const ENTRADAS_ALIASES = [
  'in',
  'entry',
  'entries',
  'entradas',
  'peopleIn',
  'people_in',
  'inCount',
  'in_count',
  'enter',
  'entering'
];

const SALIDAS_ALIASES = [
  'out',
  'exit',
  'exits',
  'salidas',
  'peopleOut',
  'people_out',
  'outCount',
  'out_count',
  'leave',
  'leaving'
];

const PRIORITIZED_COUNTER_PATHS = [
  ['data', 'people_counter'],
  ['data', 'peopleCounter'],
  ['people_counter'],
  ['peopleCounter'],
  ['data', 'counter'],
  ['counter'],
  ['data'],
  []
];

const COMMON_COUNTER_CONTAINERS = [
  'payload',
  'measurements',
  'values',
  'data',
  'counter',
  'people_counter',
  'peopleCounter'
];

interface AliasMatch {
  field: string;
  value: unknown;
}

interface CounterPair {
  entradas?: AliasMatch;
  salidas?: AliasMatch;
}

export class PeoplePayloadNormalizerService {
  public normalize(rawPayload: JsonObject): NormalizedPeoplePayload {
    const warnings: string[] = [];
    const deviceId = this.normalizeDeviceId(rawPayload, warnings);
    const timestamp = this.normalizeTimestamp(rawPayload, warnings);
    const counters = this.findCounterPair(rawPayload);
    const entradas = this.normalizeCounter(counters.entradas, 'entradas', warnings);
    const salidas = this.normalizeCounter(counters.salidas, 'salidas', warnings);

    return {
      device_id: deviceId,
      timestamp,
      entradas,
      salidas,
      total: entradas - salidas,
      raw_payload: rawPayload,
      warnings
    };
  }

  private normalizeDeviceId(payload: JsonObject, warnings: string[]): string {
    const deviceSerialNumber = getAtNormalizedPath(payload, ['device_info', 'device_sn']);
    const match = isValidDeviceIdentifier(deviceSerialNumber)
      ? { field: 'device_sn', value: deviceSerialNumber }
      : findDeepAlias(payload, DEVICE_ALIASES, MAX_DEPTH);

    if (match === null) {
      warnings.push('No se encontró el identificador del dispositivo; se utilizó unknown');
      return 'unknown';
    }

    if (typeof match.value === 'string' && match.value.trim().length > 0) {
      return match.value.trim();
    }

    if (typeof match.value === 'number' && Number.isFinite(match.value)) {
      return String(match.value);
    }

    warnings.push('El identificador del dispositivo no es válido; se utilizó unknown');
    return 'unknown';
  }

  private normalizeTimestamp(payload: JsonObject, warnings: string[]): Date {
    const match = findDeepAlias(payload, TIMESTAMP_ALIASES, MAX_DEPTH);

    if (match === null) {
      warnings.push('No se encontró un timestamp válido; se utilizó la fecha actual del servidor');
      return new Date();
    }

    const parsedDate = parseTimestamp(match.value);

    if (parsedDate === null) {
      warnings.push('No se encontró un timestamp válido; se utilizó la fecha actual del servidor');
      return new Date();
    }

    return parsedDate;
  }

  private normalizeCounter(
    match: AliasMatch | undefined,
    label: 'entradas' | 'salidas',
    warnings: string[]
  ): number {
    if (match === undefined) {
      warnings.push(`No se encontró el contador de ${label}; se utilizó 0`);
      return 0;
    }

    const parsedValue = parseCounter(match.value);

    if (parsedValue === null) {
      const message =
        label === 'entradas'
          ? 'El contador de entradas debe ser un número entero mayor o igual a cero'
          : 'El contador de salidas debe ser un número entero mayor o igual a cero';

      throw new AppError(400, 'INVALID_COUNTER', message, {
        field: match.field,
        value: match.value
      });
    }

    return parsedValue;
  }

  private findCounterPair(payload: JsonObject): CounterPair {
    const lineTriggerData = getAtNormalizedPath(payload, ['line_trigger_data']);

    if (Array.isArray(lineTriggerData)) {
      return sumLineTriggerCounters(lineTriggerData);
    }

    for (const path of PRIORITIZED_COUNTER_PATHS) {
      const container = path.length === 0 ? payload : getAtNormalizedPath(payload, path);

      if (isPlainObject(container)) {
        const pair = findDirectCounterPair(container);

        if (pair.entradas !== undefined || pair.salidas !== undefined) {
          return pair;
        }
      }
    }

    for (const container of findNamedContainers(payload, COMMON_COUNTER_CONTAINERS, MAX_DEPTH)) {
      const pair = findDirectCounterPair(container);

      if (pair.entradas !== undefined || pair.salidas !== undefined) {
        return pair;
      }
    }

    return {};
  }
}

function sumLineTriggerCounters(items: unknown[]): CounterPair {
  let entradas = 0;
  let salidas = 0;

  for (const [index, item] of items.entries()) {
    if (!isPlainObject(item)) {
      continue;
    }

    const entrada = findDirectAlias(item, ['in']);
    const salida = findDirectAlias(item, ['out']);

    entradas += parseLineTriggerCounter(entrada, index, 'entradas');
    salidas += parseLineTriggerCounter(salida, index, 'salidas');
  }

  return {
    entradas: { field: 'line_trigger_data[].in', value: entradas },
    salidas: { field: 'line_trigger_data[].out', value: salidas }
  };
}

function parseLineTriggerCounter(
  match: AliasMatch | undefined,
  index: number,
  label: 'entradas' | 'salidas'
): number {
  if (match === undefined) {
    return 0;
  }

  const parsedValue = parseCounter(match.value);

  if (parsedValue !== null) {
    return parsedValue;
  }

  const message =
    label === 'entradas'
      ? 'El contador de entradas debe ser un número entero mayor o igual a cero'
      : 'El contador de salidas debe ser un número entero mayor o igual a cero';

  throw new AppError(400, 'INVALID_COUNTER', message, {
    field: `line_trigger_data[${index}].${match.field}`,
    value: match.value
  });
}

function findDirectCounterPair(container: JsonObject): CounterPair {
  return {
    entradas: findDirectAlias(container, ENTRADAS_ALIASES),
    salidas: findDirectAlias(container, SALIDAS_ALIASES)
  };
}

function findDirectAlias(objectValue: JsonObject, aliases: string[]): AliasMatch | undefined {
  const normalizedAliases = new Set(aliases.map(normalizeKey));

  for (const [key, value] of Object.entries(objectValue)) {
    if (normalizedAliases.has(normalizeKey(key))) {
      return { field: key, value };
    }
  }

  return undefined;
}

function findDeepAlias(root: unknown, aliases: string[], maxDepth: number): AliasMatch | null {
  const normalizedAliases = new Set(aliases.map(normalizeKey));
  const queue: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined || current.depth > maxDepth) {
      continue;
    }

    if (current.value !== null && typeof current.value === 'object') {
      if (visited.has(current.value)) {
        continue;
      }

      visited.add(current.value);
    }

    if (isPlainObject(current.value)) {
      for (const [key, value] of Object.entries(current.value)) {
        if (normalizedAliases.has(normalizeKey(key))) {
          return { field: key, value };
        }

        if (isTraversable(value)) {
          queue.push({ value, depth: current.depth + 1 });
        }
      }
    } else if (Array.isArray(current.value)) {
      for (const item of current.value) {
        if (isTraversable(item)) {
          queue.push({ value: item, depth: current.depth + 1 });
        }
      }
    }
  }

  return null;
}

function getAtNormalizedPath(root: JsonObject, path: string[]): unknown {
  let current: unknown = root;

  for (const pathPart of path) {
    if (!isPlainObject(current)) {
      return undefined;
    }

    const match = Object.entries(current).find(
      ([key]) => normalizeKey(key) === normalizeKey(pathPart)
    );

    if (match === undefined) {
      return undefined;
    }

    current = match[1];
  }

  return current;
}

function findNamedContainers(
  root: JsonObject,
  containerNames: string[],
  maxDepth: number
): JsonObject[] {
  const normalizedNames = new Set(containerNames.map(normalizeKey));
  const queue: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  const containers: JsonObject[] = [];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined || current.depth > maxDepth) {
      continue;
    }

    if (current.value !== null && typeof current.value === 'object') {
      if (visited.has(current.value)) {
        continue;
      }

      visited.add(current.value);
    }

    if (isPlainObject(current.value)) {
      for (const [key, value] of Object.entries(current.value)) {
        if (isPlainObject(value) && normalizedNames.has(normalizeKey(key))) {
          containers.push(value);
        }

        if (isTraversable(value)) {
          queue.push({ value, depth: current.depth + 1 });
        }
      }
    } else if (Array.isArray(current.value)) {
      for (const item of current.value) {
        if (isTraversable(item)) {
          queue.push({ value: item, depth: current.depth + 1 });
        }
      }
    }
  }

  return containers;
}

function parseTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    return parseUnixTimestamp(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (/^\d+$/.test(trimmed)) {
      return parseUnixTimestamp(Number(trimmed));
    }

    const parsedDate = new Date(shouldTreatAsUtcDateTime(trimmed) ? `${trimmed}Z` : trimmed);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

function parseUnixTimestamp(value: number): Date | null {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  const milliseconds = value.toString().length === 10 ? value * 1000 : value;
  const parsedDate = new Date(milliseconds);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function parseCounter(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!/^\d+$/.test(trimmed)) {
      return null;
    }

    const parsedValue = Number(trimmed);
    return Number.isSafeInteger(parsedValue) ? parsedValue : null;
  }

  return null;
}

function isValidDeviceIdentifier(value: unknown): boolean {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function shouldTreatAsUtcDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value);
}

function isPlainObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTraversable(value: unknown): boolean {
  return value !== null && typeof value === 'object';
}

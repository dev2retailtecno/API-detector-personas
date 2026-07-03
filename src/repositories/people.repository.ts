import type pg from 'pg';
import type {
  CreatePeopleCountInput,
  CreatePeopleCountResult,
  ListPeopleFilters,
  ListPeopleResult,
  PeopleCountRecord,
  PeopleRepository as PeopleRepositoryContract
} from '../types/people.types.js';

export class PeopleRepository implements PeopleRepositoryContract {
  public constructor(private readonly pool: pg.Pool) {}

  public async create(input: CreatePeopleCountInput): Promise<CreatePeopleCountResult> {
    const query = `
      INSERT INTO people_count (
        device_id,
        entradas,
        salidas,
        total,
        fecha,
        raw_payload,
        payload_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      ON CONFLICT (payload_hash) DO NOTHING
      RETURNING id, device_id, entradas, salidas, total, fecha, raw_payload, payload_hash, created_at;
    `;

    const values = [
      input.device_id,
      input.entradas,
      input.salidas,
      input.total,
      input.timestamp,
      JSON.stringify(input.raw_payload),
      input.payload_hash
    ];

    const result = await this.pool.query(query, values);

    if (result.rowCount === 0) {
      return { duplicate: true, record: null };
    }

    return {
      duplicate: false,
      record: mapRow(result.rows[0] as DatabasePeopleCountRow)
    };
  }

  public async list(filters: ListPeopleFilters): Promise<ListPeopleResult> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (filters.device_id !== undefined) {
      values.push(filters.device_id);
      where.push(`device_id = $${values.length}`);
    }

    if (filters.from !== undefined) {
      values.push(filters.from);
      where.push(`fecha >= $${values.length}`);
    }

    if (filters.to !== undefined) {
      values.push(filters.to);
      where.push(`fecha <= $${values.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.limit;

    values.push(filters.limit, offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const dataQuery = `
      SELECT id, device_id, entradas, salidas, total, fecha, raw_payload, payload_hash, created_at
      FROM people_count
      ${whereSql}
      ORDER BY fecha DESC, id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex};
    `;

    const countValues = values.slice(0, values.length - 2);
    const countQuery = `
      SELECT COUNT(*)::int AS total_items
      FROM people_count
      ${whereSql};
    `;

    const [dataResult, countResult] = await Promise.all([
      this.pool.query(dataQuery, values),
      this.pool.query(countQuery, countValues)
    ]);

    return {
      data: (dataResult.rows as DatabasePeopleCountRow[]).map(mapRow),
      totalItems: Number((countResult.rows[0] as { total_items: number }).total_items)
    };
  }

  public async findById(id: number): Promise<PeopleCountRecord | null> {
    const query = `
      SELECT id, device_id, entradas, salidas, total, fecha, raw_payload, payload_hash, created_at
      FROM people_count
      WHERE id = $1;
    `;
    const result = await this.pool.query(query, [id]);

    if (result.rowCount === 0) {
      return null;
    }

    return mapRow(result.rows[0] as DatabasePeopleCountRow);
  }

  public async healthCheck(): Promise<void> {
    await this.pool.query('SELECT 1;');
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

interface DatabasePeopleCountRow {
  id: string | number;
  device_id: string;
  entradas: number;
  salidas: number;
  total: number;
  fecha: Date | string;
  raw_payload: Record<string, unknown>;
  payload_hash: string;
  created_at: Date | string;
}

function mapRow(row: DatabasePeopleCountRow): PeopleCountRecord {
  return {
    id: Number(row.id),
    device_id: row.device_id,
    entradas: row.entradas,
    salidas: row.salidas,
    total: row.total,
    fecha: row.fecha instanceof Date ? row.fecha : new Date(row.fecha),
    raw_payload: row.raw_payload,
    payload_hash: row.payload_hash,
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at)
  };
}

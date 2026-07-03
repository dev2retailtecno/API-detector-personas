import request from 'supertest';
import { createApp } from '../../src/app.js';
import type {
  CreatePeopleCountInput,
  CreatePeopleCountResult,
  ListPeopleFilters,
  ListPeopleResult,
  PeopleCountRecord,
  PeopleRepository
} from '../../src/types/people.types.js';

describe('people routes', () => {
  it('rechaza body vacío', async () => {
    const app = createApp(new MemoryPeopleRepository());

    const response = await request(app)
      .post('/api/people')
      .set('Content-Type', 'application/json')
      .send('');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_PAYLOAD');
  });

  it('rechaza body como array', async () => {
    const app = createApp(new MemoryPeopleRepository());

    const response = await request(app).post('/api/people').send([]);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_PAYLOAD');
  });

  it('rechaza JSON malformado', async () => {
    const app = createApp(new MemoryPeopleRepository());

    const response = await request(app)
      .post('/api/people')
      .set('Content-Type', 'application/json')
      .send('{"deviceName"');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('guarda un evento nuevo sin devolver raw_payload', async () => {
    const app = createApp(new MemoryPeopleRepository());

    const response = await request(app)
      .post('/api/people')
      .send({
        devEUI: 'ABC123',
        time: '2026-06-24T15:30:00Z',
        data: {
          people_counter: {
            in: 20,
            out: 10
          }
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Datos recibidos y almacenados',
      duplicate: false,
      data: {
        id: 1,
        device_id: 'ABC123',
        timestamp: '2026-06-24T15:30:00.000Z',
        entradas: 20,
        salidas: 10,
        total: 10
      },
      warnings: []
    });
    expect(response.body.data.raw_payload).toBeUndefined();
  });

  it('marca como duplicado el mismo evento reenviado', async () => {
    const repository = new MemoryPeopleRepository();
    const app = createApp(repository);
    const payload = {
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00Z',
      in: 15,
      out: 5
    };

    await request(app).post('/api/people').send(payload).expect(200);
    const response = await request(app).post('/api/people').send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Evento recibido anteriormente',
      duplicate: true
    });
    expect(repository.records).toHaveLength(1);
  });

  it('devuelve 500 ante error controlado de PostgreSQL', async () => {
    const app = createApp(new FailingPeopleRepository());

    const response = await request(app).post('/api/people').send({
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00Z',
      in: 1,
      out: 0
    });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('lista eventos paginados', async () => {
    const repository = new MemoryPeopleRepository();
    const app = createApp(repository);

    await seed(app, 'A', '2026-06-24T15:30:00Z');
    await seed(app, 'A', '2026-06-25T15:30:00Z');
    await seed(app, 'B', '2026-06-26T15:30:00Z');

    const response = await request(app).get('/api/people?page=1&limit=2');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 2,
      total_items: 3,
      total_pages: 2
    });
    expect(response.body.data[0].device_id).toBe('B');
  });

  it('filtra por dispositivo', async () => {
    const app = createApp(new MemoryPeopleRepository());

    await seed(app, 'A', '2026-06-24T15:30:00Z');
    await seed(app, 'B', '2026-06-25T15:30:00Z');

    const response = await request(app).get('/api/people?device_id=A');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].device_id).toBe('A');
  });

  it('filtra por rango de fechas', async () => {
    const app = createApp(new MemoryPeopleRepository());

    await seed(app, 'A', '2026-06-23T15:30:00Z');
    await seed(app, 'A', '2026-06-24T15:30:00Z');
    await seed(app, 'A', '2026-06-25T15:30:00Z');

    const response = await request(app).get(
      '/api/people?from=2026-06-24T00:00:00Z&to=2026-06-24T23:59:59Z'
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].timestamp).toBe('2026-06-24T15:30:00.000Z');
  });

  it('devuelve raw_payload en consulta individual', async () => {
    const app = createApp(new MemoryPeopleRepository());

    await seed(app, 'A', '2026-06-24T15:30:00Z');
    const response = await request(app).get('/api/people/1');

    expect(response.status).toBe(200);
    expect(response.body.data.raw_payload).toMatchObject({
      deviceName: 'A'
    });
  });

  it('health db devuelve 503 si la base no está disponible', async () => {
    const app = createApp(new FailingPeopleRepository());

    const response = await request(app).get('/health/db');

    expect(response.status).toBe(503);
    expect(response.body.database).toBe('unavailable');
  });
});

async function seed(
  app: ReturnType<typeof createApp>,
  deviceId: string,
  timestamp: string
): Promise<void> {
  await request(app).post('/api/people').send({
    deviceName: deviceId,
    timestamp,
    in: 10,
    out: 2
  });
}

class MemoryPeopleRepository implements PeopleRepository {
  public readonly records: PeopleCountRecord[] = [];
  private readonly payloadHashes = new Set<string>();
  private nextId = 1;

  public async create(input: CreatePeopleCountInput): Promise<CreatePeopleCountResult> {
    if (this.payloadHashes.has(input.payload_hash)) {
      return { duplicate: true, record: null };
    }

    this.payloadHashes.add(input.payload_hash);

    const record: PeopleCountRecord = {
      id: this.nextId,
      device_id: input.device_id,
      entradas: input.entradas,
      salidas: input.salidas,
      total: input.total,
      fecha: input.timestamp,
      raw_payload: input.raw_payload,
      payload_hash: input.payload_hash,
      created_at: new Date()
    };

    this.nextId += 1;
    this.records.push(record);

    return { duplicate: false, record };
  }

  public async list(filters: ListPeopleFilters): Promise<ListPeopleResult> {
    const filtered = this.records
      .filter((record) => filters.device_id === undefined || record.device_id === filters.device_id)
      .filter((record) => filters.from === undefined || record.fecha >= filters.from)
      .filter((record) => filters.to === undefined || record.fecha <= filters.to)
      .sort((left, right) => {
        const dateDifference = right.fecha.getTime() - left.fecha.getTime();
        return dateDifference === 0 ? right.id - left.id : dateDifference;
      });

    const start = (filters.page - 1) * filters.limit;

    return {
      data: filtered.slice(start, start + filters.limit),
      totalItems: filtered.length
    };
  }

  public async findById(id: number): Promise<PeopleCountRecord | null> {
    return this.records.find((record) => record.id === id) ?? null;
  }

  public async healthCheck(): Promise<void> {
    return Promise.resolve();
  }

  public async close(): Promise<void> {
    return Promise.resolve();
  }
}

class FailingPeopleRepository extends MemoryPeopleRepository {
  public override async create(_input: CreatePeopleCountInput): Promise<CreatePeopleCountResult> {
    throw new Error('database unavailable');
  }

  public override async healthCheck(): Promise<void> {
    throw new Error('database unavailable');
  }
}

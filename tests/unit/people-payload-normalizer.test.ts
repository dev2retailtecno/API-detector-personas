import { AppError } from '../../src/errors/app-error.js';
import { PeoplePayloadNormalizerService } from '../../src/services/people-payload-normalizer.service.js';

describe('PeoplePayloadNormalizerService', () => {
  const normalizer = new PeoplePayloadNormalizerService();

  it('normaliza payload Milesight anidado', () => {
    const result = normalizer.normalize({
      devEUI: '24E124XXXXXX',
      time: '2026-06-24T15:30:00Z',
      data: {
        people_counter: {
          in: 12,
          out: 8,
          total: 99
        }
      }
    });

    expect(result).toMatchObject({
      device_id: '24E124XXXXXX',
      entradas: 12,
      salidas: 8,
      total: 4,
      warnings: []
    });
    expect(result.timestamp.toISOString()).toBe('2026-06-24T15:30:00.000Z');
  });

  it('suma una entrada de line_trigger_data', () => {
    const result = normalizer.normalize({
      line_trigger_data: [{ in: 1, out: 0 }]
    });

    expect(result).toMatchObject({ entradas: 1, salidas: 0, total: 1 });
  });

  it('suma una salida de line_trigger_data', () => {
    const result = normalizer.normalize({
      line_trigger_data: [{ in: 0, out: 1 }]
    });

    expect(result).toMatchObject({ entradas: 0, salidas: 1, total: -1 });
  });

  it('no cuenta group_in ni group_out como personas', () => {
    const result = normalizer.normalize({
      line_trigger_data: [{ in: 0, out: 0, group_in: 1, group_out: 2 }]
    });

    expect(result).toMatchObject({ entradas: 0, salidas: 0, total: 0 });
  });

  it('suma entradas y salidas de múltiples líneas', () => {
    const result = normalizer.normalize({
      line_trigger_data: [
        { in: 1, out: 0 },
        { in: 2, out: 1 }
      ]
    });

    expect(result).toMatchObject({ entradas: 3, salidas: 1, total: 2 });
  });

  it('prioriza device_info.device_sn sobre device_name', () => {
    const result = normalizer.normalize({
      device_info: {
        device_sn: '6767E42214440033',
        device_name: 'People Counter'
      },
      line_trigger_data: [{ in: 1, out: 0 }]
    });

    expect(result.device_id).toBe('6767E42214440033');
  });

  it('mantiene compatibilidad con data.people_counter', () => {
    const result = normalizer.normalize({
      data: {
        people_counter: {
          in: 5,
          out: 2
        }
      }
    });

    expect(result).toMatchObject({ entradas: 5, salidas: 2, total: 3 });
  });

  it('preserva completo el payload real de Milesight y su timestamp', () => {
    const payload = {
      time_info: { time: '2026-09-23T11:52:25-06:00' },
      device_info: {
        device_sn: '6767E42214440033',
        device_name: 'People Counter'
      },
      line_trigger_data: [
        {
          in: 1,
          out: 0,
          group_in: 0,
          staff_in: 0,
          children_in: 0,
          line_name: 'Line1',
          line_uuid: 'ef4e5cd0-69c9-48a7-99f8-63f1553fd13c'
        }
      ]
    };

    const result = normalizer.normalize(payload);

    expect(result.timestamp.toISOString()).toBe('2026-09-23T17:52:25.000Z');
    expect(result.raw_payload).toBe(payload);
  });

  it('normaliza payload simple', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00',
      in: 15,
      out: 5
    });

    expect(result.device_id).toBe('VS135-P');
    expect(result.timestamp.toISOString()).toBe('2026-06-24T15:30:00.000Z');
    expect(result.entradas).toBe(15);
    expect(result.salidas).toBe(5);
    expect(result.total).toBe(10);
  });

  it('interpreta timestamp Unix en segundos', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: 1719239400,
      in: 20,
      out: 7
    });

    expect(result.timestamp.toISOString()).toBe('2024-06-24T14:30:00.000Z');
  });

  it('interpreta timestamp Unix en milisegundos', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: 1719239400000,
      in: 20,
      out: 7
    });

    expect(result.timestamp.toISOString()).toBe('2024-06-24T14:30:00.000Z');
  });

  it('interpreta timestamp Unix enviado como string', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: '1719239400',
      in: 20,
      out: 7
    });

    expect(result.timestamp.toISOString()).toBe('2024-06-24T14:30:00.000Z');
  });

  it('acepta contadores enviados como strings numéricos', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00Z',
      in: '12',
      out: '8'
    });

    expect(result.entradas).toBe(12);
    expect(result.salidas).toBe(8);
  });

  it('ignora campos adicionales y preserva raw_payload', () => {
    const payload = {
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00Z',
      in: 1,
      out: 0,
      extra: { firmware: 'x' }
    };

    const result = normalizer.normalize(payload);

    expect(result.raw_payload).toBe(payload);
    expect(result.total).toBe(1);
  });

  it('usa unknown si no encuentra device_id', () => {
    const result = normalizer.normalize({
      timestamp: '2026-06-24T15:30:00Z',
      in: 1,
      out: 0
    });

    expect(result.device_id).toBe('unknown');
    expect(result.warnings).toContain(
      'No se encontró el identificador del dispositivo; se utilizó unknown'
    );
  });

  it('usa fecha actual si no encuentra timestamp', () => {
    const before = Date.now();
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      in: 1,
      out: 0
    });
    const after = Date.now();

    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.timestamp.getTime()).toBeLessThanOrEqual(after);
    expect(result.warnings).toContain(
      'No se encontró un timestamp válido; se utilizó la fecha actual del servidor'
    );
  });

  it('usa cero si no encuentra entradas', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00Z',
      out: 3
    });

    expect(result.entradas).toBe(0);
    expect(result.total).toBe(-3);
    expect(result.warnings).toContain('No se encontró el contador de entradas; se utilizó 0');
  });

  it('usa cero si no encuentra salidas', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00Z',
      in: 3
    });

    expect(result.salidas).toBe(0);
    expect(result.total).toBe(3);
    expect(result.warnings).toContain('No se encontró el contador de salidas; se utilizó 0');
  });

  it('calcula total aunque el dispositivo envíe otro valor', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00Z',
      in: 20,
      out: 7,
      total: 999
    });

    expect(result.total).toBe(13);
  });

  it('acepta entrada con valor cero', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00Z',
      in: 0,
      out: 2
    });

    expect(result.entradas).toBe(0);
  });

  it('acepta salida con valor cero', () => {
    const result = normalizer.normalize({
      deviceName: 'VS135-P',
      timestamp: '2026-06-24T15:30:00Z',
      in: 2,
      out: 0
    });

    expect(result.salidas).toBe(0);
  });

  it.each([
    { value: -1, label: 'número negativo' },
    { value: 1.5, label: 'número decimal' },
    { value: 'abc', label: 'string no numérico' }
  ])('rechaza contador inválido: $label', ({ value }) => {
    expect(() =>
      normalizer.normalize({
        deviceName: 'VS135-P',
        timestamp: '2026-06-24T15:30:00Z',
        in: value,
        out: 0
      })
    ).toThrow(AppError);
  });

  it('reconoce alias con mayúsculas, guiones y camelCase', () => {
    const result = normalizer.normalize({
      serial_number: 'SN-1',
      event_time: '2026-06-24T15:30:00Z',
      data: {
        counter: {
          PeopleIn: '6',
          'people-out': '4'
        }
      }
    });

    expect(result.device_id).toBe('SN-1');
    expect(result.entradas).toBe(6);
    expect(result.salidas).toBe(4);
    expect(result.total).toBe(2);
  });
});

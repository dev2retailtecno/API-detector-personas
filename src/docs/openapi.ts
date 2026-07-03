import type { OpenAPIV3 } from 'openapi-types';

export const openApiDocument: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'API Detector Personas',
    version: '1.0.0',
    description: 'Webhook para recibir conteos de personas desde dispositivos Milesight VS135-P.'
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Desarrollo local'
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Opcional. Solo se exige si PEOPLE_API_KEY tiene valor.'
      }
    },
    schemas: {
      PeopleResponse: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          device_id: { type: 'string', example: 'ABC123' },
          timestamp: { type: 'string', format: 'date-time' },
          entradas: { type: 'integer', example: 20 },
          salidas: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 10 }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INVALID_PAYLOAD' },
              message: { type: 'string', example: 'El cuerpo debe ser un objeto JSON' }
            }
          }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check general',
        responses: {
          '200': {
            description: 'Servicio disponible'
          }
        }
      }
    },
    '/health/db': {
      get: {
        summary: 'Health check de PostgreSQL',
        responses: {
          '200': { description: 'Base de datos disponible' },
          '503': { description: 'Base de datos no disponible' }
        }
      }
    },
    '/api/people': {
      post: {
        summary: 'Recibir evento de conteo de personas',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              },
              examples: {
                milesightAnidado: {
                  summary: 'Milesight anidado',
                  value: {
                    devEUI: '24E124XXXXXX',
                    time: '2026-06-24T15:30:00Z',
                    data: {
                      people_counter: {
                        in: 12,
                        out: 8,
                        total: 4
                      }
                    }
                  }
                },
                simple: {
                  summary: 'Formato simple',
                  value: {
                    deviceName: 'VS135-P',
                    timestamp: '2026-06-24T15:30:00',
                    in: 15,
                    out: 5
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Evento recibido'
          },
          '400': {
            description: 'Payload inválido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      },
      get: {
        summary: 'Listar eventos normalizados',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'device_id', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } }
        ],
        responses: {
          '200': {
            description: 'Listado paginado'
          }
        }
      }
    },
    '/api/people/{id}': {
      get: {
        summary: 'Consultar un evento por id',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 1 }
          }
        ],
        responses: {
          '200': {
            description: 'Evento encontrado, incluyendo raw_payload'
          },
          '404': {
            description: 'Evento no encontrado'
          }
        }
      }
    }
  }
};

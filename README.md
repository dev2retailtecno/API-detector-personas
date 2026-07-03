# API Detector Personas

API webhook para recibir, normalizar y almacenar conteos de personas enviados por dispositivos Milesight VS135-P.

Expone `POST /api/people`, conserva el `raw_payload` original en PostgreSQL y calcula siempre:

```text
total = entradas - salidas
```

## Arquitectura

- `controllers`: validan entrada HTTP y construyen respuestas.
- `services`: normalización, reglas de negocio y cálculo de hash.
- `repositories`: acceso a PostgreSQL con `pg` y consultas parametrizadas.
- `middlewares`: errores, API key opcional, rutas no encontradas.
- `docs`: especificación OpenAPI usada por Swagger UI.
- `migrations`: SQL versionado para la tabla `people_count`.

No se usa ORM. La API usa TypeScript, Express, PostgreSQL, Zod, Pino, Vitest, Supertest, Docker y Swagger.

## Requisitos

- Node.js 20 o superior.
- npm.
- PostgreSQL 14 o superior, o Docker Compose.

## Configuración local

```bash
npm install
cp .env.example .env
```

Edita `.env` si necesitas cambiar la conexión:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/people_detector
DATABASE_SSL=false
PEOPLE_API_KEY=
```

`PEOPLE_API_KEY` es opcional. Si está vacío, los endpoints `/api/people` son públicos. Si tiene valor, se exige:

```http
X-API-Key: valor-configurado
```

## Base de datos y migraciones

Crea la base si trabajas sin Docker:

```bash
createdb people_detector
npm run migrate
```

La migración crea `people_count`, índices para consultas por dispositivo y fecha, y una restricción única sobre `payload_hash` para evitar duplicados.

## Desarrollo

```bash
npm run dev
```

La API queda en:

```text
http://localhost:3000
```

## Docker

```bash
docker compose up --build
```

Esto levanta PostgreSQL, espera su health check, ejecuta migraciones automáticamente y arranca la API.

## Endpoints

- `POST /api/people`: recibe eventos del VS135-P.
- `GET /api/people`: lista eventos sin `raw_payload`.
- `GET /api/people/:id`: consulta un evento con `raw_payload`.
- `GET /health`: health check general.
- `GET /health/db`: verifica PostgreSQL con `SELECT 1;`.
- `GET /docs`: Swagger UI.
- `GET /docs.json`: OpenAPI en JSON.

## Filtros del listado

`GET /api/people` acepta:

- `page`: predeterminado `1`.
- `limit`: predeterminado `20`, máximo `100`.
- `device_id`.
- `from`: fecha ISO 8601.
- `to`: fecha ISO 8601.

Ordena por `fecha DESC, id DESC`.

## Payloads soportados

Formato Milesight anidado:

```json
{
  "devEUI": "24E124XXXXXX",
  "time": "2026-06-24T15:30:00Z",
  "data": {
    "people_counter": {
      "in": 12,
      "out": 8,
      "total": 4
    }
  }
}
```

Formato simple:

```json
{
  "deviceName": "VS135-P",
  "timestamp": "2026-06-24T15:30:00",
  "in": 15,
  "out": 5
}
```

Timestamp Unix:

```json
{
  "deviceName": "VS135-P",
  "timestamp": 1719239400,
  "in": "25",
  "out": "8"
}
```

Un Unix timestamp de 10 dígitos se interpreta como segundos. Uno de 13 dígitos se interpreta como milisegundos.

## Pruebas manuales con curl

Caso Milesight:

```bash
curl -X POST http://localhost:3000/api/people \
  -H "Content-Type: application/json" \
  -d '{
    "devEUI": "ABC123",
    "time": "2026-06-24T15:30:00Z",
    "data": {
      "people_counter": {
        "in": 20,
        "out": 10
      }
    }
  }'
```

Caso simple:

```bash
curl -X POST http://localhost:3000/api/people \
  -H "Content-Type: application/json" \
  -d '{
    "deviceName": "VS135-P",
    "timestamp": "2026-06-24T15:30:00",
    "in": 15,
    "out": 5
  }'
```

Timestamp Unix:

```bash
curl -X POST http://localhost:3000/api/people \
  -H "Content-Type: application/json" \
  -d '{
    "deviceName": "VS135-P",
    "timestamp": 1719239400,
    "in": "25",
    "out": "8"
  }'
```

Si usas API key:

```bash
curl -X GET http://localhost:3000/api/people \
  -H "X-API-Key: valor-configurado"
```

## Cuerpos para Postman

POST `http://localhost:3000/api/people`

Headers:

```text
Content-Type: application/json
X-API-Key: valor-configurado
```

Body Milesight:

```json
{
  "devEUI": "ABC123",
  "time": "2026-06-24T15:30:00Z",
  "data": {
    "people_counter": {
      "in": 20,
      "out": 10
    }
  }
}
```

Body simple:

```json
{
  "deviceName": "VS135-P",
  "timestamp": "2026-06-24T15:30:00",
  "in": 15,
  "out": 5
}
```

Body Unix:

```json
{
  "deviceName": "VS135-P",
  "timestamp": 1719239400,
  "in": "25",
  "out": "8"
}
```

## Respuestas

Evento nuevo:

```json
{
  "success": true,
  "message": "Datos recibidos y almacenados",
  "duplicate": false,
  "data": {
    "id": 1,
    "device_id": "ABC123",
    "timestamp": "2026-06-24T15:30:00.000Z",
    "entradas": 20,
    "salidas": 10,
    "total": 10
  },
  "warnings": []
}
```

Evento duplicado:

```json
{
  "success": true,
  "message": "Evento recibido anteriormente",
  "duplicate": true,
  "warnings": []
}
```

Contador inválido:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_COUNTER",
    "message": "El contador de entradas debe ser un número entero mayor o igual a cero",
    "details": {
      "field": "in",
      "value": "abc"
    }
  }
}
```

## Configurar Milesight VS135-P

Configura el envío HTTP/HTTPS del dispositivo hacia:

```text
http://localhost:3000/api/people
```

En producción la URL debe ser similar a:

```text
https://dominio-del-servidor.com/api/people
```

Usa HTTPS mediante un proxy inverso o la plataforma de despliegue. Si configuras `PEOPLE_API_KEY`, agrega el header `X-API-Key` en el webhook del dispositivo o en el gateway que reenvíe los eventos.

## Pruebas y calidad

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Las pruebas unitarias cubren normalización de payloads y validación de contadores. Las pruebas de integración usan un repositorio en memoria, por lo que no requieren una base externa.

## Agregar nuevos alias

Edita `src/services/people-payload-normalizer.service.ts` y agrega el alias en la lista correspondiente:

- `DEVICE_ALIASES`
- `TIMESTAMP_ALIASES`
- `ENTRADAS_ALIASES`
- `SALIDAS_ALIASES`
- `COMMON_COUNTER_CONTAINERS`

La comparación ignora mayúsculas, guiones, guiones bajos y diferencias comunes de camelCase.

## Problemas comunes

- `DATABASE_URL` inválida: revisa usuario, contraseña, host y base de datos.
- `GET /health/db` devuelve `503`: PostgreSQL no está disponible o la URL no apunta al contenedor correcto.
- Evento duplicado: es esperado si el dispositivo reenvía exactamente el mismo payload normalizado.
- `INVALID_JSON`: el body no es JSON válido.
- `INVALID_PAYLOAD`: el body está vacío, es un array o es un valor primitivo.

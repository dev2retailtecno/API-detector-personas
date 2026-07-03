CREATE TABLE IF NOT EXISTS people_count (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(150) NOT NULL DEFAULT 'unknown',
    entradas INTEGER NOT NULL DEFAULT 0,
    salidas INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    fecha TIMESTAMPTZ NOT NULL,
    raw_payload JSONB NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_people_count_entradas
        CHECK (entradas >= 0),

    CONSTRAINT chk_people_count_salidas
        CHECK (salidas >= 0),

    CONSTRAINT uq_people_count_payload_hash
        UNIQUE (payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_people_count_device_fecha
    ON people_count (device_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_people_count_fecha
    ON people_count (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_people_count_created_at
    ON people_count (created_at DESC);

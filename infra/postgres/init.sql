CREATE TABLE IF NOT EXISTS events (
    id           UUID PRIMARY KEY,
    tenant_id    VARCHAR(50) NOT NULL,
    type         VARCHAR(50) NOT NULL,
    payload      JSONB NOT NULL DEFAULT '{}',
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    retry_count  INT NOT NULL DEFAULT 0,
    processed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
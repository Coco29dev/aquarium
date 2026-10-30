-- Up Migration

-- Déjà créée en phase 0 sur la production : IF NOT EXISTS pour rester idempotent.
CREATE TABLE IF NOT EXISTS push_subscriptions (
	id              BIGSERIAL PRIMARY KEY,
	endpoint        TEXT NOT NULL UNIQUE,
	p256dh          TEXT NOT NULL,
	auth            TEXT NOT NULL,
	user_agent      TEXT,
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_success_at TIMESTAMPTZ,
	last_error      TEXT
);

CREATE TABLE aquariums (
	id         SERIAL PRIMARY KEY,
	name       TEXT NOT NULL,
	water_type TEXT NOT NULL CHECK (water_type IN ('douce', 'plantee', 'mer', 'recif')),
	volume_l   NUMERIC,
	started_on DATE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE parameter_defs (
	id             SERIAL PRIMARY KEY,
	aquarium_id    INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	key            TEXT,
	name           TEXT NOT NULL,
	unit           TEXT NOT NULL DEFAULT '',
	min_value      NUMERIC,
	max_value      NUMERIC,
	drift_per_week NUMERIC,
	decimals       SMALLINT NOT NULL DEFAULT 1,
	step           NUMERIC NOT NULL DEFAULT 0.1,
	position       INT NOT NULL DEFAULT 0,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX parameter_defs_aquarium_idx ON parameter_defs (aquarium_id, position);

CREATE TABLE measurements (
	id           SERIAL PRIMARY KEY,
	aquarium_id  INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	parameter_id INT NOT NULL REFERENCES parameter_defs (id) ON DELETE CASCADE,
	value        NUMERIC NOT NULL,
	measured_at  TIMESTAMPTZ NOT NULL,
	client_id    UUID UNIQUE,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX measurements_param_idx ON measurements (parameter_id, measured_at DESC);

CREATE TABLE recurring_tasks (
	id          SERIAL PRIMARY KEY,
	aquarium_id INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	title       TEXT NOT NULL,
	kind        TEXT NOT NULL DEFAULT 'autre',
	every_days  INT NOT NULL CHECK (every_days > 0),
	next_due    DATE NOT NULL,
	active      BOOLEAN NOT NULL DEFAULT true,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_completions (
	id        SERIAL PRIMARY KEY,
	task_id   INT NOT NULL REFERENCES recurring_tasks (id) ON DELETE CASCADE,
	done_at   TIMESTAMPTZ NOT NULL,
	note      TEXT,
	client_id UUID UNIQUE
);
CREATE INDEX task_completions_task_idx ON task_completions (task_id, done_at DESC);

-- Petit magasin clé/valeur serveur (ex. dernier jour de rappel envoyé).
CREATE TABLE app_state (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

-- Down Migration

DROP TABLE IF EXISTS app_state;
DROP TABLE IF EXISTS task_completions;
DROP TABLE IF EXISTS recurring_tasks;
DROP TABLE IF EXISTS measurements;
DROP TABLE IF EXISTS parameter_defs;
DROP TABLE IF EXISTS aquariums;

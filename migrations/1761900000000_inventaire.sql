-- Up Migration

CREATE TABLE inhabitants (
	id          SERIAL PRIMARY KEY,
	aquarium_id INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	kind        TEXT NOT NULL CHECK (kind IN ('faune', 'flore')),
	species     TEXT NOT NULL,
	quantity    INT NOT NULL DEFAULT 1 CHECK (quantity >= 0),
	arrived_on  DATE,
	left_on     DATE,
	notes       TEXT,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inhabitants_aquarium_idx ON inhabitants (aquarium_id);

CREATE TABLE equipment (
	id             SERIAL PRIMARY KEY,
	aquarium_id    INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	name           TEXT NOT NULL,
	category       TEXT NOT NULL DEFAULT 'autre',
	purchased_on   DATE,
	price          NUMERIC(10, 2),
	warranty_until DATE,
	notes          TEXT,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX equipment_aquarium_idx ON equipment (aquarium_id);

CREATE TABLE consumables (
	id                 SERIAL PRIMARY KEY,
	equipment_id       INT NOT NULL REFERENCES equipment (id) ON DELETE CASCADE,
	name               TEXT NOT NULL,
	installed_on       DATE,
	replace_every_days INT CHECK (replace_every_days IS NULL OR replace_every_days > 0),
	notes              TEXT,
	created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX consumables_equipment_idx ON consumables (equipment_id);

CREATE TABLE expenses (
	id          SERIAL PRIMARY KEY,
	aquarium_id INT REFERENCES aquariums (id) ON DELETE SET NULL,
	label       TEXT NOT NULL,
	category    TEXT NOT NULL DEFAULT 'autre',
	amount      NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
	spent_on    DATE NOT NULL DEFAULT CURRENT_DATE,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX expenses_date_idx ON expenses (spent_on DESC);

CREATE TABLE notes (
	id          SERIAL PRIMARY KEY,
	aquarium_id INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	body        TEXT NOT NULL,
	noted_on    DATE NOT NULL DEFAULT CURRENT_DATE,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notes_aquarium_idx ON notes (aquarium_id, noted_on DESC);

CREATE TABLE photos (
	id           SERIAL PRIMARY KEY,
	aquarium_id  INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	storage_key  TEXT NOT NULL UNIQUE,
	content_type TEXT NOT NULL,
	bytes        INT NOT NULL,
	caption      TEXT,
	taken_on     DATE NOT NULL DEFAULT CURRENT_DATE,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX photos_aquarium_idx ON photos (aquarium_id, taken_on DESC);

-- Down Migration

DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS consumables;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS inhabitants;

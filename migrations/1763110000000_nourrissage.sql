-- Up Migration

-- Journal de nourrissage : un enregistrement par repas, pour le compteur du jour et l'alerte de suralimentation.
CREATE TABLE feedings (
	id          SERIAL PRIMARY KEY,
	aquarium_id INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	fed_at      TIMESTAMPTZ NOT NULL,
	note        TEXT NULL,
	client_id   UUID UNIQUE NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX feedings_aquarium_fed_idx ON feedings (aquarium_id, fed_at DESC);

-- Nombre de repas par jour visé pour ce bac (NULL : pas de consigne).
ALTER TABLE aquariums
	ADD COLUMN feedings_per_day INT NULL CHECK (feedings_per_day IS NULL OR (feedings_per_day BETWEEN 1 AND 10));

-- Down Migration

ALTER TABLE aquariums DROP COLUMN IF EXISTS feedings_per_day;
DROP TABLE IF EXISTS feedings;

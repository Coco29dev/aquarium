-- Up Migration

-- Étape de vie d'un bac : en projet (pas encore en eau), en cyclage, actif.
ALTER TABLE aquariums
	ADD COLUMN stage TEXT NOT NULL DEFAULT 'actif' CHECK (stage IN ('projet', 'cyclage', 'actif'));

-- Liste de projet d'un bac pas encore en eau : matériel, espèces souhaitées, budget, étapes.
CREATE TABLE project_items (
	id          SERIAL PRIMARY KEY,
	aquarium_id INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	kind        TEXT NOT NULL CHECK (kind IN ('equipement', 'espece', 'budget', 'etape')),
	label       TEXT NOT NULL,
	done        BOOLEAN NOT NULL DEFAULT false,
	amount      NUMERIC(10, 2),
	species_id  INT REFERENCES species (id) ON DELETE SET NULL,
	notes       TEXT,
	position    INT NOT NULL DEFAULT 0,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_items_aquarium_idx ON project_items (aquarium_id, position, id);

-- Down Migration

DROP TABLE IF EXISTS project_items;
ALTER TABLE aquariums DROP COLUMN IF EXISTS stage;

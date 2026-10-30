-- Up Migration

-- Table d'espèces : colonnes « scientifiques » alimentées par l'import FishBase / SeaLifeBase,
-- colonnes « élevage » saisies à la main (jamais écrasées par un nouvel import).
CREATE TABLE species (
	id              SERIAL PRIMARY KEY,
	source          TEXT NOT NULL CHECK (source IN ('fishbase', 'sealifebase', 'maison')),
	source_code     INT,
	scientific_name TEXT NOT NULL,
	name_fr         TEXT,
	name_en         TEXT,
	kind            TEXT NOT NULL CHECK (kind IN ('poisson', 'corail', 'invertebre', 'plante', 'autre')),
	fresh           BOOLEAN NOT NULL DEFAULT false,
	brackish        BOOLEAN NOT NULL DEFAULT false,
	salt            BOOLEAN NOT NULL DEFAULT false,
	max_length_cm   NUMERIC,
	lifespan_years  NUMERIC,
	-- Élevage (modifiable) ; null = inconnu
	temp_min        NUMERIC,
	temp_max        NUMERIC,
	ph_min          NUMERIC,
	ph_max          NUMERIC,
	min_tank_l      INT,
	temperament     TEXT CHECK (temperament IN ('paisible', 'semi-agressif', 'agressif')),
	diet            TEXT CHECK (diet IN ('carnivore', 'omnivore', 'herbivore', 'filtreur', 'autre')),
	zone            TEXT CHECK (zone IN ('haut', 'milieu', 'bas', 'tous')),
	group_min       INT CHECK (group_min IS NULL OR group_min >= 1),
	reef_safe       BOOLEAN,
	bioload_g       NUMERIC CHECK (bioload_g IS NULL OR bioload_g >= 0),
	notes           TEXT,
	-- Champs de l'élevage déduits de FishBase (zone, régime, banc) : à confirmer.
	estimated       TEXT[] NOT NULL DEFAULT '{}',
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX species_source_code_idx ON species (source, source_code) WHERE source_code IS NOT NULL;
CREATE INDEX species_sci_idx ON species (lower(scientific_name));

ALTER TABLE inhabitants ADD COLUMN species_id INT REFERENCES species (id) ON DELETE SET NULL;
CREATE INDEX inhabitants_species_idx ON inhabitants (species_id);

ALTER TABLE consumables ADD COLUMN unit_price NUMERIC(10, 2) CHECK (unit_price IS NULL OR unit_price >= 0);

-- Historique des remplacements : sert à calculer la durée de vie réelle.
CREATE TABLE consumable_replacements (
	id            SERIAL PRIMARY KEY,
	consumable_id INT NOT NULL REFERENCES consumables (id) ON DELETE CASCADE,
	installed_on  DATE NOT NULL,
	replaced_on   DATE NOT NULL,
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
	CHECK (replaced_on >= installed_on)
);
CREATE INDEX consumable_replacements_idx ON consumable_replacements (consumable_id, replaced_on DESC);

-- Down Migration

DROP TABLE IF EXISTS consumable_replacements;
ALTER TABLE consumables DROP COLUMN IF EXISTS unit_price;
ALTER TABLE inhabitants DROP COLUMN IF EXISTS species_id;
DROP TABLE IF EXISTS species;

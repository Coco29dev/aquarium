-- Up Migration

-- Fiches enrichies : provenance, difficulté d'entretien, conseils d'entretien (texte libre) et, pour
-- les plantes, besoin de lumière et de CO2. Toutes optionnelles : l'import FishBase n'en renseigne aucune.
ALTER TABLE species
	ADD COLUMN origin     TEXT,
	ADD COLUMN difficulty SMALLINT CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 3),
	ADD COLUMN care       TEXT,
	ADD COLUMN light      SMALLINT CHECK (light IS NULL OR light BETWEEN 1 AND 3),
	ADD COLUMN co2        SMALLINT CHECK (co2 IS NULL OR co2 BETWEEN 0 AND 2);

-- Down Migration

ALTER TABLE species
	DROP COLUMN IF EXISTS co2,
	DROP COLUMN IF EXISTS light,
	DROP COLUMN IF EXISTS care,
	DROP COLUMN IF EXISTS difficulty,
	DROP COLUMN IF EXISTS origin;

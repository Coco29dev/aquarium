-- Up Migration

ALTER TABLE species DROP CONSTRAINT species_source_check;
ALTER TABLE species ADD CONSTRAINT species_source_check
	CHECK (source IN ('fishbase', 'sealifebase', 'maison', 'noyau'));

ALTER TABLE species
	ADD COLUMN description   TEXT,
	-- Espèce du « noyau » encyclopédique (ou ajoutée à la main) : visible par défaut.
	ADD COLUMN curated       BOOLEAN NOT NULL DEFAULT false,
	-- 'claude' : fiche rédigée par Claude, à vérifier ; 'verifie' : confirmée par toi.
	ADD COLUMN data_quality  TEXT CHECK (data_quality IN ('claude', 'verifie')),
	-- Champs modifiés à la main : un nouvel import du noyau ne les écrase jamais.
	ADD COLUMN locked        TEXT[] NOT NULL DEFAULT '{}',
	ADD COLUMN photo_key     TEXT,
	ADD COLUMN photo_source  TEXT,
	ADD COLUMN photo_author  TEXT,
	ADD COLUMN photo_license TEXT;

UPDATE species SET curated = true WHERE source = 'maison';
CREATE INDEX species_curated_idx ON species (curated) WHERE curated;
CREATE UNIQUE INDEX species_noyau_name_idx ON species (lower(scientific_name)) WHERE source = 'noyau';

-- Down Migration

DROP INDEX IF EXISTS species_noyau_name_idx;
DROP INDEX IF EXISTS species_curated_idx;
ALTER TABLE species
	DROP COLUMN IF EXISTS photo_license, DROP COLUMN IF EXISTS photo_author, DROP COLUMN IF EXISTS photo_source,
	DROP COLUMN IF EXISTS photo_key, DROP COLUMN IF EXISTS locked, DROP COLUMN IF EXISTS data_quality,
	DROP COLUMN IF EXISTS curated, DROP COLUMN IF EXISTS description;
DELETE FROM species WHERE source = 'noyau';
ALTER TABLE species DROP CONSTRAINT species_source_check;
ALTER TABLE species ADD CONSTRAINT species_source_check CHECK (source IN ('fishbase', 'sealifebase', 'maison'));

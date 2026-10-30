-- Up Migration

-- Photo de couverture d'un bac (en-tête de sa fiche).
ALTER TABLE aquariums
	ADD COLUMN cover_photo_id INT NULL REFERENCES photos (id) ON DELETE SET NULL;

-- Down Migration

ALTER TABLE aquariums DROP COLUMN IF EXISTS cover_photo_id;

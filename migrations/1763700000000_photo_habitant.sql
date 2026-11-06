-- Up Migration

-- Photo personnelle d'un habitant (propre à la fiche du bac : la fiche d'espèce n'est jamais modifiée).
-- Le fichier vit dans le bucket, comme les photos du bac.
ALTER TABLE inhabitants ADD COLUMN photo_key TEXT, ADD COLUMN photo_type TEXT;

-- Down Migration

ALTER TABLE inhabitants DROP COLUMN IF EXISTS photo_type, DROP COLUMN IF EXISTS photo_key;

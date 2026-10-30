-- Up Migration

ALTER TABLE project_items DROP CONSTRAINT IF EXISTS project_items_kind_check;
ALTER TABLE project_items ADD CONSTRAINT project_items_kind_check CHECK (kind IN ('equipement', 'espece', 'plante', 'budget', 'etape'));

-- Down Migration

DELETE FROM project_items WHERE kind = 'plante';
ALTER TABLE project_items DROP CONSTRAINT IF EXISTS project_items_kind_check;
ALTER TABLE project_items ADD CONSTRAINT project_items_kind_check CHECK (kind IN ('equipement', 'espece', 'budget', 'etape'));

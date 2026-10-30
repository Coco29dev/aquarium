-- Up Migration

-- Temps d'attente du réactif d'un test (secondes), pour le minuteur du pas à pas. Repère modifiable.
ALTER TABLE parameter_defs ADD COLUMN test_wait_seconds INT CHECK (test_wait_seconds IS NULL OR test_wait_seconds BETWEEN 5 AND 3600);

-- Repère générique de 5 minutes pour les tests colorimétriques du cycle de l'azote (modifiable ensuite).
UPDATE parameter_defs SET test_wait_seconds = 300 WHERE key IN ('nh3', 'no2', 'no3') AND test_wait_seconds IS NULL;

-- Down Migration

ALTER TABLE parameter_defs DROP COLUMN IF EXISTS test_wait_seconds;

-- Up Migration

-- Journal d'événements typés par bac : changement d'eau, dosage, réglage d'éclairage ou de CO₂,
-- ajout ou départ d'un habitant, étape. Le détail propre à chaque type vit dans payload (JSONB) ;
-- le schéma est documenté et validé dans src/lib/domain/events.ts.
CREATE TABLE events (
	id          SERIAL PRIMARY KEY,
	aquarium_id INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	kind        TEXT NOT NULL,
	at          TIMESTAMPTZ NOT NULL,
	payload     JSONB NOT NULL DEFAULT '{}',
	note        TEXT NULL,
	source      TEXT NOT NULL DEFAULT 'manuel' CHECK (source IN ('manuel', 'tache', 'auto')),
	source_ref  INT NULL,
	client_id   UUID UNIQUE NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_aquarium_at_idx ON events (aquarium_id, at DESC);
-- Un événement automatique n'existe qu'une fois pour sa source (idempotence des rejeux).
CREATE UNIQUE INDEX events_source_ref_idx ON events (source, source_ref, kind)
	WHERE source_ref IS NOT NULL AND source <> 'manuel';

-- Supprimer une réalisation de tâche supprime l'événement qu'elle avait créé.
CREATE FUNCTION events_drop_with_completion() RETURNS trigger AS $$
BEGIN
	DELETE FROM events WHERE source = 'tache' AND source_ref = OLD.id;
	RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_completions_drop_event
	AFTER DELETE ON task_completions
	FOR EACH ROW EXECUTE FUNCTION events_drop_with_completion();

-- Rétro-remplissage : les changements d'eau passés (tâches de type « eau »)...
INSERT INTO events (aquarium_id, kind, at, payload, source, source_ref)
SELECT t.aquarium_id, 'changement_eau', c.done_at, '{}'::jsonb, 'tache', c.id
FROM task_completions c
JOIN recurring_tasks t ON t.id = c.task_id
WHERE t.kind = 'eau';

-- ... et les arrivées et départs d'habitants (à midi, heure de Paris : on ne connaît que le jour).
INSERT INTO events (aquarium_id, kind, at, payload, source, source_ref)
SELECT i.aquarium_id, 'habitant_ajout',
       (i.arrived_on::timestamp + interval '12 hours') AT TIME ZONE 'Europe/Paris',
       jsonb_build_object('species', i.species, 'quantity', i.quantity), 'auto', i.id
FROM inhabitants i
WHERE i.arrived_on IS NOT NULL;

INSERT INTO events (aquarium_id, kind, at, payload, source, source_ref)
SELECT i.aquarium_id, 'habitant_depart',
       (i.left_on::timestamp + interval '12 hours') AT TIME ZONE 'Europe/Paris',
       jsonb_build_object('species', i.species, 'quantity', i.quantity), 'auto', i.id
FROM inhabitants i
WHERE i.left_on IS NOT NULL;

-- Down Migration

DROP TRIGGER IF EXISTS task_completions_drop_event ON task_completions;
DROP FUNCTION IF EXISTS events_drop_with_completion();
DROP TABLE IF EXISTS events;

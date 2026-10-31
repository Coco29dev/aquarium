-- Up Migration

-- Conversation de l'assistant : un fil par aquarium. `content` est le JSON des blocs de contenu de
-- l'API Claude (texte, appels d'outils, résultats), rejoué tel quel à chaque tour : on ne modifie
-- jamais un message déjà écrit. En texte et non en JSONB : un tableau JSON passerait pour un tableau
-- Postgres à la restauration d'une sauvegarde.
CREATE TABLE chat_messages (
	id          SERIAL PRIMARY KEY,
	aquarium_id INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
	content     TEXT NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_aquarium_idx ON chat_messages (aquarium_id, id);

-- Down Migration

DROP TABLE IF EXISTS chat_messages;

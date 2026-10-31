-- Up Migration

-- Conversations de l'assistant : plusieurs par bac, avec un titre (proposé automatiquement puis
-- modifiable). Les messages existants sont rattachés à une conversation par bac. thread_id reste
-- nullable : une restauration d'une ancienne sauvegarde peut en laisser sans conversation, le serveur
-- les rattache alors à une conversation créée pour eux.
CREATE TABLE chat_threads (
	id          SERIAL PRIMARY KEY,
	aquarium_id INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	title       TEXT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_threads_aquarium_idx ON chat_threads (aquarium_id, updated_at DESC);

ALTER TABLE chat_messages ADD COLUMN thread_id INT NULL REFERENCES chat_threads (id) ON DELETE CASCADE;
CREATE INDEX chat_messages_thread_idx ON chat_messages (thread_id, id);

INSERT INTO chat_threads (aquarium_id, created_at, updated_at)
	SELECT aquarium_id, min(created_at), max(created_at) FROM chat_messages GROUP BY aquarium_id;
UPDATE chat_messages m SET thread_id = t.id FROM chat_threads t WHERE t.aquarium_id = m.aquarium_id AND m.thread_id IS NULL;

-- Photos envoyées dans une conversation : l'image vit dans le stockage (bucket), la ligne la décrit.
-- thread_id est vide tant que la photo n'a pas été envoyée avec un message.
CREATE TABLE chat_attachments (
	id           SERIAL PRIMARY KEY,
	aquarium_id  INT NOT NULL REFERENCES aquariums (id) ON DELETE CASCADE,
	thread_id    INT NULL REFERENCES chat_threads (id) ON DELETE CASCADE,
	storage_key  TEXT NOT NULL,
	content_type TEXT NOT NULL,
	bytes        INT NOT NULL,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_attachments_thread_idx ON chat_attachments (thread_id);

-- Down Migration

DROP TABLE IF EXISTS chat_attachments;
ALTER TABLE chat_messages DROP COLUMN IF EXISTS thread_id;
DROP TABLE IF EXISTS chat_threads;

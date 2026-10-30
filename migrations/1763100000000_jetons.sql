-- Up Migration

-- Jetons d'accès pour les raccourcis Siri / bouton Action (routes /api/shortcuts/* uniquement).
-- Seul l'empreinte SHA-256 du jeton est conservée ; le jeton lui-même n'est montré qu'à la création.
CREATE TABLE api_tokens (
	id           SERIAL PRIMARY KEY,
	label        TEXT NOT NULL,
	token_hash   TEXT NOT NULL UNIQUE,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_used_at TIMESTAMPTZ NULL,
	revoked_at   TIMESTAMPTZ NULL
);

-- Down Migration

DROP TABLE IF EXISTS api_tokens;

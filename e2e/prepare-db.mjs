// Repart d'une base de test vide ; l'appli applique ses migrations au démarrage.
// Lancé avant le serveur par playwright.config.ts. Refuse tout nom de base sans « e2e ».
import pg from 'pg';

const raw = process.env.DATABASE_URL ?? 'postgres:///aquarium_e2e';
const url = new URL(raw.startsWith('postgres:///') ? raw.replace('postgres:///', 'postgres://localhost/') : raw);
const name = url.pathname.slice(1);
if (!/^[a-z0-9_]*e2e[a-z0-9_]*$/.test(name)) throw new Error(`Base de test refusée : le nom doit contenir « e2e » (${name})`);
url.pathname = '/postgres';
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
await client.query(`CREATE DATABASE ${name}`);
await client.end();

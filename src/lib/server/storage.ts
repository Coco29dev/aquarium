import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AwsClient } from 'aws4fetch';
import { env } from '$env/dynamic/private';

// Bucket S3 Railway en production ; dossier local .data/photos en développement (sans variables S3).

const LOCAL_DIR = path.resolve('.data/photos');

function s3(): { client: AwsClient; base: string } | null {
	const { S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
	if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
	const client = new AwsClient({
		accessKeyId: S3_ACCESS_KEY_ID,
		secretAccessKey: S3_SECRET_ACCESS_KEY,
		region: S3_REGION || 'auto',
		service: 's3'
	});
	// Les buckets Railway utilisent le style « virtual-hosted » : https://<bucket>.<endpoint>/<clé>.
	const endpoint = new URL(S3_ENDPOINT);
	return { client, base: `${endpoint.protocol}//${S3_BUCKET}.${endpoint.host}` };
}

function localPath(key: string): string {
	const resolved = path.resolve(LOCAL_DIR, key);
	if (!resolved.startsWith(LOCAL_DIR + path.sep)) throw new Error('Clé de stockage invalide');
	return resolved;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
	const remote = s3();
	if (remote) {
		const response = await remote.client.fetch(`${remote.base}/${key}`, {
			method: 'PUT',
			body: body as BodyInit,
			headers: { 'content-type': contentType }
		});
		if (!response.ok) throw new Error(`Envoi au stockage refusé (${response.status})`);
		return;
	}
	const file = localPath(key);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, body);
}

export async function getObject(key: string): Promise<Uint8Array | null> {
	const remote = s3();
	if (remote) {
		const response = await remote.client.fetch(`${remote.base}/${key}`);
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(`Lecture du stockage refusée (${response.status})`);
		return new Uint8Array(await response.arrayBuffer());
	}
	try {
		return await readFile(localPath(key));
	} catch {
		return null;
	}
}

export async function deleteObject(key: string): Promise<void> {
	const remote = s3();
	if (remote) {
		const response = await remote.client.fetch(`${remote.base}/${key}`, { method: 'DELETE' });
		if (!response.ok && response.status !== 404) throw new Error(`Suppression refusée (${response.status})`);
		return;
	}
	await rm(localPath(key), { force: true });
}

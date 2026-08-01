// A minimal CloudKit Web Services client, enough to push curated content into
// the public database from a machine rather than from the app.
//
// Server-to-server keys exist for exactly this: a key pair whose public half is
// registered in the CloudKit Console, used to sign requests. It is the only way
// to write to the public database without a signed-in user, which is what keeps
// `edit JSON -> push -> live` working without an App Store release.
//
// Apple's signing scheme is unusual enough to be worth stating plainly, because
// every part of it fails with the same opaque 401:
//
//   signature = ECDSA-SHA256( "<date>:<base64(sha256(body))>:<path>" )
//
// The date must match the header exactly, the body hash is of the *exact* bytes
// sent, and the path is the URL path only — no host, no query.

import { createHash, createSign } from 'crypto';
import { readFileSync } from 'fs';

const HOST = 'https://api.apple-cloudkit.com';

/** CloudKit rejects anything larger in one call. */
export const MAX_OPERATIONS = 200;

export type FieldValue = string | number | boolean | string[] | number[];

export interface CloudKitRecord {
  recordName: string;
  recordType: string;
  fields: Record<string, FieldValue | null | undefined>;
}

export interface CloudKitConfig {
  container: string;
  environment: 'development' | 'production';
  keyId: string;
  privateKeyPem: string;
}

/**
 * Reads config from the environment, failing loudly rather than half-working.
 *
 * `CLOUDKIT_ENV` defaults to development deliberately: an accidental push to
 * production is the expensive mistake, and it should take a deliberate word.
 */
export function configFromEnv(): CloudKitConfig {
  const container = process.env.CLOUDKIT_CONTAINER;
  const keyId = process.env.CLOUDKIT_KEY_ID;
  const keyPath = process.env.CLOUDKIT_PRIVATE_KEY_PATH;
  const environment = (process.env.CLOUDKIT_ENV ?? 'development') as CloudKitConfig['environment'];

  const missing = [
    !container && 'CLOUDKIT_CONTAINER',
    !keyId && 'CLOUDKIT_KEY_ID',
    !keyPath && 'CLOUDKIT_PRIVATE_KEY_PATH',
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')} in server/.env.\n` +
        'Run `npm run cloudkit:keygen` if you have not created a key yet.'
    );
  }
  if (environment !== 'development' && environment !== 'production') {
    throw new Error(`CLOUDKIT_ENV must be development or production, got "${environment}"`);
  }

  return {
    container: container!,
    environment,
    keyId: keyId!,
    privateKeyPem: readFileSync(keyPath!, 'utf8'),
  };
}

/**
 * Signs and sends one request.
 *
 * The body is stringified once and both hashed and sent, because hashing a
 * re-serialised copy is how key ordering silently breaks the signature.
 */
async function send(config: CloudKitConfig, path: string, body: unknown): Promise<any> {
  const payload = JSON.stringify(body);
  const date = new Date().toISOString().replace(/\.\d{3}/, '');
  const bodyHash = createHash('sha256').update(payload, 'utf8').digest('base64');

  const signer = createSign('sha256');
  signer.update(`${date}:${bodyHash}:${path}`, 'utf8');
  const signature = signer.sign(config.privateKeyPem, 'base64');

  const response = await fetch(`${HOST}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Apple-CloudKit-Request-KeyID': config.keyId,
      'X-Apple-CloudKit-Request-ISO8601Date': date,
      'X-Apple-CloudKit-Request-SignatureV1': signature,
    },
    body: payload,
  });

  const text = await response.text();
  if (!response.ok) {
    // 401 here is almost always the key: not registered, registered against the
    // other container, or the private key not matching the registered public
    // half. The body carries Apple's own reason, so surface it rather than the
    // status alone.
    throw new Error(`CloudKit ${response.status} on ${path}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

function basePath(config: CloudKitConfig): string {
  return `/database/1/${config.container}/${config.environment}/public`;
}

/** Drops null and undefined, and wraps the rest in CloudKit's `{ value }` shape. */
function encodeFields(fields: CloudKitRecord['fields']): Record<string, { value: FieldValue }> {
  const out: Record<string, { value: FieldValue }> = {};
  for (const [key, value] of Object.entries(fields)) {
    // An absent field beats an empty one: the content rule is that a blank
    // field is honest and a placeholder is not, and CloudKit has no null.
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.length === 0) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = { value };
  }
  return out;
}

/**
 * Upserts records in batches.
 *
 * `forceReplace` rather than `create`: the push is meant to be run repeatedly
 * over the same slugs, and it must update rather than collide. That is also why
 * `recordName` is the content's slug — it makes identity stable across
 * re-imports, which is what "which tips have I seen" already depends on.
 */
export async function pushRecords(
  config: CloudKitConfig,
  records: CloudKitRecord[],
  onProgress?: (done: number, total: number) => void
): Promise<{ saved: number; errors: string[] }> {
  const path = `${basePath(config)}/records/modify`;
  const errors: string[] = [];
  let saved = 0;

  for (let i = 0; i < records.length; i += MAX_OPERATIONS) {
    const batch = records.slice(i, i + MAX_OPERATIONS);
    const result = await send(config, path, {
      operations: batch.map((record) => ({
        operationType: 'forceReplace',
        record: {
          recordName: record.recordName,
          recordType: record.recordType,
          fields: encodeFields(record.fields),
        },
      })),
    });

    // A 200 does not mean every record saved. CloudKit reports per-record
    // failures inside the body, and a partial failure looks exactly like a
    // success from the status line.
    for (const entry of result.records ?? []) {
      if (entry.serverErrorCode) {
        errors.push(`${entry.recordName ?? '?'}: ${entry.serverErrorCode} ${entry.reason ?? ''}`);
      } else {
        saved += 1;
      }
    }

    onProgress?.(Math.min(i + batch.length, records.length), records.length);
  }

  return { saved, errors };
}

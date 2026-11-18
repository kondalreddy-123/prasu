const DB_NAME = 'healthpass-private-offline-summary';
const DB_VERSION = 1;
const STORE_NAME = 'summaries';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Secure offline storage is not available in this browser.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'patientId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open secure offline storage.'));
  });
}

function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = operation(tx.objectStore(STORE_NAME));
    let result: T | undefined;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error || new Error('Secure offline storage request failed.'));
    tx.oncomplete = () => { db.close(); resolve(result as T); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Secure offline storage transaction failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Secure offline storage transaction was cancelled.')); };
  }));
}

function deriveKey(passphrase: string, salt: Uint8Array) {
  if (!globalThis.crypto?.subtle) return Promise.reject(new Error('Secure device encryption is not available.'));
  return crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']).then((material) =>
    crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as any, iterations: 250000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  );
}

async function encryptSummary(summary: any, key: CryptoKey, salt: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(summary));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(summary.patientId) }, key, plaintext);
  await transact('readwrite', (store) => store.put({ patientId: summary.patientId, salt, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)), savedAt: new Date().toISOString(), version: summary.version }));
}

export type OfflineSummaryKey = { key: CryptoKey; salt: string };

// Reconnection is read-only: only a strictly newer server snapshot replaces the cache.
export function shouldReplaceOfflineSummary(localVersion: number, serverVersion: number) {
  return serverVersion > localVersion;
}

export function buildOfflineMedicalSummary(patientId: string, patient: any, record: any, profile: any) {
  const patientProfile = profile?.patientId === patientId ? profile : {};
  const allergies = (record?.allergies || []).filter((item: any) => item.patientId === patientId).map((item: any) => [item.allergen, item.severity].filter(Boolean).join(' · ')).filter(Boolean);
  if (!allergies.length && patientProfile.knownAllergies) allergies.push(...String(patientProfile.knownAllergies).split(/[,\n]/).map((item: string) => item.trim()).filter(Boolean));
  const currentMedications = (record?.medicines || []).filter((item: any) => item.patientId === patientId && item.computedStatus === 'ACTIVE').map((item: any) => [item.name, item.strength].filter(Boolean).join(' ')).filter(Boolean);
  if (!currentMedications.length && patientProfile.currentMedications) currentMedications.push(...String(patientProfile.currentMedications).split(/[,\n]/).map((item: string) => item.trim()).filter(Boolean));
  const conditions = (record?.chronicConditions || []).filter((item: any) => item.patientId === patientId || !item.patientId && patientId === 'pat-1').map((item: any) => item.simpleLabel || item.name).filter(Boolean);
  if (patientProfile.healthConditions) conditions.push(...String(patientProfile.healthConditions).split(/[,\n]/).map((item: string) => item.trim()).filter(Boolean));
  const contact = patient?.id === patientId && patientId === 'pat-1' ? patient?.emergencyContact || {} : {};
  const emergencyContacts = [
    [contact.name, contact.relation, contact.phone].filter(Boolean).join(' · '),
    [patientProfile.emergencyContactName, patientProfile.emergencyContactRelation, patientProfile.emergencyContactPhone].filter(Boolean).join(' · '),
  ].filter(Boolean);
  const dates = [
    ...(record?.allergies || []), ...(record?.medicines || []), ...(record?.chronicConditions || []),
    ...(record?.visits || []), ...(record?.prescriptions || []), ...(record?.reports || []),
  ].filter((item: any) => item.patientId === patientId || !item.patientId && patientId === 'pat-1')
    .map((item: any) => item.updatedAt || item.createdAt || item.uploadedAt || item.startDate)
    .concat(patientProfile.updatedAt || [])
    .filter(Boolean).map((value: any) => new Date(value).getTime()).filter(Number.isFinite);
  const version = dates.length ? Math.max(...dates) : 0;
  return { patientId, allergies, currentMedications, conditions, emergencyContacts, updatedAt: version ? new Date(version).toISOString() : '', version };
}

export async function saveEncryptedOfflineSummary(summary: any, passphrase: string): Promise<OfflineSummaryKey> {
  if (passphrase.trim().length < 10) throw new Error('Use an offline passphrase of at least 10 characters.');
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = toBase64(saltBytes);
  const key = await deriveKey(passphrase, saltBytes);
  await encryptSummary(summary, key, salt);
  return { key, salt };
}

export async function replaceEncryptedOfflineSummary(summary: any, key: CryptoKey, salt: string) {
  await encryptSummary(summary, key, salt);
}

export async function loadEncryptedOfflineSummary(patientId: string, passphrase: string) {
  const stored = await transact<any>('readonly', (store) => store.get(patientId));
  if (!stored || stored.patientId !== patientId) return null;
  try {
    const key = await deriveKey(passphrase, fromBase64(stored.salt));
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(stored.iv), additionalData: encoder.encode(patientId) }, key, fromBase64(stored.ciphertext));
    const summary = JSON.parse(decoder.decode(plaintext));
    if (summary.patientId !== patientId) throw new Error('Patient scope mismatch.');
    return { summary, key, salt: stored.salt } as { summary: any; key: CryptoKey; salt: string };
  } catch {
    throw new Error('Offline summary could not be unlocked. Check the passphrase and signed-in patient.');
  }
}

export async function clearEncryptedOfflineSummary(patientId: string) {
  await transact('readwrite', (store) => store.delete(patientId));
}

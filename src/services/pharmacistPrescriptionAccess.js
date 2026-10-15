export const PHARMACIST_PRESCRIPTION_CATEGORY = 'Medications & Prescriptions';

const PRESCRIPTION_STATUSES = new Set(['ACTIVE', 'EXPIRED', 'CANCELLED', 'DISCONTINUED']);

export function getPrescriptionDisplayStatus(prescription, now = Date.now()) {
  const status = String(prescription?.status || prescription?.computedStatus || '').toUpperCase();
  if (status === 'CANCELLED' || status === 'DISCONTINUED' || status === 'EXPIRED') return status;
  const expiryValue = prescription?.validUntil || prescription?.endDate || '';
  const expiry = Date.parse(expiryValue);
  const expiryBoundary = /^\d{4}-\d{2}-\d{2}$/.test(expiryValue) && Number.isFinite(expiry)
    ? expiry + 86400000
    : expiry;
  if (Number.isFinite(expiryBoundary) && expiryBoundary <= now) return 'EXPIRED';
  if (status === 'ACTIVE' || Number.isFinite(expiryBoundary) && expiryBoundary > now) return 'ACTIVE';
  return PRESCRIPTION_STATUSES.has(status) ? status : 'UNAVAILABLE';
}

export function getPharmacistPrescriptionAccess(grant, { patientId, pharmacistId, now = Date.now() } = {}) {
  if (!grant || grant.patientId !== patientId || grant.providerId !== pharmacistId || grant.providerType !== 'pharmacist') {
    return { status: 'UNAVAILABLE', canRead: false };
  }

  if (grant.status === 'PENDING') return { status: 'PENDING', canRead: false, grant };
  if (grant.status === 'DENIED' || grant.status === 'REJECTED') return { status: 'REJECTED', canRead: false, grant };
  if (grant.status === 'REVOKED' || grant.status === 'CANCELLED') return { status: 'REVOKED', canRead: false, grant };

  const expiry = Date.parse(grant.expiresAt || '');
  if (grant.status !== 'GRANTED' || !Number.isFinite(expiry) || expiry <= now) {
    return { status: 'EXPIRED', canRead: false, grant };
  }

  const grantedCategories = grant.grantedCategories || [];
  const prescriptionOnly = grantedCategories.length === 1
    && grantedCategories[0] === PHARMACIST_PRESCRIPTION_CATEGORY;
  if (!prescriptionOnly) return { status: 'UNAVAILABLE', canRead: false, grant };

  return { status: 'ACTIVE', canRead: true, grant };
}

export function decidePharmacistPrescriptionRequest(grant, decision, { durationHours = 24, durationSeconds, now = Date.now() } = {}) {
  if (!grant || grant.providerType !== 'pharmacist' || grant.status !== 'PENDING') {
    return { ok: false, error: 'Pending pharmacist request not found.' };
  }
  if (decision === 'DENY') return { ok: true, grant: { ...grant, status: 'DENIED', decidedAt: new Date(now).toISOString() } };
  if (decision !== 'GRANT'
    || grant.requestedCategories?.length !== 1
    || grant.requestedCategories[0] !== PHARMACIST_PRESCRIPTION_CATEGORY) {
    return { ok: false, error: 'Pharmacist access can only be approved for prescriptions.' };
  }
  const hours = Number(durationHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
    return { ok: false, error: 'Choose an access period between 1 and 168 hours.' };
  }
  const durationMs = durationSeconds == null ? hours * 3600000 : Math.min(168 * 3600000, Math.max(1000, Number(durationSeconds) * 1000));
  return {
    ok: true,
    grant: {
      ...grant,
      status: 'GRANTED',
      grantedCategories: [PHARMACIST_PRESCRIPTION_CATEGORY],
      expiresAt: new Date(now + durationMs).toISOString(),
      decidedAt: new Date(now).toISOString(),
    },
  };
}

export function revokePharmacistPrescriptionAccess(grant, now = Date.now()) {
  if (!grant || grant.providerType !== 'pharmacist' || grant.status !== 'GRANTED') {
    return { ok: false, error: 'Active pharmacist consent not found.' };
  }
  return { ok: true, grant: { ...grant, status: 'REVOKED', revokedAt: new Date(now).toISOString() } };
}

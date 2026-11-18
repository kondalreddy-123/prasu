import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from './app.js';
import { connectDB, disconnectDB } from './db.js';
import { User } from './models/User.js';
import { CaregiverRelationship } from './models/CaregiverRelationship.js';
import { Reminder } from './models/Reminder.js';
import { AuditLog } from './models/AuditLog.js';

let server;
let baseUrl;
let memoryServer;

test.before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await connectDB(memoryServer.getUri());
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
  if (memoryServer) await memoryServer.stop();
});

function getCookieHeader(response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return '';
  return setCookie.split(';')[0];
}

async function loginAs(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return getCookieHeader(response);
}

test('17. Caregiver registration, linking with HealthPass ID, category access, and assisted upload', async () => {
  // 1. Register a patient
  const resPat = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ramesh Rao',
      email: 'ramesh.patient@example.com',
      password: 'Password123!',
      role: 'patient',
    }),
  });
  assert.equal(resPat.status, 201);
  const patientData = (await resPat.json()).user;

  // 2. Register a caregiver
  const resCaregiver = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sunita Rao',
      email: 'sunita.caregiver@example.com',
      password: 'Password123!',
      role: 'caregiver',
    }),
  });
  assert.equal(resCaregiver.status, 201);
  const caregiverCookie = getCookieHeader(resCaregiver);

  // 3. Link caregiver to patient by HealthPass ID
  const resLink = await fetch(`${baseUrl}/api/caregiver/link-patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: caregiverCookie },
    body: JSON.stringify({
      healthPassId: patientData.healthPassId,
      relationship: 'Daughter',
    }),
  });
  assert.equal(resLink.status, 200);
  const linkData = await resLink.json();
  assert.equal(linkData.success, true);

  // 4. Caregiver gets list of linked patients
  const resList = await fetch(`${baseUrl}/api/caregiver/patients`, {
    headers: { Cookie: caregiverCookie },
  });
  assert.equal(resList.status, 200);
  const listData = await resList.json();
  assert.equal(listData.patients.length, 1);
  assert.equal(listData.patients[0].patient.healthPassId, patientData.healthPassId);

  // 5. Caregiver assisted upload
  const resUpload = await fetch(`${baseUrl}/api/caregiver/patient/${patientData.id}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: caregiverCookie },
    body: JSON.stringify({
      title: 'Discharge Summary - District Hospital',
      category: 'Discharge summaries',
      reportDate: '2026-11-10',
      facilityName: 'District Hospital',
      resultSummary: 'Post-op recovery stable. Follow up in 2 weeks.',
    }),
  });
  assert.equal(resUpload.status, 201);
  const uploadData = await resUpload.json();
  assert.equal(uploadData.record.source, 'CAREGIVER_ASSISTED_UPLOAD');
});

test('18. Smart reminder engine: scheduling, adherence update, and caregiver tracking', async () => {
  const patient = await User.findOne({ email: 'ramesh.patient@example.com' });
  const patCookie = await loginAs('ramesh.patient@example.com', 'Password123!');
  const caregiverCookie = await loginAs('sunita.caregiver@example.com', 'Password123!');

  // 1. Patient creates a medicine reminder
  const resRem = await fetch(`${baseUrl}/api/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: patCookie },
    body: JSON.stringify({
      type: 'MEDICINE',
      title: 'Metformin 500mg',
      dosage: '1 tablet after breakfast',
      frequency: 'Daily',
      scheduledTime: '08:30 AM',
    }),
  });
  assert.equal(resRem.status, 201);
  const remData = await resRem.json();
  const reminderId = remData.reminder.id;

  // 2. Patient marks adherence as TAKEN
  const resAdherence = await fetch(`${baseUrl}/api/reminders/${reminderId}/adherence`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: patCookie },
    body: JSON.stringify({ status: 'TAKEN', notes: 'Taken on time with warm water' }),
  });
  assert.equal(resAdherence.status, 200);
  assert.equal((await resAdherence.json()).reminder.status, 'TAKEN');

  // 3. Authorized caregiver views reminders for the linked patient
  const resCaregiverView = await fetch(`${baseUrl}/api/reminders?patientId=${patient._id}`, {
    headers: { Cookie: caregiverCookie },
  });
  assert.equal(resCaregiverView.status, 200);
  const caregiverReminders = await resCaregiverView.json();
  assert.ok(caregiverReminders.reminders.length >= 1);
  assert.equal(caregiverReminders.reminders[0].status, 'TAKEN');
});

test('19. SHA-256 hash-chain audit log verification endpoint detects tampering', async () => {
  const admin = await User.create({
    name: 'Audit Admin',
    email: 'audit.admin@hospital.org',
    password: 'AdminPassword123!',
    role: 'admin',
    isVerified: true,
  });
  const adminCookie = await loginAs('audit.admin@hospital.org', 'AdminPassword123!');

  // Verify chain integrity of entries created so far
  const resVerify1 = await fetch(`${baseUrl}/api/admin/audit-logs/verify-chain`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(resVerify1.status, 200);
  const verify1 = await resVerify1.json();
  assert.equal(verify1.verified, true);
  assert.ok(verify1.totalEntriesChecked >= 2);

  // Tamper with one entry directly in the database
  const entryToTamper = await AuditLog.findOne();
  assert.ok(entryToTamper);
  entryToTamper.plainSummary = 'TAMPERED ILLEGAL SUMMARY';
  await entryToTamper.save({ validateBeforeSave: false });

  // Verify chain again -> must detect failure
  const resVerify2 = await fetch(`${baseUrl}/api/admin/audit-logs/verify-chain`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(resVerify2.status, 200);
  const verify2 = await resVerify2.json();
  assert.equal(verify2.verified, false, 'Hash chain verification must detect altered entry');
  assert.ok(verify2.brokenAtSequence >= 1);
});

test('20. HL7 FHIR R4 Patient bundle export conforms to resource mapping specifications', async () => {
  const patient = await User.findOne({ email: 'ramesh.patient@example.com' });
  const patCookie = await loginAs('ramesh.patient@example.com', 'Password123!');

  const resFhir = await fetch(`${baseUrl}/api/fhir/patient/${patient._id}/bundle`, {
    headers: { Cookie: patCookie },
  });
  assert.equal(resFhir.status, 200);
  const bundle = await resFhir.json();
  assert.equal(bundle.resourceType, 'Bundle');
  assert.equal(bundle.type, 'collection');
  assert.ok(Array.isArray(bundle.entry));
  assert.ok(bundle.entry.some((e) => e.resource.resourceType === 'Patient'));
  assert.ok(bundle.entry.some((e) => e.resource.resourceType === 'Observation'));
});

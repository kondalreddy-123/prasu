import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from './app.js';
import { connectDB, disconnectDB } from './db.js';
import { User } from './models/User.js';
import { HealthRecord } from './models/HealthRecord.js';
import { Consultation } from './models/Consultation.js';
import { ConsentGrant } from './models/ConsentGrant.js';
import { AuditLog } from './models/AuditLog.js';
import { Allergy } from './models/Allergy.js';

let server;
let baseUrl;
let memoryServer;

test.before(async () => {
  // Start dedicated in-memory Mongo instance for integration tests
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  await connectDB(uri);

  // Start HTTP server on an ephemeral port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
  if (memoryServer) {
    await memoryServer.stop();
  }
});

// Helper to extract cookie from Response headers
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
  assert.equal(response.status, 200, `Login should succeed for ${email}`);
  return getCookieHeader(response);
}

test('1. Patient registration and duplicate email rejection', async () => {
  // 1a. Successful patient registration
  const res1 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Sharma',
      email: 'alice@example.com',
      password: 'StrongPassword123!',
      role: 'patient',
    }),
  });

  assert.equal(res1.status, 201, 'Registration should return 201');
  const data1 = await res1.json();
  assert.equal(data1.success, true);
  assert.equal(data1.user.name, 'Alice Sharma');
  assert.equal(data1.user.email, 'alice@example.com');
  assert.equal(data1.user.role, 'patient');
  assert.ok(data1.user.id, 'User must have an ID');
  assert.equal(data1.user.password, undefined, 'Plaintext or hash password must never be exposed');

  // Verify cookie set
  const cookie = getCookieHeader(res1);
  assert.ok(cookie.startsWith('token='), 'Should receive an HttpOnly session cookie');

  // 1b. Duplicate email rejection
  const res2 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Duplicate',
      email: 'ALICE@example.com', // Case insensitivity test
      password: 'AnotherPassword123!',
      role: 'patient',
    }),
  });

  assert.equal(res2.status, 409, 'Duplicate email must return 409 Conflict');
  const data2 = await res2.json();
  assert.match(data2.error, /already exists/i);

  // 1c. Invalid inputs
  const res3 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '',
      email: 'invalid-email',
      password: 'short',
      role: 'patient',
    }),
  });
  assert.equal(res3.status, 400, 'Invalid fields must return 400');
});

test('2. Successful login, failed login, session persistence, and logout', async () => {
  // 2a. Failed login with wrong password
  const resWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'WrongPassword!',
    }),
  });
  assert.equal(resWrongPass.status, 401, 'Wrong password must return 401');

  // 2b. Failed login with non-existent user
  const resNotFound = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nobody@example.com',
      password: 'Password123!',
    }),
  });
  assert.equal(resNotFound.status, 401, 'Unknown email must return 401');

  // 2c. Successful login
  const resLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'StrongPassword123!',
    }),
  });
  assert.equal(resLogin.status, 200, 'Successful login must return 200');
  const loginData = await resLogin.json();
  assert.equal(loginData.success, true);
  const aliceCookie = getCookieHeader(resLogin);

  // 2d. Session persistence via /api/auth/me using cookie
  const resMe = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: aliceCookie },
  });
  assert.equal(resMe.status, 200, 'Restoring session via cookie must return 200');
  const meData = await resMe.json();
  assert.equal(meData.user.email, 'alice@example.com');

  // 2e. Logout clears session
  const resLogout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: aliceCookie },
  });
  assert.equal(resLogout.status, 200, 'Logout must return 200');

  // 2f. Unauthenticated check fails
  const resAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {},
  });
  assert.equal(resAfterLogout.status, 401, 'No session must return 401');
});

test('3. Patient data isolation between two separate accounts', async () => {
  // Register Patient B (Bob)
  const resBob = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bob Verma',
      email: 'bob@example.com',
      password: 'PasswordBob456!',
      role: 'patient',
    }),
  });
  const bobData = await resBob.json();
  const bobId = bobData.user.id;
  const bobCookie = getCookieHeader(resBob);

  // Login as Alice
  const resAlice = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'StrongPassword123!',
    }),
  });
  const aliceData = await resAlice.json();
  const aliceId = aliceData.user.id;
  const aliceCookie = getCookieHeader(resAlice);

  // Alice attempts to access Bob's wallet -> 403 Forbidden
  const resAlicePeeksBob = await fetch(`${baseUrl}/api/patient/${bobId}/wallet`, {
    headers: { Cookie: aliceCookie },
  });
  assert.equal(resAlicePeeksBob.status, 403, 'Patient cannot access another patient’s wallet');
  const peeksData = await resAlicePeeksBob.json();
  assert.match(peeksData.error, /access your own/i);

  // Bob can access his own wallet -> 200 OK
  const resBobOwnWallet = await fetch(`${baseUrl}/api/patient/${bobId}/wallet`, {
    headers: { Cookie: bobCookie },
  });
  assert.equal(resBobOwnWallet.status, 200, 'Patient can access their own wallet');
  const bobWallet = await resBobOwnWallet.json();
  assert.equal(bobWallet.patient.name, 'Bob Verma');
  assert.deepEqual(bobWallet.record.medicines, [], 'New account starts with clean empty medicines');
  assert.deepEqual(bobWallet.record.reports, [], 'New account starts with clean empty reports');
});

test('4. Doctor registration, verification check, and unauthorized access block', async () => {
  // 4a. Register Doctor
  const resDoc = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Dr. Vikram Rao',
      email: 'vikram.doctor@hospital.org',
      password: 'DoctorPassword789!',
      role: 'doctor',
      facilityName: 'District Civil Hospital',
      facilityLevel: 'DISTRICT',
    }),
  });
  assert.equal(resDoc.status, 201);
  const docData = await resDoc.json();
  const docId = docData.user.id;
  assert.equal(docData.user.isVerified, false, 'Doctor starts as unverified');

  // Unverified doctor cannot login until verified by an administrator
  const resUnverifiedLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vikram.doctor@hospital.org',
      password: 'DoctorPassword789!',
    }),
  });
  assert.equal(resUnverifiedLogin.status, 403, 'Unverified doctor cannot login');
  const unverifiedData = await resUnverifiedLogin.json();
  assert.equal(unverifiedData.code, 'PROVIDER_UNVERIFIED');

  // 4b. Admin verifies doctor
  // Create an admin user directly
  const admin = await User.create({
    name: 'Hospital Admin',
    email: 'admin@hospital.org',
    password: 'AdminPassword123!',
    role: 'admin',
    isVerified: true,
  });

  const resVerify = await fetch(`${baseUrl}/api/admin/verify-doctor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.generateAuthToken()}`,
    },
    body: JSON.stringify({
      doctorId: docId,
      verified: true,
    }),
  });
  assert.equal(resVerify.status, 200, 'Admin can verify doctor');

  // 4c. Doctor now logs in successfully
  const resDocLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vikram.doctor@hospital.org',
      password: 'DoctorPassword789!',
    }),
  });
  assert.equal(resDocLogin.status, 200, 'Verified doctor can now log in');
  const verifiedDocCookie = getCookieHeader(resDocLogin);

  // 4d. Verified doctor attempts to view Alice's record before consent is granted -> 403 NO_CONSENT
  const alice = await User.findOne({ email: 'alice@example.com' });
  const resNoConsent = await fetch(`${baseUrl}/api/provider/patient/${alice._id}/record?doctorId=${docId}`, {
    headers: { Cookie: verifiedDocCookie },
  });
  assert.equal(resNoConsent.status, 403, 'Access without consent must return 403');
  const noConsentData = await resNoConsent.json();
  assert.equal(noConsentData.code, 'NO_CONSENT');
});

test('5. Access granted only after explicit patient consent', async () => {
  const alice = await User.findOne({ email: 'alice@example.com' });
  const doc = await User.findOne({ email: 'vikram.doctor@hospital.org' });

  // Doctor login
  const resDocLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vikram.doctor@hospital.org',
      password: 'DoctorPassword789!',
    }),
  });
  const docCookie = getCookieHeader(resDocLogin);

  // Doctor creates access request
  const resReq = await fetch(`${baseUrl}/api/provider/request-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({
      patientId: alice._id.toString(),
      purpose: 'Routine health check and medication review',
      requestedCategories: ['General Medical History', 'Medications & Prescriptions', 'Lab reports'],
      durationHours: 24,
    }),
  });
  assert.equal(resReq.status, 201, 'Access request created');
  const reqData = await resReq.json();
  const grantId = reqData.grant.id;

  // Alice logs in and approves consent
  const resAliceLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'StrongPassword123!',
    }),
  });
  const aliceCookie = getCookieHeader(resAliceLogin);

  const resDecision = await fetch(`${baseUrl}/api/patient/${alice._id}/consent/${grantId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({
      decision: 'GRANT',
      durationHours: 24,
      grantedCategories: ['General Medical History', 'Medications & Prescriptions', 'Lab reports'],
    }),
  });
  assert.equal(resDecision.status, 200, 'Patient grants consent');
  const decisionData = await resDecision.json();
  assert.equal(decisionData.grant.status, 'GRANTED');

  // Doctor now accesses patient record successfully
  const resRecord = await fetch(`${baseUrl}/api/provider/patient/${alice._id}/record?doctorId=${doc._id}`, {
    headers: { Cookie: docCookie },
  });
  assert.equal(resRecord.status, 200, 'Doctor with active consent can view patient record');
  const recordData = await resRecord.json();
  assert.equal(recordData.patient.name, 'Alice Sharma');
  assert.ok(recordData.grant, 'Grant must be active');
  assert.equal(recordData.grant.status, 'GRANTED');

  // Check audit log recorded the access
  const accessLogs = await AuditLog.find({ patientId: alice._id, action: 'RECORD_ACCESSED' });
  assert.ok(accessLogs.length > 0, 'Access event must be recorded in AuditLog');
});

test('6. Access denied after consent revocation', async () => {
  const alice = await User.findOne({ email: 'alice@example.com' });
  const doc = await User.findOne({ email: 'vikram.doctor@hospital.org' });

  // Get active grant
  const grant = await ConsentGrant.findOne({ patientId: alice._id, providerId: doc._id, status: 'GRANTED' });
  assert.ok(grant, 'Grant must be active');

  // Alice logs in and revokes consent
  const resAliceLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'StrongPassword123!',
    }),
  });
  const aliceCookie = getCookieHeader(resAliceLogin);

  const resRevoke = await fetch(`${baseUrl}/api/patient/${alice._id}/consent/${grant._id}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({}),
  });
  assert.equal(resRevoke.status, 200, 'Consent revocation must succeed');
  const revokeData = await resRevoke.json();
  assert.equal(revokeData.grant.status, 'REVOKED');

  // Doctor attempts to access record again -> 403 ACCESS_REVOKED
  const resDocLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vikram.doctor@hospital.org',
      password: 'DoctorPassword789!',
    }),
  });
  const docCookie = getCookieHeader(resDocLogin);

  const resBlocked = await fetch(`${baseUrl}/api/provider/patient/${alice._id}/record?doctorId=${doc._id}`, {
    headers: { Cookie: docCookie },
  });
  assert.equal(resBlocked.status, 403, 'Access after revocation must return 403');
  const blockedData = await resBlocked.json();
  assert.equal(blockedData.code, 'ACCESS_REVOKED');
});

test('7. Duplicate active records and legitimate repeated consultations', async () => {
  const alice = await User.findOne({ email: 'alice@example.com' });
  const resAliceLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'StrongPassword123!',
    }),
  });
  const aliceCookie = getCookieHeader(resAliceLogin);

  // 7a. First report upload succeeds
  const reportPayload = {
    title: 'Complete Blood Count (CBC)',
    category: 'Lab reports',
    reportDate: '2026-10-15',
    resultSummary: 'Hb 13.5 g/dL, WBC 6500 /uL',
  };

  const resRep1 = await fetch(`${baseUrl}/api/patient/${alice._id}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify(reportPayload),
  });
  assert.equal(resRep1.status, 201, 'First upload succeeds');

  // 7b. Identical active report is blocked (409)
  const resRep2 = await fetch(`${baseUrl}/api/patient/${alice._id}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify(reportPayload),
  });
  assert.equal(resRep2.status, 409, 'Duplicate active report must return 409');
  const rep2Data = await resRep2.json();
  assert.equal(rep2Data.code, 'DUPLICATE_MEDICAL_RECORD');

  // 7c. Legitimate report with different date or different test succeeds
  const resRep3 = await fetch(`${baseUrl}/api/patient/${alice._id}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({
      ...reportPayload,
      reportDate: '2026-10-17', // Different date (subsequent test)
    }),
  });
  assert.equal(resRep3.status, 201, 'Legitimate subsequent report must succeed');

  // 7d. Legitimate repeated consultations
  const doc = await User.findOne({ email: 'vikram.doctor@hospital.org' });

  // Grant access for consultation testing
  await ConsentGrant.create({
    patientId: alice._id,
    providerId: doc._id,
    providerName: doc.name,
    status: 'GRANTED',
    expiresAt: new Date(Date.now() + 86400000),
    grantedCategories: ['Consultation History', 'Medications & Prescriptions'],
  });

  const resDocLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vikram.doctor@hospital.org',
      password: 'DoctorPassword789!',
    }),
  });
  const docCookie = getCookieHeader(resDocLogin);

  // Visit 1: Initial consultation
  const resVisit1 = await fetch(`${baseUrl}/api/provider/patient/${alice._id}/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({
      date: '2026-10-01',
      diagnosis: 'Acute Viral Infection',
      chiefComplaint: 'Fever for 2 days',
      clinicalNotes: 'Vitals stable. Rest and hydration advised.',
      medicines: [{ name: 'Paracetamol', strength: '650 mg', dosage: '1 tablet TID' }],
    }),
  });
  assert.equal(resVisit1.status, 201, 'Initial consultation created');

  // Visit 2: Follow-up consultation with different diagnosis / notes on a later date succeeds
  const resVisit2 = await fetch(`${baseUrl}/api/provider/patient/${alice._id}/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({
      date: '2026-10-10',
      diagnosis: 'Follow-up resolved viral fever',
      chiefComplaint: 'Post-viral recovery check',
      clinicalNotes: 'Fever resolved. Normal activity approved.',
      medicines: [],
    }),
  });
  assert.equal(resVisit2.status, 201, 'Legitimate follow-up consultation succeeds');
});

test('8. Database persistence after server restart', async () => {
  // Check records in DB before restart
  const aliceBefore = await User.findOne({ email: 'alice@example.com' });
  assert.ok(aliceBefore);
  const reportsBefore = await HealthRecord.countDocuments({ patientId: aliceBefore._id, isActive: true });
  assert.equal(reportsBefore, 2);

  // Simulate server shutdown
  await new Promise((resolve) => server.close(resolve));

  // Restart server on a new port using the same database connection
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const newPort = server.address().port;
  const newBaseUrl = `http://127.0.0.1:${newPort}`;
  baseUrl = newBaseUrl;

  // Login Alice on new server instance
  const resAliceLogin = await fetch(`${newBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'StrongPassword123!',
    }),
  });
  assert.equal(resAliceLogin.status, 200, 'Login succeeds after restart');
  const aliceCookie = getCookieHeader(resAliceLogin);

  // Verify wallet still contains all persisted data
  const resWallet = await fetch(`${newBaseUrl}/api/patient/${aliceBefore._id}/wallet`, {
    headers: { Cookie: aliceCookie },
  });
  assert.equal(resWallet.status, 200);
  const wallet = await resWallet.json();
  assert.equal(wallet.patient.name, 'Alice Sharma');
  assert.equal(wallet.record.reports.length, 2, 'Reports must persist across server restart');
});

test('9. Authentication hardening rejects header bypass, untrusted CORS, and missing routes', async () => {
  const bob = await User.findOne({ email: 'bob@example.com' });

  const resBypass = await fetch(`${baseUrl}/api/patient/${bob._id}/wallet`, {
    headers: { 'x-user-id': bob._id.toString() },
  });
  assert.equal(resBypass.status, 401, 'x-user-id must never authenticate a request');

  const resMeBypass = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'x-user-id': bob._id.toString() },
  });
  assert.equal(resMeBypass.status, 401, 'x-user-id must not restore a session');

  const resEvilOrigin = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(resEvilOrigin.status, 200);
  assert.equal(
    resEvilOrigin.headers.get('access-control-allow-origin'),
    null,
    'Untrusted origins must not receive an Access-Control-Allow-Origin header'
  );

  const resTrustedOrigin = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'http://localhost:3000' },
  });
  assert.equal(resTrustedOrigin.headers.get('access-control-allow-origin'), 'http://localhost:3000');

  const resMissing = await fetch(`${baseUrl}/api/definitely-not-a-route`);
  assert.equal(resMissing.status, 404);
});

test('10. Consent state machine enforces pending, rejected, category scope, and latest grant', async () => {
  const alice = await User.findOne({ email: 'alice@example.com' });
  const doc = await User.findOne({ email: 'vikram.doctor@hospital.org' });
  const docCookie = await loginAs('vikram.doctor@hospital.org', 'DoctorPassword789!');

  const temporaryGrant = await ConsentGrant.create({
    patientId: alice._id,
    providerId: doc._id,
    providerName: doc.name,
    providerRole: 'doctor',
    purpose: 'State-machine test',
    requestedCategories: ['General Medical History', 'Medications & Prescriptions'],
    grantedCategories: [],
    durationHours: 24,
    expiresAt: new Date(Date.now() + 86400000),
    status: 'PENDING',
  });

  const recordUrl = `${baseUrl}/api/provider/patient/${alice._id}/record?doctorId=${doc._id}`;

  const resPending = await fetch(recordUrl, { headers: { Cookie: docCookie } });
  assert.equal(resPending.status, 403);
  assert.equal((await resPending.json()).code, 'CONSENT_PENDING');

  temporaryGrant.status = 'REJECTED';
  await temporaryGrant.save();
  const resRejected = await fetch(recordUrl, { headers: { Cookie: docCookie } });
  assert.equal(resRejected.status, 403);
  assert.equal((await resRejected.json()).code, 'CONSENT_REJECTED');

  temporaryGrant.status = 'GRANTED';
  temporaryGrant.grantedCategories = ['General Medical History'];
  await temporaryGrant.save();

  try {
    const resScoped = await fetch(recordUrl, { headers: { Cookie: docCookie } });
    assert.equal(resScoped.status, 200, 'General Medical History access is still valid');
    const scopedRecord = await resScoped.json();
    assert.deepEqual(scopedRecord.medicines, [], 'Unshared medication data must be withheld');
    assert.equal(scopedRecord.medicinesSection?.shared, false, 'Medication section must be withheld');
    assert.deepEqual(scopedRecord.prescriptionsSection?.prescriptions, [], 'Unshared prescriptions must be withheld');

    const resClinical = await fetch(`${baseUrl}/api/clinical/check-safety`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: docCookie },
      body: JSON.stringify({ patientId: alice._id.toString(), candidateMedicines: [{ name: 'Paracetamol' }] }),
    });
    assert.equal(resClinical.status, 403);
    assert.equal((await resClinical.json()).code, 'CATEGORY_NOT_SHARED');

    temporaryGrant.status = 'REVOKED';
    await temporaryGrant.save();
    const resRevoked = await fetch(recordUrl, { headers: { Cookie: docCookie } });
    assert.equal(resRevoked.status, 403);
    assert.equal((await resRevoked.json()).code, 'ACCESS_REVOKED');
  } finally {
    // Never leak state-machine fixtures into later tests.
    await ConsentGrant.deleteOne({ _id: temporaryGrant._id });
  }
});

test('11. In-person OTP is patient-only and locks after five failed attempts', async () => {
  const bob = await User.findOne({ email: 'bob@example.com' });
  const docCookie = await loginAs('vikram.doctor@hospital.org', 'DoctorPassword789!');

  const resRequest = await fetch(`${baseUrl}/api/provider/request-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({
      patientId: bob._id.toString(),
      purpose: 'In-person consent verification',
      requestedCategories: ['General Medical History', 'Medications & Prescriptions'],
      durationHours: 24,
    }),
  });
  assert.equal(resRequest.status, 201);
  const requestData = await resRequest.json();
  assert.equal(requestData.grant.otpCode, undefined, 'Provider response must never expose the OTP');
  assert.equal(requestData.grant.status, 'PENDING');

  const grant = await ConsentGrant.findById(requestData.grant.id);
  assert.match(String(grant.otpCode), /^\d{6}$/, 'Backend must generate a six-digit OTP');

  const bobCookie = await loginAs('bob@example.com', 'PasswordBob456!');
  const resWallet = await fetch(`${baseUrl}/api/patient/${bob._id}/wallet`, {
    headers: { Cookie: bobCookie },
  });
  assert.equal(resWallet.status, 200);
  const wallet = await resWallet.json();
  const walletGrant = wallet.grants.find((item) => item.id === requestData.grant.id);
  assert.ok(walletGrant, 'Patient wallet must list the pending request');
  assert.equal(walletGrant.otpCode, grant.otpCode, 'OTP is shown in the patient wallet');

  const wrongOtp = grant.otpCode === '000000' ? '111111' : '000000';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const resWrong = await fetch(`${baseUrl}/api/provider/approve-in-person-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: docCookie },
      body: JSON.stringify({ grantId: grant._id.toString(), otp: wrongOtp }),
    });
    assert.equal(resWrong.status, 403);
  }

  const resLocked = await fetch(`${baseUrl}/api/provider/approve-in-person-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({ grantId: grant._id.toString(), otp: grant.otpCode }),
  });
  assert.equal(resLocked.status, 429, 'Correct OTP must not work after five failures');
  const lockedData = await resLocked.json();
  assert.equal(lockedData.code, 'OTP_LOCKED');

  const lockedGrant = await ConsentGrant.findById(grant._id);
  assert.equal(lockedGrant.otpCode, undefined, 'OTP must be cleared after lockout');
});

test('12. Lab report upload requires an explicit Laboratory Reports consent grant', async () => {
  const bob = await User.findOne({ email: 'bob@example.com' });
  const resLabRegister = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Apex Lab Technologist',
      email: 'lab.tech@apex.test',
      password: 'LabPassword123!',
      role: 'lab',
      facilityName: 'Apex Diagnostics',
      facilityLevel: 'LAB',
    }),
  });
  assert.equal(resLabRegister.status, 201);
  const labData = await resLabRegister.json();
  assert.equal(labData.user.isVerified, true, 'Labs are active without admin verification');
  const labCookie = getCookieHeader(resLabRegister);

  const resLookupBefore = await fetch(`${baseUrl}/api/lab/patient-lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: labCookie },
    body: JSON.stringify({ healthPassId: bob.healthPassId }),
  });
  assert.equal(resLookupBefore.status, 200);
  assert.equal((await resLookupBefore.json()).accessStatus, 'NONE');

  const resRequest = await fetch(`${baseUrl}/api/lab/request-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: labCookie },
    body: JSON.stringify({ healthPassId: bob.healthPassId, durationHours: 24 }),
  });
  assert.equal(resRequest.status, 201);
  const labRequest = await resRequest.json();
  assert.equal(labRequest.grant.otpCode, undefined, 'Lab-facing response must not expose the OTP');
  assert.deepEqual(labRequest.grant.requestedCategories, ['Laboratory Reports']);

  const resUploadBefore = await fetch(`${baseUrl}/api/lab/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: labCookie },
    body: JSON.stringify({ healthPassId: bob.healthPassId, title: 'Blocked CBC', reportDate: '2026-10-20' }),
  });
  assert.equal(resUploadBefore.status, 403);
  assert.equal((await resUploadBefore.json()).code, 'NO_CONSENT');

  const bobCookie = await loginAs('bob@example.com', 'PasswordBob456!');
  const resDecision = await fetch(`${baseUrl}/api/patient/${bob._id}/consent/${labRequest.grant.id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
    body: JSON.stringify({ decision: 'GRANT', grantedCategories: ['Laboratory Reports'], durationHours: 24 }),
  });
  assert.equal(resDecision.status, 200);

  const resLookupAfter = await fetch(`${baseUrl}/api/lab/patient-lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: labCookie },
    body: JSON.stringify({ healthPassId: bob.healthPassId }),
  });
  const lookupAfter = await resLookupAfter.json();
  assert.equal(lookupAfter.accessStatus, 'GRANTED', 'Approved lab consent maps to GRANTED');

  const reportPayload = {
    healthPassId: bob.healthPassId,
    title: 'Complete Blood Count',
    reportDate: '2026-10-21',
    resultSummary: 'Hb 13.2 g/dL, WBC 6100 /uL',
  };
  const resUpload = await fetch(`${baseUrl}/api/lab/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: labCookie },
    body: JSON.stringify(reportPayload),
  });
  assert.equal(resUpload.status, 201, 'Approved lab can upload a report');

  const resDuplicate = await fetch(`${baseUrl}/api/lab/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: labCookie },
    body: JSON.stringify(reportPayload),
  });
  assert.equal(resDuplicate.status, 409);
  assert.equal((await resDuplicate.json()).code, 'DUPLICATE_MEDICAL_RECORD');
});

test('13. Pharmacy pending requests are reused and access follows the latest decision', async () => {
  const bob = await User.findOne({ email: 'bob@example.com' });
  const resPharmacyRegister = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Jan Aushadhi Pharmacist',
      email: 'pharmacy.test@janaushadhi.test',
      password: 'PharmacyPassword123!',
      role: 'pharmacy',
      facilityName: 'Jan Aushadhi Kendra',
      facilityLevel: 'PHARMACY',
    }),
  });
  assert.equal(resPharmacyRegister.status, 201);
  const pharmacyCookie = getCookieHeader(resPharmacyRegister);

  const resFirstRequest = await fetch(`${baseUrl}/api/pharmacy/request-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: pharmacyCookie },
    body: JSON.stringify({ healthPassId: bob.healthPassId, durationHours: 24 }),
  });
  assert.equal(resFirstRequest.status, 201);
  const firstGrant = (await resFirstRequest.json()).grant;
  assert.equal(firstGrant.otpCode, undefined, 'Pharmacy response must not expose the OTP');
  assert.equal(firstGrant.providerType, 'pharmacist');

  const resSecondRequest = await fetch(`${baseUrl}/api/pharmacy/request-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: pharmacyCookie },
    body: JSON.stringify({ healthPassId: bob.healthPassId, durationHours: 24 }),
  });
  assert.equal(resSecondRequest.status, 200);
  assert.equal((await resSecondRequest.json()).grant.id, firstGrant.id, 'Pending request must be reused');

  const resPendingLookup = await fetch(`${baseUrl}/api/pharmacy/patient/${bob.healthPassId}`, {
    headers: { Cookie: pharmacyCookie },
  });
  assert.equal(resPendingLookup.status, 200);
  const pendingLookup = await resPendingLookup.json();
  assert.equal(pendingLookup.accessStatus, 'PENDING');
  assert.deepEqual(pendingLookup.prescriptions, []);

  const bobCookie = await loginAs('bob@example.com', 'PasswordBob456!');
  const resDecision = await fetch(`${baseUrl}/api/patient/${bob._id}/consent/${firstGrant.id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
    body: JSON.stringify({ decision: 'GRANT', grantedCategories: ['Medications & Prescriptions'], durationHours: 24 }),
  });
  assert.equal(resDecision.status, 200);

  const resActiveLookup = await fetch(`${baseUrl}/api/pharmacy/patient/${bob.healthPassId}`, {
    headers: { Cookie: pharmacyCookie },
  });
  const activeLookup = await resActiveLookup.json();
  assert.equal(activeLookup.accessStatus, 'ACTIVE');
  assert.equal(activeLookup.canRead, true);

  const resRevoke = await fetch(`${baseUrl}/api/patient/${bob._id}/consent/${firstGrant.id}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
    body: JSON.stringify({}),
  });
  assert.equal(resRevoke.status, 200);

  const resRevokedLookup = await fetch(`${baseUrl}/api/pharmacy/patient/${bob.healthPassId}`, {
    headers: { Cookie: pharmacyCookie },
  });
  const revokedLookup = await resRevokedLookup.json();
  assert.equal(revokedLookup.accessStatus, 'REVOKED');
  assert.deepEqual(revokedLookup.prescriptions, []);
});

test('14. Clinical safety returns only the four required alert arrays', async () => {
  const alice = await User.findOne({ email: 'alice@example.com' });
  const docCookie = await loginAs('vikram.doctor@hospital.org', 'DoctorPassword789!');

  await Allergy.create({
    patientId: alice._id,
    allergen: 'Penicillin',
    reaction: 'Rash',
    severity: 'MODERATE',
    // Clinician-recorded cross-reactivity for the penicillin class.
    drugClassMatches: ['penicillin', 'amoxicillin', 'ampicillin', 'beta-lactam'],
  });

  const res = await fetch(`${baseUrl}/api/clinical/check-safety`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({
      patientId: alice._id.toString(),
      candidateMedicines: [{ name: 'Amoxicillin' }, { name: 'Paracetamol' }],
      candidateTests: ['Complete Blood Count'],
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(
    Object.keys(data).sort(),
    ['allergyAlerts', 'duplicateAlerts', 'interactionAlerts', 'repeatTestAlerts']
  );
  assert.ok(data.allergyAlerts.some((alert) => alert.allergen === 'Penicillin'));
  assert.ok(data.duplicateAlerts.length >= 1, 'Active Paracetamol must produce a duplicate alert');
  assert.ok(data.repeatTestAlerts.length >= 1, 'Recent CBC must produce a repeat-test alert');

  const bob = await User.findOne({ email: 'bob@example.com' });
  const resNoConsent = await fetch(`${baseUrl}/api/clinical/check-safety`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({ patientId: bob._id.toString(), candidateMedicines: [{ name: 'Paracetamol' }] }),
  });
  assert.equal(resNoConsent.status, 403);
  assert.ok(
    ['NO_CONSENT', 'CONSENT_PENDING'].includes((await resNoConsent.json()).code),
    'A patient without an active granted consent cannot run clinical safety checks'
  );
});

test('15. Emergency lookup verifies date of birth, audits access, and isolates records', async () => {
  const alice = await User.findOne({ email: 'alice@example.com' });
  const doc = await User.findOne({ email: 'vikram.doctor@hospital.org' });
  const docCookie = await loginAs('vikram.doctor@hospital.org', 'DoctorPassword789!');

  const lookupBody = {
    healthPassId: alice.healthPassId,
    dateOfBirth: '1990-01-15',
    reason: 'Unconscious patient in emergency department; treatment required.',
    patientUnableToConsent: true,
  };

  // Alice registered without a DOB, so emergency access must fail closed.
  const resNoDob = await fetch(`${baseUrl}/api/emergency/find-patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify(lookupBody),
  });
  assert.equal(resNoDob.status, 403, 'Missing stored DOB must not be bypassed');

  alice.dateOfBirth = '1990-01-15';
  await alice.save();

  const resWrongDob = await fetch(`${baseUrl}/api/emergency/find-patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({ ...lookupBody, dateOfBirth: '1991-01-15' }),
  });
  assert.equal(resWrongDob.status, 403);

  const resBadReason = await fetch(`${baseUrl}/api/emergency/find-patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({ ...lookupBody, reason: 'short' }),
  });
  assert.equal(resBadReason.status, 400);

  const resNoAttestation = await fetch(`${baseUrl}/api/emergency/find-patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({ ...lookupBody, patientUnableToConsent: false }),
  });
  assert.equal(resNoAttestation.status, 400);

  const resSuccess = await fetch(`${baseUrl}/api/emergency/find-patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify(lookupBody),
  });
  assert.equal(resSuccess.status, 200);
  const successData = await resSuccess.json();
  assert.ok(successData.summary.accessEventId);
  assert.equal(successData.summary.patient.healthPassId, alice.healthPassId);
  assert.equal(successData.summary.patient.dateOfBirth, undefined, 'DOB is not repeated in the emergency summary');
  assert.equal(successData.summary.patient.password, undefined);
  assert.ok(Array.isArray(successData.summary.records));
  assert.ok(Array.isArray(successData.summary.prescriptions));
  assert.ok(Array.isArray(successData.summary.labFindings));
  assert.ok(successData.summary.labFindings.length >= 1, 'Lab findings are included separately');

  const audit = await AuditLog.findOne({ patientId: alice._id, action: 'EMERGENCY_ACCESS', actorId: doc._id });
  assert.ok(audit, 'Emergency access must be audited');
  assert.match(audit.details.reason, /Unconscious patient/);

  const unverifiedDoctor = await User.create({
    name: 'Dr. Unverified',
    email: 'unverified.emergency@hospital.org',
    password: 'UnverifiedPassword123!',
    role: 'doctor',
    isVerified: false,
  });
  const resUnverified = await fetch(`${baseUrl}/api/emergency/find-patient`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${unverifiedDoctor.generateAuthToken()}`,
    },
    body: JSON.stringify(lookupBody),
  });
  assert.equal(resUnverified.status, 403);
  assert.equal((await resUnverified.json()).code, 'DOCTOR_UNVERIFIED');

  const aliceCookie = await loginAs('alice@example.com', 'StrongPassword123!');
  const resPatientLookup = await fetch(`${baseUrl}/api/emergency/find-patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify(lookupBody),
  });
  assert.equal(resPatientLookup.status, 403, 'Patients cannot use emergency break-glass lookup');

  // Emergency record isolation and linking workflow.
  const resCreate = await fetch(`${baseUrl}/api/emergency-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({
      status: 'IDENTITY_UNKNOWN',
      patientDetails: { apparentName: { text: 'Unidentified Adult', tag: 'UNKNOWN_UNVERIFIED' } },
      emergencyObservations: { text: 'Found unresponsive; stabilised.', tag: 'VERIFIED' },
    }),
  });
  assert.equal(resCreate.status, 201);
  const emergencyRecord = (await resCreate.json()).record;

  const otherDoctor = await User.create({
    name: 'Dr. Other',
    email: 'other.doctor@hospital.org',
    password: 'OtherDoctorPassword123!',
    role: 'doctor',
    isVerified: true,
  });
  const otherDoctorToken = otherDoctor.generateAuthToken();
  const resOtherList = await fetch(`${baseUrl}/api/emergency-records`, {
    headers: { Authorization: `Bearer ${otherDoctorToken}` },
  });
  const otherList = await resOtherList.json();
  assert.ok(!otherList.records.some((record) => record.id === emergencyRecord.id), 'Other doctors cannot list the record');

  const resOtherGet = await fetch(`${baseUrl}/api/emergency-records/${emergencyRecord.id}`, {
    headers: { Authorization: `Bearer ${otherDoctorToken}` },
  });
  assert.equal(resOtherGet.status, 403);

  const resBadLink = await fetch(`${baseUrl}/api/emergency-records/${emergencyRecord.id}/link-initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({ targetHealthPassId: bobHealthPassIdOrFallback(await User.findOne({ email: 'bob@example.com' })) }),
  });
  assert.equal(resBadLink.status, 400, 'Link initiation requires identity verification');

  const bob = await User.findOne({ email: 'bob@example.com' });
  const resLink = await fetch(`${baseUrl}/api/emergency-records/${emergencyRecord.id}/link-initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({
      targetHealthPassId: bob.healthPassId,
      identityVerified: true,
      identityVerificationMethod: 'GOVERNMENT_ID_AND_BIOMETRIC',
      identityVerificationNotes: 'Aadhaar and facial match verified.',
      authorizationBasis: 'PATIENT_APP_CONSENT',
      conflictResolutionMode: 'KEEP_SEPARATE_PROVENANCE',
    }),
  });
  assert.equal(resLink.status, 200);
  const linkedPending = await resLink.json();
  assert.equal(linkedPending.record.status, 'AWAITING_CONSENT');

  const bobCookie = await loginAs('bob@example.com', 'PasswordBob456!');
  const resDoctorApprove = await fetch(`${baseUrl}/api/emergency-records/${emergencyRecord.id}/link-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({ actorRole: 'doctor' }),
  });
  assert.equal(resDoctorApprove.status, 403, 'Doctor cannot approve patient-app consent on the patient behalf');

  const resPatientApprove = await fetch(`${baseUrl}/api/emergency-records/${emergencyRecord.id}/link-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
    body: JSON.stringify({ actorRole: 'patient', patientId: bob._id.toString() }),
  });
  assert.equal(resPatientApprove.status, 200);
  assert.equal((await resPatientApprove.json()).record.status, 'LINKED');

  const resUnlink = await fetch(`${baseUrl}/api/emergency-records/${emergencyRecord.id}/unlink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: docCookie },
    body: JSON.stringify({ reason: 'Link verified as incorrect after review.' }),
  });
  assert.equal(resUnlink.status, 200);
  const unlinked = await resUnlink.json();
  assert.equal(unlinked.record.status, 'CLOSED');
  assert.equal(unlinked.record.linkingWorkflow.decisionStatus, 'UNLINKED');
});

test('16. Personal report entries, report summaries, and admin provider verification alias', async () => {
  const alice = await User.findOne({ email: 'alice@example.com' });
  const aliceCookie = await loginAs('alice@example.com', 'StrongPassword123!');

  const resReport = await fetch(`${baseUrl}/api/patient/${alice._id}/personal-health-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({
      categories: ['General Medical History', 'Medications & Prescriptions', 'Laboratory Reports'],
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    }),
  });
  assert.equal(resReport.status, 200);
  const reportData = await resReport.json();
  assert.ok(Array.isArray(reportData.entries), 'Personal report must return entries');
  assert.ok(reportData.entries.length >= 1, 'Alice has records in the requested categories');

  const walletResponse = await fetch(`${baseUrl}/api/patient/${alice._id}/wallet`, {
    headers: { Cookie: aliceCookie },
  });
  const wallet = await walletResponse.json();
  const firstReport = wallet.record.reports[0];
  assert.ok(firstReport, 'Alice has an uploaded report');

  const resSummary = await fetch(`${baseUrl}/api/patient/${alice._id}/reports/${firstReport.id}/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({}),
  });
  assert.equal(resSummary.status, 200);
  const summaryData = await resSummary.json();
  assert.ok(summaryData.summary && typeof summaryData.summary === 'object');

  const adminCookie = await loginAs('admin@hospital.org', 'AdminPassword123!');
  const resOverview = await fetch(`${baseUrl}/api/admin/overview`, { headers: { Cookie: adminCookie } });
  assert.equal(resOverview.status, 200);
  const overview = await resOverview.json();
  assert.ok(Array.isArray(overview.providers));
  assert.ok(overview.providers.every((provider) => typeof provider.verified === 'boolean'));

  const doc = await User.findOne({ email: 'vikram.doctor@hospital.org' });
  const resVerifyAlias = await fetch(`${baseUrl}/api/admin/providers/${doc._id}/verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({}),
  });
  assert.equal(resVerifyAlias.status, 200, 'Frontend verification alias must exist');
  assert.equal((await resVerifyAlias.json()).provider.verified, true);
});

function bobHealthPassIdOrFallback(user) {
  return user.healthPassId;
}

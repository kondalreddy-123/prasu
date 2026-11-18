# HealthPass — AI-Powered, Offline-First Personal Healthcare Platform

> **"Your Health. Your Records. Your Control."**

HealthPass is a patient-controlled, privacy-first healthcare management platform connecting Patients, Doctors, Caregivers, Pharmacies, Laboratories, and Administrators under a unified, consent-enforced architecture.

---

## 🌟 Innovation Pillars Implemented

1. **Rural-First, Offline-First Architecture**:
   - PWA-ready with local encrypted storage, offline document capture, and automatic sync queues.
   - Trilingual interface support (**English**, **Telugu / తెలుగు**, **Hindi / हिन्दी**).
2. **OCR & Document Intelligence**:
   - Extraction of test results, reference ranges, and prescription details.
   - Human verification flagging for uncertain values without hallucinating missing data.
3. **AI Medical Checkup Analyser & Historical Trends**:
   - Clear visual indicators (`BELOW RANGE`, `WITHIN RANGE`, `ABOVE RANGE`).
   - Comparative multi-report trend observation (e.g. Glucose across visits).
   - Plain-language patient summaries and doctor discussion questions.
4. **AI Health Companion**:
   - Consent-gated, de-identified report explanations.
   - Strictly informational: never autonomous diagnosis or prescribing.
5. **Smart Reminder Engine**:
   - Medicines, follow-ups, vaccinations, and lab test schedules.
   - Adherence confirmation (`TAKEN`, `SNOOZED`, `MISSED`) with caregiver tracking.
6. **Continuous Health Timeline**:
   - Unified chronological view of consultations, diagnostic reports, and prescriptions.
7. **Caregiver & Assisted Access**:
   - Patient-authorized caregiver relationships with category-specific permissions and assisted uploads.
8. **Tamper-Evident SHA-256 Hash-Chain Audit Logging**:
   - Cryptographically linked audit trail (`previousHash` -> `hash`) with verification API.
9. **HL7 FHIR R4 Interoperability**:
   - Resource mapping for `Patient`, `Observation`, `Condition`, `MedicationRequest`, and `Consent`.

---

## 👥 Six User Roles

| Role | Responsibility |
|---|---|
| **Patient** | Owns records, approves/revokes category-specific consent, tracks reminders. |
| **Doctor** | Scans QR, requests category-scoped access, conducts consultations, runs safety checks. |
| **Caregiver** | Assists patients with reminders and document uploads under explicit consent. |
| **Pharmacist** | Accesses authorized digital prescriptions to dispense generic medicines. |
| **Laboratory** | Uploads diagnostic test values and delivers tamper-evident lab reports. |
| **Administrator** | Verifies clinician credentials and monitors SHA-256 audit chain integrity. |

---

## 🚀 Getting Started

### 1. Installation
```sh
npm install
```

### 2. Run Tests
```sh
npm test
```
All 78 automated integration and unit tests will execute.

### 3. Start Development Server
```sh
# Frontend
npm run dev

# Backend API server
npm run server
```

### 4. Build for Production
```sh
npm run build
```

---

## 🔒 Security & Responsible AI Principles

- **Consent on Every Request**: QR scanning identifies the patient; it never authorizes medical access automatically.
- **Fail-Closed Security**: Denied, expired, or revoked permissions return zero medical data.
- **Non-Hallucinating OCR & AI**: Extracted fields strictly reflect printed document values without inventing missing measurements.
- **Cryptographic Auditability**: SHA-256 hash chaining ensures data tampering is immediately detectable.

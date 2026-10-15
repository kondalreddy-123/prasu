# HC_07_pros
## HealthPass local hackathon prototype

HealthPass is a fictional, browser-local prototype built with React, Vite, TypeScript, and CSS. It has no Supabase, Firebase, cloud database, or remote API runtime. The mock API in `src/api.ts` always serves the local demo store.

## Start and build

```sh
npm install
npm run dev
npm test
npm run build
```

Open the local URL printed by Vite. There are no environment keys or cloud account requirements.

## Demo accounts

Open **More → Sign in**. Sign-in is simulated and every account uses the fictional password `Demo@123`.

| Role | Demo email |
| --- | --- |
| Patient — Ananya Rao | `patient@demo.com` |
| Patient — Aarav Kumar | `child@demo.com` |
| Patient — Lakshmi Narayana | `elder@demo.com` |
| Doctor — Anil Kumar | `village.doctor@demo.com` |
| Doctor — Rahul Sharma | `doctor@demo.com` |
| Doctor — Meera Reddy | `district.doctor@demo.com` |
| Pharmacist | `pharmacy@demo.com` |
| Diagnostic lab | `lab@demo.com` |
| Registry admin | `admin@demo.com` |

To demonstrate pharmacist consent, sign in as the pharmacist, search for a patient's HealthPass ID, and request access. Switch to that patient's demo account and open **Access Requests** (or follow the dashboard alert); approve or reject the prescription-only request. Switch back to the pharmacist account to see the resulting state. Consent requests and demo edits persist in local browser storage on the same browser origin.

## Local storage and reset

The local demo store is versioned and validates its shape when loading. Missing data starts from fictional examples; valid saved data is retained. Corrupt or incompatible data is left untouched and the app falls back to examples rather than overwriting it. A failed storage write returns an error instead of claiming the change was saved. **More → Reset demo data** asks for confirmation and restores the built-in fictional records in this browser.

Browser storage is not encrypted or protected like a medical database. Demo accounts are not real authentication. Consent enforcement is implemented in frontend demo code and can be bypassed by changing the browser. Local data does not sync to another device or browser profile, cannot provide reliable cross-device/concurrent duplicate prevention, and must never contain real patient information.

## Current limitations

- The report explainer can call the optional local OpenAI service when configured. It is a local demo integration only: demo sign-in is simulated, so do not use real patient reports or real patient data. A configured provider may process the de-identified report text under its own terms; the app does not claim a privacy/security review or production authorization.
- The AI key is read only by the loopback Node service and must never be placed in a `VITE_*` variable. The API is disabled until `OPENAI_API_KEY` is set. It sends no report text when the user has not consented, report ownership fails, or source text is unavailable.
- Browser read-aloud uses installed Web Speech voices. English, Telugu, and Hindi voices are not present on every Windows/browser setup; HealthPass will not substitute a different language voice.
- Image and scanned-PDF OCR are not configured. The report explainer uses saved extracted text or the report's textual summary only.
- Camera QR scanning depends on browser camera support and permission. Manual HealthPass ID lookup remains available.
- This prototype uses fictional accounts and example data. Pharmacist identity, clinician credentials, and consent are simulations, not verified claims.
- Supabase migration files remain in `supabase/migrations/` as prior design artifacts only. They are not imported, applied, or used by this local-only app.

## Optional local AI report explanation

Open two Windows Command Prompt windows in the project folder. In the first, set the server-only key and start the loopback AI service:

```cmd
set OPENAI_API_KEY=your_api_key_here
set OPENAI_MODEL=gpt-4o-mini
npm run ai-server
```

In the second window, start the app:

```cmd
npm run dev
```

To run checks:

```cmd
npm test
npm run build
```

The Vite development server proxies the AI route to `127.0.0.1:3031`. Set `REPORT_AI_PORT` to change that port in both windows. `.env.example` lists the variable names but does not load them; set the variables in the server terminal. The AI response is kept in memory only and is not written to browser storage. The AI integration is not included in a production backend or deployment.

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import { getDBStatus } from './db.js';
import { authRouter } from './routes/authRoutes.js';
import { patientRouter } from './routes/patientRoutes.js';
import { providerRouter } from './routes/providerRoutes.js';
import { pharmacyRouter } from './routes/pharmacyRoutes.js';
import { labRouter } from './routes/labRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { emergencyRouter } from './routes/emergencyRoutes.js';
import { emergencyPatientRouter } from './routes/emergencyPatientRoutes.js';
import { clinicalRouter } from './routes/clinicalRoutes.js';
import { caregiverRouter } from './routes/caregiverRoutes.js';
import { reminderRouter } from './routes/reminderRoutes.js';
import { fhirRouter } from './routes/fhirRoutes.js';
import { createReportExplanationService } from './reportExplanationService.mjs';

export const app = express();

// Security & Parsing Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

if (process.env.CORS_ORIGIN) {
  for (const configured of process.env.CORS_ORIGIN.split(',')) {
    const origin = configured.trim();
    if (origin) allowedOrigins.push(origin);
  }
}

const isProduction = process.env.NODE_ENV === 'production';
const localhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, server-to-server) send no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProduction && localhostOrigin.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = getDBStatus();
  res.status(200).json({
    status: 'ok',
    service: 'HealthPass API Backend',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routes
app.use('/api/auth', authRouter);
app.use('/api/patient', patientRouter);
app.use('/api/provider', providerRouter);
app.use('/api/pharmacy', pharmacyRouter);
app.use('/api/lab', labRouter);
app.use('/api/admin', adminRouter);
app.use('/api/emergency-records', emergencyRouter);
app.use('/api/emergency', emergencyPatientRouter);
app.use('/api/clinical', clinicalRouter);
app.use('/api/caregiver', caregiverRouter);
app.use('/api/reminders', reminderRouter);
app.use('/api/fhir', fhirRouter);

// AI Report Explanation Service (integrated from existing reportExplanationServer)
const aiSessionToken = crypto.randomBytes(32).toString('hex');
const explainReport = createReportExplanationService();

app.get('/api/report-explanations/session', (req, res) => {
  res.json({
    token: aiSessionToken,
    configured: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post('/api/report-explanations', async (req, res) => {
  const reqToken = req.headers['x-healthpass-ai-session'];
  if (reqToken && reqToken !== aiSessionToken) {
    return res.status(403).json({ error: 'Invalid AI session. Please refresh.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const result = await explainReport(req.body, controller.signal);
    return res.status(result.status).json(result.data);
  } catch (err) {
    return res.status(500).json({
      code: 'AI_REQUEST_FAILED',
      error: 'The explanation could not be generated. Your original report is unchanged.',
    });
  } finally {
    clearTimeout(timeout);
  }
});

// Fallback 404 for unhandled API endpoints
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[API Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected server error occurred.',
  });
});

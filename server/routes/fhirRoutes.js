import express from 'express';
import { User } from '../models/User.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Medicine } from '../models/Medicine.js';
import { Allergy } from '../models/Allergy.js';
import { ConsentGrant } from '../models/ConsentGrant.js';
import { authenticate } from '../middleware/auth.js';

export const fhirRouter = express.Router();

// GET /api/fhir/patient/:patientId/bundle
// Exports patient records mapped to HL7 FHIR R4 Bundle
fhirRouter.get('/patient/:patientId/bundle', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;

    // Consent / Ownership validation:
    // Only patient themselves, or verified provider with active consent can export
    const isOwner = req.user.role === 'patient' && String(req.user._id) === String(patientId);
    let hasConsent = false;

    if (!isOwner) {
      const grant = await ConsentGrant.findOne({
        patientId,
        providerId: req.user._id,
        status: 'GRANTED',
        expiresAt: { $gt: new Date() },
      });
      hasConsent = Boolean(grant);
    }

    if (!isOwner && !hasConsent && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Consent is required to access FHIR R4 bundle.' });
    }

    const [patient, records, medicines, allergies, grants] = await Promise.all([
      User.findById(patientId),
      HealthRecord.find({ patientId, isActive: true }),
      Medicine.find({ patientId, isActive: true }),
      Allergy.find({ patientId, isActive: true }),
      ConsentGrant.find({ patientId }),
    ]);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const bundleEntries = [];

    // 1. FHIR Patient Resource
    bundleEntries.push({
      fullUrl: `urn:uuid:patient-${patient._id}`,
      resource: {
        resourceType: 'Patient',
        id: patient._id.toString(),
        identifier: [
          {
            system: 'https://healthpass.org/id',
            value: patient.healthPassId || `HP-${patient._id.toString().slice(-6).toUpperCase()}`,
          },
        ],
        name: [
          {
            use: 'official',
            text: patient.name,
          },
        ],
        gender: patient.gender ? patient.gender.toLowerCase() : 'unknown',
        birthDate: patient.dateOfBirth || undefined,
        telecom: patient.phone ? [{ system: 'phone', value: patient.phone }] : [],
      },
    });

    // 2. FHIR Condition Resources (Allergies)
    for (const allergy of allergies) {
      bundleEntries.push({
        fullUrl: `urn:uuid:allergy-${allergy._id}`,
        resource: {
          resourceType: 'AllergyIntolerance',
          id: allergy._id.toString(),
          clinicalStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }],
          },
          verificationStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }],
          },
          code: {
            text: allergy.allergen,
          },
          patient: {
            reference: `Patient/${patient._id}`,
          },
          criticality: allergy.severity === 'HIGH' ? 'high' : 'low',
          reaction: [
            {
              manifestation: [{ text: allergy.reaction || 'Unspecified allergic reaction' }],
            },
          ],
        },
      });
    }

    // 3. FHIR MedicationRequest Resources
    for (const med of medicines) {
      bundleEntries.push({
        fullUrl: `urn:uuid:medication-${med._id}`,
        resource: {
          resourceType: 'MedicationRequest',
          id: med._id.toString(),
          status: med.computedStatus === 'ACTIVE' ? 'active' : 'completed',
          intent: 'order',
          medicationCodeableConcept: {
            text: `${med.name} ${med.strength || ''}`.trim(),
          },
          subject: {
            reference: `Patient/${patient._id}`,
          },
          dosageInstruction: [
            {
              text: med.dosageInstructions || med.dosage || 'As directed',
            },
          ],
        },
      });
    }

    // 4. FHIR Observation Resources (Lab values & reports)
    for (const record of records) {
      bundleEntries.push({
        fullUrl: `urn:uuid:record-${record._id}`,
        resource: {
          resourceType: 'Observation',
          id: record._id.toString(),
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: record.category === 'Laboratory Reports' ? 'laboratory' : 'exam',
                  display: record.category,
                },
              ],
            },
          ],
          code: {
            text: record.title,
          },
          subject: {
            reference: `Patient/${patient._id}`,
          },
          effectiveDateTime: record.reportDate || record.createdAt.toISOString(),
          valueString: record.resultSummary || undefined,
        },
      });
    }

    // 5. FHIR Consent Resources
    for (const grant of grants) {
      bundleEntries.push({
        fullUrl: `urn:uuid:consent-${grant._id}`,
        resource: {
          resourceType: 'Consent',
          id: grant._id.toString(),
          status: grant.status === 'GRANTED' ? 'active' : grant.status === 'REVOKED' ? 'inactive' : 'draft',
          scope: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }],
          },
          patient: {
            reference: `Patient/${patient._id}`,
          },
          provision: {
            type: grant.status === 'GRANTED' ? 'permit' : 'deny',
            period: {
              end: grant.expiresAt ? grant.expiresAt.toISOString() : undefined,
            },
          },
        },
      });
    }

    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: bundleEntries.length,
      entry: bundleEntries,
    };

    return res.status(200).json(fhirBundle);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate FHIR R4 resource bundle.' });
  }
});

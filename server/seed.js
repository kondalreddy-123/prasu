import { User } from './models/User.js';
import { PatientProfile } from './models/PatientProfile.js';

export async function seedDemoAccounts() {
  try {
    const demoUsers = [
      {
        name: 'Ananya Rao',
        email: 'ananya.rao@healthpass.org',
        password: 'Patient@2026',
        role: 'patient',
        healthPassId: 'HP-PAT-0417',
        isVerified: true,
        bloodGroup: 'O+',
        gender: 'Female',
        dateOfBirth: '1994-05-12',
        phone: '+91 98480 12345',
        profile: {
          knownAllergies: 'Sulfa Drugs (Sulfonamides)',
          currentMedications: 'Metformin 500mg, Telmisartan 40mg',
          existingConditions: 'Type 2 Diabetes, Mild Hypertension',
          bloodGroup: 'O+',
          age: 32,
          dateOfBirth: '1994-05-12',
          emergencyContactName: 'Sunita Rao',
          emergencyContactRelation: 'Sister',
          emergencyContactPhone: '+91 98480 22334',
          vitals: {
            bloodPressure: '124/82 mmHg',
            fastingSugar: '112 mg/dL',
            weight: '62 kg',
            immunizationStatus: 'Up to date (COVID-19 Booster completed)',
          },
        },
      },
      {
        name: 'Dr. Priya Sharma, MBBS, MD',
        email: 'dr.priya@apollohealth.org',
        password: 'Doctor@2026',
        role: 'doctor',
        facilityName: 'Apex Multispecialty Hospital',
        facilityLevel: 'DISTRICT',
        licenseNumber: 'MCI-2026-9842',
        isVerified: true,
      },
      {
        name: 'Dr. Anil Kumar, MBBS',
        email: 'village.doctor@demo.com',
        password: 'Doctor@2026',
        role: 'doctor',
        facilityName: 'Village Health Centre, Kothapalli',
        facilityLevel: 'VILLAGE',
        licenseNumber: 'MCI-2026-1049',
        isVerified: true,
      },
      {
        name: 'Rajesh Verma, B.Pharm',
        email: 'rajesh.pharmacy@janaushadhi.gov',
        password: 'Pharma@2026',
        role: 'pharmacy',
        facilityName: 'Pradhan Mantri Jan Aushadhi Kendra #1042',
        facilityLevel: 'PHARMACY',
        licenseNumber: '20-B/21-B MH-9841',
        isVerified: true,
      },
      {
        name: 'Dr. Sunita Patil, MD Path',
        email: 'sunita.path@apexdiagnostics.org',
        password: 'LabPath@2026',
        role: 'lab',
        facilityName: 'Apex Diagnostics & NABL Pathology Lab',
        facilityLevel: 'LAB',
        licenseNumber: 'NABL-MC-2026-081',
        isVerified: true,
      },
      {
        name: 'Sunita Rao (Family Caregiver)',
        email: 'sunita.caregiver@demo.com',
        password: 'Demo@123',
        role: 'caregiver',
        healthPassId: 'HP-CG-8821',
        isVerified: true,
      },
      {
        name: 'Hospital Administrator',
        email: 'admin@hospital.org',
        password: 'AdminPassword123!',
        role: 'admin',
        isVerified: true,
      },
    ];

    for (const item of demoUsers) {
      const { profile, ...userData } = item;
      const cleanEmail = userData.email.toLowerCase();
      const exists = await User.findOne({ email: cleanEmail });
      if (!exists) {
        const user = new User(userData);
        await user.save();
        if (user.role === 'patient' && profile) {
          await PatientProfile.create({
            patientId: user._id,
            ...profile,
          });
        }
        console.log(`[HealthPass DB] Seeded demo user: ${user.email} (${user.role})`);
      }
    }
  } catch (err) {
    console.warn('[HealthPass DB] Seeding note:', err.message);
  }
}

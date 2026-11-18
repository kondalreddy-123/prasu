import React, { useState } from 'react';
import {
  Heart,
  Plus,
  QrCode,
  Shield,
  Upload,
  UserCheck,
  Users,
  Bell,
  FileText,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { SmartReminderWorkspace } from './SmartReminderWorkspace.tsx';

export interface LinkedPatient {
  id: string;
  name: string;
  healthPassId: string;
  relationship: string;
  grantedCategories: string[];
  canManageReminders: boolean;
  canUploadRecords: boolean;
  bloodGroup?: string;
  phone?: string;
}

interface Props {
  language?: 'EN' | 'TE' | 'HI';
  onUploadAssistedRecord?: (patientId: string) => void;
}

const SAMPLE_LINKED_PATIENTS: LinkedPatient[] = [
  {
    id: 'pat-ramesh',
    name: 'Ramesh Rao',
    healthPassId: 'HP-998241',
    relationship: 'Father',
    grantedCategories: [
      'Medications & Prescriptions',
      'Laboratory Reports',
      'General Medical History',
    ],
    canManageReminders: true,
    canUploadRecords: true,
    bloodGroup: 'B+',
    phone: '+91 98480 22334',
  },
  {
    id: 'pat-lakshmi',
    name: 'Lakshmi Narayana',
    healthPassId: 'HP-ELDER01',
    relationship: 'Elder Family Member',
    grantedCategories: ['Medications & Prescriptions', 'Laboratory Reports'],
    canManageReminders: true,
    canUploadRecords: true,
    bloodGroup: 'O+',
    phone: '+91 94401 55667',
  },
];

export const CaregiverWorkspace: React.FC<Props> = ({
  language = 'EN',
  onUploadAssistedRecord,
}) => {
  const [patients, setPatients] = useState<LinkedPatient[]>(SAMPLE_LINKED_PATIENTS);
  const [activePatient, setActivePatient] = useState<LinkedPatient>(SAMPLE_LINKED_PATIENTS[0]);
  const [newHealthPassId, setNewHealthPassId] = useState<string>('');
  const [relationshipType, setRelationshipType] = useState<string>('Family Member');
  const [isLinkingOpen, setIsLinkingOpen] = useState<boolean>(false);
  const [linkSuccess, setLinkSuccess] = useState<string>('');

  const handleLinkPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHealthPassId.trim()) return;

    const newPat: LinkedPatient = {
      id: `pat-${Date.now()}`,
      name: `Patient (${newHealthPassId.trim().toUpperCase()})`,
      healthPassId: newHealthPassId.trim().toUpperCase(),
      relationship: relationshipType,
      grantedCategories: ['Medications & Prescriptions', 'Laboratory Reports'],
      canManageReminders: true,
      canUploadRecords: true,
    };

    setPatients((prev) => [newPat, ...prev]);
    setActivePatient(newPat);
    setLinkSuccess(`Successfully requested caregiver link for ${newHealthPassId.toUpperCase()}.`);
    setNewHealthPassId('');
    setIsLinkingOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold">
                {language === 'TE'
                  ? 'సంరక్షకుల వర్క్‌స్పేస్ (కేర్‌గివర్)'
                  : language === 'HI'
                  ? 'देखभालकर्ता कार्यक्षेत्र (केयरगिवर)'
                  : 'Caregiver & Assisted Care Workspace'}
              </h2>
            </div>
            <p className="text-xs text-indigo-200 mt-1 max-w-2xl leading-relaxed">
              Family members and community health workers assist elderly or rural patients with medicine schedules, appointment reminders, and record uploads under explicit patient consent.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsLinkingOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Link Patient by HealthPass ID
          </button>
        </div>
      </div>

      {/* Success alert */}
      {linkSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <span>{linkSuccess}</span>
          <button type="button" onClick={() => setLinkSuccess('')} className="font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Linking Modal */}
      {isLinkingOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Link Patient for Assisted Care
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter the patient's HealthPass ID printed on their card or displayed in their profile.
            </p>

            <form onSubmit={handleLinkPatient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  HealthPass ID (e.g., HP-998241)
                </label>
                <input
                  type="text"
                  required
                  value={newHealthPassId}
                  onChange={(e) => setNewHealthPassId(e.target.value)}
                  placeholder="HP-XXXXXX"
                  className="w-full px-3 py-2 text-sm uppercase rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Relationship to Patient
                </label>
                <select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Family Member">Family Member</option>
                  <option value="Child / Son / Daughter">Child (Son / Daughter)</option>
                  <option value="Parent">Parent</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Community Health Worker (ASHA / ANM)">
                    Community Health Worker (ASHA / ANM)
                  </option>
                  <option value="Legal Guardian">Legal Guardian</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Caregivers never bypass patient consent. The patient may review, modify category permissions, or revoke access at any time.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkingOpen(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 shadow-sm"
                >
                  Confirm Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Selection Selector */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {patients.map((pat) => (
          <button
            key={pat.id}
            type="button"
            onClick={() => setActivePatient(pat)}
            className={`p-3 rounded-2xl border text-left shrink-0 transition-all flex items-center gap-3 cursor-pointer ${
              activePatient.id === pat.id
                ? 'bg-white border-indigo-500 shadow-md ring-2 ring-indigo-100'
                : 'bg-white/80 border-slate-200 hover:bg-white text-slate-600'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                activePatient.id === pat.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {pat.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">{pat.name}</div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span>{pat.relationship}</span>
                <span>·</span>
                <span className="font-mono text-indigo-700 font-semibold">{pat.healthPassId}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Active Patient Assisted Management Panel */}
      {activePatient && (
        <div className="space-y-6">
          {/* Patient Overview Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                  Assisted Care Active
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {activePatient.name} ({activePatient.healthPassId})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authorized Categories: {activePatient.grantedCategories.join(', ')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUploadAssistedRecord && onUploadAssistedRecord(activePatient.id)}
                  className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Document for Patient
                </button>
              </div>
            </div>
          </div>

          {/* Assisted Reminders Tracking */}
          <SmartReminderWorkspace
            language={language}
            isCaregiverView={true}
          />
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Pill,
  Plus,
  RotateCcw,
  UserCheck,
} from 'lucide-react';

export interface SmartReminderItem {
  id: string;
  type: 'MEDICINE' | 'APPOINTMENT' | 'LAB_TEST' | 'VACCINATION' | 'FOLLOW_UP';
  title: string;
  dosage?: string;
  frequency: string;
  scheduledTime: string;
  dueDate: string;
  status: 'SCHEDULED' | 'TAKEN' | 'MISSED' | 'SNOOZED';
  source?: string;
}

interface Props {
  reminders?: SmartReminderItem[];
  onAdherenceUpdate?: (id: string, status: 'TAKEN' | 'MISSED' | 'SNOOZED' | 'SCHEDULED') => void;
  language?: 'EN' | 'TE' | 'HI';
  isCaregiverView?: boolean;
}

const DEFAULT_REMINDERS: SmartReminderItem[] = [
  {
    id: 'rem-1',
    type: 'MEDICINE',
    title: 'Metformin 500mg',
    dosage: '1 tablet after breakfast',
    frequency: 'Daily',
    scheduledTime: '08:30 AM',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'TAKEN',
    source: 'Verified Prescription · Dr. Vikram Patel',
  },
  {
    id: 'rem-2',
    type: 'MEDICINE',
    title: 'Atorvastatin 10mg',
    dosage: '1 tablet before bedtime',
    frequency: 'Daily',
    scheduledTime: '09:30 PM',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'SCHEDULED',
    source: 'Verified Prescription · Dr. Vikram Patel',
  },
  {
    id: 'rem-3',
    type: 'LAB_TEST',
    title: 'Fasting Blood Sugar & HbA1c',
    frequency: 'Once',
    scheduledTime: '08:00 AM',
    dueDate: '2026-11-25',
    status: 'SCHEDULED',
    source: 'Lab Follow-up Recommendation',
  },
  {
    id: 'rem-4',
    type: 'FOLLOW_UP',
    title: 'Routine Health Consultation',
    frequency: 'Once',
    scheduledTime: '10:00 AM',
    dueDate: '2026-12-05',
    status: 'SCHEDULED',
    source: 'Primary Health Centre',
  },
];

export const SmartReminderWorkspace: React.FC<Props> = ({
  reminders = DEFAULT_REMINDERS,
  onAdherenceUpdate,
  language = 'EN',
  isCaregiverView = false,
}) => {
  const [items, setItems] = useState<SmartReminderItem[]>(reminders);
  const [filterType, setFilterType] = useState<string>('ALL');

  const handleUpdate = (id: string, status: 'TAKEN' | 'MISSED' | 'SNOOZED' | 'SCHEDULED') => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
    if (onAdherenceUpdate) onAdherenceUpdate(id, status);
  };

  const filtered = items.filter((item) =>
    filterType === 'ALL' ? true : item.type === filterType
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-bold text-slate-800">
              {language === 'TE'
                ? 'స్మార్ట్ రిమైండర్ ఇంజిన్ (పిల్లర్ 5)'
                : language === 'HI'
                ? 'स्मार्ट रिमाइंडर इंजन (पिलर 5)'
                : 'HealthPass Smart Reminder Engine'}
            </h3>
            {isCaregiverView && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Caregiver Tracking
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Medicines and doctor appointments driven by verified clinical instructions. Works offline and syncs automatically.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
          {['ALL', 'MEDICINE', 'LAB_TEST', 'FOLLOW_UP'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                filterType === tab
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab === 'ALL'
                ? 'All Reminders'
                : tab === 'MEDICINE'
                ? 'Medicines'
                : tab === 'LAB_TEST'
                ? 'Lab Tests'
                : 'Follow-ups'}
            </button>
          ))}
        </div>
      </div>

      {/* Reminder Cards Grid */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-xl border transition-all ${
              item.status === 'TAKEN'
                ? 'bg-emerald-50/40 border-emerald-200'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.type === 'MEDICINE'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-cyan-100 text-cyan-800'
                  }`}
                >
                  {item.type === 'MEDICINE' ? (
                    <Pill className="w-5 h-5" />
                  ) : (
                    <Calendar className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{item.title}</h4>
                  {item.dosage && (
                    <p className="text-xs text-slate-600 mt-0.5">{item.dosage}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.scheduledTime}
                    </span>
                    <span>·</span>
                    <span>{item.frequency}</span>
                    <span>·</span>
                    <span>{item.dueDate}</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  item.status === 'TAKEN'
                    ? 'bg-emerald-100 text-emerald-800'
                    : item.status === 'MISSED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {item.status}
              </span>
            </div>

            {/* Action Bar */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                {item.source}
              </span>

              <div className="flex items-center gap-2">
                {item.status !== 'TAKEN' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUpdate(item.id, 'TAKEN')}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {language === 'TE' ? 'తీసుకున్నాను' : language === 'HI' ? 'ले ली' : 'Taken'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate(item.id, 'SNOOZED')}
                      className="px-2 py-1 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Snooze
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpdate(item.id, 'SCHEDULED')}
                    className="text-slate-500 hover:text-slate-700 text-xs flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

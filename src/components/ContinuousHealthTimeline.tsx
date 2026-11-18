import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  FlaskConical,
  HeartPulse,
  Pill,
  Search,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  type: 'CONSULTATION' | 'LAB_REPORT' | 'PRESCRIPTION' | 'DISCHARGE_SUMMARY' | 'VACCINATION';
  title: string;
  category: string;
  date: string;
  facility: string;
  provider: string;
  summary: string;
  isVerified: boolean;
  statusColor?: 'NORMAL' | 'ATTENTION' | 'CRITICAL';
}

const SAMPLE_TIMELINE: TimelineEvent[] = [
  {
    id: 'tl-1',
    type: 'LAB_REPORT',
    title: 'Comprehensive Metabolic Panel',
    category: 'Laboratory Reports',
    date: '2026-11-12',
    facility: 'City Diagnostic Laboratory',
    provider: 'Dr. Vikram Patel',
    summary: 'Fasting glucose 118 mg/dL (Above range), Hb 11.2 g/dL (Below range)',
    isVerified: true,
    statusColor: 'ATTENTION',
  },
  {
    id: 'tl-2',
    type: 'CONSULTATION',
    title: 'Outpatient Follow-up Consultation',
    category: 'Consultation History',
    date: '2026-11-05',
    facility: 'Community Health Centre',
    provider: 'Dr. Anil Kumar',
    summary: 'Blood pressure 128/82 mmHg. Vitals stable. Lifestyle modifications discussed.',
    isVerified: true,
    statusColor: 'NORMAL',
  },
  {
    id: 'tl-3',
    type: 'PRESCRIPTION',
    title: 'Antidiabetic & Lipid Maintenance Therapy',
    category: 'Medications & Prescriptions',
    date: '2026-10-20',
    facility: 'District Hospital',
    provider: 'Dr. Meera Reddy',
    summary: 'Metformin 500mg (Daily), Atorvastatin 10mg (Bedtime). Prescribed for 90 days.',
    isVerified: true,
    statusColor: 'NORMAL',
  },
  {
    id: 'tl-4',
    type: 'DISCHARGE_SUMMARY',
    title: 'Post-Observation Summary',
    category: 'General Medical History',
    date: '2026-09-15',
    facility: 'District Hospital',
    provider: 'Dr. Vikram Patel',
    summary: 'Evaluated for acute viral symptoms. Discharged with oral hydration and antipyretics.',
    isVerified: true,
    statusColor: 'NORMAL',
  },
];

interface Props {
  events?: TimelineEvent[];
  language?: 'EN' | 'TE' | 'HI';
}

export const ContinuousHealthTimeline: React.FC<Props> = ({
  events = SAMPLE_TIMELINE,
  language = 'EN',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = events.filter((e) => {
    const matchesCat = selectedCategory === 'ALL' || e.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.facility.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'CONSULTATION':
        return <Stethoscope className="w-4 h-4 text-teal-600" />;
      case 'LAB_REPORT':
        return <FlaskConical className="w-4 h-4 text-cyan-600" />;
      case 'PRESCRIPTION':
        return <Pill className="w-4 h-4 text-emerald-600" />;
      case 'DISCHARGE_SUMMARY':
      default:
        return <FileText className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-bold text-slate-800">
              {language === 'TE'
                ? 'నిరంతర ఆరోగ్య కాలక్రమం'
                : language === 'HI'
                ? 'निरंतर स्वास्थ्य समयरेखा'
                : 'Continuous Health Timeline'}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
              One Verified Chronological Record
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consolidating consultations, laboratory reports, discharge summaries, and prescriptions across all visits.
          </p>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search timeline..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 w-48"
          />
        </div>
      </div>

      {/* Timeline List */}
      <div className="p-5">
        <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
          {filtered.map((item) => (
            <div key={item.id} className="relative pl-6">
              {/* Timeline Marker Dot */}
              <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center shadow-xs">
                {getEventIcon(item.type)}
              </div>

              {/* Event Card */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 hover:shadow-sm transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{item.title}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                      {item.category}
                    </span>
                    {item.isVerified && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" /> Clinician Verified
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {item.date}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed mt-1">{item.summary}</p>

                <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Issued by: <strong>{item.provider}</strong> · {item.facility}
                  </span>
                  <span className="text-teal-700 font-medium flex items-center gap-0.5 hover:underline cursor-pointer">
                    Source Document <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

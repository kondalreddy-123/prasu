import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export interface LabResultItem {
  testName: string;
  result: string;
  numericValue?: number;
  unit: string;
  referenceRange: string;
  status: 'BELOW_RANGE' | 'WITHIN_RANGE' | 'ABOVE_RANGE' | 'NORMAL' | 'ATTENTION';
  previousValue?: string;
  trend?: 'HIGHER' | 'LOWER' | 'STABLE';
}

export interface MedicalCheckupReport {
  id: string;
  title: string;
  date: string;
  facility: string;
  doctorReviewer?: string;
  items: LabResultItem[];
  trendSummary?: string;
  simpleExplanation: string;
  discussionQuestions: string[];
}

interface Props {
  report?: MedicalCheckupReport;
  reportsHistory?: MedicalCheckupReport[];
  language?: 'EN' | 'TE' | 'HI';
}

const DEFAULT_REPORT: MedicalCheckupReport = {
  id: 'rep-sample-01',
  title: 'Comprehensive Metabolic & Blood Profile',
  date: '2026-11-12',
  facility: 'City Diagnostic Laboratory',
  doctorReviewer: 'Dr. Vikram Patel, MD',
  items: [
    {
      testName: 'Hemoglobin',
      result: '11.2',
      numericValue: 11.2,
      unit: 'g/dL',
      referenceRange: '12.0 - 15.5',
      status: 'BELOW_RANGE',
      previousValue: '11.8',
      trend: 'LOWER',
    },
    {
      testName: 'Fasting Blood Glucose',
      result: '118',
      numericValue: 118,
      unit: 'mg/dL',
      referenceRange: '70 - 99',
      status: 'ABOVE_RANGE',
      previousValue: '111',
      trend: 'HIGHER',
    },
    {
      testName: 'Total Cholesterol',
      result: '189',
      numericValue: 189,
      unit: 'mg/dL',
      referenceRange: '< 200',
      status: 'WITHIN_RANGE',
      previousValue: '195',
      trend: 'LOWER',
    },
    {
      testName: 'Serum Creatinine',
      result: '0.9',
      numericValue: 0.9,
      unit: 'mg/dL',
      referenceRange: '0.6 - 1.2',
      status: 'WITHIN_RANGE',
      previousValue: '0.9',
      trend: 'STABLE',
    },
  ],
  trendSummary: 'Fasting glucose has trended slightly higher across the last three reports (104 -> 111 -> 118 mg/dL).',
  simpleExplanation:
    'Your fasting glucose is above the reference range printed on this report, and hemoglobin is slightly below it. These numbers are observations for doctor review, never a standalone diagnosis.',
  discussionQuestions: [
    'Should my fasting blood sugar be rechecked, and should an HbA1c test be scheduled?',
    'Does the slightly lower hemoglobin require dietary adjustments or further iron studies?',
    'Are my current kidney function parameters and cholesterol within targets?',
  ],
};

export const MedicalCheckupAnalyser: React.FC<Props> = ({
  report = DEFAULT_REPORT,
  language = 'EN',
}) => {
  const [selectedTest, setSelectedTest] = useState<string>('Fasting Blood Glucose');

  const getStatusBadge = (status: LabResultItem['status']) => {
    switch (status) {
      case 'BELOW_RANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <ArrowDown className="w-3 h-3" />
            {language === 'TE' ? 'తక్కువ పరిధి' : language === 'HI' ? 'सीमा से कम' : 'BELOW RANGE'}
          </span>
        );
      case 'ABOVE_RANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <ArrowUp className="w-3 h-3" />
            {language === 'TE' ? 'ఎక్కువ పరిధి' : language === 'HI' ? 'सीमा से अधिक' : 'ABOVE RANGE'}
          </span>
        );
      case 'WITHIN_RANGE':
      case 'NORMAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" />
            {language === 'TE' ? 'సాధారణ పరిధి' : language === 'HI' ? 'सामान्य सीमा' : 'WITHIN RANGE'}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-800 to-cyan-900 text-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-300" />
              <h3 className="text-lg font-bold">
                {language === 'TE'
                  ? 'AI మెడికల్ చెకప్ ఎనలైజర్ (పిల్లర్ 3)'
                  : language === 'HI'
                  ? 'एआई मेडिकल चेकअप विश्लेषक (पिलर 3)'
                  : 'AI Medical Checkup Analyser & Trends'}
              </h3>
            </div>
            <p className="text-xs text-cyan-100 mt-1">
              {report.title} · {report.facility} · {report.date}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur-sm text-cyan-200 text-xs rounded-full font-medium border border-white/20">
              Informational Support · Not Clinical Diagnosis
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Report Table & Trends */}
      <div className="p-5 space-y-6">
        {/* Lab Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-medium">
                <th className="pb-3 px-3">Test Name</th>
                <th className="pb-3 px-3">Current Result</th>
                <th className="pb-3 px-3">Reference Range</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Previous</th>
                <th className="pb-3 px-3">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.items.map((item) => (
                <tr
                  key={item.testName}
                  onClick={() => setSelectedTest(item.testName)}
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                    selectedTest === item.testName ? 'bg-cyan-50/50' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-semibold text-slate-800 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.status === 'ABOVE_RANGE'
                          ? 'bg-rose-500'
                          : item.status === 'BELOW_RANGE'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    {item.testName}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {item.result} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-mono text-xs">
                    {item.referenceRange} {item.unit}
                  </td>
                  <td className="py-3 px-3">{getStatusBadge(item.status)}</td>
                  <td className="py-3 px-3 text-slate-600">
                    {item.previousValue ? `${item.previousValue} ${item.unit}` : '—'}
                  </td>
                  <td className="py-3 px-3">
                    {item.trend === 'HIGHER' ? (
                      <span className="flex items-center gap-1 text-xs text-rose-600 font-medium">
                        <TrendingUp className="w-3.5 h-3.5" /> Higher
                      </span>
                    ) : item.trend === 'LOWER' ? (
                      <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <TrendingDown className="w-3.5 h-3.5" /> Lower
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Stable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Visual Trend Card (As designed in PDF Page 3) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-cyan-100 bg-cyan-50/30">
            <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-700" />
              Glucose Trend · Observed, not a conclusion
            </h4>
            <div className="flex items-end justify-between h-24 pt-4 px-6 bg-white rounded-lg border border-cyan-100">
              <div className="text-center">
                <div className="text-xs font-bold text-slate-700 mb-1">104</div>
                <div className="w-8 bg-cyan-200 rounded-t h-10 mx-auto" />
                <div className="text-[11px] text-slate-500 mt-1 font-medium">Mar</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-slate-700 mb-1">111</div>
                <div className="w-8 bg-cyan-400 rounded-t h-14 mx-auto" />
                <div className="text-[11px] text-slate-500 mt-1 font-medium">Jul</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-rose-600 mb-1">118</div>
                <div className="w-8 bg-rose-400 rounded-t h-18 mx-auto" />
                <div className="text-[11px] text-slate-500 mt-1 font-medium">Nov</div>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-2 italic">
              {report.trendSummary}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-teal-600" />
                Simple-Language Explanation
              </h4>
              <p className="text-xs leading-relaxed text-slate-700">
                {report.simpleExplanation}
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200/60">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-600" />
                Questions to discuss with your doctor
              </div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                {report.discussionQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Safety Footer */}
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Every value links back to original report page. No autonomous diagnoses, no prescribing, and no medication changes.
          </span>
        </div>
      </div>
    </div>
  );
};

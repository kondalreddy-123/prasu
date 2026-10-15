import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CheckCircle2,
  FileText,
  HeartPulse,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
  Volume2,
} from 'lucide-react';
import { SupportedLang } from '../i18n/translations.ts';

type Journey = 'patient' | 'doctor';

const WALKTHROUGH_COPY = {
  EN: {
    title: 'How HealthPass works',
    subtitle: 'Choose a journey. Follow one simple step at a time.',
    patientJourney: 'Patient Journey',
    doctorJourney: 'Doctor Journey',
    step: 'Step',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
    readAloud: 'Read aloud',
    stopReading: 'Stop reading',
    speechUnavailable: 'Read aloud is not available on this device. The step text is shown here.',
    tryPatient: 'Try Patient Demo',
    tryDoctor: 'Try Doctor Demo',
    demoNote: 'Demo only · uses fictional sample records. This walkthrough illustrates the consent flow; it does not prove backend security.',
    patient: [
      ['Open My HealthPass', 'Open your patient dashboard to see your health information and sharing choices.'],
      ['View your medical reports', 'Choose My Reports to see reports saved in your HealthPass.'],
      ['Ask AI to explain a report', 'Open a doctor-uploaded report and choose “Explain with AI”.'],
      ['Read or listen to the summary', 'Choose a supported language. Read the simple summary or use Read Aloud.'],
      ['Review a doctor’s request', 'Check which record categories the doctor wants to see and for how long.'],
      ['Choose what to share', 'Approve or reject the request. You can revoke access later from your sharing choices.'],
    ],
    doctor: [
      ['Open the Doctor Dashboard', 'Start in your existing HealthPass doctor workspace.'],
      ['Find the patient', 'Search using the patient’s HealthPass ID or scan their QR code.'],
      ['Request the records you need', 'Choose specific record categories and explain why access is needed.'],
      ['Wait for the patient’s choice', 'The patient reviews your request and decides whether to share.'],
      ['View approved records', 'When access is granted, view only the categories the patient approved.'],
      ['Upload a medical report', 'Upload the report to the selected patient’s profile. The patient can then ask AI to explain it.'],
    ],
  },
  HI: {
    title: 'HealthPass कैसे काम करता है',
    subtitle: 'एक यात्रा चुनें और हर कदम को आसान तरीके से देखें।',
    patientJourney: 'मरीज की यात्रा',
    doctorJourney: 'डॉक्टर की यात्रा',
    step: 'कदम',
    of: 'में से',
    previous: 'पिछला',
    next: 'अगला',
    readAloud: 'ज़ोर से सुनें',
    stopReading: 'पढ़ना रोकें',
    speechUnavailable: 'इस डिवाइस पर पढ़कर सुनाने की सुविधा उपलब्ध नहीं है। कदम का विवरण यहां दिया गया है।',
    tryPatient: 'मरीज डेमो देखें',
    tryDoctor: 'डॉक्टर डेमो देखें',
    demoNote: 'केवल डेमो · काल्पनिक रिकॉर्ड इस्तेमाल होते हैं। यह तरीका सहमति की प्रक्रिया दिखाता है, बैकएंड सुरक्षा साबित नहीं करता।',
    patient: [
      ['My HealthPass खोलें', 'अपनी स्वास्थ्य जानकारी और साझा करने के विकल्प देखने के लिए मरीज डैशबोर्ड खोलें।'],
      ['मेडिकल रिपोर्ट देखें', 'HealthPass में सेव रिपोर्ट देखने के लिए My Reports चुनें।'],
      ['AI से रिपोर्ट समझें', 'डॉक्टर की अपलोड की हुई रिपोर्ट खोलें और “Explain with AI” चुनें।'],
      ['सारांश पढ़ें या सुनें', 'उपलब्ध भाषा चुनें। आसान सारांश पढ़ें या उसे सुनें।'],
      ['डॉक्टर का अनुरोध देखें', 'जांचें कि डॉक्टर किन रिकॉर्ड श्रेणियों को कितनी देर तक देखना चाहते हैं।'],
      ['तय करें क्या साझा करना है', 'अनुरोध स्वीकार या अस्वीकार करें। बाद में साझा करने की अनुमति वापस ले सकते हैं।'],
    ],
    doctor: [
      ['Doctor Dashboard खोलें', 'अपने मौजूदा HealthPass डॉक्टर कार्यक्षेत्र से शुरू करें।'],
      ['मरीज खोजें', 'मरीज की HealthPass ID से खोजें या QR कोड स्कैन करें।'],
      ['जरूरी रिकॉर्ड का अनुरोध करें', 'विशिष्ट रिकॉर्ड श्रेणियां चुनें और बताएं कि आपको पहुंच क्यों चाहिए।'],
      ['मरीज के फैसले का इंतजार करें', 'मरीज आपके अनुरोध की समीक्षा करके तय करता है कि क्या साझा करना है।'],
      ['स्वीकृत रिकॉर्ड देखें', 'अनुमति मिलने पर केवल वही श्रेणियां देखें जिन्हें मरीज ने मंजूरी दी है।'],
      ['मेडिकल रिपोर्ट अपलोड करें', 'रिपोर्ट चुने हुए मरीज की प्रोफ़ाइल में अपलोड करें। मरीज फिर AI से इसे समझ सकता है।'],
    ],
  },
  TE: {
    title: 'హెల్త్‌పాస్ ఎలా పనిచేస్తుంది',
    subtitle: 'ఒక ప్రయాణాన్ని ఎంచుకుని, ఒక్కో దశను చూడండి.',
    patientJourney: 'రోగి ప్రయాణం',
    doctorJourney: 'డాక్టర్ ప్రయాణం',
    step: 'దశ',
    of: 'లో',
    previous: 'వెనక్కి',
    next: 'తర్వాత',
    readAloud: 'చదివి వినిపించు',
    stopReading: 'చదవడం ఆపు',
    speechUnavailable: 'ఈ పరికరంలో చదివి వినిపించే సౌకర్యం లేదు. దశ వివరాలు ఇక్కడ కనిపిస్తాయి.',
    tryPatient: 'రోగి డెమో చూడండి',
    tryDoctor: 'డాక్టర్ డెమో చూడండి',
    demoNote: 'డెమో మాత్రమే · కల్పిత నమూనా రికార్డులు ఉపయోగిస్తాయి. ఈ వివరణ అనుమతి విధానాన్ని చూపిస్తుంది; బ్యాకెండ్ భద్రతను నిరూపించదు.',
    patient: [
      ['నా హెల్త్‌పాస్ తెరవండి', 'మీ ఆరోగ్య సమాచారం, భాగస్వామ్య ఎంపికలను చూడటానికి రోగి డాష్‌బోర్డ్ తెరవండి.'],
      ['వైద్య నివేదికలు చూడండి', 'మీ హెల్త్‌పాస్‌లో సేవ్ చేసిన నివేదికలను చూడటానికి నా నివేదికలు ఎంచుకోండి.'],
      ['నివేదికను AIతో వివరించండి', 'డాక్టర్ అప్‌లోడ్ చేసిన నివేదికను తెరిచి “AIతో వివరించండి” ఎంచుకోండి.'],
      ['సారాంశం చదవండి లేదా వినండి', 'అందుబాటులో ఉన్న భాషను ఎంచుకోండి. సులభమైన సారాంశం చదవండి లేదా వినండి.'],
      ['డాక్టర్ అభ్యర్థన చూడండి', 'డాక్టర్ ఏ రికార్డు విభాగాలను, ఎంతసేపు చూడాలనుకుంటున్నారో పరిశీలించండి.'],
      ['ఏది పంచుకోవాలో ఎంచుకోండి', 'అభ్యర్థనను ఆమోదించండి లేదా తిరస్కరించండి. తర్వాత ఎప్పుడైనా అనుమతిని రద్దు చేయవచ్చు.'],
    ],
    doctor: [
      ['డాక్టర్ డాష్‌బోర్డ్ తెరవండి', 'మీ ప్రస్తుత హెల్త్‌పాస్ డాక్టర్ వర్క్‌స్పేస్‌ను తెరవండి.'],
      ['రోగిని కనుగొనండి', 'రోగి హెల్త్‌పాస్ ఐడీతో వెతకండి లేదా వారి క్యూఆర్ కోడ్ స్కాన్ చేయండి.'],
      ['అవసరమైన రికార్డులు కోరండి', 'నిర్దిష్ట రికార్డు విభాగాలు ఎంచుకుని, యాక్సెస్ ఎందుకు కావాలో వివరించండి.'],
      ['రోగి నిర్ణయం కోసం వేచి ఉండండి', 'మీ అభ్యర్థనను రోగి పరిశీలించి, పంచుకోవాలో నిర్ణయిస్తారు.'],
      ['ఆమోదించిన రికార్డులు చూడండి', 'అనుమతి వచ్చిన తర్వాత, రోగి ఆమోదించిన విభాగాలను మాత్రమే చూడండి.'],
      ['వైద్య నివేదిక అప్‌లోడ్ చేయండి', 'ఎంచుకున్న రోగి ప్రొఫైల్‌కు నివేదిక అప్‌లోడ్ చేయండి. రోగి దానిని AIతో వివరించుకోవచ్చు.'],
    ],
  },
} as const;

const STEP_ICONS: Record<Journey, React.ElementType[]> = {
  patient: [HeartPulse, FileText, Sparkles, AudioLines, ShieldCheck, CheckCircle2],
  doctor: [Stethoscope, QrCode, LockKeyhole, Activity, ShieldCheck, Upload],
};

interface HowItWorksWalkthroughProps {
  lang: SupportedLang;
  onTryPatientDemo: () => void;
  onTryDoctorDemo: () => void;
}

export const HowItWorksWalkthrough: React.FC<HowItWorksWalkthroughProps> = ({
  lang,
  onTryPatientDemo,
  onTryDoctorDemo,
}) => {
  const language: 'EN' | 'TE' | 'HI' = lang === 'TE' ? 'TE' : lang === 'HI' ? 'HI' : 'EN';
  const copy = WALKTHROUGH_COPY[language];
  const [journey, setJourney] = useState<Journey>('patient');
  const [stepIndex, setStepIndex] = useState(0);
  const [speechError, setSpeechError] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const steps = copy[journey];
  const current = steps[stepIndex];
  const IllustrationIcon = STEP_ICONS[journey][stepIndex] || Activity;
  const SecurityIcon = journey === 'doctor' ? QrCode : ShieldCheck;

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    setSpeechError(false);
    setIsSpeaking(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  }, [journey, stepIndex, language]);

  const readCurrentStep = () => {
    setSpeechError(false);
    if (typeof window !== 'undefined' && isSpeaking && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechError(true);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${current[0]}. ${current[1]}`);
    utterance.lang = language === 'TE' ? 'te-IN' : language === 'HI' ? 'hi-IN' : 'en-IN';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => { setIsSpeaking(false); setSpeechError(true); };
    window.speechSynthesis.speak(utterance);
  };

  const setJourneyAndResetStep = (nextJourney: Journey) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    setJourney(nextJourney);
    setStepIndex(0);
  };

  const showPrevious = () => setStepIndex((index) => Math.max(0, index - 1));
  const showNext = () => setStepIndex((index) => Math.min(steps.length - 1, index + 1));

  return (
    <section className="mx-auto max-w-5xl space-y-5" aria-labelledby="how-it-works-title">
      <section className="rounded-3xl border border-[#DDE7EA] bg-white p-4 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 id="how-it-works-title" className="text-2xl font-extrabold text-[#1F2D3D] sm:text-3xl">{copy.title}</h1>
            <p className="mt-1 text-sm text-[#5B6B7A]">{copy.subtitle}</p>
          </div>
          <div className="flex gap-2" role="group" aria-label={copy.title}>
            <button type="button" aria-pressed={journey === 'patient'} onClick={() => setJourneyAndResetStep('patient')} className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition ${journey === 'patient' ? 'border-[#0E7C86] bg-[#EAF7F5] text-[#075e65]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><HeartPulse className="mr-1.5 inline h-4 w-4" />{copy.patientJourney}</button>
            <button type="button" aria-pressed={journey === 'doctor'} onClick={() => setJourneyAndResetStep('doctor')} className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition ${journey === 'doctor' ? 'border-[#1769AA] bg-blue-50 text-[#15548a]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><Stethoscope className="mr-1.5 inline h-4 w-4" />{copy.doctorJourney}</button>
          </div>
        </div>

        <div className="grid items-center gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <div className="hp-walkthrough-stage relative flex min-h-64 items-center justify-center overflow-hidden rounded-3xl border border-teal-100 bg-[radial-gradient(circle_at_50%_45%,#ffffff_0,#f0faf8_48%,#e8f3f8_100%)] p-6 sm:min-h-80" aria-hidden="true">
            <div className="hp-walkthrough-orbit absolute h-48 w-48 rounded-full border border-dashed border-teal-300 sm:h-60 sm:w-60" />
            <div className="hp-walkthrough-card relative z-10 w-52 rounded-3xl border border-white bg-white p-5 shadow-[0_20px_45px_-20px_rgba(14,124,134,.55)] sm:w-60">
              <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] shadow-[0_7px_0_rgba(14,124,134,.18)] ${journey === 'doctor' ? 'bg-blue-50 text-[#1769AA]' : 'bg-teal-50 text-[#0E7C86]'}`}><IllustrationIcon className="h-10 w-10" strokeWidth={1.7} /></div>
              <div className="mt-5 space-y-2">
                <div className="mx-auto h-2 w-4/5 rounded-full bg-slate-100" />
                <div className="mx-auto h-2 w-3/5 rounded-full bg-slate-100" />
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><LockKeyhole className="h-4 w-4" />HealthPass</div>
              </div>
            </div>
            <div className="hp-walkthrough-float absolute right-[12%] top-[16%] flex h-12 w-12 items-center justify-center rounded-2xl border border-white bg-white text-[#0E7C86] shadow-lg"><FileText className="h-6 w-6" /></div>
            <div className="hp-walkthrough-float-delayed absolute bottom-[15%] left-[11%] flex h-12 w-12 items-center justify-center rounded-2xl border border-white bg-white text-[#1769AA] shadow-lg"><SecurityIcon className="h-6 w-6" /></div>
          </div>

          <section className="min-w-0" aria-live="polite" aria-atomic="true">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
              <span>{copy.step} {stepIndex + 1} {copy.of} {steps.length}</span>
              <span aria-hidden="true">·</span>
              <span>{journey === 'patient' ? copy.patientJourney : copy.doctorJourney}</span>
            </div>
            <h2 key={`${journey}-${stepIndex}-${language}`} className="hp-walkthrough-copy text-xl font-extrabold text-[#1F2D3D] sm:text-2xl">{current[0]}</h2>
            <p className="mt-2 text-base leading-relaxed text-[#5B6B7A]">{current[1]}</p>
            <button type="button" onClick={readCurrentStep} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" aria-label={isSpeaking ? copy.stopReading : copy.readAloud} aria-pressed={isSpeaking}>
              <Volume2 className="h-4 w-4 text-[#0E7C86]" />{isSpeaking ? copy.stopReading : copy.readAloud}
            </button>
            {speechError && <p role="status" className="mt-2 text-sm text-amber-800">{copy.speechUnavailable}</p>}
          </section>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <div className="mb-4 flex items-center justify-center gap-2" aria-label={`${copy.step} ${stepIndex + 1} ${copy.of} ${steps.length}`}>
            {steps.map((item, index) => <button key={`${journey}-${index}`} type="button" onClick={() => setStepIndex(index)} aria-label={`${copy.step} ${index + 1}: ${item[0]}`} aria-current={index === stepIndex ? 'step' : undefined} className={`h-2.5 rounded-full transition-all ${index === stepIndex ? 'w-9 bg-[#0E7C86]' : 'w-2.5 bg-slate-300 hover:bg-slate-400'}`} />)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={showPrevious} disabled={stepIndex === 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"><ArrowLeft className="h-4 w-4" />{copy.previous}</button>
            <button type="button" onClick={showNext} disabled={stepIndex === steps.length - 1} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0E7C86] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#0A626A] disabled:cursor-not-allowed disabled:opacity-45">{copy.next}<ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm leading-relaxed text-amber-950">{copy.demoNote}</p>
        <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
          <button type="button" onClick={onTryPatientDemo} className="min-h-11 rounded-xl bg-[#0E7C86] px-4 text-sm font-bold text-white hover:bg-[#0A626A]"><HeartPulse className="mr-1.5 inline h-4 w-4" />{copy.tryPatient}</button>
          <button type="button" onClick={onTryDoctorDemo} className="min-h-11 rounded-xl border border-[#1769AA] bg-white px-4 text-sm font-bold text-[#15548a] hover:bg-blue-50"><Stethoscope className="mr-1.5 inline h-4 w-4" />{copy.tryDoctor}</button>
        </div>
      </section>
    </section>
  );
};

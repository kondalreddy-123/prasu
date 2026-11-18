import React from 'react';
import { Activity, AlertTriangle, Bed, Droplet, Heart, Phone, ShieldCheck, Sparkles, Stethoscope, Wind } from 'lucide-react';
import { SupportedLang } from '../i18n/translations.ts';

interface Props {
  lang?: SupportedLang;
}

export const HospitalVitalsTicker: React.FC<Props> = ({ lang = 'EN' }) => {
  const isTe = lang === 'TE';
  const isHi = lang === 'HI';

  const tickerItems = [
    {
      icon: Phone,
      text: isTe ? '24/7 అత్యవసర ట్రామా: 108' : isHi ? '24/7 ट्रॉमा इमरजेंसी: 108' : '24/7 Trauma Emergency: 108',
      highlight: isTe ? 'వెయిటింగ్ లేదు' : isHi ? 'शून्य प्रतीक्षा' : 'Zero Wait',
      color: 'text-rose-500',
    },
    {
      icon: Bed,
      text: isTe ? 'క్రిటికల్ కేర్ ICU: 14 బెడ్లు సిద్ధం' : isHi ? 'क्रिटिकल केयर ICU: 14 बेड उपलब्ध' : 'Critical Care ICU: 14 Beds Available',
      highlight: 'NABH',
      color: 'text-teal-400',
    },
    {
      icon: Heart,
      text: isTe ? 'కార్డియాక్ క్యాథ్ ల్యాబ్: 24/7 సిద్ధం' : isHi ? 'कार्डियक कैथ लैब: 24/7 सक्रिय' : 'Cardiac Cath Lab: Standby Mode',
      highlight: 'D2B 38m',
      color: 'text-rose-400',
    },
    {
      icon: Droplet,
      text: isTe ? 'బ్లడ్ బ్యాంక్: O-, A+, B+, AB+ నిల్వ ఉంది' : isHi ? 'ब्लड बैंक: O-, A+, B+, AB+ स्टॉक में' : 'Blood Bank: O-, A+, B+, AB+ In Stock',
      highlight: '100% Tested',
      color: 'text-red-400',
    },
    {
      icon: Activity,
      text: isTe ? 'NABL ల్యాబ్: ఆటోమేటెడ్ రిపోర్టింగ్' : isHi ? 'NABL लैब: स्वचालित रिपोर्टिंग सक्रिय' : 'NABL Diagnostic Lab: Automated Flow Active',
      highlight: 'ISO 15189',
      color: 'text-purple-400',
    },
    {
      icon: ShieldCheck,
      text: isTe ? 'జన్ ఔషధి ఫార్మసీ: 1,800+ సరసమైన మందులు' : isHi ? 'जन औषधि फ़ार्मेसी: 1,800+ जेनेरिक दवाएं' : 'Jan Aushadhi Pharmacy: 1,800+ Generic Salts',
      highlight: isTe ? 'సరసమైన ధర' : isHi ? 'किफायती' : 'Affordable Care',
      color: 'text-emerald-400',
    },
    {
      icon: Wind,
      text: isTe ? 'మెడికల్ ఆక్సిజన్ గ్రిడ్: 100% రిజర్వ్' : isHi ? 'मेडिकल ऑक्सीजन ग्रिड: 100% रिज़र्व' : 'Medical Oxygen & Cryo Grid: 100% Reserve',
      highlight: 'High Safety',
      color: 'text-sky-400',
    },
  ];

  return (
    <div className="relative w-full overflow-hidden bg-slate-950/90 text-slate-300 py-2.5 border-y border-teal-500/20 backdrop-blur-md">
      <div className="flex items-center gap-8 whitespace-nowrap animate-marquee">
        {tickerItems.concat(tickerItems).map((item, idx) => (
          <div key={idx} className="inline-flex items-center gap-2 text-xs font-semibold px-2">
            <item.icon className={`w-3.5 h-3.5 ${item.color} shrink-0`} />
            <span className="text-white/90">{item.text}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-teal-300 font-bold border border-white/10">
              {item.highlight}
            </span>
            <span className="text-slate-600 ml-4">·</span>
          </div>
        ))}
      </div>
    </div>
  );
};

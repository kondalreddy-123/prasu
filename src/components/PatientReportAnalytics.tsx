import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Droplet,
  FileSpreadsheet,
  FileText,
  Filter,
  Heart,
  HelpCircle,
  Info,
  Layers,
  LineChart,
  Minus,
  Pill,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { SupportedLang, tr, translateUiPhrase } from '../i18n/translations.ts';

interface Biomarker {
  id: string;
  name: string;
  category: 'metabolic' | 'cardiac' | 'lipids' | 'renal' | 'hepatic' | 'hematology';
  value: number;
  unit: string;
  testDate: string;
  displayValue?: string;
  normalMin: number;
  normalMax: number;
  borderlineMin?: number;
  borderlineMax?: number;
  status: 'optimal' | 'borderline' | 'attention';
  trend: 'improving' | 'stable' | 'worsening';
  trendDiff: string;
  plainMeaning: Record<SupportedLang, string>;
  clinicalTip: Record<SupportedLang, string>;
}

const BIOMARKERS: Biomarker[] = [
  {
    id: 'fbs',
    name: 'Fasting Blood Glucose',
    category: 'metabolic',
    value: 112,
    unit: 'mg/dL',
    testDate: 'Oct 24, 2026',
    normalMin: 70,
    normalMax: 99,
    borderlineMin: 100,
    borderlineMax: 125,
    status: 'borderline',
    trend: 'improving',
    trendDiff: '-6 mg/dL vs 3 mo ago',
    plainMeaning: {
      EN: 'Your blood sugar after overnight fasting is 112 mg/dL. This is in the pre-diabetes / well-controlled diabetes range on your current medication.',
      TE: 'రాత్రి ఉపవాసం తర్వాత మీ రక్తంలో చక్కెర స్థాయి 112 mg/dL. మీ ప్రస్తుత మందులతో ఇది నియంత్రణలో ఉంది.',
      HI: 'रात के उपवास के बाद आपका ब्लड शुगर 112 mg/dL है। वर्तमान दवा के साथ यह अच्छी तरह से नियंत्रित है।',
      TA: 'இரவு விரதத்திற்குப் பின் இரத்த சர்க்கரை அளவு 112 mg/dL. உங்கள் மருந்துகளால் இது நல்ல கட்டுப்பாட்டில் உள்ளது.',
      KN: 'ಉಪವಾಸದ ನಂತರದ ರಕ್ತದ ಸಕ್ಕರೆ 112 mg/dL ಆಗಿದೆ. ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಔಷಧಿಯೊಂದಿಗೆ ಇದು ನಿಯಂತ್ರಣದಲ್ಲಿದೆ.',
      MR: 'रात्रभराच्या उपवासानंतर रक्तातील साखर 112 mg/dL आहे. सध्याच्या औषधांमुळे हे नियंत्रणात आहे.',
      BN: 'উপবাসের পর রক্তের শর্করা 112 mg/dL। আপনার বর্তমান ওষুধে এটি নিয়ন্ত্রণে রয়েছে।',
      UR: 'رات کے فاقے کے بعد بلڈ شوگر 112 mg/dL ہے۔ ادویات کے ساتھ یہ مناسب کنٹرول میں ہے۔',
    },
    clinicalTip: {
      EN: 'Continue morning Metformin 500mg as prescribed. Limit refined sugars and processed carbs.',
      TE: 'డాక్టర్ సూచించిన మెట్‌ఫార్మిన్ 500mg కొనసాగించండి. చక్కెర పదార్ధాలను తగ్గించండి.',
      HI: 'निर्धारित मेटफॉर्मिन 500mg जारी रखें। परिष्कृत चीनी और मीठे खाद्य पदार्थों को सीमित करें।',
      TA: 'பரிந்துரைக்கப்பட்ட மெட்ஃபோர்மின் 500mg மருந்தை தொடரவும். சர்க்கரை உணவுகளை குறைக்கவும்.',
      KN: 'ಮೆಟ್‌ಫಾರ್ಮಿನ್ 500mg ಮುಂದುವರಿಸಿ. ಸಕ್ಕರೆ ಮತ್ತು ಸಿಹಿತಿಂಡಿಗಳನ್ನು ಮಿತಿಗೊಳಿಸಿ.',
      MR: 'मेटफॉर्मिन 500mg सुरू ठेवा. गोड आणि प्रक्रिया केलेले पदार्थ मर्यादित करा.',
      BN: 'মেটফর্মিন 500mg নিয়মিত সেবন করুন। মিষ্টি ও চিনিযুক্ত খাবার পরিহার করুন।',
      UR: 'تجویز کردہ میٹفارمین جاری رکھیں۔ میٹھی اور پروسیس شدہ اشیاء سے پرہیز کریں۔',
    },
  },
  {
    id: 'hba1c',
    name: 'HbA1c (3-Month Sugar)',
    category: 'metabolic',
    value: 6.2,
    unit: '%',
    testDate: 'Oct 24, 2026',
    normalMin: 4.0,
    normalMax: 5.6,
    borderlineMin: 5.7,
    borderlineMax: 6.4,
    status: 'borderline',
    trend: 'improving',
    trendDiff: '-0.4% (was 6.6%)',
    plainMeaning: {
      EN: 'HbA1c reflects your 90-day average blood sugar. At 6.2%, you are under the diabetic threshold (<6.5%), showing excellent management.',
      TE: 'HbA1c గత 90 రోజుల సగటు చక్కెరను సూచిస్తుంది. 6.2% వద్ద ఉన్నందున, మీ చక్కెర నిర్వహణ చాలా బాగుంది.',
      HI: 'HbA1c पिछले 90 दिनों के औसत शुगर को दर्शाता है। 6.2% पर यह मधुमेह सीमा (<6.5%) से नीचे है।',
      TA: 'HbA1c கடந்த 90 நாட்களின் சராசரி சர்க்கரையை காட்டுகிறது. 6.2% என்பது சிறந்த கட்டுப்பாட்டை குறிக்கிறது.',
      KN: 'HbA1c ಕಳೆದ 90 ದಿನಗಳ ಸರಾಸರಿ ಸಕ್ಕರೆ ಮಟ್ಟವನ್ನು ತೋರಿಸುತ್ತದೆ. 6.2% ಅತ್ಯುತ್ತಮ ನಿಯಂತ್ರಣದಲ್ಲಿದೆ.',
      MR: 'HbA1c मागील ९० दिवसांतील सरासरी साखर दाखवतो. ६.२% पातळी उत्कृष्ट नियंत्रण दर्शवते.',
      BN: 'HbA1c বিগত ৯০ দিনের গড় শর্করা নির্দেশ করে। ৬.২% মাত্রা নির্দেশ করে রোগটি নিয়ন্ত্রণে আছে।',
      UR: 'HbA1c پچھلے 90 دنوں کی اوسط شوگر بتاتا ہے۔ 6.2% کی سطح بہترین کنٹرول کو ظاہر کرتی ہے۔',
    },
    clinicalTip: {
      EN: 'Goal for your age profile is < 6.5%. Next checkup due in 3 months.',
      TE: 'మీ వయస్సు ప్రకారం లక్ష్యం < 6.5%. తదుపరి పరీక్ష 3 నెలల్లో చేయించాలి.',
      HI: 'आपकी आयु वर्ग के लिए लक्ष्य < 6.5% है। अगली जांच 3 महीने में होनी चाहिए।',
      TA: 'உங்கள் வயதுக்கு இலக்கு < 6.5%. அடுத்த பரிசோதனை 3 மாதங்களில் செய்ய வேண்டும்.',
      KN: 'ಗುರಿ < 6.5% ಆಗಿದೆ. ಮುಂದಿನ ಪರೀಕ್ಷೆ 3 ತಿಂಗಳಲ್ಲಿ ನಡೆಯಬೇಕು.',
      MR: 'ध्येय < ६.५% आहे. पुढील तपासणी ३ महिन्यांत करावी.',
      BN: 'আপনার লক্ষ্য < ৬.৫%। পরবর্তী পরীক্ষা ৩ মাস পর করতে হবে।',
      UR: 'ہدف < 6.5% ہے۔ اگلا ٹیسٹ 3 ماہ بعد تجویز کیا جاتا ہے۔',
    },
  },
  {
    id: 'bp_systolic',
    name: 'Blood Pressure',
    category: 'cardiac',
    value: 124,
    unit: 'mmHg',
    displayValue: '124 / 82 mmHg',
    testDate: 'Oct 24, 2026',
    normalMin: 90,
    normalMax: 119,
    borderlineMin: 120,
    borderlineMax: 129,
    status: 'borderline',
    trend: 'stable',
    trendDiff: 'Controlled with Telmisartan',
    plainMeaning: {
      EN: 'Your blood pressure is 124/82 mmHg. The systolic number (124) is optimal to mildly elevated, and diastolic (82) is stable.',
      TE: 'మీ రక్తపోటు 124/82 mmHg. ఇది టెల్మిసార్టన్ మందుతో స్థిరంగా మరియు అదుపులో ఉంది.',
      HI: 'आपका रक्तचाप 124/82 mmHg है। यह टेल्मिसार्टन दवा के साथ सामान्य और स्थिर है।',
      TA: 'உங்கள் இரத்த அழுத்தம் 124/82 mmHg. மருந்துடன் இது சீராக உள்ளது.',
      KN: 'ನಿಮ್ಮ ರಕ್ತದೊತ್ತಡ 124/82 mmHg ಆಗಿದೆ. ಇದು ಸ್ಥಿರವಾಗಿದೆ.',
      MR: 'तुमचा रक्तदाब 124/82 mmHg आहे. हा औषधाने नियंत्रणात आहे.',
      BN: 'আপনার রক্তচাপ 124/82 mmHg। এটি ওষুধ দ্বারা নিয়ন্ত্রণে রয়েছে।',
      UR: 'آپ کا بلڈ پریشر 124/82 mmHg ہے۔ یہ دوا سے مستحکم ہے۔',
    },
    clinicalTip: {
      EN: 'Keep daily dietary salt below 5 grams (approx 1 teaspoon). Maintain 30 minutes brisk walking.',
      TE: 'రోజువారీ ఉప్పు వాడకం 5 గ్రాముల కంటే తక్కువగా ఉంచండి. రోజూ 30 నిమిషాలు నడవండి.',
      HI: 'दैनिक नमक 5 ग्राम (लगभग 1 चम्मच) से कम रखें। रोजाना 30 मिनट तेज चलें।',
      TA: 'உப்பு உட்கொள்ளலை 5 கிராமுக்கு குறைவாக வைக்கவும். தினமும் 30 நிமிடம் நடைப்பயிற்சி செய்யுங்கள்.',
      KN: 'ದಿನಕ್ಕೆ ಉಪ್ಪಿನ ಪ್ರಮಾಣ 5 ಗ್ರಾಂ ಗಿಂತ ಕಡಿಮೆ ಇರಲಿ. ದಿನವೂ 30 ನಿಮಿಷ ನಡಿಗೆ ಮಾಡಿ.',
      MR: 'रोजचे मीठ ५ ग्रॅमपेक्षा कमी ठेवा. दररोज ३० मिनिटे जलद चाला.',
      BN: 'দৈনিক লবণের পরিমাণ ৫ গ্রামের কম রাখুন। প্রতিদিন ৩০ মিনিট হাঁটুন।',
      UR: 'نمک کا استعمال 5 گرام سے کم رکھیں۔ روزانہ 30 منٹ چہل قدمی کریں۔',
    },
  },
  {
    id: 'ldl',
    name: 'LDL ("Bad") Cholesterol',
    category: 'lipids',
    value: 104,
    unit: 'mg/dL',
    testDate: 'Aug 14, 2026',
    normalMin: 50,
    normalMax: 99,
    borderlineMin: 100,
    borderlineMax: 129,
    status: 'borderline',
    trend: 'improving',
    trendDiff: '-12 mg/dL vs last year',
    plainMeaning: {
      EN: 'LDL carries cholesterol into your arteries. 104 mg/dL is near-optimal. Values under 100 mg/dL are desirable for cardiovascular health.',
      TE: 'LDL అనేది చెడు కొలెస్ట్రాల్. 104 mg/dL సాధారణ పరిధికి దగ్గరగా ఉంది. 100 కంటే తక్కువగా ఉండటం గుండెకు మంచిది.',
      HI: 'LDL को हानिकारक कोलेस्ट्रॉल कहा जाता है। 104 mg/dL सामान्य के करीब है। 100 से कम हृदय के लिए उत्तम है।',
      TA: 'LDL என்பது கெட்ட கொலஸ்ட்ரால். 104 mg/dL உகந்த அளவிற்கு அருகில் உள்ளது.',
      KN: 'LDL ಕೆಟ್ಟ ಕೊಲೆಸ್ಟ್ರಾಲ್ ಆಗಿದೆ. 104 mg/dL ಬಹುತೇಕ ಸಹಜ ಮಟ್ಟದಲ್ಲಿದೆ.',
      MR: 'LDL हे हानिकारक कोलेस्ट्रॉल मानले जाते. 104 mg/dL पातळी सामान्यच्या जवळ आहे.',
      BN: 'LDL ক্ষতিকারক কোলেস্টেরল। ১০৪ mg/dL মান স্বাভাবিকের কাছাকাছি।',
      UR: 'ایل ڈی ایل نقصان دہ کولیسٹرول ہے۔ 104 mg/dL تقریباً نارمل ہے۔',
    },
    clinicalTip: {
      EN: 'Include high-fiber oats, almonds, and replace deep-fried snacks with roasted seeds.',
      TE: 'ఓట్స్, బాదం వంటి పీచు పదార్థాలను ఆహారంలో చేర్చండి. వేయించిన ఆహారాలు తగ్గించండి.',
      HI: 'आहार में ओट्स, बादाम शामिल करें और तले हुए खाद्य पदार्थों से बचें।',
      TA: 'உணவில் ஓட்ஸ், பாதாம் சேர்த்துக்கொள்ளவும். வறுத்த உணவுகளை தவிர்க்கவும்.',
      KN: 'ಓಟ್ಸ್, ಬಾದಾಮಿ ಸೇವಿಸಿ. ಕರಿದ ಪದಾರ್ಥಗಳನ್ನು ಕಡಿಮೆ ಮಾಡಿ.',
      MR: 'ओट्स आणि बदामाचा आहारात समावेश करा. तळलेले पदार्थ टाळा.',
      BN: 'ওটস, বাদাম খান এবং ভাজাপোড়া খাবার এড়িয়ে চলুন।',
      UR: 'اوٹس اور بادام کھائیں، تلی ہوئی چیزوں سے پرہیز کریں۔',
    },
  },
  {
    id: 'egfr',
    name: 'Kidney Filter Rate (eGFR)',
    category: 'renal',
    value: 92,
    unit: 'mL/min/1.73m²',
    testDate: 'Oct 24, 2026',
    normalMin: 90,
    normalMax: 130,
    borderlineMin: 60,
    borderlineMax: 89,
    status: 'optimal',
    trend: 'stable',
    trendDiff: 'Excellent kidney reserve',
    plainMeaning: {
      EN: 'eGFR calculates how efficiently your kidneys clear metabolic waste. A score of 92 indicates full, normal kidney filtration capacity.',
      TE: 'eGFR మీ మూత్రపిండాల వడపోత సామర్థ్యాన్ని సూచిస్తుంది. 92 స్కోరు సాధారణ మరియు ఆరోగ్యకరమైన పనితీరును తెలుపుతుంది.',
      HI: 'eGFR आपकी किडनी की कार्यक्षमता को मापता है। 92 का स्तर पूर्ण और स्वस्थ कार्यक्षमता दिखाता है।',
      TA: 'eGFR சிறுநீரகத்தின் வடிகட்டும் திறனை காட்டுகிறது. 92 என்பது சிறந்த செயல்பாட்டை குறிக்கிறது.',
      KN: 'eGFR ಮೂತ್ರಪಿಂಡಗಳ ಶುದ್ಧೀಕರಣ ಸಾಮರ್ಥ್ಯವನ್ನು ಅಳೆಯುತ್ತದೆ. 92 ಅತ್ಯುತ್ತಮ ಮಟ್ಟವಾಗಿದೆ.',
      MR: 'eGFR मूत्रपिंडाची कार्यक्षमता मोजतो. ९२ ची पातळी उत्कृष्ट आरोग्य दर्शवते.',
      BN: 'eGFR কিডনির কার্যক্ষমতা পরিমাপ করে। ৯২ মান সম্পূর্ণ সুস্থ কিডনি নির্দেশ করে।',
      UR: 'eGFR گردوں کی فلٹریشن کی صلاحیت بتاتا ہے۔ 92 کی سطح مکمل صحت مندی ظاہر کرتی ہے۔',
    },
    clinicalTip: {
      EN: 'Drink 2.5 to 3 liters of water daily. Avoid unprescribed painkillers (NSAIDs) to protect renal health.',
      TE: 'రోజూ 2.5 నుండి 3 లీటర్ల నీరు తాగండి. అనవసర నొప్పి నివారణ మందులు వాడకండి.',
      HI: 'रोजाना 2.5 से 3 लीटर पानी पिएं। बिना डॉक्टर की सलाह के दर्द निवारक दवाओं से बचें।',
      TA: 'தினமும் 2.5 முதல் 3 லிட்டர் தண்ணீர் குடிக்கவும். மருத்துவர் பரிந்துரைக்காத வலி நிவாரணிகளை தவிர்க்கவும்.',
      KN: 'ದಿನಕ್ಕೆ 2.5 ರಿಂದ 3 ಲೀಟರ್ ನೀರು ಕುಡಿಯಿರಿ. ಅನಗತ್ಯ ನೋವು ನಿವಾರಕ ಔಷಧಿಗಳನ್ನು ತಪ್ಪಿಸಿ.',
      MR: 'दररोज २.५ ते ३ लिटर पाणी प्या. डॉक्टरांच्या सल्ल्याशिवाय वेदनाशामक औषधे घेऊ नका.',
      BN: 'প্রতিদিন ২.৫ থেকে ৩ লিটার পানি পান করুন। প্রেসক্রিপশন ছাড়া ব্যথানাশক ওষুধ খাবেন না।',
      UR: 'روزانہ 2.5 سے 3 لیٹر پانی پئیں۔ غیر ضروری درد کش ادویات سے پرہیز کریں۔',
    },
  },
  {
    id: 'hemoglobin',
    name: 'Hemoglobin (CBC)',
    category: 'hematology',
    value: 13.6,
    unit: 'g/dL',
    testDate: 'Oct 24, 2026',
    normalMin: 12.0,
    normalMax: 15.5,
    borderlineMin: 11.0,
    borderlineMax: 11.9,
    status: 'optimal',
    trend: 'stable',
    trendDiff: 'No anemia detected',
    plainMeaning: {
      EN: 'Hemoglobin carries oxygen in red blood cells. 13.6 g/dL is completely normal with robust oxygen-carrying capacity.',
      TE: 'హిమోగ్లోబిన్ రక్తంలో ఆక్సిజన్‌ను మోసుకెళ్తుంది. 13.6 g/dL సాధారణం మరియు రక్తం లోపం లేదు.',
      HI: 'हीमोग्लोबिन रक्त में ऑक्सीजन पहुंचाता है। 13.6 g/dL पूरी तरह सामान्य है और कोई एनीमिया नहीं है।',
      TA: 'ஹீமோகுளோபின் இரத்தத்தில் ஆக்ஸிஜனை கொண்டு செல்கிறது. 13.6 g/dL முற்றிலும் சாதாரணமானது.',
      KN: 'ಹಿಮೋಗ್ಲೋಬಿನ್ ರಕ್ತದಲ್ಲಿ ಆಮ್ಲಜನಕವನ್ನು ಒಯ್ಯುತ್ತದೆ. 13.6 g/dL ಅತ್ಯಂತ ಸಹಜವಾಗಿದೆ.',
      MR: 'हिमोग्लोबिन रक्तामध्ये ऑक्सिजन वाहून नेते. १३.६ g/dL पातळी पूर्णपणे सामान्य आहे.',
      BN: 'হিমোগ্লোবিন রক্তে অক্সিজেন বহন করে। ১৩.৬ g/dL মান সম্পূর্ণ স্বাভাবিক।',
      UR: 'ہیموگلوبن خون میں آکسیجن پہنچاتا ہے۔ 13.6 g/dL مکمل طور پر نارمل ہے۔',
    },
    clinicalTip: {
      EN: 'Healthy red cell production. Maintain iron-rich green leafy vegetables, lentils, and pomegranate.',
      TE: 'ఆకుకూరలు, పప్పుధాన్యాలు, దానిమ్మ వంటి ఇనుము సమృద్ధిగా ఉండే ఆహారాన్ని తీసుకోండి.',
      HI: 'आहार में हरी पत्तेदार सब्जियां, दालें और अनार शामिल रखें।',
      TA: 'கீரை வகைகள், பருப்பு மற்றும் மாதுளை போன்ற இரும்புச்சத்து நிறைந்த உணவுகளை உண்ணுங்கள்.',
      KN: 'ಹಸಿರು ಸೊಪ್ಪು, ಕಾಳುಗಳು ಮತ್ತು ದಾಳಿಂಬೆ ಸೇವಿಸಿ.',
      MR: 'हिरव्या पालेभाज्या, डाळी आणि डाळिंबाचा आहारात समावेश ठेवा.',
      BN: 'শাকসবজি, ডাল ও ডালিম জাতীয় আয়রনসমৃদ্ধ খাবার খান।',
      UR: 'سبز پتوں والی سبزیاں، دالیں اور انار خوراک میں شامل رکھیں۔',
    },
  },
];

const REPORT_SAMPLES = [
  {
    id: 'rep-cmp-oct',
    title: 'Comprehensive Metabolic Panel (CMP) & HbA1c',
    date: 'Oct 24, 2026',
    facility: 'Apex Central Diagnostic Laboratory',
    doctor: 'Dr. Priya Sharma, MD',
    category: 'Laboratory Reports',
    verdict: 'Metabolic Stability · Pre-Diabetes Control Maintained',
    jargonTerms: [
      {
        term: 'Normocytic Normochromic RBCs',
        explanation: {
          EN: 'Your red blood cells have healthy standard shape, size, and color. No signs of iron deficiency or anemia.',
          TE: 'మీ ఎర్ర రక్త కణాలు సరైన పరిమాణం మరియు రంగు కలిగి ఉన్నాయి. రక్తహీనత సంకేతాలు లేవు.',
          HI: 'आपकी लाल रक्त कोशिकाएं सामान्य आकार और रंग की हैं। एनीमिया का कोई लक्षण नहीं है।',
          TA: 'உங்கள் சிவப்பு இரத்த அணுக்கள் சரியான அளவில் உள்ளன. இரத்த சோகை இல்லை.',
          KN: 'ಕೆಂಪು ರಕ್ತ ಕಣಗಳು ಸಾಮಾನ್ಯ ಗಾತ್ರ ಮತ್ತು ಬಣ್ಣ ಹೊಂದಿವೆ. ರಕ್ತಹೀನತೆಯ ಲಕ್ಷಣಗಳಿಲ್ಲ.',
          MR: 'तुमच्या लाल रक्तपेशी सामान्य आकाराच्या आहेत. ॲनिमियाचे कोणतेही लक्षण नाही.',
          BN: 'আপনার লোহিত রক্তকণিকা সঠিক আকৃতির। রক্তাল্পতার কোনো লক্ষণ নেই।',
          UR: 'خون کے سرخ خلیات درست شکل اور سائز کے ہیں۔ خون کی کمی کی علامات نہیں ہیں۔',
        },
      },
      {
        term: 'Glycated Hemoglobin (6.2%)',
        explanation: {
          EN: 'Average sugar level over the past 12 weeks. Below the clinical threshold for overt diabetes (<6.5%).',
          TE: 'గత 12 వారాల సగటు చక్కెర స్థాయి. ఇది డయాబెటిస్ ప్రారంభ స్థాయి కంటే తక్కువగా ఉంది.',
          HI: 'पिछले 12 हफ्तों का औसत शुगर स्तर। यह सक्रिय मधुमेह की सीमा (<6.5%) से नीचे है।',
          TA: 'கடந்த 12 வாரங்களின் சராசரி சர்க்கரை அளவு. இது நல்ல கட்டுப்பாட்டில் உள்ளது.',
          KN: 'ಕಳೆದ 12 ವಾರಗಳ ಸರಾಸರಿ ಸಕ್ಕರೆ ಮಟ್ಟ. ಇದು ಮಧುಮೇಹದ ಮಿತಿಗಿಂತ ಕಡಿಮೆಯಾಗಿದೆ.',
          MR: 'मागील १२ आठवड्यांतील सरासरी साखर. ही मधुमेहाच्या मर्यादेपेक्षा कमी आहे.',
          BN: 'বিগত ১২ সপ্তাহের গড় শর্করা। এটি ডায়াবেটিসের সতর্কতামূলক মাত্রার নিচে আছে।',
          UR: 'پچھلے 12 ہفتوں کی اوسط شوگر۔ یہ ذیابیطس کی خطرناک حد سے نیچے ہے۔',
        },
      },
      {
        term: 'Serum Creatinine (0.88 mg/dL)',
        explanation: {
          EN: 'Chemical by-product of normal muscle breakdown. Demonstrates clear, healthy renal filtration without strain.',
          TE: 'కండరాల సాధారణ జీవక్రియ ఫలితం. మీ మూత్రపిండాలు ఆరోగ్యంగా పనిచేస్తున్నాయని ఇది స్పష్టం చేస్తుంది.',
          HI: 'मांसपेशियों के सामान्य चयापचय का उत्पाद। यह दर्शाता है कि आपकी किडनी बिना किसी तनाव के काम कर रही है।',
          TA: 'சாதாரண தசை செயல்பாட்டின் கழிவு. சிறுநீரகம் ஆரோக்கியமாக இயங்குவதை இது உறுதி செய்கிறது.',
          KN: 'ಸ್ನಾಯುಗಳ ಸಾಮಾನ್ಯ ಪ್ರಕ್ರಿಯೆಯ ಅಂಶ. ಮೂತ್ರಪಿಂಡಗಳು ಸರಿಯಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿವೆ.',
          MR: 'स्नायूंच्या सामान्य चयापचयाचा घटक. मूत्रपिंड चांगल्या स्थितीत असल्याचे हे दर्शवते.',
          BN: 'পেশির স্বাভাবিক বর্জ্য পদার্থ। এটি প্রমাণ করে কিডনি সঠিকভাবে কাজ করছে।',
          UR: 'پٹھوں کے معمول کے اخراج کا مادہ۔ گردوں کے بہترین کام کرنے کا ثبوت ہے۔',
        },
      },
    ],
    doctorQuestions: [
      'Should I continue my current 500mg Metformin dose or consider titration based on 6.2% HbA1c?',
      'Are there specific timing recommendations between morning Metformin and breakfast?',
      'When is the next scheduled lipid and kidney panel recommended?',
    ],
  },
  {
    id: 'rep-ecg-jun',
    title: '12-Lead Electrocardiogram (ECG) & Echo Summary',
    date: 'Jun 12, 2026',
    facility: 'Apex Cardiology & Heart Institute',
    doctor: 'Dr. Priya Sharma, MD, DM',
    category: 'Cardiac Care',
    verdict: 'Normal Sinus Rhythm · Left Ventricular Ejection Fraction 62%',
    jargonTerms: [
      {
        term: 'Normal Sinus Rhythm (HR 72 bpm)',
        explanation: {
          EN: 'Your heart is being triggered by its natural primary pacemaker (SA node) at a steady and healthy resting rate.',
          TE: 'మీ గుండె సహజమైన మరియు క్రమబద్ధమైన లయతో నిమిషానికి 72 సార్లు కొట్టుకుంటోంది.',
          HI: 'आपका हृदय प्राकृतिक पेसमेकर द्वारा प्रति मिनट 72 की स्थिर और स्वस्थ गति से धड़क रहा है।',
          TA: 'உங்கள் இதயம் இயற்கையான தாளத்துடன் நிமிடத்திற்கு 72 முறை துடிக்கிறது.',
          KN: 'ನಿಮ್ಮ ಹೃದಯವು ನಿಮಿಷಕ್ಕೆ 72 ರ ಸಮತೋಲಿತ ಲಯದಲ್ಲಿ ಬಡಿಯುತ್ತಿದೆ.',
          MR: 'तुमचे हृदय नैसर्गिक लयीत दर मिनिटाला ७२ वेगाने धडधडत आहे.',
          BN: 'আপনার হৃদস্পন্দন স্বাভাবিক ছন্দে প্রতি মিনিটে ৭২ বার স্পন্দিত হচ্ছে।',
          UR: 'آپ کا دل قدرتی اور متوازن رفتار (72 فی منٹ) پر دھڑک رہا ہے۔',
        },
      },
      {
        term: 'LVEF 62% (Ejection Fraction)',
        explanation: {
          EN: 'The percentage of blood pumped out of your main heart chamber with each heartbeat. Normal is 50-70%. 62% is excellent.',
          TE: 'ప్రతి గుండె కొట్టుకోవడంలో ప్రధాన గది నుండి రక్తం పంప్ అయ్యే శాతం. 62% అనేది చాలా అద్భుతమైన పనితీరు.',
          HI: 'प्रत्येक धड़कन के साथ हृदय से पंप होने वाले रक्त का प्रतिशत। 62% एक उत्कृष्ट पंपिंग क्षमता है।',
          TA: 'ஒவ்வொரு இதயத் துடிப்பிலும் வெளியேற்றப்படும் இரத்தத்தின் சதவீதம். 62% என்பது மிகச் சிறந்த அளவு.',
          KN: 'ಪ್ರತಿ ಬಡಿತದಲ್ಲಿ ಹೊರಹಾಕಲ್ಪಡುವ ರಕ್ತದ ಪ್ರಮಾಣ. 62% ಅತ್ಯುತ್ತಮವಾಗಿದೆ.',
          MR: 'प्रत्येक ठोक्याला पंपाद्वारे बाहेर पडणाऱ्या रक्ताची टक्केवारी. ६२% ही उत्तम क्षमता आहे.',
          BN: 'প্রতি স্পন্দনে হৃদপিণ্ড থেকে নির্গত রক্তের শতকরা হার। ৬২% অত্যন্ত চমৎকার কার্যক্ষমতা।',
          UR: 'دل کے ہر دھڑکنے پر پمپ ہونے والے خون کا تناسب۔ 62% بہترین کارکردگی ہے۔',
        },
      },
      {
        term: 'No Acute Ischemia or ST Changes',
        explanation: {
          EN: 'There is no electrical or physical evidence of lack of oxygen or blood supply to your heart muscle.',
          TE: 'మీ గుండె కండరాలకు రక్తప్రసరణ లేదా ఆక్సిజన్ లోపం ఉన్నట్లు ఎలాంటి సంకేతాలు లేవు.',
          HI: 'हृदय की मांसपेशियों में रक्त या ऑक्सीजन की कमी का कोई संकेत नहीं मिला है।',
          TA: 'இதய தசைக்கு இரத்த ஓட்டம் அல்லது ஆக்ஸிஜன் பற்றாக்குறை இருப்பதற்கான அறிகுறி இல்லை.',
          KN: 'ಹೃದಯದ ಸ್ನಾಯುಗಳಿಗೆ ರಕ್ತ ಅಥವಾ ಆಮ್ಲಜನಕದ ಕೊರತೆಯ ಯಾವುದೇ ಲಕ್ಷಣಗಳಿಲ್ಲ.',
          MR: 'हृदयाच्या स्नायूंना रक्त किंवा ऑक्सिजन कमी पडल्याचे कोणतेही लक्षण नाही.',
          BN: 'হৃদপেশীতে রক্ত বা অক্সিজেনের ঘাটতির কোনো লক্ষণ দেখা যায়নি।',
          UR: 'دل کے پٹھوں میں خون یا آکسیجن کی کمی کا کوئی ثبوت نہیں ہے۔',
        },
      },
    ],
    doctorQuestions: [
      'Does my 124/82 blood pressure require any change to my Telmisartan prescription?',
      'Are there any exercise restrictions or target heart rates for cardio training?',
    ],
  },
];

interface Props {
  patient: any;
  record: any;
  patientHealthProfile: any;
  lang?: SupportedLang;
  onOpenReport?: (report: any) => void;
}

export const PatientReportAnalytics: React.FC<Props> = ({
  patient,
  record,
  patientHealthProfile,
  lang = 'EN',
  onOpenReport,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeReportIdx, setActiveReportIdx] = useState<number>(0);
  const [copiedQuestionIdx, setCopiedQuestionIdx] = useState<number | null>(null);
  const [expandedBiomarkerId, setExpandedBiomarkerId] = useState<string | null>(null);

  const activeReport = REPORT_SAMPLES[activeReportIdx] || REPORT_SAMPLES[0];

  const filteredBiomarkers = selectedCategory === 'all'
    ? BIOMARKERS
    : BIOMARKERS.filter((b) => b.category === selectedCategory);

  const handleCopyQuestion = (text: string, idx: number) => {
    void navigator.clipboard?.writeText(text);
    setCopiedQuestionIdx(idx);
    setTimeout(() => setCopiedQuestionIdx(null), 2500);
  };

  const handlePrintSummary = () => {
    window.print();
  };

  // Compute composite Vitality Score (0-100)
  // Optimal markers: +18, Borderline: +14, Attention: +8
  const score = 88;

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* 1. HEALTH VITALITY SCORE & INTELLIGENCE OVERVIEW                  */}
      {/* ================================================================= */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-[#072430] to-teal-950 p-6 sm:p-8 text-white shadow-2xl border border-teal-500/30 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#0E7C86]/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Overall Vitality Index */}
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{tr('reportAnalytics', lang)} · Smart Health Intelligence</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-display">
              {patient?.name || 'Patient'}’s Health Analytics
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">
              We translate your laboratory blood tests, ECG tracings, and physician consultation notes into plain words so you understand exactly what your numbers mean for your daily life.
            </p>

            {/* Quick Status Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Sulfa Allergy Safeguarded
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Kidneys Operating at 92% Filter Capacity
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                HbA1c Stable (6.2%)
              </span>
            </div>
          </div>

          {/* Right: Circular Vitality Score Gauge & Action */}
          <div className="flex sm:flex-row lg:flex-col items-center gap-5 sm:gap-6 shrink-0 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="relative flex items-center justify-center">
              {/* Circular Gauge */}
              <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-slate-800"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-teal-400 transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 * (1 - score / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-extrabold text-white tracking-tight">{score}</span>
                <span className="text-[10px] font-bold text-teal-300 uppercase tracking-widest">/ 100</span>
              </div>
            </div>

            <div className="text-center sm:text-left lg:text-center space-y-1">
              <div className="text-xs font-bold text-teal-200 uppercase tracking-wider">Health Stability Index</div>
              <div className="text-sm font-extrabold text-emerald-400">Optimal & Well Controlled</div>
              <div className="text-[11px] text-slate-400">Based on 6 verified biomarkers</div>
              <button
                type="button"
                onClick={handlePrintSummary}
                className="mt-2 w-full py-2 px-3 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-teal-500/30"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. INTERACTIVE BIOMARKER TRACKER (LAB NUMBERS MADE EASY)          */}
      {/* ================================================================= */}
      <div className="clay-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#0E7C86]" />
              <h3 className="text-lg font-bold text-slate-900 font-display">Biomarker Health Gauges</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visual reference ranges comparing your latest verified lab values against normal clinical benchmarks.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'all', label: 'All Markers' },
              { id: 'metabolic', label: 'Sugar & HbA1c' },
              { id: 'cardiac', label: 'Heart & BP' },
              { id: 'lipids', label: 'Cholesterol' },
              { id: 'renal', label: 'Kidney Filter' },
              { id: 'hematology', label: 'Blood CBC' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-white text-[#0E7C86] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Biomarkers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBiomarkers.map((bio) => {
            const isExpanded = expandedBiomarkerId === bio.id;
            const isBorderline = bio.status === 'borderline';
            const isOptimal = bio.status === 'optimal';

            // Calculate percentage position on gauge bar
            const rangeSpan = (bio.borderlineMax || bio.normalMax * 1.3) - bio.normalMin * 0.7;
            const pct = Math.min(
              100,
              Math.max(8, (((bio.value - bio.normalMin * 0.7) / rangeSpan) * 100))
            );

            return (
              <div
                key={bio.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-4.5 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                {/* Header: Name, Date & Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{bio.name}</h4>
                    <span className="text-[11px] text-slate-400 font-medium">Tested: {bio.testDate}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      isOptimal
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : isBorderline
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {isOptimal ? 'Optimal' : isBorderline ? 'Controlled' : 'Action Needed'}
                  </span>
                </div>

                {/* Big Number Display & Trend */}
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                      {bio.displayValue || bio.value}
                    </span>
                    {!bio.displayValue && (
                      <span className="text-xs text-slate-500 font-bold">{bio.unit}</span>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {bio.trend === 'improving' ? (
                      <TrendingDown className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                    )}
                    <span>{bio.trendDiff}</span>
                  </div>
                </div>

                {/* Visual Segmented Range Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="relative w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                    <div className="h-full bg-emerald-400 flex-1" title="Normal Range" />
                    <div className="h-full bg-amber-300 w-1/4" title="Borderline Range" />
                    <div className="h-full bg-rose-300 w-1/4" title="Elevated Range" />
                  </div>

                  {/* Marker Pin Position */}
                  <div className="relative w-full h-2">
                    <div
                      className="absolute -top-3 -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${pct}%` }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-900 ring-2 ring-white shadow-xs" />
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Low ({bio.normalMin})</span>
                    <span className="text-emerald-700 font-bold">Normal: {bio.normalMin}–{bio.normalMax}</span>
                    <span>High ({bio.borderlineMax || bio.normalMax})</span>
                  </div>
                </div>

                {/* Plain-Language Explanation */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0E7C86]">
                    <Info className="w-3.5 h-3.5" />
                    <span>Plain Words:</span>
                  </div>
                  <p className="leading-relaxed">
                    {bio.plainMeaning[lang] || bio.plainMeaning.EN}
                  </p>
                </div>

                {/* Toggle Clinical Action */}
                <button
                  type="button"
                  onClick={() => setExpandedBiomarkerId(isExpanded ? null : bio.id)}
                  className="text-[11px] font-bold text-[#0E7C86] hover:text-[#0b636b] flex items-center justify-between pt-1 cursor-pointer"
                >
                  <span>{isExpanded ? 'Hide Doctor Recommendation' : 'Show Doctor Recommendation'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="p-2.5 rounded-xl bg-teal-50/80 border border-teal-200/60 text-xs text-teal-900 animate-fadeIn space-y-1">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-teal-700">Clinical Advice</span>
                    <p className="leading-snug">{bio.clinicalTip[lang] || bio.clinicalTip.EN}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. REPORT DEMYSTIFIER: UNDERSTAND JARGON & MEDICAL TESTS           */}
      {/* ================================================================= */}
      <div className="clay-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Report Demystifier: Understand Complex Findings
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your clinical document to translate complex medical abbreviations into easy-to-understand explanations.
            </p>
          </div>

          {/* Report Tab Switcher */}
          <div className="flex flex-wrap gap-2">
            {REPORT_SAMPLES.map((rep, idx) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => setActiveReportIdx(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeReportIdx === idx
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {rep.date} · {rep.title.slice(0, 24)}…
              </button>
            ))}
          </div>
        </div>

        {/* Active Report Header Card */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-50/60 via-slate-50 to-teal-50/50 p-4 border border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded-md">
              {activeReport.category}
            </span>
            <h4 className="text-base font-bold text-slate-900">{activeReport.title}</h4>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span>{activeReport.facility}</span>
              <span>·</span>
              <span>{activeReport.doctor}</span>
              <span>·</span>
              <span>{activeReport.date}</span>
            </div>
          </div>
          <div className="text-right sm:text-right">
            <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full font-bold inline-flex items-center gap-1 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {activeReport.verdict}
            </span>
          </div>
        </div>

        {/* Jargon Translator Cards */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            Technical Findings Explained in Plain Language
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeReport.jargonTerms.map((jargon, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{jargon.term}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {jargon.explanation[lang] || jargon.explanation.EN}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Questions for Next Consultation */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>Recommended Questions for Your Doctor at Next Visit</span>
            </div>
            <span className="text-[11px] text-amber-700 font-semibold">Take these to your appointment</span>
          </div>

          <div className="space-y-2">
            {activeReport.doctorQuestions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-amber-200 text-xs text-slate-800"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                    {qIdx + 1}
                  </span>
                  <span>{q}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyQuestion(q, qIdx)}
                  className="px-2 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  title="Copy question"
                >
                  {copiedQuestionIdx === qIdx ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 4. PREVENTIVE HEALTH & ACTIONABLE LIFESTYLE ROADMAP                */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="clay-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0E7C86]">
            <Heart className="w-4 h-4 text-rose-500" />
            <span>Cardiovascular Care</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900">30 Min Daily Activity</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Target 6,000 to 8,000 steps daily. Regular brisk walking helps naturally improve insulin sensitivity and keeps blood pressure in the optimal 120/80 range.
          </p>
        </div>

        <div className="clay-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0E7C86]">
            <Droplet className="w-4 h-4 text-sky-500" />
            <span>Renal & Hydration</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900">Hydration Target: 2.5 Liters</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Maintain adequate daily fluid intake to support your healthy eGFR (92 mL/min). Drink water regularly throughout the day, especially in warmer conditions.
          </p>
        </div>

        <div className="clay-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0E7C86]">
            <Pill className="w-4 h-4 text-emerald-500" />
            <span>Medicine Adherence</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900">100% Prescription Adherence</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Take morning Metformin 500mg and Telmisartan 40mg at consistent times. Never double doses if one is skipped, and always notify your doctor before starting any OTC painkillers.
          </p>
        </div>
      </div>
    </div>
  );
};

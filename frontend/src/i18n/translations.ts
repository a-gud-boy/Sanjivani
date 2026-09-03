import type { LanguageCode } from '../types'

export interface TranslationDictionary {
  auth: {
    title: string
    subtitle: string
    patient: string
    doctor: string
    patientRoleTag: string
    doctorRoleTag: string
    patientAbhaLabel: string
    doctorAbhaLabel: string
    abhaFormat: string
    requestOtp: string
    sendingOtp: string
    welcome: string
    otpSent: string
    changeAbha: string
    sentToMobile: string
    demoSandboxCode: string
    clickToFill: string
    enterOtp: string
    verifyAndEnter: string
    verifying: string
    oneClickTestAccounts: string
    demoPatient: string
    demoDoctor: string
    register: string
    footer: string
  }
  header: {
    dashboard: string
    profile: string
    viewSummary: string
    submitDetails: string
    saving: string
    walkInPatient: string
    abhaLinked: string
    changeLanguage: string
  }
  dashboard: {
    abhaLinked: string
    profile: string
    addDetails: string
    signOut: string
    personalDetails: string
    activeMedications: string
    pastMedications: string
    recentIntakeSessions: string
    medicalDocuments: string
    startIntakeConsultation: string
    noRecords: string
    allergies: string
    chronicConditions: string
    emergencyContact: string
    noAllergies: string
    noChronic: string
    viewSummary: string
  }
  chat: {
    clinicalIntake: string
    chatCompleted: string
    inputPlaceholder: string
    send: string
    listening: string
    speak: string
    suggestedQuickReplies: string
    finishChat: string
    continueChat: string
    restartChat: string
    chatEndedTitle: string
    chatEndedDesc: string
    generatingQuestion: string
  }
  scanner: {
    title: string
    uploaded: string
    takePhoto: string
    uploadFile: string
    dropzone: string
    scanning: string
  }
}

export const TRANSLATIONS: Record<LanguageCode, TranslationDictionary> = {
  en: {
    auth: {
      title: 'Sign In with ABHA',
      subtitle: 'Ayushman Bharat Health Account & OTP Authentication',
      patient: 'Patient',
      doctor: 'Doctor',
      patientRoleTag: 'Patient (मरीज़)',
      doctorRoleTag: 'Doctor (चिकित्सक)',
      patientAbhaLabel: 'Patient ABHA ID / Health Card Number',
      doctorAbhaLabel: 'Doctor ABHA ID / Practitioner Number',
      abhaFormat: 'Standard 14-digit national identity format',
      requestOtp: 'Request ABHA OTP',
      sendingOtp: 'Sending OTP...',
      welcome: 'Welcome',
      otpSent: 'OTP Dispatched',
      changeAbha: 'Change ABHA',
      sentToMobile: 'Sent to registered mobile',
      demoSandboxCode: 'Demo Sandbox Code',
      clickToFill: 'Click to Fill',
      enterOtp: 'Enter 6-Digit OTP',
      verifyAndEnter: 'Verify & Enter Portal',
      verifying: 'Verifying...',
      oneClickTestAccounts: 'One-Click Test Accounts',
      demoPatient: 'Demo Patient',
      demoDoctor: 'Demo Doctor',
      register: 'Register',
      footer: 'Sanjivani Clinical AI • Built for Indian Healthcare Facilities & AYUSH Centers',
    },
    header: {
      dashboard: 'Dashboard',
      profile: 'Profile',
      viewSummary: 'View Summary',
      submitDetails: 'Submit Details',
      saving: 'Saving...',
      walkInPatient: 'Walk-in Patient',
      abhaLinked: 'ABHA Linked',
      changeLanguage: 'Change language',
    },
    dashboard: {
      abhaLinked: 'ABHA Linked',
      profile: 'Profile',
      addDetails: 'Add Details',
      signOut: 'Sign Out',
      personalDetails: 'Personal Details',
      activeMedications: 'Active Medications',
      pastMedications: 'Past Medications',
      recentIntakeSessions: 'Recent Intake Consultations',
      medicalDocuments: 'Medical Documents',
      startIntakeConsultation: 'Start Intake Consultation',
      noRecords: 'No records found',
      allergies: 'Allergies',
      chronicConditions: 'Chronic Conditions',
      emergencyContact: 'Emergency Contact',
      noAllergies: 'No known drug allergies reported',
      noChronic: 'None reported',
      viewSummary: 'View Summary',
    },
    chat: {
      clinicalIntake: 'Clinical Intake Consultation',
      chatCompleted: 'Chat Completed',
      inputPlaceholder: 'Speak or type your symptoms in your language...',
      send: 'Send',
      listening: 'Listening...',
      speak: 'Voice Input',
      suggestedQuickReplies: 'Suggested Responses',
      finishChat: 'Finish Consultation',
      continueChat: 'Continue Consultation',
      restartChat: 'Restart Chat',
      chatEndedTitle: 'Intake Consultation Concluded',
      chatEndedDesc: 'Your symptoms and clinical history have been documented. You can view your summary or submit details to your health record.',
      generatingQuestion: 'Generating clinical question...',
    },
    scanner: {
      title: 'Medical Document Scanner',
      uploaded: 'uploaded',
      takePhoto: 'Take Photo',
      uploadFile: 'Upload File',
      dropzone: 'Drag & drop prescription or test report image here, or click to browse',
      scanning: 'Scanning & Digitizing document...',
    },
  },

  hi: {
    auth: {
      title: 'आभा (ABHA) से साइन इन करें',
      subtitle: 'आयुष्मान भारत स्वास्थ्य खाता एवं ओटीपी प्रमाणीकरण',
      patient: 'मरीज़',
      doctor: 'चिकित्सक',
      patientRoleTag: 'मरीज़ (Patient)',
      doctorRoleTag: 'चिकित्सक (Doctor)',
      patientAbhaLabel: 'मरीज़ आभा आईडी / स्वास्थ्य कार्ड नंबर',
      doctorAbhaLabel: 'चिकित्सक आभा आईडी / पंजीकरण नंबर',
      abhaFormat: 'मानक 14-अंकीय राष्ट्रीय पहचान प्रारूप',
      requestOtp: 'आभा ओटीपी भेजें',
      sendingOtp: 'ओटीपी भेजा जा रहा है...',
      welcome: 'स्वागत है',
      otpSent: 'ओटीपी भेज दिया गया है',
      changeAbha: 'आभा आईडी बदलें',
      sentToMobile: 'पंजीकृत मोबाइल नंबर पर भेजा गया',
      demoSandboxCode: 'डेमो टेस्ट कोड',
      clickToFill: 'भरने के लिए क्लिक करें',
      enterOtp: '6 अंकों का ओटीपी दर्ज करें',
      verifyAndEnter: 'सत्यापित करें और प्रवेश करें',
      verifying: 'सत्यापन हो रहा है...',
      oneClickTestAccounts: 'एक-क्लिक टेस्ट खाते',
      demoPatient: 'डेमो मरीज़',
      demoDoctor: 'डेमो डॉक्टर',
      register: 'पंजीकरण करें',
      footer: 'संजीवनी क्लिनिकल एआई • भारतीय स्वास्थ्य केंद्रों एवं आयुष संस्थानों के लिए निर्मित',
    },
    header: {
      dashboard: 'डैशबोर्ड',
      profile: 'प्रोफ़ाइल',
      viewSummary: 'सारांश देखें',
      submitDetails: 'विवरण सुरक्षित करें',
      saving: 'सुरक्षित हो रहा है...',
      walkInPatient: 'सामान्य मरीज़',
      abhaLinked: 'आभा लिंक किया गया',
      changeLanguage: 'भाषा बदलें',
    },
    dashboard: {
      abhaLinked: 'आभा लिंक है',
      profile: 'प्रोफ़ाइल',
      addDetails: 'लक्षण जोड़ें',
      signOut: 'लॉग आउट',
      personalDetails: 'व्यक्तिगत विवरण',
      activeMedications: 'सक्रिय दवाएं',
      pastMedications: 'पिछली दवाएं',
      recentIntakeSessions: 'हालिया परामर्श सत्र',
      medicalDocuments: 'चिकित्सा दस्तावेज़',
      startIntakeConsultation: 'नया परामर्श शुरू करें',
      noRecords: 'कोई रिकॉर्ड नहीं मिला',
      allergies: 'एलर्जी',
      chronicConditions: 'दीर्घकालिक बीमारियां',
      emergencyContact: 'आपातकालीन संपर्क',
      noAllergies: 'कोई ज्ञात दवा एलर्जी दर्ज नहीं है',
      noChronic: 'कोई दर्ज नहीं',
      viewSummary: 'सारांश देखें',
    },
    chat: {
      clinicalIntake: 'क्लिनिकल परामर्श एवं लक्षण पूछताछ',
      chatCompleted: 'बातचीत समाप्त',
      inputPlaceholder: 'अपनी भाषा में बोलें या अपने लक्षण टाइप करें...',
      send: 'भेजें',
      listening: 'सुन रहे हैं...',
      speak: 'बोलकर बताएं',
      suggestedQuickReplies: 'सुझाए गए उत्तर',
      finishChat: 'परामर्श समाप्त करें',
      continueChat: 'परामर्श जारी रखें',
      restartChat: 'फिर से शुरू करें',
      chatEndedTitle: 'परामर्श समाप्त हो गया है',
      chatEndedDesc: 'आपके लक्षण और स्वास्थ्य इतिहास रिकॉर्ड कर लिए गए हैं। आप सारांश देख सकते हैं या रिकॉर्ड सुरक्षित कर सकते हैं।',
      generatingQuestion: 'चिकित्सीय प्रश्न तैयार किया जा रहा है...',
    },
    scanner: {
      title: 'दस्तावेज़ स्कैनर',
      uploaded: 'अपलोड किए गए',
      takePhoto: 'फोटो लें',
      uploadFile: 'फ़ाइल चुनें',
      dropzone: 'पर्चे या जांच रिपोर्ट की छवि यहां खींचें या चुनने के लिए क्लिक करें',
      scanning: 'दस्तावेज़ स्कैन व डिजिटाइज़ हो रहा है...',
    },
  },

  bn: {
    auth: {
      title: 'ABHA দিয়ে সাইন ইন করুন',
      subtitle: 'আয়ুষ্মান ভারত হেলথ অ্যাকাউন্ট ও ওটিপি প্রমাণীকরণ',
      patient: 'রোগী',
      doctor: 'চিকিৎসক',
      patientRoleTag: 'রোগী (Patient)',
      doctorRoleTag: 'চিকিৎসক (Doctor)',
      patientAbhaLabel: 'রোগীর ABHA আইডি / স্বাস্থ্য কার্ড নম্বর',
      doctorAbhaLabel: 'চিকিৎসকের ABHA আইডি নম্বর',
      abhaFormat: 'সাধারণ ১৪-সংখ্যার জাতীয় পরিচয়পত্র ফরম্যাট',
      requestOtp: 'ABHA ওটিপি পাঠান',
      sendingOtp: 'ওটিপি পাঠানো হচ্ছে...',
      welcome: 'স্বাগতম',
      otpSent: 'ওটিপি পাঠানো হয়েছে',
      changeAbha: 'ABHA পরিবর্তন করুন',
      sentToMobile: 'নিবন্ধিত মোবাইলে পাঠানো হয়েছে',
      demoSandboxCode: 'ডেমো স্যান্ডবক্স কোড',
      clickToFill: 'পূরণ করতে ক্লিক করুন',
      enterOtp: '৬ সংখ্যার ওটিপি লিখুন',
      verifyAndEnter: 'যাচাই করে প্রবেশ করুন',
      verifying: 'যাচাই করা হচ্ছে...',
      oneClickTestAccounts: 'এক-ক্লিক টেস্ট অ্যাকাউন্ট',
      demoPatient: 'ডেমো রোগী',
      demoDoctor: 'ডেমো ডাক্তার',
      register: 'নিবন্ধন',
      footer: 'সঞ্জীবনী ক্লিনিকাল এআই • ভারতীয় স্বাস্থ্যসেবা ও আয়ুষ কেন্দ্রের জন্য নির্মিত',
    },
    header: {
      dashboard: 'ড্যাশবোর্ড',
      profile: 'প্রোফাইল',
      viewSummary: 'সারাংশ দেখুন',
      submitDetails: 'সংরক্ষণ করুন',
      saving: 'সংরক্ষণ হচ্ছে...',
      walkInPatient: 'সাধারণ রোগী',
      abhaLinked: 'ABHA সংযুক্ত',
      changeLanguage: 'ভাষা পরিবর্তন',
    },
    dashboard: {
      abhaLinked: 'ABHA সংযুক্ত',
      profile: 'প্রোফাইল',
      addDetails: 'লক্ষণ যোগ করুন',
      signOut: 'লগ আউট',
      personalDetails: 'ব্যক্তিগত বিবরণ',
      activeMedications: 'চলতি ওষুধপত্র',
      pastMedications: 'আগের ওষুধপত্র',
      recentIntakeSessions: 'সাম্প্রতিক ক্লিনিকাল সেশন',
      medicalDocuments: 'চিকিৎসা নথি',
      startIntakeConsultation: 'নতুন পরামর্শ শুরু করুন',
      noRecords: 'কোনো তথ্য নেই',
      allergies: 'অ্যালার্জি',
      chronicConditions: 'দীর্ঘস্থায়ী রোগ',
      emergencyContact: 'জরুরি যোগাযোগ',
      noAllergies: 'ওষুধের কোনো অ্যালার্জি জানা নেই',
      noChronic: 'কোনোটি নেই',
      viewSummary: 'সারাংশ দেখুন',
    },
    chat: {
      clinicalIntake: 'ক্লিনিকাল ইনটেক পরামর্শ',
      chatCompleted: 'পরামর্শ সম্পন্ন',
      inputPlaceholder: 'আপনার ভাষায় আপনার লক্ষণগুলি বলুন বা লিখুন...',
      send: 'পাঠান',
      listening: 'শুনছি...',
      speak: 'ভয়েস ইনপুট',
      suggestedQuickReplies: 'প্রস্তাবিত উত্তর',
      finishChat: 'পরামর্শ শেষ করুন',
      continueChat: 'পরামর্শ চালিয়ে যান',
      restartChat: 'পুনরায় শুরু করুন',
      chatEndedTitle: 'পরামর্শ শেষ হয়েছে',
      chatEndedDesc: 'আপনার স্বাস্থ্য লক্ষণ লিপিবদ্ধ করা হয়েছে। আপনি সারাংশ দেখতে বা সংরক্ষণ করতে পারেন।',
      generatingQuestion: 'প্রশ্ন তৈরি হচ্ছে...',
    },
    scanner: {
      title: 'মেডিকেল ডকুমেন্ট স্ক্যানার',
      uploaded: 'আপলোড হয়েছে',
      takePhoto: 'ছবি তুলুন',
      uploadFile: 'ফাইল আপলোড',
      dropzone: 'প্রেসক্রিপশন বা রিপোর্ট ছবি এখানে আনুন বা ক্লিক করুন',
      scanning: 'নথি স্ক্যান ও ডিজিটাইজ হচ্ছে...',
    },
  },

  ta: {
    auth: {
      title: 'ABHA மூலம் உள்நுழைக',
      subtitle: 'ஆயுஷ்மான் பாரத் சுகாதார கணக்கு மற்றும் OTP அங்கீகாரம்',
      patient: 'நோயாளி',
      doctor: 'மருத்துவர்',
      patientRoleTag: 'நோயாளி (Patient)',
      doctorRoleTag: 'மருத்துவர் (Doctor)',
      patientAbhaLabel: 'நோயாளி ABHA எண் / சுகாதார அட்டை எண்',
      doctorAbhaLabel: 'மருத்துவர் ABHA எண் / பதிவு எண்',
      abhaFormat: 'நிலையான 14-இலக்க தேசிய அடையாள வடிவம்',
      requestOtp: 'ABHA OTP கோருக',
      sendingOtp: 'OTP அனுப்பப்படுகிறது...',
      welcome: 'வரவேற்கிறோம்',
      otpSent: 'OTP அனுப்பப்பட்டது',
      changeAbha: 'ABHA மாற்றுக',
      sentToMobile: 'பதிவுசெய்த மொபைலுக்கு அனுப்பப்பட்டது',
      demoSandboxCode: 'டெமோ குறியீடு',
      clickToFill: 'தானாக நிரப்ப கிளிக் செய்க',
      enterOtp: '6-இலக்க OTP உள்ளிடுக',
      verifyAndEnter: 'சரிபார்த்து நுழைக',
      verifying: 'சரிபார்க்கிறது...',
      oneClickTestAccounts: 'ஒரு கிளிக் சோதனை கணக்குகள்',
      demoPatient: 'டெமோ நோயாளி',
      demoDoctor: 'டெமோ மருத்துவர்',
      register: 'பதிவு செய்க',
      footer: 'சஞ்சீவனி மருத்துவ AI • இந்திய சுகாதார மையங்கள் மற்றும் ஆயுஷ் மையங்களுக்காக உருவாக்கப்பட்டது',
    },
    header: {
      dashboard: 'முகப்பு பலகை',
      profile: 'சுயவிவரம்',
      viewSummary: 'சுருக்கம் காண்க',
      submitDetails: 'விவரங்களைச் சேமி',
      saving: 'சேமிக்கப்படுகிறது...',
      walkInPatient: 'நோயாளி',
      abhaLinked: 'ABHA இணைக்கப்பட்டது',
      changeLanguage: 'மொழியை மாற்றுக',
    },
    dashboard: {
      abhaLinked: 'ABHA இணைக்கப்பட்டது',
      profile: 'சுயவிவரம்',
      addDetails: 'அறிகுறிகளைச் சேர்க்க',
      signOut: 'வெளியேறு',
      personalDetails: 'தனிப்பட்ட விவரங்கள்',
      activeMedications: 'தற்போதைய மருந்துகள்',
      pastMedications: 'முந்தைய மருந்துகள்',
      recentIntakeSessions: 'சமீபத்திய மருத்துவ ஆலோசனைகள்',
      medicalDocuments: 'மருத்துவ ஆவணங்கள்',
      startIntakeConsultation: 'ஆலோசனையைத் தொடங்கு',
      noRecords: 'பதிவுகள் எதுவும் இல்லை',
      allergies: 'ஒவ்வாமை',
      chronicConditions: 'நீண்டகால நோய்கள்',
      emergencyContact: 'அவசர தொடர்பு',
      noAllergies: 'மருந்து ஒவ்வாமை எதுவும் தெரிவிக்கப்படவில்லை',
      noChronic: 'எதுவும் இல்லை',
      viewSummary: 'சுருக்கம் காண்க',
    },
    chat: {
      clinicalIntake: 'மருத்துவ ஆலோசனை மற்றும் அறிகுறிகள்',
      chatCompleted: 'உரையாடல் முடிந்தது',
      inputPlaceholder: 'உங்கள் அறிகுறிகளை உங்கள் மொழியில் பேசவும் அல்லது தட்டச்சு செய்யவும்...',
      send: 'அனுப்புக',
      listening: 'கேட்கிறது...',
      speak: 'குரல் உள்ளீடு',
      suggestedQuickReplies: 'பரிந்துரைக்கப்பட்ட பதில்கள்',
      finishChat: 'ஆலோசனையை முடிக்க',
      continueChat: 'தொடர்க',
      restartChat: 'மீண்டும் தொடங்க',
      chatEndedTitle: 'மருத்துவ ஆலோசனை முடிவடைந்தது',
      chatEndedDesc: 'உங்கள் அறிகுறிகள் மற்றும் மருத்துவ விவரங்கள் ஆவணப்படுத்தப்பட்டுள்ளன.',
      generatingQuestion: 'கேள்வி உருவாக்கப்படுகிறது...',
    },
    scanner: {
      title: 'மருத்துவ ஆவண ஸ்கேனர்',
      uploaded: 'பதிவேற்றப்பட்டது',
      takePhoto: 'புகைப்படம் எடு',
      uploadFile: 'கோப்பைப் பதிவேற்று',
      dropzone: 'மருந்து சீட்டு அல்லது அறிக்கை படத்தை இங்கே இழுத்து விடவும்',
      scanning: 'ஆவணம் ஸ்கேன் செய்யப்படுகிறது...',
    },
  },

  te: {
    auth: {
      title: 'ABHA తో సైన్ ఇన్ చేయండి',
      subtitle: 'ఆయుష్మాన్ భారత్ హెల్త్ అకౌంట్ & OTP ప్రమాణీకరణ',
      patient: 'రోగి',
      doctor: 'వైద్యుడు',
      patientRoleTag: 'రోగి (Patient)',
      doctorRoleTag: 'వైద్యుడు (Doctor)',
      patientAbhaLabel: 'రోగి ABHA ID / హెల్త్ కార్డ్ నంబర్',
      doctorAbhaLabel: 'వైద్యుని ABHA ID నంబర్',
      abhaFormat: 'ప్రామాణిక 14 అంకెల జాతీయ గుర్తింపు ఫార్మాట్',
      requestOtp: 'ABHA OTP పంపండి',
      sendingOtp: 'OTP పంపుతోంది...',
      welcome: 'స్వాగతం',
      otpSent: 'OTP పంపబడింది',
      changeAbha: 'ABHA మార్చండి',
      sentToMobile: 'నమోదిత మొబైల్‌కు పంపబడింది',
      demoSandboxCode: 'డెమో కోడ్',
      clickToFill: 'ఆటో-ఫిల్ చేయడానికి క్లిక్ చేయండి',
      enterOtp: '6 అంకెల OTP నమోదు చేయండి',
      verifyAndEnter: 'ధృవీకరించి ప్రవేశించండి',
      verifying: 'ధృవీకరిస్తోంది...',
      oneClickTestAccounts: 'ఒక-క్లిక్ టెస్ట్ ఖాతాలు',
      demoPatient: 'డెమో రోగి',
      demoDoctor: 'డెమో డాక్టర్',
      register: 'నమోదు చేసుకోండి',
      footer: 'సంజీవని క్లినికల్ AI • భారతీయ ఆరోగ్య కేంద్రాలు & ఆయుష్ కేంద్రాల కోసం రూపొందించబడింది',
    },
    header: {
      dashboard: 'డ్యాష్‌బోర్డ్',
      profile: 'ప్రొఫైల్',
      viewSummary: 'సారాంశం చూడండి',
      submitDetails: 'వివరాలు సేవ్ చేయండి',
      saving: 'సేవ్ చేస్తోంది...',
      walkInPatient: 'రోగి',
      abhaLinked: 'ABHA లింక్ చేయబడింది',
      changeLanguage: 'భాష మార్చండి',
    },
    dashboard: {
      abhaLinked: 'ABHA లింక్ చేయబడింది',
      profile: 'ప్రొఫైల్',
      addDetails: 'లక్షణాలు జోడించండి',
      signOut: 'లాగ్ అవుట్',
      personalDetails: 'వ్యక్తిగత వివరాలు',
      activeMedications: 'ప్రస్తుత మందులు',
      pastMedications: 'గత మందులు',
      recentIntakeSessions: 'ఇటీవలి సంప్రదింపులు',
      medicalDocuments: 'వైద్య పత్రాలు',
      startIntakeConsultation: 'కొత్త సంప్రదింపు ప్రారంభించండి',
      noRecords: 'రికార్డులు కనుగొనబడలేదు',
      allergies: 'అలెర్జీలు',
      chronicConditions: 'దీర్ఘకాలిక సమస్యలు',
      emergencyContact: 'అత్యవసర పరిచయం',
      noAllergies: 'మందుల అలెర్జీలు లేవు',
      noChronic: 'ఏమీ నమోదు కాలేదు',
      viewSummary: 'సారాంశం చూడండి',
    },
    chat: {
      clinicalIntake: 'క్లినికల్ సంప్రదింపులు',
      chatCompleted: 'సంభాషణ ముగిసింది',
      inputPlaceholder: 'మీ భాషలో మాట్లాడండి లేదా మీ లక్షణాలను టైప్ చేయండి...',
      send: 'పంపు',
      listening: 'వింటోంది...',
      speak: 'వాయిస్ ఇన్‌పుట్',
      suggestedQuickReplies: 'సూచించిన సమాధానాలు',
      finishChat: 'సంప్రదింపు ముగించండి',
      continueChat: 'కొనసాగించండి',
      restartChat: 'మళ్లీ ప్రారంభించండి',
      chatEndedTitle: 'సంప్రదింపు ముగిసింది',
      chatEndedDesc: 'మీ ఆరోగ్య లక్షణాలు నమోదు చేయబడ్డాయి.',
      generatingQuestion: 'ప్రశ్న సిద్ధం అవుతోంది...',
    },
    scanner: {
      title: 'మెడికల్ డాక్యుమెంట్ స్కానర్',
      uploaded: 'అప్‌లోడ్ చేయబడింది',
      takePhoto: 'ఫోటో తీయండి',
      uploadFile: 'ఫైల్ ఎంచుకోండి',
      dropzone: 'ప్రిస్క్రిప్షన్ లేదా ల్యాబ్ రిపోర్ట్ చిత్రాన్ని ఇక్కడ ఉంచండి',
      scanning: 'పత్రం స్కాన్ అవుతోంది...',
    },
  },

  mr: {
    auth: {
      title: 'आभा (ABHA) सह साइन इन करा',
      subtitle: 'आयुष्मान भारत आरोग्य खाते आणि OTP प्रमाणीकरण',
      patient: 'रुग्ण',
      doctor: 'डॉक्टर',
      patientRoleTag: 'रुग्ण (Patient)',
      doctorRoleTag: 'डॉक्टर (Doctor)',
      patientAbhaLabel: 'रुग्ण ABHA आयडी / आरोग्य कार्ड क्रमांक',
      doctorAbhaLabel: 'डॉक्टर ABHA आयडी क्रमांक',
      abhaFormat: 'मानक १४-अंकी राष्ट्रीय ओळख स्वरूप',
      requestOtp: 'ABHA OTP मागवा',
      sendingOtp: 'OTP पाठवला जात आहे...',
      welcome: 'स्वागत आहे',
      otpSent: 'OTP पाठवला गेला आहे',
      changeAbha: 'ABHA बदला',
      sentToMobile: 'नोंदणीकृत मोबाईलवर पाठवले',
      demoSandboxCode: 'डेमो कोड',
      clickToFill: 'भरण्यासाठी क्लिक करा',
      enterOtp: '६-अंकी OTP टाका',
      verifyAndEnter: 'सत्यापित करून प्रवेश करा',
      verifying: 'सत्यापन सुरू आहे...',
      oneClickTestAccounts: 'एक-क्लिक चाचणी खाती',
      demoPatient: 'डेमो रुग्ण',
      demoDoctor: 'डेमो डॉक्टर',
      register: 'नोंदणी करा',
      footer: 'संजीवनी क्लिनिकल एआय • भारतीय आरोग्य सुविधा आणि आयुष केंद्रांसाठी विकसित',
    },
    header: {
      dashboard: 'डॅशबोर्ड',
      profile: 'प्रोफाइल',
      viewSummary: 'सारांश पहा',
      submitDetails: 'माहिती सेव्ह करा',
      saving: 'सेव्ह होत आहे...',
      walkInPatient: 'रुग्ण',
      abhaLinked: 'ABHA जोडले आहे',
      changeLanguage: 'भाषा बदला',
    },
    dashboard: {
      abhaLinked: 'ABHA जोडले आहे',
      profile: 'प्रोफाइल',
      addDetails: 'तपशील जोडा',
      signOut: 'साइन आउट',
      personalDetails: 'वैयक्तिक माहिती',
      activeMedications: 'सध्याची औषधे',
      pastMedications: 'मागील औषधे',
      recentIntakeSessions: 'अलीकडील सल्लामसलत सत्रे',
      medicalDocuments: 'वैद्यकीय कागदपत्रे',
      startIntakeConsultation: 'नवीन सल्लामसलत सुरू करा',
      noRecords: 'कोणतीही नोंद आढळली नाही',
      allergies: 'अ‍ॅलर्जी',
      chronicConditions: 'दीर्घकालीन आजार',
      emergencyContact: 'आपत्कालीन संपर्क',
      noAllergies: 'कोणतीही औषध अ‍ॅलर्जी नाही',
      noChronic: 'काहीही नोंदवले नाही',
      viewSummary: 'सारांश पहा',
    },
    chat: {
      clinicalIntake: 'क्लिनिकल तपासणी व सल्लामसलत',
      chatCompleted: 'संभाषण पूर्ण झाले',
      inputPlaceholder: 'तुमच्या भाषेत बोला किंवा तुमची लक्षणे टाइप करा...',
      send: 'पाठवा',
      listening: 'ऐकत आहे...',
      speak: 'व्हॉइस इनपुट',
      suggestedQuickReplies: 'सुचवलेली उत्तरे',
      finishChat: 'सल्लामसलत पूर्ण करा',
      continueChat: 'सल्लामसलत सुरू ठेवा',
      restartChat: 'पुन्हा सुरू करा',
      chatEndedTitle: 'सल्लामसलत पूर्ण झाली आहे',
      chatEndedDesc: 'तुमची लक्षणे आणि वैद्यकीय इतिहास नोंदवला गेला आहे.',
      generatingQuestion: 'वैद्यकीय प्रश्न तयार होत आहे...',
    },
    scanner: {
      title: 'वैद्यकीय कागदपत्र स्कॅनर',
      uploaded: 'अपलोड केले',
      takePhoto: 'फोटो घ्या',
      uploadFile: 'फाइल निवडा',
      dropzone: 'प्रिस्क्रिप्शन किंवा अहवाल येथे ड्रॅग करा किंवा क्लिक करा',
      scanning: 'कागदपत्र स्कॅन होत आहे...',
    },
  },

  gu: {
    auth: {
      title: 'ABHA વડે સાઇન ઇન કરો',
      subtitle: 'આયુષ્માન ભારત હેલ્થ એકાઉન્ટ અને OTP પ્રમાણીકરણ',
      patient: 'દર્દી',
      doctor: 'ડોક્ટર',
      patientRoleTag: 'દર્દી (Patient)',
      doctorRoleTag: 'ડોક્ટર (Doctor)',
      patientAbhaLabel: 'દર્દી ABHA ID / હેલ્થ કાર્ડ નંબર',
      doctorAbhaLabel: 'ડોક્ટર ABHA ID / રજીસ્ટ્રેશન નંબર',
      abhaFormat: 'પ્રમાણભૂત 14-અંકનું રાષ્ટ્રીય ઓળખ ફોર્મેટ',
      requestOtp: 'ABHA OTP મોકલો',
      sendingOtp: 'OTP મોકલાઈ રહ્યો છે...',
      welcome: 'સ્વાગત છે',
      otpSent: 'OTP મોકલાઈ ગયો છે',
      changeAbha: 'ABHA બદલો',
      sentToMobile: 'નોંધાયેલા મોબાઇલ પર મોકલ્યો',
      demoSandboxCode: 'ડેમો કોડ',
      clickToFill: 'ઓટો-ફિલ કરવા ક્લિક કરો',
      enterOtp: '6-અંકનો OTP દાખલ કરો',
      verifyAndEnter: 'ચકાસો અને પ્રવેશ કરો',
      verifying: 'ચકાસણી ચાલુ છે...',
      oneClickTestAccounts: 'વન-ક્લિક ટેસ્ટ એકાઉન્ટ્સ',
      demoPatient: 'ડેમો દર્દી',
      demoDoctor: 'ડેમો ડોક્ટર',
      register: 'નોંધણી કરો',
      footer: 'સંજીવની ક્લિનિકલ AI • ભારતીય આરોગ્ય કેન્દ્રો અને આયુષ કેન્દ્રો માટે રચાયેલ',
    },
    header: {
      dashboard: 'ડેશબોર્ડ',
      profile: 'પ્રોફાઇલ',
      viewSummary: 'સારાંશ જુઓ',
      submitDetails: 'વિગતો સાચવો',
      saving: 'સાચવી રહ્યું છે...',
      walkInPatient: 'દર્દી',
      abhaLinked: 'ABHA લિંક થયેલ છે',
      changeLanguage: 'ભાષા બદલો',
    },
    dashboard: {
      abhaLinked: 'ABHA લિંક થયેલ છે',
      profile: 'પ્રોફાઇલ',
      addDetails: 'લક્ષણો ઉમેરો',
      signOut: 'સાઇન આઉટ',
      personalDetails: 'વ્યક્તિગત વિગતો',
      activeMedications: 'હાલની દવાઓ',
      pastMedications: 'અગાઉની દવાઓ',
      recentIntakeSessions: 'તાજેતરની સલાહ સત્રો',
      medicalDocuments: 'તબીબી દસ્તાવેજો',
      startIntakeConsultation: 'નવી સલાહ શરૂ કરો',
      noRecords: 'કોઈ રેકોર્ડ મળ્યો નથી',
      allergies: 'એલર્જી',
      chronicConditions: 'લાંબા ગાળાના રોગો',
      emergencyContact: 'ઇમરજન્સી સંપર્ક',
      noAllergies: 'કોઈ દવાની એલર્જી નથી',
      noChronic: 'કંઈ નોંધાયેલ નથી',
      viewSummary: 'સારાંશ જુઓ',
    },
    chat: {
      clinicalIntake: 'ક્લિનિકલ સલાહ અને લક્ષણ પૂછપરછ',
      chatCompleted: 'વાતચીત પૂર્ણ થઈ',
      inputPlaceholder: 'તમારી ભાષામાં બોલો અથવા લક્ષણો લખો...',
      send: 'મોકલો',
      listening: 'સાંભળી રહ્યા છીએ...',
      speak: 'વોઇસ ઇનપુટ',
      suggestedQuickReplies: 'સૂચવેલા જવાબો',
      finishChat: 'સલાહ પૂર્ણ કરો',
      continueChat: 'વાતચીત ચાલુ રાખો',
      restartChat: 'ફરીથી શરૂ કરો',
      chatEndedTitle: 'સલાહ પૂર્ણ થઈ છે',
      chatEndedDesc: 'તમારા લક્ષણો અને તબીબી ઇતિહાસ નોંધવામાં આવ્યો છે.',
      generatingQuestion: 'પ્રશ્ન તૈયાર થઈ રહ્યો છે...',
    },
    scanner: {
      title: 'મેડિકલ દસ્તાવેજ સ્કેનર',
      uploaded: 'અપલોડ કરેલ',
      takePhoto: 'ફોટો લો',
      uploadFile: 'ફાઇલ અપલોડ',
      dropzone: 'પ્રિસ્ક્રિપ્શન અથવા રિપોર્ટ અહીં ખેંચો અથવા ક્લિક કરો',
      scanning: 'દસ્તાવેજ સ્કેન થઈ રહ્યો છે...',
    },
  },
}

export function useTranslation(lang: LanguageCode): TranslationDictionary {
  return TRANSLATIONS[lang] || TRANSLATIONS.en
}

# Hindi strings for review

Every Hindi string a native reviewer must check before it ships (00 gate 3.1). One row per
string: its key in `hi.json`, the English, the Hindi, and its status (`draft` until a reviewer
marks it `reviewed`). Later work packages add their new strings here (WP-18 replaces this list
with an export script).

Rules for the reviewer:

- Inside Hindi text the name stays in Latin letters: **LifePeek** (never written in Devanagari).
- `{{name}}`, `{{version}}` and other words in double braces are filled in by the app; keep them as they are.
- `**…**` marks bold text on the privacy page.
- The launch date and the project email on the privacy page are placeholders in angle brackets until
  the maintainer fills them in (in `en.json`, `hi.json` and this file).
- "डायबिटीज़" is used instead of "मधुमेह" because students hear it more. Please confirm.
- On the privacy page, the first three items of "आपके डिवाइस पर क्या रहता है" (`privacy.sections[0].items[0]`,
  `[1]` and `[2]`; `[1]` was added with the reduced-motion setting) and the paragraph under "गलती की रिपोर्ट करना"
  (`privacy.sections[1].intro[0]`) are new wording; please check them closely.

## Renamed lines (BioSim → LifePeek, only the name changed)

| Key | English | Hindi | Status |
|---|---|---|---|
| `home.lead` | LifePeek shows why. Pick two meals and watch them travel through the body side by side — how fast each leaves the stomach, where the sugar, protein, fat and fibre go, and how blood sugar responds. | LifePeek बताता है कि ऐसा क्यों होता है। दो भोजन चुनें और उन्हें साथ-साथ शरीर में आगे बढ़ते देखें — हर भोजन आमाशय से कितनी जल्दी निकलता है, शर्करा, प्रोटीन, वसा और रेशा कहाँ जाते हैं, और रक्त शर्करा कैसे बदलती है। | draft |
| `home.previewCaption` | Food still in the stomach after eating — computed by the LifePeek model | खाने के बाद आमाशय में बचा भोजन — LifePeek मॉडल द्वारा गणना | draft |
| `feedback.failed` | Couldn’t reach the LifePeek server. | LifePeek सर्वर से संपर्क नहीं हो सका। | draft |
| `disclaimer.long` | LifePeek is a simplified teaching model. Times and blood-sugar values are typical ranges for healthy adults and vary a lot between people. It must not be used to make health, diet or medical decisions. | LifePeek पढ़ाने के लिए बनाया गया एक सरल मॉडल है। समय और रक्त शर्करा के मान स्वस्थ वयस्कों की सामान्य सीमाएँ हैं और हर व्यक्ति में काफ़ी अलग होते हैं। इसका उपयोग स्वास्थ्य, आहार या चिकित्सा संबंधी निर्णय लेने के लिए नहीं किया जाना चाहिए। | draft |
| `teach.title` | Using LifePeek in class | कक्षा में LifePeek का उपयोग | draft |
| `teach.lead` | LifePeek is built for a projector and a 40-minute lesson on nutrition and digestion (for example, the “Life Processes” chapter). | LifePeek प्रोजेक्टर और पोषण व पाचन पर 40 मिनट के पाठ के लिए बनाया गया है (उदाहरण के लिए, “जैव प्रक्रम” अध्याय)। | draft |
| `science.fixedBody` | Time in the small and large intestine varies far more between people than between meals, so LifePeek uses typical published values and shows the range. | छोटी और बड़ी आँत में लगने वाला समय अलग-अलग भोजनों की तुलना में अलग-अलग लोगों में कहीं ज़्यादा बदलता है, इसलिए LifePeek प्रकाशित सामान्य मानों का उपयोग करता है और उनकी सीमा दिखाता है। | draft |
| `error.body` | This often happens right after LifePeek is updated. Reloading fixes it. | ऐसा अक्सर LifePeek के अपडेट होने के ठीक बाद होता है। पेज दोबारा लोड करने से यह ठीक हो जाता है। | draft |

## Tagline (also in README.md)

| Key | English | Hindi | Status |
|---|---|---|---|
| `about.tagline` | LifePeek: peek inside living things | LifePeek: सजीवों के अंदर झाँकिए | draft |

## Medical note

| Key | English | Hindi | Status |
|---|---|---|---|
| `disclaimer.short` | Educational model of a typical healthy adult. Not medical advice. | एक सामान्य स्वस्थ वयस्क का शैक्षिक मॉडल। यह चिकित्सकीय सलाह नहीं है। | draft |
| `disclaimer.firstRun.title` | For learning, not for diet decisions | सीखने के लिए, खान-पान के फ़ैसलों के लिए नहीं | draft |
| `disclaimer.firstRun.body` | LifePeek shows what typically happens in a healthy adult. Real bodies differ. It is not medical advice. If you have diabetes or any health worry, talk to a doctor. | LifePeek दिखाता है कि एक स्वस्थ वयस्क में आम तौर पर क्या होता है। हर शरीर अलग होता है। यह चिकित्सकीय सलाह नहीं है। अगर आपको डायबिटीज़ है या स्वास्थ्य से जुड़ी कोई चिंता है, तो डॉक्टर से बात करें। | draft |
| `disclaimer.firstRun.ok` | Got it | ठीक है | draft |
| `disclaimer.graph` | A typical range for a healthy adult, not a prediction for you. Not medical advice. | यह एक स्वस्थ वयस्क की सामान्य सीमा है, आपके लिए भविष्यवाणी नहीं। यह चिकित्सकीय सलाह नहीं है। | draft |
| `disclaimer.more` | More about this | इसके बारे में और जानें | draft |
| `about.medicalTitle` | Not medical advice | यह चिकित्सकीय सलाह नहीं है | draft |
| `about.medical` | LifePeek is an educational model of a typical healthy adult. It does not model children, pregnancy, diabetes or digestive illness. Its numbers are typical ranges, not measurements of any person, and must not be used to choose a diet, treat an illness or change medicine. If you have diabetes or any health concern, talk to a doctor or a qualified dietitian. | LifePeek एक सामान्य स्वस्थ वयस्क का शैक्षिक मॉडल है। यह बच्चों, गर्भावस्था, डायबिटीज़ या पाचन की बीमारियों को नहीं दिखाता। इसकी संख्याएँ सामान्य सीमाएँ हैं, किसी व्यक्ति की माप नहीं, और इनका उपयोग आहार चुनने, बीमारी का इलाज करने या दवा बदलने के लिए नहीं किया जाना चाहिए। अगर आपको डायबिटीज़ है या स्वास्थ्य से जुड़ी कोई चिंता है, तो डॉक्टर या योग्य आहार विशेषज्ञ से बात करें। | draft |

## Privacy page

| Key | English | Hindi | Status |
|---|---|---|---|
| `privacy.title` | Privacy | गोपनीयता (प्राइवेसी) | draft |
| `privacy.updated` | Last updated: <date of launch> | पिछला अपडेट: <लॉन्च की तारीख> | draft |
| `privacy.summary` | **Short version: LifePeek does not ask for, collect or store anything about you.** There are no accounts, no logins, no ads, no cookies and no tracking. | **संक्षेप में: LifePeek आपके बारे में कुछ भी नहीं माँगता, इकट्ठा नहीं करता और सहेजता नहीं है।** कोई अकाउंट नहीं, कोई लॉगिन नहीं, कोई विज्ञापन नहीं, कोई कुकी नहीं और कोई ट्रैकिंग नहीं। | draft |
| `privacy.sections[0].title` | What stays on your device | आपके डिवाइस पर क्या रहता है | draft |
| `privacy.sections[0].intro[0]` | LifePeek saves a few things **in your own browser only**. They are never sent to us: | LifePeek कुछ चीज़ें **सिर्फ़ आपके अपने ब्राउज़र में** सहेजता है। ये हमें कभी नहीं भेजी जातीं: | draft |
| `privacy.sections[0].items[0]` | your language (English or Hindi), whether Projector mode is on, and whether you have closed the "not medical advice" note; | आपकी भाषा (अंग्रेज़ी या हिन्दी), प्रोजेक्टर मोड चालू है या नहीं, और आपने "चिकित्सकीय सलाह नहीं" वाली सूचना बंद की है या नहीं; | draft |
| `privacy.sections[0].items[1]` | whether you have chosen less movement on screen (reduced motion); | आपने स्क्रीन पर कम हलचल चुनी है या नहीं; | draft |
| `privacy.sections[0].items[2]` | a one-time note that the page has just reloaded after an update error (deleted when you close the tab); | अपडेट में गड़बड़ी के बाद पेज के दोबारा लोड होने का एक बार का निशान (टैब बंद करते ही मिट जाता है); | draft |
| `privacy.sections[0].items[3]` | a copy of the app, so it works offline in class; | ऐप की एक कॉपी, ताकि कक्षा में इंटरनेट के बिना भी चले; | draft |
| `privacy.sections[0].items[4]` | the meals you pick are kept in the page address (the link). A share link contains only the meals, nothing about you. | आपने जो भोजन चुने, वे पेज के पते (लिंक) में रहते हैं। शेयर किए गए लिंक में सिर्फ़ भोजन होते हैं, आपके बारे में कुछ नहीं। | draft |
| `privacy.sections[0].outro[0]` | You can delete all of this by clearing the site data for lifepeek.vercel.app in your browser settings. | अपने ब्राउज़र की सेटिंग में lifepeek.vercel.app का साइट डेटा मिटाकर आप यह सब हटा सकते हैं। | draft |
| `privacy.sections[1].title` | Reporting a mistake | गलती की रिपोर्ट करना | draft |
| `privacy.sections[1].intro[0]` | When you press **Report a mistake**, LifePeek opens a **GitHub issue** in a new tab with your report already filled in. **Nothing is sent to us. Your report text reaches GitHub only inside the link that opens the form, and nothing is published until you press Submit there.** You choose whether to send it. | जब आप **गलती बताएँ** दबाते हैं, तो LifePeek एक नए टैब में **GitHub issue** खोलता है जिसमें आपकी रिपोर्ट पहले से भरी होती है। **हमें कुछ नहीं भेजा जाता। आपकी रिपोर्ट का टेक्स्ट सिर्फ़ उस लिंक के अंदर GitHub तक पहुँचता है जो फ़ॉर्म खोलता है, और जब तक आप वहाँ Submit नहीं दबाते, कुछ भी प्रकाशित नहीं होता।** भेजना है या नहीं, यह आप तय करते हैं। | draft |
| `privacy.sections[1].items[0]` | GitHub issues are **public**. Anyone can read them. | GitHub issue **सार्वजनिक** होते हैं। इन्हें कोई भी पढ़ सकता है। | draft |
| `privacy.sections[1].items[1]` | You need a GitHub account, and GitHub only allows accounts for people aged 13 and over. If you are younger, ask your teacher to send the report. | इसके लिए GitHub अकाउंट चाहिए, और GitHub सिर्फ़ 13 साल या उससे बड़े लोगों को अकाउंट बनाने देता है। अगर आप छोटे हैं, तो अपने शिक्षक से रिपोर्ट भेजने को कहें। | draft |
| `privacy.sections[1].items[2]` | GitHub's own privacy statement applies to your account and the issue: https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement | आपके अकाउंट और issue पर GitHub की अपनी प्राइवेसी नीति लागू होती है: https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement | draft |
| `privacy.sections[1].items[3]` | **Don't type your name, school, phone number, email or any health information** in the report. Just say what is wrong and, if you can, where the right number comes from. | रिपोर्ट में **अपना नाम, स्कूल, फ़ोन नंबर, ईमेल या स्वास्थ्य से जुड़ी कोई जानकारी न लिखें।** बस यह बताएँ कि क्या गलत है और, हो सके तो, सही संख्या कहाँ से ली गई है। | draft |
| `privacy.sections[1].items[4]` | If you posted something by mistake, ask us (see "Contact" below) and we will delete the issue. | अगर गलती से कुछ निजी जानकारी पोस्ट हो गई, तो हमें बताएँ (नीचे "संपर्क" देखें), हम वह issue हटा देंगे। | draft |
| `privacy.sections[2].title` | Hosting | होस्टिंग | draft |
| `privacy.sections[2].intro[0]` | The app is served by Vercel, a web hosting company. Like every website, Vercel's servers see your IP address and browser type when your device downloads the app, and may keep this in logs for a limited time, for security and to keep the site running, under Vercel's privacy policy: https://vercel.com/legal/privacy-policy. We do not use these logs to find out who you are, and we do not combine them with anything else. | ऐप Vercel नाम की वेब होस्टिंग कंपनी के ज़रिए चलता है। हर वेबसाइट की तरह, जब आपका डिवाइस ऐप डाउनलोड करता है, तो Vercel के सर्वर आपका IP पता और ब्राउज़र का प्रकार देखते हैं, और सुरक्षा व साइट चलाने के लिए इसे Vercel की प्राइवेसी नीति के अनुसार कुछ समय के लिए लॉग में रख सकते हैं: https://vercel.com/legal/privacy-policy। हम इन लॉग से यह पता नहीं लगाते कि आप कौन हैं, और इन्हें किसी और जानकारी से नहीं जोड़ते। | draft |
| `privacy.sections[2].items[0]` | **Analytics are switched off.** We do not use Vercel Analytics, Google Analytics or any other tracker. | **एनालिटिक्स बंद है।** हम Vercel Analytics, Google Analytics या कोई और ट्रैकर इस्तेमाल नहीं करते। | draft |
| `privacy.sections[2].items[1]` | Fonts and pictures are part of the app, so your browser does not contact Google or other services. | फ़ॉन्ट और चित्र ऐप के अंदर ही हैं, इसलिए आपका ब्राउज़र Google या किसी और सेवा से संपर्क नहीं करता। | draft |
| `privacy.sections[3].title` | How long we keep things | हम चीज़ें कितने समय तक रखते हैं | draft |
| `privacy.sections[3].items[0]` | **On our side: nothing**, because we don't receive anything about you. | **हमारे पास: कुछ भी नहीं**, क्योंकि हमें आपके बारे में कुछ मिलता ही नहीं। | draft |
| `privacy.sections[3].items[1]` | Reports on GitHub stay public until they are deleted. We delete any report that contains personal details as soon as we see it. | GitHub पर रिपोर्ट तब तक सार्वजनिक रहती हैं जब तक उन्हें हटाया न जाए। जिस रिपोर्ट में निजी जानकारी हो, उसे हम देखते ही हटा देते हैं। | draft |
| `privacy.sections[3].items[2]` | If we later add our own report form, we will update this page **before** it goes live. The plan is: no name or email fields, IP addresses used only for a moment to stop spam (never saved), server logs deleted within 14 days, and reports deleted within 90 days after they are handled. | अगर बाद में हम अपना रिपोर्ट फ़ॉर्म जोड़ते हैं, तो उसके चालू होने से **पहले** यह पेज अपडेट करेंगे। योजना यह है: नाम या ईमेल का कोई खाना नहीं, IP पता सिर्फ़ स्पैम रोकने के लिए एक पल के लिए इस्तेमाल होगा (कभी सहेजा नहीं जाएगा), सर्वर लॉग 14 दिन के अंदर मिटा दिए जाएँगे, और रिपोर्ट का काम पूरा होने के 90 दिन के अंदर रिपोर्ट मिटा दी जाएगी। | draft |
| `privacy.sections[4].title` | Children and India's data protection law | बच्चे और भारत का डेटा संरक्षण कानून | draft |
| `privacy.sections[4].intro[0]` | LifePeek is made for school students. India's **Digital Personal Data Protection Act, 2023 (DPDP Act)** protects personal data, with extra care for children. We follow it by not collecting personal data at all, so there is nothing to ask parents' consent for. If this ever changes, we will update this page first. | LifePeek स्कूल के विद्यार्थियों के लिए बना है। भारत का **डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 (DPDP Act)** लोगों के निजी डेटा की रक्षा करता है, और बच्चों के डेटा पर ख़ास ध्यान देता है। हम इसका पालन इस तरह करते हैं कि हम कोई निजी डेटा इकट्ठा ही नहीं करते, इसलिए माता-पिता से अनुमति लेने की ज़रूरत नहीं पड़ती। अगर यह कभी बदला, तो हम पहले यह पेज अपडेट करेंगे। | draft |
| `privacy.sections[5].title` | Contact (grievances) | संपर्क (शिकायत) | draft |
| `privacy.sections[5].intro[0]` | If you have a question or a complaint about privacy, or want something deleted: | अगर प्राइवेसी के बारे में आपका कोई सवाल या शिकायत है, या आप कुछ हटवाना चाहते हैं: | draft |
| `privacy.sections[5].items[0]` | open an issue: https://github.com/Sarthaks-24/lifepeek/issues, or | एक issue खोलें: https://github.com/Sarthaks-24/lifepeek/issues, या | draft |
| `privacy.sections[5].items[1]` | email: **<project email>** | ईमेल करें: **<प्रोजेक्ट ईमेल>** | draft |
| `privacy.sections[5].outro[0]` | Maintainer: {{name}} (GitHub: @Sarthaks-24). We aim to reply within 7 days. | देखरेख करने वाले: {{name}} (GitHub: @Sarthaks-24)। हम 7 दिन के अंदर जवाब देने की कोशिश करते हैं। | draft |
| `privacy.sections[6].title` | Not medical advice | यह चिकित्सकीय सलाह नहीं है | draft |
| `privacy.sections[6].intro[0]` | LifePeek is an **educational model of a typical healthy adult**. Times and blood-sugar values are typical ranges and vary a lot between people. **It is not medical advice.** Do not use it to make health, diet or medical decisions. If you have diabetes or any health concern, talk to a doctor. | LifePeek **एक सामान्य स्वस्थ वयस्क का शैक्षिक मॉडल** है। समय और रक्त शर्करा के मान सामान्य सीमाएँ हैं और हर व्यक्ति में काफ़ी अलग होते हैं। **यह चिकित्सकीय सलाह नहीं है।** इसका उपयोग स्वास्थ्य, आहार या चिकित्सा संबंधी निर्णय लेने के लिए न करें। अगर आपको डायबिटीज़ है या स्वास्थ्य से जुड़ी कोई चिंता है, तो डॉक्टर से बात करें। | draft |

## Footer

| Key | English | Hindi | Status |
|---|---|---|---|
| `footer.madeBy` | Made by {{name}} | {{name}} द्वारा बनाया गया | draft |
| `footer.about` | About | परिचय | draft |
| `footer.privacy` | Privacy | गोपनीयता | draft |
| `footer.licences` | Code Apache-2.0 · Content CC BY 4.0 | कोड Apache-2.0 · सामग्री CC BY 4.0 | draft |
| `footer.notices` | Third-party notices | थर्ड-पार्टी नोटिस | draft |
| `footer.model` | Model version {{version}} | मॉडल संस्करण {{version}} | draft |

## About page

| Key | English | Hindi | Status |
|---|---|---|---|
| `about.title` | About LifePeek | LifePeek का परिचय | draft |
| `about.lead` | Compare what happens to two meals inside your body. Free, no login, works offline once loaded. | देखिए कि दो भोजनों के साथ आपके शरीर के अंदर क्या होता है, और उनकी तुलना कीजिए। मुफ़्त, बिना लॉगिन, और एक बार लोड होने के बाद इंटरनेट के बिना भी चलता है। | draft |
| `about.makerTitle` | Who made it | इसे किसने बनाया | draft |
| `about.maker` | LifePeek is made by {{name}}. Every number in it is cited, and every report of a mistake is checked against published sources. | LifePeek को {{name}} ने बनाया है। इसकी हर संख्या का स्रोत दिया गया है, और गलती की हर रिपोर्ट को प्रकाशित स्रोतों से जाँचा जाता है। | draft |
| `about.sourcesTitle` | Where the numbers come from | संख्याएँ कहाँ से आती हैं | draft |
| `about.sources` | Each food is described only by cited values: its nutrients from USDA FoodData Central or the Indian Nutrient Databank, and, where it applies, its glycemic index from the International GI tables (Atkinson et al. 2008). The model computes everything else. | हर भोजन के लिए सिर्फ़ स्रोत सहित मान लिए गए हैं: उसके पोषक तत्व USDA FoodData Central या Indian Nutrient Databank से, और जहाँ लागू हो, उसका ग्लाइसेमिक इंडेक्स अंतरराष्ट्रीय GI तालिकाओं (Atkinson et al. 2008) से। बाकी सब कुछ मॉडल गणना करके निकालता है। | draft |
| `about.sourcesLink` | Every food and its sources | हर भोजन और उसके स्रोत | draft |
| `about.licencesTitle` | Licences | लाइसेंस | draft |
| `about.licenceCode` | Code: Apache License 2.0. Keep the NOTICE file in copies. | कोड: Apache License 2.0। इसकी कॉपी में NOTICE फ़ाइल साथ रखें। | draft |
| `about.licenceContent` | Lesson text, translations, illustrations, docs, and our own food-file structure and labels: CC BY 4.0. Credit: “LifePeek by {{name}}, https://lifepeek.vercel.app, CC BY 4.0”. | पाठ की सामग्री, अनुवाद, चित्र, दस्तावेज़, और भोजन-फ़ाइलों की हमारी अपनी बनावट और नाम: CC BY 4.0। श्रेय ऐसे दें: “LifePeek by {{name}}, https://lifepeek.vercel.app, CC BY 4.0”। | draft |
| `about.licenceData` | Nutrient and GI values from USDA, the Indian Nutrient Databank, Atkinson et al. and others: not relicensed by us. | USDA, Indian Nutrient Databank, Atkinson et al. और दूसरे स्रोतों से लिए गए पोषक तत्व और GI मान: इन्हें हम दोबारा लाइसेंस नहीं देते। | draft |
| `about.licenceName` | The LifePeek name and logo: not licensed. Forks must use a different name. | LifePeek नाम और लोगो: इनका लाइसेंस नहीं दिया गया है। फ़ोर्क को कोई दूसरा नाम रखना होगा। | draft |
| `about.licenceLibraries` | Bundled libraries and fonts: their own licences. | साथ में शामिल लाइब्रेरी और फ़ॉन्ट: उनके अपने लाइसेंस। | draft |
| `about.reportTitle` | Found a mistake? | कोई गलती दिखी? | draft |
| `about.report` | Spotted a wrong number or explanation? Use “Report a mistake” in the simulator. | कोई गलत संख्या या व्याख्या दिखी? सिमुलेटर में “गलती बताएँ” का उपयोग करें। | draft |
| `about.openIssue` | Open an issue on GitHub | GitHub पर issue खोलें | draft |
| `about.privacyTitle` | Privacy | गोपनीयता | draft |
| `about.privacy` | LifePeek has no accounts, no ads, no cookies and no analytics, and collects no personal data. | LifePeek में कोई अकाउंट, विज्ञापन, कुकी या एनालिटिक्स नहीं है, और यह कोई निजी डेटा इकट्ठा नहीं करता। | draft |
| `about.privacyLink` | Read the privacy page | गोपनीयता पेज पढ़ें | draft |

## Report-a-mistake form

| Key | English | Hindi | Status |
|---|---|---|---|
| `feedback.privacy` | Reports are public. Please don’t include names, school, emails or health information. | रिपोर्ट सार्वजनिक होती हैं। कृपया नाम, स्कूल, ईमेल या स्वास्थ्य संबंधी जानकारी न लिखें। | draft |
| `feedback.publicWarning` | This opens a public page on GitHub. Don't type your name, school or phone number. | इससे GitHub पर एक सार्वजनिक पेज खुलता है। अपना नाम, स्कूल या फ़ोन नंबर न लिखें। | draft |
| `feedback.openIssueDirect` | Open the report on GitHub | रिपोर्ट GitHub पर खोलें | draft |

## Sign-off

Reviewed by ___ on ___

# Hindi strings for review

Every Hindi string a native reviewer must check before it ships (00 gate 3.1). One row per
string: its key in `hi.json`, the English, the Hindi, and its status (`draft` until a reviewer
marks it `reviewed by <initials> <date>`).

Nobody keeps this list by hand (WP-18). After adding or changing a string in `en.json` and
`hi.json`, run `node apps/web/scripts/hi-review.mjs --write`: new keys get a `draft` row (under
"New strings", to move under a better heading if you like), the English and Hindi columns follow
the JSON files, a reviewed row whose Hindi or English changed goes back to `draft`, and rows of
deleted keys go. `i18n.test.ts` fails while this file is out of date.
`node apps/web/scripts/hi-review.mjs` writes `apps/web/hi-review.csv` (key, English, Hindi, status)
for the reviewer and lists every key not yet reviewed. Only the reviewer changes a status.

Rules for the reviewer:

- Inside Hindi text the name stays in Latin letters: **LifePeek** (never written in Devanagari).
- `{{name}}`, `{{version}}` and other words in double braces are filled in by the app; keep them as they are.
- `**…**` marks bold text on the privacy page.
- The launch date and the project email on the privacy page are placeholders in angle brackets until
  the maintainer fills them in (in `en.json`, `hi.json` and this file).
- "डायबिटीज़" is used instead of "मधुमेह" because students hear it more. Please confirm.
- On the privacy page, the first four items of "आपके डिवाइस पर क्या रहता है" (`privacy.sections[0].items[0]`
  to `[3]`; `[1]` was added with the reduced-motion setting, `[2]` with the letter-key switch in WP-15) and the paragraph under "गलती की रिपोर्ट करना"
  (`privacy.sections[1].intro[0]`) are new wording; please check them closely.
- `keep.help` is the help of the "Keep to compare" button, so it now says what the button does, as
  an active sentence with the button as its unspoken subject ("इस भोजन को … रख देता है"), not a passive
  "रखा जाता है". "ग्राफ़ों पर" is plural, like "on the graphs". Please check it reads naturally.
- "ग्राफ़" with no ending stands for "graphs" (plural) in `stage.graphs`, `table.title` and
  `keys.table`, and for one graph in `graph.label`, `graph.halfNote` and `keys.strips`. Please
  confirm the plural ones read as plural, or suggest a clearer form.
- Food names fill `{{meal}}`, `{{fast}}`, `{{slow}}`, `{{a}}` and `{{b}}`. Some are feminine (इडली, दाल, रोटी),
  some masculine (केला, सेब), and a meal can be two foods ("रोटी + दाल"). So no verb or adjective agrees
  with a food name (FIX-F): the name is the subject only of "… तेज़ है" (तेज़ does not change), or sits
  before a postposition ("… की तुलना में", "… को … समय लगता है"), or after a label ending in a noun
  ("रखा गया भोजन: इडली", "रखा गया भोजन (दाल):"). `agreement.test.ts` checks every food in these
  sentences. Please keep to this if you reword them. Open point: "केला" and "उबला अंडा" stay as they are
  before a postposition ("केला की तुलना में", not "केले की"); tell us if that reads wrong.
- `stats.medianDays` uses माध्यक, the word for "median" in NCERT गणित कक्षा 10, अध्याय 13 "सांख्यिकी"
  ("माध्य (mean), माध्यक (median) और बहुलक (mode)").

## Renamed lines (old name → LifePeek, only the name changed)

| Key | English | Hindi | Status |
|---|---|---|---|
| `home.lead` | LifePeek shows why. Pick a meal, press Play and watch it travel through the body: how fast it leaves the stomach, where the sugar, protein, fat and fibre go, and how blood sugar and energy respond. Keep one meal to compare it with the next. | LifePeek बताता है कि ऐसा क्यों होता है। कोई भोजन चुनें, ‘चलाएँ’ दबाएँ और उसे शरीर में आगे बढ़ते देखें: वह आमाशय से कितनी जल्दी निकलता है, शर्करा, प्रोटीन, वसा और रेशा कहाँ जाते हैं, और रक्त शर्करा व ऊर्जा कैसे बदलती हैं। अगले भोजन से तुलना के लिए एक भोजन रख लें। | draft |
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
| `privacy.sections[0].items[2]` | whether you have switched off the letter-key shortcuts; | आपने अक्षर-कुंजी वाले शॉर्टकट बंद किए हैं या नहीं; | draft |
| `privacy.sections[0].items[3]` | a one-time note that the page has just reloaded after an update error (deleted when you close the tab); | अपडेट में गड़बड़ी के बाद पेज के दोबारा लोड होने का एक बार का निशान (टैब बंद करते ही मिट जाता है); | draft |
| `privacy.sections[0].items[4]` | a copy of the app, so it works offline in class; | ऐप की एक कॉपी, ताकि कक्षा में इंटरनेट के बिना भी चले; | draft |
| `privacy.sections[0].items[5]` | the meals you pick are kept in the page address (the link). A share link contains only the meals, nothing about you. | आपने जो भोजन चुने, वे पेज के पते (लिंक) में रहते हैं। शेयर किए गए लिंक में सिर्फ़ भोजन होते हैं, आपके बारे में कुछ नहीं। | draft |
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
| `about.sources` | Each food is described only by cited values: its nutrients from USDA FoodData Central or the Indian Nutrient Databank, and, where it applies, its glycemic index from the International GI tables (Atkinson et al. 2008). The model computes everything else. | हर खाद्य पदार्थ के लिए सिर्फ़ स्रोत सहित मान लिए गए हैं: उसके पोषक तत्व USDA FoodData Central या Indian Nutrient Databank से, और जहाँ लागू हो, उसका ग्लाइसेमिक इंडेक्स अंतरराष्ट्रीय GI तालिकाओं (Atkinson et al. 2008) से। बाकी सब कुछ मॉडल गणना करके निकालता है। | draft |
| `about.sourcesLink` | Every food and its sources | हर खाद्य पदार्थ और उसके स्रोत | draft |
| `about.licencesTitle` | Licences | लाइसेंस | draft |
| `about.licenceCode` | Code: Apache License 2.0. Keep the NOTICE file in copies. | कोड: Apache License 2.0। इसकी कॉपी में NOTICE फ़ाइल साथ रखें। | draft |
| `about.licenceContent` | Lesson text, translations, illustrations, docs, and our own food-file structure and labels: CC BY 4.0. Credit: “LifePeek by {{name}}, https://lifepeek.vercel.app, CC BY 4.0”. | पाठ की सामग्री, अनुवाद, चित्र, दस्तावेज़, और भोजन-फ़ाइलों की हमारी अपनी बनावट और नाम: CC BY 4.0। श्रेय ऐसे दें: “LifePeek by {{name}}, https://lifepeek.vercel.app, CC BY 4.0”। | draft |
| `about.licenceData` | Nutrient and GI values from USDA, the Indian Nutrient Databank, Atkinson et al. and others: not relicensed by us. | USDA, Indian Nutrient Databank, Atkinson et al. और दूसरे स्रोतों से लिए गए पोषक तत्व और GI मान: इन्हें हम दोबारा लाइसेंस नहीं देते। | draft |
| `about.licenceName` | The LifePeek name and logo: not licensed. Forks must use a different name. | LifePeek नाम और लोगो: इनका लाइसेंस नहीं दिया गया है। फ़ोर्क को कोई दूसरा नाम रखना होगा। | draft |
| `about.licenceLibraries` | Bundled libraries and fonts: their own licences. | साथ में शामिल लाइब्रेरी और फ़ॉन्ट: उनके अपने लाइसेंस। | draft |
| `about.reportTitle` | Found a mistake? | कोई गलती दिखी? | draft |
| `about.report` | Spotted a wrong number or explanation? Use “Report a mistake” in the simulator. | कोई गलत संख्या या व्याख्या दिखी? सिम्युलेटर में “गलती बताएँ” का उपयोग करें। | draft |
| `about.openIssue` | Open an issue on GitHub | GitHub पर issue खोलें | draft |
| `about.privacyTitle` | Privacy | गोपनीयता | draft |
| `about.privacy` | LifePeek has no accounts, no ads, no cookies and no analytics, and collects no personal data. | LifePeek में कोई अकाउंट, विज्ञापन, कुकी या एनालिटिक्स नहीं है, और यह कोई निजी डेटा इकट्ठा नहीं करता। | draft |
| `about.privacyLink` | Read the privacy page | गोपनीयता पेज पढ़ें | draft |

## Report-a-mistake form

| Key | English | Hindi | Status |
|---|---|---|---|
| `feedback.privacy` | Reports are public. Please don’t include names, school, emails or health information. | रिपोर्ट सार्वजनिक होती हैं। कृपया नाम, स्कूल, ईमेल या स्वास्थ्य संबंधी जानकारी न लिखें। | draft |
| `feedback.publicWarning` | This opens a public page on GitHub. Don't type your name, school, phone number, email or any health information. | इससे GitHub पर एक सार्वजनिक पेज खुलता है। अपना नाम, स्कूल या फ़ोन नंबर न लिखें। | draft |
| `feedback.openIssueDirect` | Open the report on GitHub | रिपोर्ट GitHub पर खोलें | draft |

## Signals, events, limits and labels (v2 screen, WP-10)

Names, short labels, one-line meanings and screen-reader summaries for the graphs and timeline
of the new screen, plus the "How we know" texts. Not shown on screen yet (the new screen is built
in later work packages). Notes for the reviewer:

- These rows reuse Hindi that is already in the app, so they are lower risk: `signals.gut.small.contentG.short`, `signals.gut.colon.contentG.short`, `signals.gut.leftBodyG.name`, `signals.blood.glucose.name`, `signals.blood.glucose.short`, `signals.event.stomachHalfEmpty.name`, `signals.event.firstLeftovers.name`, `signals.event.firstLeftovers.desc`, `signals.event.never`, `limits.glucoseTail`.
- `limits.energyInAtwater` is new wording: it says that "energy coming in" reads a few per cent low,
  and why. Please check that it is clear for a class 7–10 student.
- `systems.digestion.name` (पाचन) and `lifeProcess.nutrition` (पोषण): please confirm these are the NCERT terms.
- `status.assumption.label` ("Model estimate", was "Best guess"): is "सबसे अच्छा अनुमान" natural, or is there a better short tag?
- Numbers keep Latin digits; `mg/dL` stays in Latin letters, as on glucometers.

| Key | English | Hindi | Status |
|---|---|---|---|
| `status.simulated.label` | Calculated from studies | अध्ययनों के आधार पर गणना | draft |
| `status.simulated.help` | Worked out by the model from published measurements. | मॉडल ने प्रकाशित मापों से इसकी गणना की है। | draft |
| `status.assumption.label` | Model estimate | सबसे अच्छा अनुमान | draft |
| `status.assumption.help` | Worked out by the app's maths, not measured: a formula or a reasonable estimate. | एक सूत्र या उचित अनुमान, जिसे इस भोजन के लिए मापा नहीं गया है। | draft |
| `status.illustration.label` | Drawing only | केवल चित्र | draft |
| `status.illustration.help` | A picture to show the idea. The speed is not calculated. | बात समझाने के लिए एक चित्र। इसकी गति की गणना नहीं की गई है। | draft |
| `status.howWeKnow` | How we know | हमें कैसे पता है | draft |
| `status.sameEveryMeal` | The same for every meal (resting body) | हर भोजन के लिए एक जैसा (आराम करता शरीर) | draft |
| `signals.gut.stomach.contentG.name` | Food in the stomach | आमाशय में भोजन | draft |
| `signals.gut.stomach.contentG.short` | In stomach | आमाशय में | draft |
| `signals.gut.stomach.contentG.desc` | Grams of the meal still in the stomach, as eaten (food and drink). | भोजन और पेय का कितना भाग (ग्राम में) अभी आमाशय में है, उसी रूप में जैसा खाया-पिया गया था। | draft |
| `signals.gut.stomach.contentG.summary` | The stomach holds {{start}} g at the start. Half of the meal's food energy has left by {{half}}. | शुरू में आमाशय में {{start}} ग्राम भोजन है। {{half}} तक भोजन की आधी ऊर्जा निकल जाती है। | draft |
| `signals.gut.stomach.liquidG.name` | Drink in the stomach | आमाशय में पेय | draft |
| `signals.gut.stomach.liquidG.short` | Drink | पेय | draft |
| `signals.gut.stomach.liquidG.desc` | Grams of the meal's drinks still in the stomach. | भोजन के साथ लिए गए पेय का कितना भाग (ग्राम में) अभी आमाशय में है। | draft |
| `signals.gut.stomach.solidG.name` | Solid food in the stomach | आमाशय में ठोस भोजन | draft |
| `signals.gut.stomach.solidG.short` | Solid food | ठोस भोजन | draft |
| `signals.gut.stomach.solidG.desc` | Grams of the meal's solid food still in the stomach. | ठोस भोजन का कितना भाग (ग्राम में) अभी आमाशय में है। | draft |
| `signals.gut.small.contentG.name` | In the small intestine | छोटी आँत में | draft |
| `signals.gut.small.contentG.short` | Small intestine | छोटी आँत | draft |
| `signals.gut.small.contentG.desc` | Grams from the meal now in the small intestine (carbohydrate, protein, fat, fibre and water). | भोजन का कितना भाग (ग्राम में) अभी छोटी आँत में है (कार्बोहाइड्रेट, प्रोटीन, वसा, रेशा और पानी)। | draft |
| `signals.gut.colon.contentG.name` | In the large intestine | बड़ी आँत में | draft |
| `signals.gut.colon.contentG.short` | Large intestine | बड़ी आँत | draft |
| `signals.gut.colon.contentG.desc` | Grams from the meal now in the large intestine, mostly fibre and water. | भोजन का कितना भाग (ग्राम में) अभी बड़ी आँत में है, ज़्यादातर रेशा और पानी। | draft |
| `signals.gut.absorbed.carbsG.name` | Carbohydrate absorbed | अवशोषित कार्बोहाइड्रेट | draft |
| `signals.gut.absorbed.carbsG.short` | Carbohydrate | कार्बोहाइड्रेट | draft |
| `signals.gut.absorbed.carbsG.desc` | Grams of the meal's carbohydrate taken into the body so far (fibre not included). | भोजन का कितना कार्बोहाइड्रेट (ग्राम में) अब तक शरीर में अवशोषित हो चुका है (रेशा इसमें शामिल नहीं)। | draft |
| `signals.gut.absorbed.proteinG.name` | Protein absorbed | अवशोषित प्रोटीन | draft |
| `signals.gut.absorbed.proteinG.short` | Protein | प्रोटीन | draft |
| `signals.gut.absorbed.proteinG.desc` | Grams of the meal's protein taken into the body so far. | भोजन का कितना प्रोटीन (ग्राम में) अब तक शरीर में अवशोषित हो चुका है। | draft |
| `signals.gut.absorbed.fatG.name` | Fat absorbed | अवशोषित वसा | draft |
| `signals.gut.absorbed.fatG.short` | Fat | वसा | draft |
| `signals.gut.absorbed.fatG.desc` | Grams of the meal's fat taken into the body so far. | भोजन की कितनी वसा (ग्राम में) अब तक शरीर में अवशोषित हो चुकी है। | draft |
| `signals.gut.absorbed.waterG.name` | Water absorbed | अवशोषित पानी | draft |
| `signals.gut.absorbed.waterG.short` | Water | पानी | draft |
| `signals.gut.absorbed.waterG.desc` | Grams of the meal's water taken into the body so far, in the small and large intestine. | भोजन का कितना पानी (ग्राम में) अब तक छोटी और बड़ी आँत में अवशोषित हो चुका है। | draft |
| `signals.gut.absorbed.fibreG.name` | Fibre absorbed (always 0) | अवशोषित रेशा (हमेशा 0) | draft |
| `signals.gut.absorbed.fibreG.short` | Fibre | रेशा | draft |
| `signals.gut.absorbed.fibreG.desc` | The body cannot digest fibre, so none of it is absorbed. | शरीर रेशे को पचा नहीं सकता, इसलिए इसका कोई भाग अवशोषित नहीं होता। | draft |
| `signals.gut.leftBodyG.name` | Left the body | शरीर से बाहर निकला | draft |
| `signals.gut.leftBodyG.short` | Left | बाहर निकला | draft |
| `signals.gut.leftBodyG.desc` | Grams from the meal that have left the body so far, mostly fibre and water. | भोजन का कितना भाग (ग्राम में) अब तक शरीर से बाहर निकल चुका है, ज़्यादातर रेशा और पानी। | draft |
| `signals.blood.glucose.name` | Blood sugar | रक्त शर्करा | draft |
| `signals.blood.glucose.short` | Blood sugar | रक्त शर्करा | draft |
| `signals.blood.glucose.desc` | Sugar (glucose) in the blood of a typical healthy adult, in mg/dL. Before eating it is about 90. | एक सामान्य स्वस्थ वयस्क के रक्त में शर्करा (ग्लूकोज़), mg/dL में। खाने से पहले यह लगभग 90 होती है। | draft |
| `signals.blood.glucose.band.name` | How much people differ | लोगों में कितना अंतर होता है | draft |
| `signals.blood.glucose.summary` | Blood sugar starts at about {{start}} mg/dL, is highest at about {{peak}} mg/dL after {{peakTime}}, and is back near the before-meal level by {{backTime}}. | रक्त शर्करा लगभग {{start}} mg/dL से शुरू होती है, {{peakTime}} बाद लगभग {{peak}} mg/dL पर सबसे अधिक होती है, और {{backTime}} तक खाने से पहले के स्तर के पास लौट आती है। | draft |
| `signals.blood.glucose.summaryNone` | Blood sugar stays near {{start}} mg/dL: this meal has almost no sugar or starch. | रक्त शर्करा लगभग {{start}} mg/dL पर रहती है: इस भोजन में लगभग कोई शर्करा या मंड (स्टार्च) नहीं है। | draft |
| `signals.energy.inRate.name` | Energy coming in | आने वाली ऊर्जा | draft |
| `signals.energy.inRate.short` | Coming in | आ रही | draft |
| `signals.energy.inRate.desc` | Food energy entering the body each hour, from absorbed carbohydrate, protein and fat. | अवशोषित कार्बोहाइड्रेट, प्रोटीन और वसा से हर घंटे शरीर में आने वाली भोजन-ऊर्जा। | draft |
| `signals.energy.inRate.summary` | In the first {{time}}, about {{in}} kcal from this meal entered the body, and the resting body used about {{used}} kcal. When more comes in than is used, the body stores the extra for later. | पहले {{time}} में इस भोजन से लगभग {{in}} किलो कैलोरी शरीर में पहुँची, और आराम करते शरीर ने लगभग {{used}} किलो कैलोरी खर्च की। जब खर्च से ज़्यादा ऊर्जा आती है, तो शरीर बची हुई ऊर्जा को बाद के लिए जमा कर लेता है। | draft |
| `signals.energy.inTotal.name` | Energy taken in so far | अब तक ली गई ऊर्जा | draft |
| `signals.energy.inTotal.short` | Taken in | ली गई | draft |
| `signals.energy.inTotal.desc` | Food energy from this meal that has entered the body so far. | इस भोजन से अब तक शरीर में पहुँची कुल ऊर्जा। | draft |
| `signals.energy.usedRate.name` | Energy used at rest | आराम में खर्च होने वाली ऊर्जा | draft |
| `signals.energy.usedRate.short` | Used | खर्च | draft |
| `signals.energy.usedRate.desc` | Energy the body uses each hour just to stay alive at rest (breathing, heartbeat, keeping warm), for the typical adult. | सामान्य वयस्क में, आराम की हालत में शरीर को ज़िंदा रखने (साँस, धड़कन, गर्म रहना) के लिए हर घंटे खर्च होने वाली ऊर्जा। | draft |
| `signals.energy.usedTotal.name` | Energy used so far | अब तक खर्च हुई ऊर्जा | draft |
| `signals.energy.usedTotal.short` | Used so far | अब तक खर्च | draft |
| `signals.energy.usedTotal.desc` | Energy the resting body has used since the meal started. It is the same for every meal. | भोजन शुरू होने के बाद से आराम करते शरीर ने जितनी ऊर्जा खर्च की है। यह हर भोजन के लिए एक जैसी है। | draft |
| `signals.event.stomachHalfEmpty.name` | Half has left the stomach | आधा भोजन आमाशय से निकल गया | draft |
| `signals.event.glucosePeak.name` | Blood sugar highest | रक्त शर्करा सबसे अधिक | draft |
| `signals.event.glucoseBackToBase.name` | Blood sugar back near the before-meal level | रक्त शर्करा खाने से पहले के स्तर के पास लौटी | draft |
| `signals.event.mostlyAbsorbed.name` | Carbs, protein and fat mostly absorbed | कार्बोहाइड्रेट, प्रोटीन और वसा ज़्यादातर अवशोषित | draft |
| `signals.event.firstLeftovers.name` | Leftovers start leaving the body | अवशेष शरीर से बाहर निकलने लगे | draft |
| `signals.event.firstLeftovers.desc` | Depends mostly on the person, not the meal | यह भोजन पर नहीं, मुख्य रूप से व्यक्ति पर निर्भर करता है | draft |
| `signals.event.never` | Not within 48 h | 48 घंटे के भीतर नहीं | draft |
| `limits.glucoseTail` | After big, fatty meals the model shows a small, slow tail; real bodies usually settle a little sooner. | बड़े, वसायुक्त भोजन के बाद मॉडल रक्त शर्करा में एक छोटी, धीमी पूँछ दिखाता है; असली शरीर में यह आमतौर पर कुछ जल्दी सामान्य हो जाती है। | draft |
| `limits.glucoseBand` | The shaded band is a model estimate of how much healthy people differ. | छायांकित पट्टी एक अनुमान है कि स्वस्थ लोगों में कितना अंतर होता है। | draft |
| `limits.energyInAtwater` | Each gram of carbohydrate or protein counts as 4 kcal and each gram of fat as 9 kcal, so the total can be a little different from the food label. These standard numbers already allow for the bit of food the body cannot take in. The model also counts only what was taken in, so that bit is left out twice and energy coming in reads a few per cent low. The small amount of energy in fibre is not counted. | हर ग्राम कार्बोहाइड्रेट या प्रोटीन को 4 किलो कैलोरी और हर ग्राम वसा को 9 किलो कैलोरी गिना जाता है, इसलिए कुल मान भोजन के लेबल से थोड़ा अलग हो सकता है। ये मानक संख्याएँ पहले से मानकर चलती हैं कि भोजन का थोड़ा भाग शरीर के अंदर नहीं जा पाता। मॉडल भी केवल उतना ही गिनता है जितना शरीर के अंदर गया, इसलिए वह भाग दो बार छूट जाता है और आने वाली ऊर्जा कुछ प्रतिशत कम दिखती है। रेशे में मौजूद थोड़ी-सी ऊर्जा नहीं गिनी गई है। | draft |
| `limits.energyUsedResting` | This is a formula for a resting adult (the ICMR-NIN 2020 reference adult, 65 kg), not a measurement. It does not change with the meal. | यह आराम करते एक वयस्क (ICMR-NIN 2020 का संदर्भ वयस्क, 65 किलो) के लिए एक सूत्र है, कोई माप नहीं। यह भोजन के साथ नहीं बदलता। | draft |
| `limits.backToBase` | "Back near the before-meal level" means within 5 mg/dL of it. | "खाने से पहले के स्तर के पास" का अर्थ है उससे 5 mg/dL के भीतर। | draft |
| `profiles.adult-ref.tag` | Typical adult | सामान्य वयस्क | draft |
| `profiles.adult-ref.desc` | Based on the ICMR-NIN 2020 reference adult man (65 kg), at rest. Digestion times come from studies of adults. | ICMR-NIN 2020 के संदर्भ वयस्क पुरुष (65 किलो) पर आधारित, आराम की अवस्था में। पाचन के समय वयस्कों पर हुए अध्ययनों से लिए गए हैं। | draft |
| `organisms.human.name` | Human | मनुष्य | draft |
| `systems.digestion.name` | Digestion | पाचन | draft |
| `lifeProcess.nutrition` | Nutrition | पोषण | draft |
| `units.g` | {{n}} g | {{n}} ग्राम | draft |
| `units.mgdl` | {{n}} mg/dL | {{n}} mg/dL | draft |
| `units.kcalPerH` | {{n}} kcal/h | {{n}} किलो कैलोरी/घंटा | draft |

## Stats page (WP-21)

The `/stats` page, its footer link, and one new line on the privacy page (`privacy.sections[2].items[2]`, under "होस्टिंग").

| Key | English | Hindi | Status |
|---|---|---|---|
| `stats.footer` | Stats | आँकड़े | draft |
| `stats.title` | LifePeek in numbers | LifePeek आँकड़ों में | draft |
| `stats.lead` | Only numbers that are already public. They are updated once a week. | सिर्फ़ वे संख्याएँ जो पहले से सार्वजनिक हैं। इन्हें हफ़्ते में एक बार अपडेट किया जाता है। | draft |
| `stats.noTracking` | **We don't count visitors.** LifePeek has no server of its own, no cookies and no analytics, so we don't know how many simulations are run. That is on purpose. | **हम आने वालों की गिनती नहीं करते।** LifePeek का अपना कोई सर्वर नहीं है, कोई कुकी नहीं और कोई एनालिटिक्स नहीं, इसलिए हमें नहीं पता कि कितने सिमुलेशन चलाए जाते हैं। ऐसा जान-बूझकर है। | draft |
| `stats.mistakesTitle` | Mistakes reported and fixed | बताई गई और ठीक की गई गलतियाँ | draft |
| `stats.mistakesLead` | Counted from the public “Report a mistake” issues on GitHub, over the last {{weeks}} weeks. A mistake counts as fixed when its issue is closed as done. | GitHub पर सार्वजनिक “गलती बताएँ” issue से गिनी गईं, पिछले {{weeks}} हफ़्तों में। कोई गलती तब ठीक मानी जाती है जब उसका issue काम पूरा होने पर बंद किया जाता है। | draft |
| `stats.loading` | Loading the numbers… | संख्याएँ लोड हो रही हैं… | draft |
| `stats.unavailable` | Numbers will appear after the next weekly update. | अगले साप्ताहिक अपडेट के बाद संख्याएँ दिखेंगी। | draft |
| `stats.failed` | The numbers didn't load. You may be offline. | संख्याएँ लोड नहीं हुईं। हो सकता है आप ऑफ़लाइन हों। | draft |
| `stats.retry` | Try again | फिर से कोशिश करें | draft |
| `stats.reported` | Reported | बताई गईं | draft |
| `stats.fixed` | Fixed | ठीक की गईं | draft |
| `stats.lastWeeks` | in the last {{weeks}} weeks | पिछले {{weeks}} हफ़्तों में | draft |
| `stats.medianDays` | Median days to fix | ठीक करने में लगे दिन (माध्यक) | draft |
| `stats.medianNote` | half were fixed sooner, half later | आधी इससे जल्दी ठीक हुईं, आधी बाद में | draft |
| `stats.noFixes` | nothing fixed in these weeks | इन हफ़्तों में कुछ ठीक नहीं हुआ | draft |
| `stats.tableTitle` | Week by week | हफ़्ते-दर-हफ़्ते | draft |
| `stats.weekCol` | Week starting | हफ़्ते की शुरुआत | draft |
| `stats.thisWeek` | this week | यह हफ़्ता | draft |
| `stats.updated` | Updated {{date}}. | {{date}} को अपडेट किया गया। | draft |
| `stats.source` | See the reports on GitHub | GitHub पर रिपोर्टें देखें | draft |
| `stats.factsTitle` | This version | यह संस्करण | draft |
| `stats.modelVersion` | Model version | मॉडल संस्करण | draft |
| `stats.foods` | Foods | खाद्य पदार्थ | draft |
| `stats.languages` | Languages | भाषाएँ | draft |
| `stats.languageNames` | English and Hindi | अंग्रेज़ी और हिन्दी | draft |
| `stats.lastRelease` | Last release | पिछली रिलीज़ | draft |
| `stats.noRelease` | None yet | अभी कोई नहीं | draft |
| `privacy.sections[2].items[2]` | The **Stats** page only shows counts of public GitHub issues (mistake reports). We read them from GitHub once a week when the site is built, so on that page your browser does not contact GitHub: it only downloads a small file from this site. | **आँकड़े** पेज सिर्फ़ GitHub के सार्वजनिक issue (गलती की रिपोर्टें) की गिनती दिखाता है। हम इन्हें हफ़्ते में एक बार, साइट बनते समय GitHub से पढ़ते हैं, इसलिए उस पेज पर आपका ब्राउज़र GitHub से संपर्क नहीं करता: वह सिर्फ़ इसी साइट से एक छोटी फ़ाइल डाउनलोड करता है। | draft |

## Stage at /next (WP-11)

The new one-screen simulator. "Keep to compare" is the plan's proposal for "Pin to compare"; the kept run is drawn as a dashed line (टूटी रेखा) on the graphs.

| Key | English | Hindi | Status |
|---|---|---|---|
| `sim.newerLink` | This link was made with a newer version of LifePeek, so this version may show it differently. | यह लिंक LifePeek के नए संस्करण से बना था, इसलिए यह संस्करण इसे कुछ अलग दिखा सकता है। | draft |
| `stage.meal` | Meal | भोजन | draft |
| `stage.body` | The body | शरीर | draft |
| `stage.bodyLabel` | The body, digesting {{meal}} | शरीर, {{meal}} को पचाते हुए | draft |
| `stage.empty` | Pick a food to start the clock. | घड़ी शुरू करने के लिए कोई खाद्य पदार्थ चुनें। | draft |
| `stage.examples` | Foods to start with | शुरू करने के लिए खाद्य पदार्थ | draft |
| `stage.layer` | Body system | शरीर का तंत्र | draft |
| `stage.graphs` | Graphs | ग्राफ़ | draft |
| `stage.strips.gut` | Stomach | आमाशय | draft |
| `stage.strips.blood` | Blood sugar | रक्त शर्करा | draft |
| `stage.strips.energy` | Energy | ऊर्जा | draft |
| `stage.clock` | Meal clock | भोजन की घड़ी | draft |
| `stage.keysHint` | Keys: ← → move 10 minutes, Shift + ← → move 1 hour, Page Down and Page Up go to the next or previous key moment, Home and End go to the start or the end. | कुंजियाँ: ← → 10 मिनट आगे-पीछे, Shift + ← → 1 घंटा आगे-पीछे, Page Down और Page Up अगले या पिछले मुख्य पल पर, Home और End शुरुआत या अंत पर। | draft |
| `stage.search` | Search foods | खाद्य पदार्थ खोजें | draft |
| `stage.noMatch` | No food matches “{{query}}”. | “{{query}}” से मेल खाता कोई खाद्य पदार्थ नहीं मिला। | draft |
| `stage.inMeal` | In the meal | भोजन में है | draft |
| `stage.mealFull` | The meal already has {{n}} foods, the most it can hold. | भोजन में पहले से {{n}} खाद्य पदार्थ हैं, इससे ज़्यादा नहीं जोड़े जा सकते। | draft |
| `stage.close` | Close | बंद करें | draft |
| `stage.thisMeal` | This meal | यह भोजन | draft |
| `stage.keptMeal` | The kept meal | रखा गया भोजन | draft |
| `keep.button` | Keep to compare | तुलना के लिए रखें | draft |
| `keep.help` | Keeps this meal as a dashed line on the graphs. Then change the meal and compare. | इस भोजन को ग्राफ़ों पर टूटी रेखा के रूप में रख देता है। फिर भोजन बदलें और तुलना करें। | draft |
| `keep.already` | This meal is the one kept | यही भोजन रखा गया है | draft |
| `keep.tag` | Kept: {{meal}} | रखा गया भोजन: {{meal}} | draft |
| `keep.remove` | Stop comparing with {{meal}} | {{meal}} से तुलना बंद करें | draft |

## Graphs (WP-12)

The graphs on the new screen: their labels, the ⓘ "How we know" panel, and the units in words.

| Key | English | Hindi | Status |
|---|---|---|---|
| `units.words.mgdl` | milligrams of sugar in each decilitre (a tenth of a litre) of blood | रक्त के हर डेसीलीटर (लीटर का दसवाँ भाग) में शर्करा, मिलीग्राम में | draft |
| `units.words.g` | grams (1000 g = 1 kg) | ग्राम (1000 ग्राम = 1 किलो) | draft |
| `units.words.kcal` | kilocalories of food energy | भोजन की ऊर्जा, किलो कैलोरी में | draft |
| `units.words.kcalPerH` | kilocalories of energy per hour | प्रति घंटे ऊर्जा, किलो कैलोरी में | draft |
| `graph.label` | Graph of {{name}}, from eating to 48 hours later | {{name}} का ग्राफ़, खाने से 48 घंटे बाद तक | draft |
| `graph.howFor` | How we know: {{name}} | हमें कैसे पता है: {{name}} | draft |
| `graph.unit` | Unit | इकाई | draft |
| `graph.unitIs` | {{unit}}: {{words}} | {{unit}}: {{words}} | draft |
| `graph.howSure` | How sure we are | हम कितने निश्चित हैं | draft |
| `graph.limits` | Known limits | ज्ञात सीमाएँ | draft |
| `graph.sources` | Sources | स्रोत | draft |
| `graph.foodData` | Food data: | खाद्य आँकड़े: | draft |
| `graph.stretched` | Scale stretched to fit this meal | इस भोजन के लिए पैमाना बढ़ाया गया | draft |
| `graph.range` | {{low}}–{{high}} | {{low}}–{{high}} | draft |
| `graph.highest` | Highest: {{value}} | सबसे अधिक: {{value}} | draft |
| `graph.highestTitle` | The ring: highest point | गोला: सबसे ऊँचा बिंदु | draft |
| `graph.highestNote` | The ring marks when blood sugar is highest after this meal. A rise of 5 mg/dL or less gets no ring: blood sugar stays near the before-meal level. | गोला दिखाता है कि इस भोजन के बाद रक्त शर्करा कब सबसे अधिक होती है। 5 mg/dL या उससे कम बढ़ने पर गोला नहीं बनता: रक्त शर्करा खाने से पहले के स्तर के पास ही रहती है। | draft |
| `graph.halfNote` | The ring marks when half of the meal's food energy has left the stomach (for water: half its weight). Drinks leave first, so the grams on this graph can fall to half before the ring. | गोला दिखाता है कि भोजन की आधी ऊर्जा कब आमाशय से निकल गई (पानी के लिए: उसका आधा वज़न)। पेय पहले निकलते हैं, इसलिए इस ग्राफ़ पर ग्राम गोले से पहले ही आधे रह सकते हैं। | draft |

## Energy graph (WP-13)

The energy graph's readouts: "Coming in 120 kcal/h (340 kcal so far)", "Used 65 kcal/h (98 kcal so far)".
The words the framing test (`framing.test.ts`) bans in Hindi start with खराब, हानिकारक, खतरनाक; please
add any other word that would make a food sound good or bad, or tell students to "burn it off".

| Key | English | Hindi | Status |
|---|---|---|---|
| `graph.soFar` | ({{value}} so far) | (अब तक {{value}}) | draft |

## Graph fixes (WP-12b)

New wording from the review council. `graph.halfEnergyLeft` is the label next to the ring on the
stomach graph (the ring marks when half the meal's food ENERGY has left; the graph shows grams).
`limits.glucoseSameHighest` is a known limit shown in "How we know" on the blood-sugar graph.

| Key | English | Hindi | Status |
|---|---|---|---|
| `graph.halfEnergyLeft` | Half the energy has left the stomach | आधी ऊर्जा आमाशय से निकल गई | draft |
| `graph.halfTitle` | The ring: half has left the stomach | गोला: आधा भोजन आमाशय से निकल गया | draft |
| `limits.glucoseSameHighest` | More of the same food or drink does not raise the highest point here, only how long blood sugar stays up: the stomach lets food out at a steady rate (about 2 kcal a minute for a sugary drink), whatever the amount. The model leaves out anything else a bigger portion might do to the highest point in real people. | यहाँ एक ही भोजन या पेय ज़्यादा लेने से सबसे ऊँचा बिंदु नहीं बढ़ता, केवल यह बढ़ता है कि रक्त शर्करा कितनी देर ऊँची रहती है: आमाशय भोजन को एक स्थिर गति से आगे भेजता है (मीठे पेय के लिए लगभग 2 किलो कैलोरी प्रति मिनट), मात्रा चाहे जितनी हो। असली लोगों में बड़ी मात्रा सबसे ऊँचे बिंदु पर और क्या असर डाल सकती है, यह मॉडल में शामिल नहीं है। | draft |

## Verification fixes (FIX-B)

Strings changed after the first verification council. `home.headline` now says when HALF of each
meal has left the stomach (the model: cola about 35 min, burger with fries about 4.5 h).
`stages.smallIntestine.what` now says 3 metres (OpenStax: about 3 m in a living person).
`limits.energyInAtwater` (above) is rewritten in simpler words for a class 7–10 student; please check it closely.
`nav.main` is the screen-reader name of the top menu. `graph.loadFailed` and `graph.retry` show in
a graph's ⓘ panel when its text could not be downloaded (offline). Rows above that changed in the same pass are
back to `draft`: the energy texts ("entered the body", not "the blood"), `stats.noTracking`,
`units.words.kcalPerH`, `limits.glucoseSameHighest`, `about.sources`, `about.sourcesLink`,
`about.report` (सिम्युलेटर) and `graph.foodData` (खाद्य आँकड़े).

| Key | English | Hindi | Status |
|---|---|---|---|
| `home.headline` | Half the food energy in a can of cola leaves your stomach in about half an hour. For a burger with fries, it takes over four hours. | कोला के एक कैन की आधी ऊर्जा लगभग आधे घंटे में आमाशय से निकल जाती है। फ़्राइज़ के साथ बर्गर की आधी ऊर्जा को निकलने में चार घंटे से ज़्यादा लगते हैं। | draft |
| `stages.smallIntestine.what` | Chyme moves through about 3 metres of narrow tube. Its lining is folded into millions of villi that give it a huge surface for absorption. | काइम लगभग 3 मीटर लंबी पतली नली से होकर गुज़रता है। इसकी भीतरी परत लाखों दीर्घरोम (villi) में मुड़ी होती है, जो अवशोषण के लिए बहुत बड़ा सतही क्षेत्र देते हैं। | draft |
| `science.limits[0]` | Models a healthy adult only — not children, pregnancy, diabetes or digestive illness. | केवल एक स्वस्थ वयस्क का मॉडल है — बच्चों, गर्भावस्था, डायबिटीज़ या पाचन रोगों के लिए नहीं। | draft |
| `nav.main` | Main | मुख्य | draft |
| `graph.loadFailed` | This didn’t load. Check the internet connection and try again. | यह लोड नहीं हो सका। इंटरनेट कनेक्शन देखें और फिर से कोशिश करें। | draft |
| `graph.retry` | Try again | फिर से कोशिश करें | draft |

## Dock, Now line and summary sentence (WP-14)

The Now line under the body says where the food is and what that organ does (`now.stages.*` are
short lines written for it; "More" opens v1's full `stages.*` texts). The summary sentence is v1's
verdict for "this meal" and "the kept meal": the reason is given only when it is true. `dock.*` are
the timeline's key-moment markers and the label over its squeezed part ("6 h → 48 h squeezed").
Two existing lines were reworded for honesty (verification council S6, S7), in their rows above
(`signals.event.mostlyAbsorbed.name`, `signals.gut.stomach.contentG.summary`): "mostly absorbed" is
about carbohydrate, protein and fat only, and the stomach graph's summary no longer has an
"almost empty by …" time (no catalog moment gives it).

| Key | English | Hindi | Status |
|---|---|---|---|
| `now.label` | Where the meal is now | भोजन अभी कहाँ है | draft |
| `now.more` | More | और जानें | draft |
| `now.moreAbout` | {{stage}}: more about this stage | {{stage}}: इस चरण के बारे में और जानें | draft |
| `now.chemistry` | Chemistry | रासायनिक क्रिया | draft |
| `now.absorbed` | Absorbed here | यहाँ अवशोषित | draft |
| `now.stages.mouth` | teeth grind food and saliva starts on starch | दाँत भोजन पीसते हैं, लार मंड को तोड़ना शुरू करती है | draft |
| `now.stages.esophagus` | muscle waves push each swallow down to the stomach | पेशियों की लहरें हर निवाले को नीचे आमाशय तक धकेलती हैं | draft |
| `now.stages.stomach` | acid and churning turn food into chyme | अम्ल और मंथन से भोजन काइम बन जाता है | draft |
| `now.stages.smallIntestine` | nutrients are absorbed into the body | पोषक तत्व शरीर में अवशोषित होते हैं | draft |
| `now.stages.largeIntestine` | water is taken back from the leftovers | बचे हुए भाग से पानी वापस सोखा जाता है | draft |
| `summary.label` | Summary | सारांश | draft |
| `summary.single` | Half of the food energy in {{meal}} has left the stomach after {{time}}. | {{meal}} की आधी ऊर्जा {{time}} बाद आमाशय से निकल चुकी है। | draft |
| `summary.singleWater` | Half of {{meal}} has left the stomach after {{time}}. | {{meal}} का आधा भाग {{time}} बाद आमाशय से निकल चुका है। | draft |
| `summary.similar` | {{a}} and {{b}} leave the stomach at about the same speed. | {{a}} और {{b}} को आमाशय से निकलने में लगभग बराबर समय लगता है। | draft |
| `summary.faster` | {{fast}} leaves the stomach about {{x}} faster than {{slow}}. | {{fast}} आमाशय से निकलने में {{slow}} की तुलना में लगभग {{x}} तेज़ है। | draft |
| `summary.reasonDrink` | {{fast}} is only a drink: drinks start leaving straight away, while solid food is ground first. | {{fast}} केवल एक पेय है: पेय तुरंत निकलने लगते हैं, जबकि ठोस भोजन पहले पीसा जाता है। | draft |
| `summary.reasonCalories` | {{slow}} has more food energy ({{kcalSlow}} vs {{kcalFast}} kcal), and the stomach lets only a little through each minute. | {{slow}} में अधिक ऊर्जा है ({{kcalSlow}} बनाम {{kcalFast}} किलो कैलोरी), और आमाशय हर मिनट थोड़ा-सा ही आगे जाने देता है। | draft |
| `summary.thisMeal` | this meal | यह भोजन | draft |
| `summary.keptMeal` | the kept meal | रखा गया भोजन | draft |
| `dock.squeezed` | {{from}} → {{to}} squeezed | {{from}} → {{to}} सिकोड़ा गया | draft |
| `dock.moments` | Key moments of this meal | इस भोजन के मुख्य पल | draft |
| `dock.keptMoments` | Key moments of the kept meal | रखे गए भोजन के मुख्य पल | draft |
| `dock.marker` | {{name}}, {{time}} | {{name}}, {{time}} | draft |
| `dock.keptMarker` | Kept: {{name}}, {{time}} | रखा गया भोजन: {{name}}, {{time}} | draft |
| `dock.usually` | {{time}} (usually {{low}} to {{high}}) | {{time}} (आमतौर पर {{low}} से {{high}}) | draft |

## Text alternatives, keys and settings (WP-15)

Every graph now has a sentence for screen readers (the `….summary` lines above, and `summaryNone`
for a stomach that holds only water: there is no food energy to halve) and a "Show as table" sheet
(`table.*`): the graph's numbers at fixed times and the key moments of both meals. `keys.*` is the
sheet that lists the keyboard keys, with two switches saved on the device: letter-key shortcuts
(new privacy line `privacy.sections[0].items[2]`, above) and reduce motion. `stage.particles`
names the one-line key to the food pieces drawn in the body (it reuses `nutrients.*`).
Key names (Space, Page Down, Shift …) stay in English on purpose: they are printed on the keys.

| Key | English | Hindi | Status |
|---|---|---|---|
| `signals.gut.stomach.contentG.summaryNone` | The stomach holds {{start}} g at the start. Half of it has left by {{half}}. | शुरू में आमाशय में {{start}} ग्राम है। {{half}} तक इसका आधा भाग निकल जाता है। | draft |
| `stage.particles` | Food pieces in the body | शरीर में भोजन के कण | draft |
| `table.title` | The graphs as a table | ग्राफ़ तालिका के रूप में | draft |
| `table.showFor` | Show as table: {{name}} | तालिका के रूप में देखें: {{name}} | draft |
| `table.time` | After eating | खाने के बाद | draft |
| `table.thisMeal` | This meal: {{meal}} | यह भोजन: {{meal}} | draft |
| `table.range` | How much people differ | लोगों में कितना अंतर | draft |
| `table.moments` | Key moments | मुख्य पल | draft |
| `table.moment` | Moment | पल | draft |
| `table.keptValue` | kept meal {{value}} | रखा गया भोजन {{value}} | draft |
| `keys.button` | Keys and settings | कुंजियाँ और सेटिंग | draft |
| `keys.title` | Keys and settings | कुंजियाँ और सेटिंग | draft |
| `keys.settings` | Settings | सेटिंग | draft |
| `keys.list` | Keys | कुंजियाँ | draft |
| `keys.play` | Play or pause | चलाएँ या रोकें | draft |
| `keys.move` | 10 minutes back or on | 10 मिनट पीछे या आगे | draft |
| `keys.moveHour` | 1 hour back or on | 1 घंटा पीछे या आगे | draft |
| `keys.moments` | Next or previous key moment (a clicker’s two buttons) | अगला या पिछला मुख्य पल (क्लिकर के दो बटन) | draft |
| `keys.ends` | Start or end | शुरुआत या अंत | draft |
| `keys.keep` | Keep this meal to compare | तुलना के लिए यह भोजन रखें | draft |
| `keys.table` | The graphs as a table | ग्राफ़ तालिका के रूप में | draft |
| `keys.strips` | Show the Stomach, Blood sugar or Energy graph | आमाशय, रक्त शर्करा या ऊर्जा का ग्राफ़ दिखाएँ | draft |
| `keys.help` | This list | यह सूची | draft |
| `keys.letters` | Letter keys | अक्षर कुंजियाँ | draft |
| `keys.lettersHelp` | Space, K, P, T, S, B, E and ? as shortcuts. Turn them off if they get in the way of a screen reader or voice control. The arrows and Page Up / Down still work. | Space, K, P, T, S, B, E और ? शॉर्टकट का काम करते हैं। अगर ये स्क्रीन रीडर या आवाज़ से चलाने में बाधा डालें, तो इन्हें बंद करें। तीर और Page Up / Down फिर भी काम करते हैं। | draft |
| `keys.motion` | Reduce motion | कम हलचल | draft |
| `keys.motionHelp` | The food pieces in the body stop tumbling. The clock still moves when you press Play. | शरीर में भोजन के कण घूमना बंद कर देते हैं। चलाएँ दबाने पर घड़ी फिर भी चलती है। | draft |
| `keys.motionDevice` | Until you choose here, this follows the device’s own setting. | जब तक आप यहाँ न चुनें, यह डिवाइस की अपनी सेटिंग के अनुसार रहता है। | draft |
| `keys.motionReset` | Follow the device’s setting again | फिर से डिवाइस की सेटिंग अपनाएँ | draft |
| `keys.on` | On | चालू | draft |
| `keys.off` | Off | बंद | draft |
| `keys.offNote` | off | बंद | draft |
| `keys.typing` | Keys typed in a search box or a form are never taken as shortcuts. | खोज बॉक्स या फ़ॉर्म में लिखी गई कुंजियाँ कभी शॉर्टकट नहीं मानी जातीं। | draft |

## Council round 2 fixes (FIX-C)

The Now line says where the meal is from the model (how much is in which organ, the kept meal, "done") and words drinks as drinks; the summary's key number; ring labels name their meal; the squeezed time axis.

| Key | English | Hindi | Status |
|---|---|---|---|
| `now.amount.all` | almost all | लगभग सारा | draft |
| `now.amount.most` | most | ज़्यादातर | draft |
| `now.amount.half` | about half | लगभग आधा | draft |
| `now.amount.some` | some | कुछ | draft |
| `now.amount.little` | a little | थोड़ा-सा | draft |
| `now.here` | {{amount}} is here | {{amount}} भाग यहाँ है | draft |
| `now.also.stomach` | {{amount}} still in the stomach | {{amount}} भाग अभी आमाशय में | draft |
| `now.also.smallIntestine` | {{amount}} already in the small intestine | {{amount}} भाग छोटी आँत में | draft |
| `now.also.largeIntestine` | {{amount}} already in the large intestine | {{amount}} भाग बड़ी आँत में | draft |
| `now.also.body` | {{amount}} already absorbed | {{amount}} भाग अवशोषित हो चुका | draft |
| `now.doneName` | Done | पूरा हुआ | draft |
| `now.done` | the gut is finished with this meal: {{amount}} was absorbed, the rest left as waste | पाचन पूरा: {{amount}} भाग अवशोषित हुआ, बाकी मल बनकर बाहर निकल गया | draft |
| `now.doneAll` | the gut is finished with this meal: {{amount}} was absorbed | पाचन पूरा: {{amount}} भाग अवशोषित हुआ | draft |
| `now.drink.mouth` | the drink is swallowed in a few gulps | पेय कुछ घूँटों में निगला जाता है | draft |
| `now.drink.esophagus` | muscle waves push each gulp down to the stomach | पेशियों की लहरें हर घूँट को नीचे आमाशय तक धकेलती हैं | draft |
| `now.drink.stomach` | the stomach lets the drink through a little at a time | आमाशय पेय को थोड़ा-थोड़ा करके आगे जाने देता है | draft |
| `now.kept` | {{meal}} (kept): | रखा गया भोजन ({{meal}}): | draft |
| `now.in.mouth` | being eaten | खाया जा रहा है | draft |
| `now.in.mouthDrink` | being drunk | पिया जा रहा है | draft |
| `now.in.esophagus` | on its way down to the stomach | आमाशय की ओर जा रहा है | draft |
| `now.in.stomach` | {{amount}} in the stomach | {{amount}} भाग आमाशय में | draft |
| `now.in.smallIntestine` | {{amount}} in the small intestine | {{amount}} भाग छोटी आँत में | draft |
| `now.in.largeIntestine` | {{amount}} in the large intestine | {{amount}} भाग बड़ी आँत में | draft |
| `now.in.done` | the gut is finished with it | पाचन पूरा हो चुका | draft |
| `summary.times` | {{n}}× | {{n}} गुना | draft |
| `summary.fasterMore` | {{fast}} leaves the stomach more than {{x}} faster than {{slow}}. | {{fast}} आमाशय से निकलने में {{slow}} की तुलना में {{x}} से भी अधिक तेज़ है। | draft |
| `summary.singleMore` | Half of the food energy in {{meal}} takes more than {{time}} to leave the stomach. | {{meal}} की आधी ऊर्जा को आमाशय से निकलने में {{time}} से अधिक समय लगता है। | draft |
| `summary.singleWaterMore` | Half of {{meal}} takes more than {{time}} to leave the stomach. | {{meal}} के आधे भाग को आमाशय से निकलने में {{time}} से अधिक समय लगता है। | draft |
| `graph.halfEnergyLeftOf` | {{meal}}: half the energy has left the stomach | {{meal}}: आधी ऊर्जा आमाशय से निकल गई | draft |
| `graph.halfLeftOf` | {{meal}}: half has left the stomach | {{meal}}: आधा भोजन आमाशय से निकल गया | draft |
| `graph.highestOf` | {{meal}}: highest {{value}} | {{meal}}: सबसे अधिक {{value}} | draft |
| `limits.steadyEmptying` | The model lets food out of the stomach at a steady rate until it is empty. So after a big meal the food in the stomach falls in a straight line, and blood sugar and energy coming in stay level for hours, then fall within about an hour. Real stomachs usually slow down near the end, so the fall is gentler. After 6 hours the time axis is squeezed (the hatched part on the right), which makes the fall look steeper still. | मॉडल में आमाशय भोजन को एक समान गति से आगे भेजता है, जब तक वह खाली न हो जाए। इसलिए बड़े भोजन के बाद आमाशय का भोजन सीधी रेखा में घटता है, और रक्त शर्करा व आने वाली ऊर्जा घंटों तक एक-सी रहती हैं, फिर लगभग एक घंटे में गिर जाती हैं। असली आमाशय आमतौर पर अंत में धीमा हो जाता है, इसलिए यह गिरावट धीमी होती है। 6 घंटे के बाद समय-अक्ष सिकोड़ा गया है (दाईं ओर का धारीदार भाग), इसलिए गिरावट और भी तीखी दिखती है। | draft |

## Older strings (site pages and shared text, listed by WP-18)

Strings from before this list existed (Home, Teach, Science, and the v1 simulator). WP-20 deleted
v1 and the keys only it used; the ones left here all ship and need the same check.

| Key | English | Hindi | Status |
|---|---|---|---|
| `nav.simulator` | Simulator | सिम्युलेटर | draft |
| `nav.teach` | For teachers | शिक्षकों के लिए | draft |
| `nav.science` | Science & sources | विज्ञान और स्रोत | draft |
| `nav.language` | हिंदी | English | draft |
| `nav.languageLabel` | Switch to Hindi | अंग्रेज़ी में बदलें | draft |
| `nav.projector` | Projector mode | प्रोजेक्टर मोड | draft |
| `nav.skip` | Skip to content | मुख्य सामग्री पर जाएँ | draft |
| `home.cta` | Open the simulator | सिम्युलेटर खोलें | draft |
| `home.hours` | hours after eating | खाने के बाद घंटे | draft |
| `home.how.title` | How it works | यह कैसे काम करता है | draft |
| `home.how.computed` | Nothing is typed in by hand | कुछ भी हाथ से नहीं भरा गया | draft |
| `home.how.computedBody` | Each food is described by its nutrients and glycemic index, taken from published tables. The model works out how fast it leaves the stomach and how blood sugar responds. | हर खाद्य पदार्थ को उसके पोषक तत्वों और ग्लाइसेमिक इंडेक्स से दर्शाया गया है, जो प्रकाशित तालिकाओं से लिए गए हैं। मॉडल गणना करता है कि वह आमाशय से कितनी जल्दी निकलता है और रक्त शर्करा कैसे बदलती है। | draft |
| `home.how.honest` | Ranges, not fake precision | सीमाएँ दिखाते हैं, नकली सटीकता नहीं | draft |
| `home.how.honestBody` | People differ. Times in the intestines and blood sugar are shown as typical ranges for healthy adults, with the source for every input. | हर व्यक्ति अलग होता है। आँतों में लगने वाला समय और रक्त शर्करा स्वस्थ वयस्कों की सामान्य सीमा के रूप में दिखाए गए हैं, और हर इनपुट का स्रोत दिया गया है। | draft |
| `home.how.class` | Made for the classroom | कक्षा के लिए बनाया गया | draft |
| `home.how.classBody` | Projector mode, English and Hindi, keys for a presentation clicker, works offline once loaded, and a link that reopens the exact same meals. | प्रोजेक्टर मोड, अंग्रेज़ी और हिन्दी, प्रेज़ेंटेशन क्लिकर के लिए कुंजियाँ, एक बार लोड होने के बाद बिना इंटरनेट के चलता है, और एक लिंक जो ठीक वही भोजन दोबारा खोलता है। | draft |
| `home.examples` | Try a comparison | कोई तुलना आज़माएँ | draft |
| `sim.title` | Simulator | सिम्युलेटर | draft |
| `sim.addFood` | Add food | खाद्य पदार्थ जोड़ें | draft |
| `sim.servings` | Servings | मात्रा (सर्विंग) | draft |
| `sim.remove` | Remove {{name}} | {{name}} हटाएँ | draft |
| `sim.play` | Play | चलाएँ | draft |
| `sim.pause` | Pause | रोकें | draft |
| `sim.timeline` | Timeline | समयरेखा | draft |
| `sim.share` | Copy link | लिंक कॉपी करें | draft |
| `sim.shareCopied` | Link copied | लिंक कॉपी हो गया | draft |
| `sim.reportError` | Report a mistake | गलती बताएँ | draft |
| `sim.noWebgl` | Your device can’t show 3D here, so you’re seeing the flat diagram. Everything else works the same. | आपका डिवाइस यहाँ 3D नहीं दिखा सकता, इसलिए आप सपाट चित्र देख रहे हैं। बाकी सब कुछ पहले जैसा ही काम करता है। | draft |
| `sim.oldLink` | This link was made with an older version of the model, so some numbers may differ from when it was shared. | यह लिंक मॉडल के पुराने संस्करण से बना था, इसलिए कुछ संख्याएँ साझा करते समय की संख्याओं से अलग हो सकती हैं। | draft |
| `sim.afterEating` | after eating | खाने के बाद | draft |
| `sim.shareManual` | Copy this link | यह लिंक कॉपी करें | draft |
| `sim.capReached` | That would make the meal bigger than {{kcal}} kcal. The model isn't reliable for meals that big. | इससे भोजन {{kcal}} किलो कैलोरी से बड़ा हो जाएगा। इतने बड़े भोजन के लिए मॉडल भरोसेमंद नहीं है। | draft |
| `sim.unknownFoods` | Some foods in this link no longer exist and were left out ({{count}}). | इस लिंक के कुछ खाद्य पदार्थ अब मौजूद नहीं हैं, इसलिए उन्हें छोड़ दिया गया ({{count}})। | draft |
| `sim.overCap` | {{meal}} is bigger than {{kcal}} kcal. The model isn't reliable for meals this big, so treat its times as rough. | {{meal}} {{kcal}} किलो कैलोरी से बड़ा है। इतने बड़े भोजन के लिए मॉडल भरोसेमंद नहीं है, इसलिए इसके समय को केवल अनुमान मानें। | draft |
| `stages.mouth.name` | Mouth | मुख | draft |
| `stages.mouth.what` | Teeth cut and grind food while the tongue mixes it with saliva into a soft ball called a bolus. | दाँत भोजन को काटते और पीसते हैं, जबकि जीभ उसे लार के साथ मिलाकर एक नरम गोला बनाती है जिसे बोलस कहते हैं। | draft |
| `stages.mouth.chemistry` | Salivary amylase starts breaking starch into smaller sugars. Lingual lipase begins on fat, but very little happens yet. | लार में मौजूद एंजाइम लार एमाइलेज मंड (स्टार्च) को छोटी शर्कराओं में तोड़ना शुरू करता है। लिंगुअल लाइपेज वसा पर काम शुरू करता है, पर अभी बहुत कम पाचन होता है। | draft |
| `stages.mouth.absorbed` | Almost nothing is absorbed here. | यहाँ लगभग कुछ भी अवशोषित नहीं होता। | draft |
| `stages.mouth.fact` | Your salivary glands make roughly 1 to 1.5 litres of saliva a day. | आपकी लार ग्रंथियाँ एक दिन में लगभग 1 से 1.5 लीटर लार बनाती हैं। | draft |
| `stages.mouth.short` | Mouth | मुख | draft |
| `stages.esophagus.name` | Food pipe (oesophagus) | भोजन नली (ग्रसिका) | draft |
| `stages.esophagus.what` | Waves of muscle contraction, called peristalsis, push each swallow down to the stomach in a few seconds. | पेशियों के संकुचन की लहरें, जिन्हें क्रमाकुंचन (peristalsis) कहते हैं, हर निवाले को कुछ ही सेकंड में आमाशय तक धकेल देती हैं। | draft |
| `stages.esophagus.chemistry` | No digestion happens here. Mucus helps the bolus slide. | यहाँ कोई पाचन नहीं होता। श्लेष्मा (म्यूकस) बोलस को फिसलने में मदद करता है। | draft |
| `stages.esophagus.absorbed` | Nothing is absorbed. | कुछ भी अवशोषित नहीं होता। | draft |
| `stages.esophagus.fact` | Peristalsis works even upside down — astronauts can swallow in space. | क्रमाकुंचन उलटे होने पर भी काम करता है — अंतरिक्ष यात्री अंतरिक्ष में भी निगल सकते हैं। | draft |
| `stages.esophagus.short` | Food pipe | भोजन नली | draft |
| `stages.stomach.name` | Stomach | आमाशय | draft |
| `stages.stomach.what` | The stomach stores the meal, churns it with acid into a thick liquid called chyme, and lets it out a little at a time through the pyloric sphincter. | आमाशय भोजन को जमा करता है, उसे अम्ल के साथ मथकर एक गाढ़े द्रव में बदलता है जिसे काइम कहते हैं, और उसे जठरनिर्गम अवरोधिनी (pyloric sphincter) से थोड़ा-थोड़ा करके आगे भेजता है। | draft |
| `stages.stomach.chemistry` | Hydrochloric acid unfolds proteins and kills many microbes. Pepsin starts cutting proteins into shorter chains. Liquids leave first; solids must be ground to tiny pieces before they can leave. | हाइड्रोक्लोरिक अम्ल प्रोटीन को खोलता है और कई सूक्ष्मजीवों को मार देता है। पेप्सिन प्रोटीन को छोटी शृंखलाओं में काटना शुरू करता है। द्रव पहले निकलते हैं; ठोस भोजन को निकलने से पहले बहुत छोटे टुकड़ों में पीसा जाना ज़रूरी है। | draft |
| `stages.stomach.absorbed` | Very little — some water, alcohol and a few drugs. | बहुत कम — कुछ पानी, अल्कोहल और कुछ दवाइयाँ। | draft |
| `stages.stomach.fact` | The more calories a meal has, the more slowly it leaves: the small intestine signals the stomach to deliver only a few calories per minute. | भोजन में जितनी अधिक कैलोरी होती है, वह उतनी ही धीरे निकलता है: छोटी आँत आमाशय को संकेत देती है कि हर मिनट केवल कुछ ही कैलोरी आगे भेजे। | draft |
| `stages.stomach.short` | Stomach | आमाशय | draft |
| `stages.smallIntestine.name` | Small intestine | छोटी आँत | draft |
| `stages.smallIntestine.chemistry` | Bile from the liver breaks fat into tiny droplets. Pancreatic enzymes — amylase, lipase, trypsin — and enzymes on the villi finish breaking food into sugars, amino acids, fatty acids and glycerol. | यकृत से आने वाला पित्त वसा को छोटी-छोटी बूँदों में तोड़ता है। अग्न्याशय के एंजाइम — एमाइलेज, लाइपेज, ट्रिप्सिन — और दीर्घरोम पर मौजूद एंजाइम भोजन को शर्करा, अमीनो अम्ल, वसा अम्ल और ग्लिसरॉल में तोड़ने का काम पूरा करते हैं। | draft |
| `stages.smallIntestine.absorbed` | Most nutrients and most of the water are absorbed here into the blood and lymph. | अधिकांश पोषक तत्व और अधिकांश पानी यहीं रक्त और लसीका में अवशोषित होते हैं। | draft |
| `stages.smallIntestine.fact` | The villi and microvilli give the small intestine a surface area of around 30 square metres — about half a badminton court. | दीर्घरोम और सूक्ष्म-दीर्घरोम छोटी आँत को लगभग 30 वर्ग मीटर का सतही क्षेत्र देते हैं — लगभग आधे बैडमिंटन कोर्ट जितना। | draft |
| `stages.smallIntestine.short` | Small intestine | छोटी आँत | draft |
| `stages.largeIntestine.name` | Large intestine | बड़ी आँत | draft |
| `stages.largeIntestine.what` | What could not be digested — mainly fibre — moves slowly through the colon and is stored until it leaves the body. | जो पच नहीं सका — मुख्य रूप से रेशा — वह बृहदांत्र (कोलन) से होकर धीरे-धीरे आगे बढ़ता है और शरीर से बाहर निकलने तक जमा रहता है। | draft |
| `stages.largeIntestine.chemistry` | Gut bacteria ferment fibre, making gases and short-chain fatty acids that feed the colon’s own cells. Some vitamins, such as vitamin K, are made by bacteria here. | आँत के जीवाणु रेशे का किण्वन करते हैं, जिससे गैसें और छोटी शृंखला वाले वसा अम्ल बनते हैं जो कोलन की अपनी कोशिकाओं को पोषण देते हैं। कुछ विटामिन, जैसे विटामिन K, यहाँ जीवाणुओं द्वारा बनाए जाते हैं। | draft |
| `stages.largeIntestine.absorbed` | Most of the remaining water and salts. | बचा हुआ अधिकांश पानी और लवण। | draft |
| `stages.largeIntestine.fact` | This is the slowest part of the journey: commonly a day or more. | यह यात्रा का सबसे धीमा भाग है: आमतौर पर एक दिन या उससे अधिक। | draft |
| `stages.largeIntestine.short` | Large intestine | बड़ी आँत | draft |
| `nutrients.carbs` | Carbohydrate | कार्बोहाइड्रेट | draft |
| `nutrients.protein` | Protein | प्रोटीन | draft |
| `nutrients.fat` | Fat | वसा | draft |
| `nutrients.fiber` | Fibre | रेशा | draft |
| `nutrients.water` | Water | पानी | draft |
| `lesson.meal` | Meal | भोजन | draft |
| `feedback.title` | Report a mistake | गलती बताएँ | draft |
| `feedback.intro` | Spotted a wrong number or explanation? Tell us — we check every report against published sources. | कोई गलत संख्या या व्याख्या दिखी? हमें बताएँ — हम हर रिपोर्ट को प्रकाशित स्रोतों से जाँचते हैं। | draft |
| `feedback.where` | Where is the mistake? | गलती कहाँ है? | draft |
| `feedback.message` | What’s wrong, and what should it say? | क्या गलत है, और सही क्या होना चाहिए? | draft |
| `feedback.source` | Source, if you have one (book, paper, link) | स्रोत, अगर आपके पास है (किताब, शोध पत्र, लिंक) | draft |
| `feedback.send` | Send report | रिपोर्ट भेजें | draft |
| `feedback.sent` | Thanks — report sent. | धन्यवाद — रिपोर्ट भेज दी गई। | draft |
| `feedback.close` | Close | बंद करें | draft |
| `feedback.openIssue` | Send it as a GitHub issue instead | इसके बजाय GitHub issue के रूप में भेजें | draft |
| `teach.plan` | A 40-minute lesson plan | 40 मिनट की पाठ योजना | draft |
| `teach.steps[0]` | Predict: ask the class which leaves the stomach first, a can of cola or a burger with fries, and which raises blood sugar more. | अनुमान: कक्षा से पूछें कि आमाशय से पहले क्या निकलेगा — कोला का एक कैन या फ़्राइज़ के साथ बर्गर, और रक्त शर्करा किससे ज़्यादा बढ़ेगी। | draft |
| `teach.steps[1]` | Open cola with burger + fries kept (the first ready lesson below). It opens at 35 min; press Home to start from eating, then press Play. The dashed grey line is the kept burger. | बर्गर + फ़्राइज़ को तुलना के लिए रखकर कोला खोलें (नीचे पहला तैयार पाठ) और ‘चलाएँ’ दबाएँ। धूसर टूटी रेखा रखा गया बर्गर है। | draft |
| `teach.steps[2]` | Press Page Down (or the presentation clicker) to jump from one key moment to the next. At each one, read the line under the body: where the food is now. | एक मुख्य पल से अगले पर जाने के लिए Page Down (या प्रेज़ेंटेशन क्लिकर) दबाएँ। हर पल पर शरीर के नीचे की पंक्ति पढ़ें: भोजन अभी कहाँ है। | draft |
| `teach.steps[3]` | Read blood sugar at 1 hour from the Blood sugar graph: drag the timeline to 1 h, and press B to bring that graph to the front. | 1 घंटे पर रक्त शर्करा ‘रक्त शर्करा’ ग्राफ़ से पढ़ें: टाइमलाइन को 1 घं तक खींचें, और वह ग्राफ़ सामने लाने के लिए B दबाएँ। | draft |
| `teach.steps[4]` | Finish with energy at 3 hours: is more energy coming in from the meal, or being used by the body? Press E for the Energy graph. | 3 घंटे पर ऊर्जा के साथ समाप्त करें: क्या भोजन से ज़्यादा ऊर्जा आ रही है, या शरीर ज़्यादा उपयोग कर रहा है? ‘ऊर्जा’ ग्राफ़ के लिए E दबाएँ। | draft |
| `teach.questionsTitle` | Four questions to check understanding | समझ जाँचने के चार प्रश्न | draft |
| `teach.tipsTitle` | Practical tips | उपयोगी सुझाव | draft |
| `teach.tips[0]` | Projector mode (top right) shows one big graph at a time: press S, B or E to switch between Stomach, Blood sugar and Energy. | प्रोजेक्टर मोड (ऊपर दाईं ओर) एक समय में एक बड़ा ग्राफ़ दिखाता है: आमाशय, रक्त शर्करा और ऊर्जा के बीच जाने के लिए S, B या E दबाएँ। | draft |
| `teach.tips[1]` | Open the app once on Wi-Fi; after that it works offline. | ऐप को एक बार वाई-फ़ाई पर खोलें; उसके बाद यह बिना इंटरनेट के भी चलता है। | draft |
| `teach.tips[2]` | Every screen has its own link: save it in your notes to reopen the exact setup. | हर स्क्रीन का अपना लिंक होता है: ठीक वही सेटअप दोबारा खोलने के लिए इसे अपने नोट्स में सहेज लें। | draft |
| `teach.tips[3]` | Every graph has “Show as table” for students using screen readers, and every control works from the keyboard (press ? for the list of keys). | स्क्रीन रीडर इस्तेमाल करने वाले विद्यार्थियों के लिए हर ग्राफ़ में “तालिका के रूप में देखें” है, और हर नियंत्रण कीबोर्ड से चलता है (कुंजियों की सूची के लिए ? दबाएँ)। | draft |
| `science.title` | Science and sources | विज्ञान और स्रोत | draft |
| `science.lead` | What the model computes, what it assumes, and where every number comes from. | मॉडल क्या गणना करता है, क्या मानकर चलता है, और हर संख्या कहाँ से आती है। | draft |
| `science.modelTitle` | What is computed | क्या गणना की जाती है | draft |
| `science.modelBody` | Stomach emptying is computed from the meal. Drinks start leaving straight away — water within minutes, drinks with calories at about 2 kcal per minute. Solid food is first ground for about 20 minutes, then leaves at about 1.4 kcal per minute, so meals with more calories take longer. (In the model a bigger meal empties at the same rate; real stomachs speed up a little for big meals.) Blood sugar is computed from the carbohydrate being absorbed, its glycemic index, and the slowing effect of fat and protein. | आमाशय का खाली होना भोजन से गणना किया जाता है। पेय तुरंत निकलने लगते हैं — पानी कुछ ही मिनटों में, कैलोरी वाले पेय लगभग 2 किलो कैलोरी प्रति मिनट की दर से। ठोस भोजन पहले लगभग 20 मिनट तक पीसा जाता है, फिर लगभग 1.4 किलो कैलोरी प्रति मिनट की दर से निकलता है, इसलिए अधिक कैलोरी वाले भोजन में अधिक समय लगता है। (मॉडल में बड़ा भोजन भी उसी दर से खाली होता है; असली आमाशय बड़े भोजन के लिए थोड़ा तेज़ हो जाता है।) रक्त शर्करा अवशोषित हो रहे कार्बोहाइड्रेट, उसके ग्लाइसेमिक इंडेक्स, और वसा व प्रोटीन के धीमा करने वाले प्रभाव से गणना की जाती है। | draft |
| `science.fixedTitle` | What is fixed | क्या तय है | draft |
| `science.limitsTitle` | Limits | सीमाएँ | draft |
| `science.limits[1]` | Blood sugar is a typical shape, not a prediction for any one person. | रक्त शर्करा एक सामान्य आकार दिखाती है, किसी एक व्यक्ति के लिए भविष्यवाणी नहीं। | draft |
| `science.limits[2]` | Exercise, sleep, stress and drinks with the meal all change real results. | व्यायाम, नींद, तनाव और भोजन के साथ लिए गए पेय — ये सब वास्तविक परिणाम बदल देते हैं। | draft |
| `science.limits[3]` | Glycemic index values for mixed and home-cooked dishes vary between studies. | मिले-जुले और घर में बने व्यंजनों के ग्लाइसेमिक इंडेक्स मान अलग-अलग अध्ययनों में अलग होते हैं। | draft |
| `science.limits[4]` | Fibre isn't modelled on its own: its slowing effect on blood sugar shows up through each food's glycemic index. | रेशे को अलग से मॉडल नहीं किया गया है: रक्त शर्करा पर उसका धीमा करने वाला प्रभाव हर खाद्य पदार्थ के ग्लाइसेमिक इंडेक्स में दिखता है। | draft |
| `science.version` | Model version {{version}} | मॉडल संस्करण {{version}} | draft |
| `science.foodsTitle` | Food data | खाद्य आँकड़े | draft |
| `science.references` | References | संदर्भ | draft |
| `science.nutrientsPerServing` | Per serving | प्रति सर्विंग | draft |
| `science.gi` | Glycemic index | ग्लाइसेमिक इंडेक्स | draft |
| `science.noGi` | not applicable (almost no carbohydrate) | लागू नहीं (लगभग कोई कार्बोहाइड्रेट नहीं) | draft |
| `notFound.title` | Page not found | पेज नहीं मिला | draft |
| `notFound.body` | That page doesn’t exist. Go back to the simulator. | यह पेज मौजूद नहीं है। सिम्युलेटर पर वापस जाएँ। | draft |
| `notFound.cta` | Open the simulator | सिम्युलेटर खोलें | draft |
| `units.min` | {{n}} min | {{n}} मिनट | draft |
| `units.h` | {{n}} h | {{n}} घंटे | draft |
| `units.hm` | {{h}} h {{m}} min | {{h}} घंटे {{m}} मिनट | draft |
| `units.hShort` | {{n}}h | {{n}} घं | draft |
| `units.kcal` | {{n}} kcal | {{n}} किलो कैलोरी | draft |
| `anatomy.liver` | Liver | यकृत | draft |
| `anatomy.pancreas` | Pancreas | अग्न्याशय | draft |
| `error.title` | Something didn’t load | कुछ लोड नहीं हुआ | draft |
| `error.reload` | Reload | दोबारा लोड करें | draft |

## Hindi hardening (WP-18)

| Key | English | Hindi | Status |
|---|---|---|---|
| `now.keptShort` | Kept: | रखा गया: | draft |

## Hindi agreement (FIX-F)

"This meal" and "the kept meal" before a postposition (`इस भोजन की`, `रखे गए भोजन की तुलना में`), for the
summary sentences whose Hindi puts the meal's name there. English needs no second form, so its text repeats.

| Key | English | Hindi | Status |
|---|---|---|---|
| `summary.oblique.thisMeal` | this meal | इस भोजन | draft |
| `summary.oblique.keptMeal` | the kept meal | रखे गए भोजन | draft |

## Foods (content/foods/*.json)

Each food's Hindi name and serving label, from its file in `content/foods/` (change them there, then
run `--write`). The app puts the short name (without the part in brackets) into sentences such as the
summary, so those sentences are worded to fit feminine (इडली, दाल, रोटी) and masculine (केला, सेब) names alike.

| Key | English | Hindi | Status |
|---|---|---|---|
| `foods/apple.name` | Apple | सेब | draft |
| `foods/apple.serving.label` | 1 medium apple (182 g) | 1 मध्यम सेब (182 ग्राम) | draft |
| `foods/banana.name` | Banana | केला | draft |
| `foods/banana.serving.label` | 1 medium banana (118 g) | 1 मध्यम केला (118 ग्राम) | draft |
| `foods/boiled-egg.name` | Boiled egg | उबला अंडा | draft |
| `foods/boiled-egg.serving.label` | 1 large egg (50 g) | 1 बड़ा अंडा (50 ग्राम) | draft |
| `foods/cheeseburger.name` | Cheeseburger | चीज़बर्गर | draft |
| `foods/cheeseburger.serving.label` | 1 fast-food cheeseburger (119 g) | 1 फ़ास्ट-फ़ूड चीज़बर्गर (119 ग्राम) | draft |
| `foods/cola.name` | Cola | कोला | draft |
| `foods/cola.serving.label` | 1 can (330 mL) | 1 कैन (330 मि.ली.) | draft |
| `foods/dal.name` | Dal (masoor) | दाल (मसूर) | draft |
| `foods/dal.serving.label` | 1 katori (150 g) | 1 कटोरी (150 ग्राम) | draft |
| `foods/fries.name` | French fries | फ़्रेंच फ़्राइज़ | draft |
| `foods/fries.serving.label` | 1 medium portion (117 g) | 1 मध्यम हिस्सा (117 ग्राम) | draft |
| `foods/green-salad.name` | Green salad (no dressing) | हरा सलाद (बिना ड्रेसिंग) | draft |
| `foods/green-salad.serving.label` | 1 bowl: lettuce, cucumber, tomato (150 g) | 1 कटोरी: सलाद पत्ता, खीरा, टमाटर (150 ग्राम) | draft |
| `foods/idli.name` | Idli | इडली | draft |
| `foods/idli.serving.label` | 2 idlis (about 45 g each) | 2 इडली (लगभग 45 ग्राम प्रत्येक) | draft |
| `foods/milk.name` | Milk (full fat) | दूध (फुल क्रीम) | draft |
| `foods/milk.serving.label` | 1 glass (250 mL) | 1 गिलास (250 मि.ली.) | draft |
| `foods/orange-juice.name` | Orange juice | संतरे का रस | draft |
| `foods/orange-juice.serving.label` | 1 glass (250 mL) | 1 गिलास (250 मि.ली.) | draft |
| `foods/roti.name` | Roti / chapati (whole wheat) | रोटी / चपाती (गेहूँ) | draft |
| `foods/roti.serving.label` | 2 rotis (72 g) | 2 रोटी (72 ग्राम) | draft |
| `foods/water.name` | Water | पानी | draft |
| `foods/water.serving.label` | 1 glass (250 mL) | 1 गिलास (250 मि.ली.) | draft |
| `foods/white-bread.name` | White bread | सफ़ेद ब्रेड | draft |
| `foods/white-bread.serving.label` | 2 slices (50 g) | 2 स्लाइस (50 ग्राम) | draft |
| `foods/white-rice.name` | White rice (cooked) | सफ़ेद चावल (पका हुआ) | draft |
| `foods/white-rice.serving.label` | 1 cup (158 g) | 1 कप (158 ग्राम) | draft |

## New strings (added by scripts/hi-review.mjs)

| Key | English | Hindi | Status |
|---|---|---|---|
| `nav.menu` | Menu | मेन्यू | draft |
| `home.example` | {{meal}}, with {{kept}} kept | {{meal}}, तुलना के लिए {{kept}} रखा गया | draft |
| `teach.lessonsTitle` | Ready lessons | तैयार पाठ | draft |
| `teach.lessonsLead` | Each opens in projector mode on a laptop, paused at the moment to talk about, on the graph it is about. Press Play, or Page Down for the next key moment. | हर पाठ लैपटॉप पर प्रोजेक्टर मोड में खुलता है, उस पल पर रुका हुआ जिस पर बात करनी है, उसी ग्राफ़ पर जिसके बारे में पाठ है। ‘चलाएँ’ दबाएँ, या अगले मुख्य पल के लिए Page Down। | draft |
| `teach.lessons.stomachRace` | Which leaves the stomach first? | आमाशय से पहले क्या निकलता है? | draft |
| `teach.lessons.rotiDal` | Which raises blood sugar more gently? | रक्त शर्करा किससे धीरे बढ़ती है? | draft |
| `teach.lessons.colaFour` | One cola or four: what happens to blood sugar? | एक कोला या चार: रक्त शर्करा का क्या होता है? | draft |
| `teach.opensAt` | opens at {{time}} on the {{graph}} graph | {{graph}} ग्राफ़ पर {{time}} पर खुलता है | draft |
| `teach.questionsLead` | Use these after the lesson. Students answer on their own phones, without help, each starting from its link. The answers are in the closed box below. | इन्हें पाठ के बाद इस्तेमाल करें। विद्यार्थी अपने फ़ोन पर, बिना मदद के, हर प्रश्न उसके लिंक से शुरू करके उत्तर दें। उत्तर नीचे बंद बॉक्स में हैं। | draft |
| `teach.tasks.halfLeft` | Cola is chosen. When has half of it left the stomach? | कोला चुना हुआ है। आधा कोला आमाशय (पेट) से कब तक निकल गया? | draft |
| `teach.tasks.faster` | Now compare cola with a burger and fries. Which leaves the stomach faster, and why? | अब कोला की तुलना बर्गर और फ़्राइज़ से करो। कौन-सा आमाशय से जल्दी निकलता है, और क्यों? | draft |
| `teach.tasks.bloodAt1h` | What is blood sugar 1 hour after the cola? | कोला के 1 घंटे बाद रक्त शर्करा (ब्लड शुगर) कितनी है? | draft |
| `teach.tasks.energyAt3h` | At 3 hours, is more energy coming in from the cola, or is the body using more? | 3 घंटे पर कोला से शरीर में ऊर्जा ज़्यादा आ रही है, या शरीर ज़्यादा ऊर्जा खर्च कर रहा है? | draft |
| `teach.qrTitle` | Open it on students’ phones | विद्यार्थियों के फ़ोन पर खोलें | draft |
| `teach.qrCaption` | Students scan this code with the phone camera: LifePeek opens with cola chosen, where questions 1 to 3 start. No login, nothing to install. | विद्यार्थी फ़ोन के कैमरे से यह कोड स्कैन करें: LifePeek कोला चुने हुए खुलता है, जहाँ से प्रश्न 1 से 3 शुरू होते हैं। न लॉगिन, न कुछ इंस्टॉल करना। | draft |
| `teach.qrAlt` | QR code for LifePeek with cola chosen | कोला चुने हुए LifePeek का QR कोड | draft |
| `teach.answersTitle` | Answers for teachers | शिक्षकों के लिए उत्तर | draft |
| `teach.answers[0]` | About 35 minutes (30 to 40 is right): the ring on the stomach graph, or its marker on the timeline. | लगभग 35 मिनट (30 से 40 सही है): आमाशय ग्राफ़ पर गोला, या टाइमलाइन पर उसका निशान। | draft |
| `teach.answers[1]` | Cola, about 8 times faster: a drink starts leaving straight away, and it has fewer calories than a burger with fries. | कोला, लगभग 8 गुना जल्दी: पेय तुरंत निकलना शुरू हो जाता है, और उसमें फ़्राइज़ के साथ बर्गर से कम कैलोरी होती है। | draft |
| `teach.answers[2]` | About 111 mg/dL (105 to 115). Its highest, about 121, was at 35 minutes. | लगभग 111 mg/dL (105 से 115)। इसका सबसे ऊँचा स्तर, लगभग 121, 35 मिनट पर था। | draft |
| `teach.answers[3]` | The body is using more: almost nothing is coming in from the cola, while the body uses about 63 kcal an hour. | शरीर ज़्यादा खर्च कर रहा है: कोला से लगभग कुछ नहीं आ रहा, जबकि शरीर लगभग 63 किलो कैलोरी प्रति घंटा खर्च करता है। | draft |
| `stage.pressPlay` | Press ▶ to watch {{meal}} go through the body | ▶ दबाएँ और देखें कि {{meal}} शरीर में कैसे आगे बढ़ता है | draft |
| `teach.lessonNotes.colaFour` | What to see: both reach the same highest point, about 121 mg/dL, but after four colas blood sugar stays raised about 3 h 15 min longer. | क्या देखें: दोनों बार सबसे ऊँचा स्तर लगभग 121 mg/dL ही रहता है, पर चार कोला के बाद रक्त शर्करा लगभग 3 घंटे 15 मिनट ज़्यादा देर तक बढ़ी रहती है। | draft |
| `update.ready` | A new version of LifePeek is ready. | LifePeek का नया संस्करण तैयार है। | draft |
| `update.reload` | Reload | दोबारा लोड करें | draft |
| `update.later` | Later | बाद में | draft |
| `sameFood.amount_one` | {{count}} serving of {{food}} | {{food}} का {{count}} हिस्सा | draft |
| `sameFood.amount_other` | {{count}} servings of {{food}} | {{food}} के {{count}} हिस्से | draft |
| `sameFood.bloodLonger` | Blood sugar stays raised about {{time}} longer after {{more}} than after {{less}}. | {{more}} के बाद रक्त शर्करा, {{less}} के बाद से लगभग {{time}} ज़्यादा देर तक बढ़ी रहती है। | draft |
| `sameFood.reasonSamePeak` | Both reach about the same highest point ({{peak}} mg/dL): the stomach lets only a little sugar through each minute, so more food keeps blood sugar up for longer, not higher. | दोनों बार सबसे ऊँचा स्तर लगभग बराबर ({{peak}} mg/dL) रहता है: आमाशय हर मिनट थोड़ी-सी शर्करा ही आगे जाने देता है, इसलिए ज़्यादा भोजन से रक्त शर्करा ज़्यादा ऊपर नहीं जाती, बल्कि ज़्यादा देर तक बढ़ी रहती है। | draft |
| `sameFood.oblique.amount_one` | {{count}} serving of {{food}} | {{food}} के {{count}} हिस्से | draft |
| `sameFood.oblique.amount_other` | {{count}} servings of {{food}} | {{food}} के {{count}} हिस्सों | draft |

## Sign-off

Reviewed by ___ on ___

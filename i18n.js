/* MIT · Copyright (c) 2026 Yousef Khames · UI strings as [Arabic, English]. */
(function (root) {
  'use strict';
  Object.assign(root.Kit.dict, {
    title: ['دَور', 'dawr'], reception: ['الاستقبال', 'Reception'], display: ['شاشة العرض', 'Display'], lang: ['EN', 'عربي'],
    demoBanner: ['بيانات تجريبية: الخدمات والتذاكر هنا للتجربة فقط.', 'Demo data: the services and tickets here are for trying it out only.'], demoTag: ['تجريبي', 'Demo'],
    startClean: ['احذف البيانات التجريبية وابدأ', 'Clear demo data and start'], confirmClean: ['سيتم حذف كل التذاكر والخدمات التجريبية. متابعة؟', 'This deletes all demo tickets and services. Continue?'],
    nowServing: ['الآن', 'Now serving'], none: ['لا أحد', 'Nobody'], waitingN: ['منتظرون: {n}', 'Waiting: {n}'], nextUp: ['التالي', 'Next'],
    labelPh: ['اسم أو ملاحظة (اختياري)', 'Name or note (optional)'], phonePh: ['واتساب (اختياري)', 'WhatsApp (optional)'], noMedical: ['لا تكتب بيانات طبية أو شخصية حساسة.', 'Do not enter medical or sensitive personal data.'],
    issue: ['إصدار تذكرة', 'Issue ticket'], callNext: ['نداء التالي', 'Call next'], done: ['تم', 'Done'], noshow: ['لم يحضر', 'No-show'], skip: ['تخطي', 'Skip'], recall: ['إعادة للطابور', 'Back to queue'],
    ticketN: ['تذكرة رقم {n}', 'Ticket {n}'], skippedList: ['تم تخطيهم', 'Skipped'], waitList: ['في الانتظار', 'Waiting'], noWaiting: ['لا أحد في الانتظار.', 'Nobody is waiting.'],
    copyLink: ['نسخ رابط التذكرة', 'Copy ticket link'], copied: ['تم النسخ', 'Copied'], wa: ['مسودة واتساب', 'WhatsApp draft'], waNoPhone: ['أدخل رقم واتساب للتذكرة أولًا', 'Add a WhatsApp number to the ticket first'], print: ['طباعة', 'Print'],
    waText: ['{shop}: دورك قريب. تذكرتك رقم {n}، المتبقي قبلك {a}. افتح الرابط لآخر حالة: {url}', '{shop}: your turn is near. Your ticket is {n}, {a} ahead of you. Open the link for the latest: {url}'],
    slipHint: ['امسح الكود أو افتح الرابط لمعرفة كم شخصًا قبلك. الحالة لحظة الإصدار وليست مباشرة.', 'Scan the code or open the link to see how many are ahead. It shows the moment of issue, not live status.'],
    issuedAt: ['صدرت {t}', 'Issued {t}'],
    statsH: ['الإحصاء من التسجيلات فقط', 'Stats from recorded tickets only'], notEnough: ['لا توجد بيانات كافية بعد (يلزم {n} تذاكر مسجلة)', 'Not enough data yet ({n} recorded tickets needed)'], avgWait: ['متوسط الانتظار: {m} دقيقة', 'Average wait: {m} min'], avgServe: ['متوسط مدة الخدمة: {m} دقيقة', 'Average service time: {m} min'],
    countsLine: ['صدر {i} · تم {d} · لم يحضر {x} · تخطي {s}', 'Issued {i} · done {d} · no-show {x} · skipped {s}'],
    manage: ['إدارة', 'Manage'], addService: ['إضافة خدمة أو طبيب', 'Add a service or doctor'], svcAr: ['الاسم بالعربي', 'Arabic name'], svcEn: ['الاسم بالإنجليزي (اختياري)', 'English name (optional)'], add: ['إضافة', 'Add'],
    removeSvc: ['حذف الخدمة', 'Remove service'], svcBusy: ['لا يمكن الحذف: يوجد منتظرون أو شخص يُخدم', 'Cannot remove: someone is waiting or being served'], svcDup: ['الخدمة موجودة', 'Service already exists'], svcName: ['اكتب اسمًا', 'Enter a name'],
    newDay: ['يوم جديد', 'New day'], confirmDay: ['سيتم حذف كل التذاكر وإعادة الترقيم من 1. صدّر الملف أولًا إن احتجت. متابعة؟', 'This deletes all tickets and restarts numbering at 1. Export first if you need the data. Continue?'],
    exportCsv: ['تصدير التذاكر CSV', 'Export tickets CSV'], backup: ['نسخة احتياطية JSON', 'Backup JSON'], restoreFile: ['استعادة نسخة', 'Restore backup'], restoreFail: ['ملف غير صالح', 'Invalid file'], restored: ['تمت الاستعادة', 'Restored'],
    limits: ['شاشة الاستقبال هي مصدر الحقيقة الوحيد على هذا الجهاز. روابط العملاء لقطة وقت الإصدار وليست مباشرة.', 'The reception screen on this device is the only source of truth. Customer links are a snapshot, not live.'],
    displayHelp: ['افتح هذه الشاشة في نافذة أخرى بنفس المتصفح والجهاز، أو اعرضها على التلفاز بالمشاركة. تتحدث تلقائيًا.', 'Open this screen in another window of the same browser and device, or cast it to a TV. It updates by itself.'],
    updated: ['آخر تحديث {t}', 'Updated {t}'], fullscreen: ['ملء الشاشة', 'Full screen'],
    /* customer */
    yourNumber: ['رقمك', 'Your number'], svcLabel: ['الخدمة: {s}', 'Service: {s}'], c_wait: ['قبلك {a} في الطابور', '{a} ahead of you'], c_next: ['أنت التالي. كن قريبًا من الاستقبال.', 'You are next. Stay close to reception.'], c_called: ['تم نداء رقمك أو تجاوزه. اسأل الاستقبال.', 'Your number was called or passed. Ask reception.'],
    c_minutes: ['تقدير تقريبي: {m} دقيقة (من متوسط مدة الخدمة المسجل)', 'Rough estimate: {m} min (from the recorded average service time)'], c_noEst: ['لا يوجد تقدير للوقت: البيانات المسجلة غير كافية.', 'No time estimate: not enough recorded data.'],
    c_age: ['الحالة وقت {t} (منذ {a} دقيقة). ليست مباشرة: افتح رابطًا أحدث من الاستقبال.', 'Status as of {t} ({a} min ago). Not live: open a newer link from reception.'],
    c_other: ['هذا الرابط من مكان آخر.', 'This link is from a different place.'], c_bad: ['رابط التذكرة غير صالح.', 'This ticket link is not valid.'], c_paste: ['الصق رابطًا أحدث هنا', 'Paste a newer link here'], c_open: ['فتح', 'Open'],
    blocked: ['البيانات المخزنة غير قابلة للقراءة ولن يتم الكتابة فوقها حتى تمسحها.', 'Stored data is unreadable and will not be overwritten until you erase it.'], reset: ['مسح البيانات', 'Erase data'], confirmReset: ['سيتم حذف كل بيانات الطابور على هذا الجهاز. متابعة؟', 'This deletes all queue data on this device. Continue?']
  });
})(globalThis);

import {
  type AttendanceCard,
  type AttendanceExam,
  type AttendanceLesson,
  createInitialAttendanceCard,
} from './attendance';

export type ClientDocument = { id: string; title: string };

export const TRAINING_STAGES = ['قانون المرور', 'مناورات', 'سياقة عامة', 'منتهي'] as const;
export type TrainingStage = (typeof TRAINING_STAGES)[number];

// ─── History Journal Types ───────────────────────────────────────────────────
export type HistoryActionType =
  | 'creation'
  | 'info_update'
  | 'stage_change'
  | 'payment'
  | 'document_update'
  | 'attendance'
  | 'exam_result'
  | 'note'
  | 'archive'
  | 'restore';

export type HistoryDiff = {
  field: string;
  label: string;
  oldValue?: string;
  newValue?: string;
};

export type ClientHistoryEntry = {
  id: string;
  timestamp: string;          // ISO 8601
  action: HistoryActionType;
  summary: string;            // Arabic human-readable summary
  diffs?: HistoryDiff[];
  amount?: number;            // for payment events
  note?: string;              // for manual notes
};

const FIELD_LABELS: Record<string, string> = {
  name: 'الاسم واللقب',
  phone: 'رقم الهاتف',
  birthDate: 'تاريخ الميلاد',
  birthPlace: 'مكان الميلاد',
  email: 'البريد الإلكتروني',
  address: 'العنوان',
  training: 'نوع التكوين',
  registrationNumber: 'رقم التسجيل',
  registrationDate: 'تاريخ التسجيل',
  stage: 'مرحلة التكوين',
  paidAmount: 'المبلغ المدفوع',
  totalAmount: 'المبلغ الإجمالي',
  obtainedCategories: 'الأصناف المتحصل عليها',
  photo: 'صورة المتدرب',
};

const ATTENDANCE_FIELD_LABELS: Record<
  Exclude<keyof AttendanceCard, 'codeLessons' | 'drivingLessons' | 'exams'>,
  string
> = {
  fileNumber: 'رقم الملف في بطاقة المداومة',
  birthPlace: 'مكان الميلاد في بطاقة المداومة',
  submissionDate: 'تاريخ إيداع الملف',
  obtainedLicenseNumber: 'رقم الرخصة المتحصل عليها',
  issueDate: 'تاريخ إصدار الرخصة',
  schoolName: 'اسم مدرسة السياقة',
  photo: 'صورة المتدرب',
};

export type CreateClientInput = {
  registrationNumber?: string;
  name: string;
  phone: string;
  birthDate: string;
  birthPlace?: string;
  email: string;
  address: string;
  training: string;
  obtainedCategories?: string[];
  registrationDate: string;
  receivedDocuments: string[];
  documents: ClientDocument[];
  paidAmount?: number;
  totalAmount?: number;
  stage?: string;
  attendance?: AttendanceCard;
  photo?: string;
};

export type Client = CreateClientInput & {
  id: string | number;
  color?: string;
  history?: ClientHistoryEntry[];
  isArchived?: boolean;
  archiveYear?: number;
  archivedAt?: string;
};

type CreatedClient = { id: string | number };

const CLIENTS_STORAGE_KEY = 'auto-ecole.clients';
// (DEMO_CLIENTS_SEEDED_KEY removed — demo seeding is no longer used)
const ARCHIVE_STORAGE_PREFIX = 'auto-ecole.archive.';
const ARCHIVE_YEARS_KEY = 'auto-ecole.archive-years';

const standardDocuments: ClientDocument[] = [
  { id: 'birth-certificate', title: 'شهادة ميلاد' },
  { id: 'residence-certificate', title: 'شهادة الإقامة' },
  { id: 'medical-certificate', title: 'شهادة طبية' },
  { id: 'identity-copy', title: 'نسخة من بطاقة التعريف الوطنية أو رخصة السياقة' },
  { id: 'identity-photos', title: '6 صور شمسية' },
];

const DEMO_PURGED_KEY = 'auto-ecole.demo-clients-purged-v3';

const DEMO_IDS = new Set([
  '001', '002', '003', '004', '005', '006',
  '007', '008', '009', '010', '011', '012',
]);

const DEMO_NAMES = new Set([
  'أمين خليفي', 'سارة بن علي', 'ياسين مرابط', 'هيبة منصوري',
  'رياض جوادي', 'لينا ناصر', 'كريم بلقاسم', 'مراد حميدي',
  'فاطمة الزهراء قاسمي', 'عبد الرحمن طاهري', 'مريم بوزيد', 'وليد لعريبي',
].map((n) => n.trim().toLowerCase()));

function getArchiveKey(year: number): string {
  return `${ARCHIVE_STORAGE_PREFIX}${year}`;
}

function getStoredArchiveYears(): number[] {
  try {
    const raw = window.localStorage.getItem(ARCHIVE_YEARS_KEY);
    if (!raw) {
      const yearsFromKeys: number[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(ARCHIVE_STORAGE_PREFIX)) {
          const y = Number(key.replace(ARCHIVE_STORAGE_PREFIX, ''));
          if (Number.isInteger(y) && y > 1900) yearsFromKeys.push(y);
        }
      }
      return Array.from(new Set(yearsFromKeys)).sort((a, b) => b - a);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((y) => Number.isInteger(y) && y > 1900).sort((a, b) => b - a);
  } catch {
    return [];
  }
}

function storeArchiveYears(years: number[]) {
  const unique = Array.from(new Set(years.map(Number))).sort((a, b) => b - a);
  window.localStorage.setItem(ARCHIVE_YEARS_KEY, JSON.stringify(unique));
}

function getStoredArchivedClients(year: number): Client[] {
  try {
    const raw = window.localStorage.getItem(getArchiveKey(year));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Client[]) : [];
  } catch {
    return [];
  }
}

function storeArchivedClients(year: number, clients: Client[]) {
  const key = getArchiveKey(year);
  if (clients.length === 0) {
    window.localStorage.removeItem(key);
    const existingYears = getStoredArchiveYears().filter((y) => y !== year);
    storeArchiveYears(existingYears);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(clients));
  const existingYears = getStoredArchiveYears();
  if (!existingYears.includes(year)) {
    storeArchiveYears([...existingYears, year]);
  }
}

function findInAllArchives(id: string | number): { client: Client; year: number } | null {
  const years = getStoredArchiveYears();
  const idStr = String(id).trim();
  for (const year of years) {
    const clients = getStoredArchivedClients(year);
    const found = clients.find(
      (c) => String(c.id).trim() === idStr || (c.registrationNumber && String(c.registrationNumber).trim() === idStr),
    );
    if (found) {
      return { client: found, year };
    }
  }
  return null;
}

function getStoredClients(): Client[] {
  try {
    const stored = window.localStorage.getItem(CLIENTS_STORAGE_KEY);
    const clients: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(clients) ? (clients as Client[]).filter((c) => !c.isArchived) : [];
  } catch {
    return [];
  }
}

function storeClients(clients: Client[]) {
  // Deduplicate before saving by unique ID and unique registrationNumber / name
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const uniqueClients: Client[] = [];

  for (const c of clients) {
    const idKey = String(c.id).trim();
    const nameKey = (c.name || '').trim().toLowerCase();
    if (seenIds.has(idKey) || (nameKey && seenNames.has(nameKey))) {
      continue;
    }
    seenIds.add(idKey);
    if (nameKey) seenNames.add(nameKey);
    uniqueClients.push(c);
  }

  window.localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(uniqueClients));
}

function ensureDemoClients(): Client[] {
  // Purge any old demo data on first run after update
  if (!window.localStorage.getItem(DEMO_PURGED_KEY)) {
    const stored = getStoredClients();
    const purged = stored.filter(
      (c) => !DEMO_IDS.has(String(c.id)) && !DEMO_NAMES.has((c.name || '').trim().toLowerCase()),
    );
    storeClients(purged);
    window.localStorage.setItem(DEMO_PURGED_KEY, 'true');
  }
  return getStoredClients();
}

// ─── History Helpers ─────────────────────────────────────────────────────────

function createHistoryId(): string {
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export function createHistoryEntry(
  action: HistoryActionType,
  summary: string,
  extra?: Partial<Pick<ClientHistoryEntry, 'diffs' | 'amount' | 'note'>>,
): ClientHistoryEntry {
  return {
    id: createHistoryId(),
    timestamp: nowISO(),
    action,
    summary,
    ...extra,
  };
}

function stringify(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (Array.isArray(val)) return val.join('، ');
  return String(val);
}

/** Compare two client snapshots and return an array of diffs for tracked fields. */
function diffClients(oldC: Client, newC: Partial<Client>): HistoryDiff[] {
  const tracked: (keyof Client)[] = [
    'name', 'phone', 'birthDate', 'birthPlace', 'email', 'address',
    'training', 'registrationNumber', 'registrationDate',
    'obtainedCategories',
  ];
  const diffs: HistoryDiff[] = [];
  for (const field of tracked) {
    const oldVal = stringify(oldC[field]);
    const newVal = stringify(newC[field]);
    if (oldVal !== newVal) {
      diffs.push({
        field,
        label: FIELD_LABELS[field] || field,
        oldValue: oldVal || undefined,
        newValue: newVal || undefined,
      });
    }
  }
  if (oldC.photo !== newC.photo && (oldC.photo || newC.photo)) {
    diffs.push({
      field: 'photo',
      label: FIELD_LABELS['photo'] || 'صورة المتدرب',
      oldValue: oldC.photo ? 'صورة مرفقة' : 'بدون صورة',
      newValue: newC.photo ? 'صورة جديدة' : 'تم حذف الصورة',
    });
  }
  return diffs;
}

function formatHistoryDate(value?: string): string {
  if (!value) return 'غير محدد';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return new Intl.DateTimeFormat('ar-DZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function attendanceValue(value: unknown): string {
  if (value === true) return 'نعم';
  if (value === false) return 'لا';
  if (typeof value === 'string' && value.startsWith('data:image/')) return 'صورة مرفقة';
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function makeDiff(field: string, label: string, oldValue: unknown, newValue: unknown): HistoryDiff | null {
  const oldText = attendanceValue(oldValue);
  const newText = attendanceValue(newValue);
  // Image data is intentionally condensed above; compare the original values
  // so replacing one photo with another is still recorded.
  const isPhoto = field === 'attendance.photo';
  return (isPhoto ? oldValue === newValue : oldText === newText) ? null : {
    field,
    label,
    oldValue: oldText || undefined,
    newValue: newText || undefined,
  };
}

function dateValue(value?: string): string {
  return value ? formatHistoryDate(value) : '';
}

function describeDiffs(diffs: HistoryDiff[]): string {
  return diffs
    .map((diff) => `${diff.label}: من «${diff.oldValue || 'فارغ'}» إلى «${diff.newValue || 'فارغ'}»`)
    .join('، ');
}

type AttendanceChange = {
  diffs: HistoryDiff[];
  examChanges: Array<{ oldExam?: AttendanceExam; newExam?: AttendanceExam }>;
  summaries: string[];
};

function describeLesson(lesson: AttendanceLesson | undefined, kind: string): string {
  if (!lesson) return kind;
  return `${kind} رقم ${lesson.num}${lesson.title ? ` «${lesson.title}»` : ''}`;
}

/**
 * Turn attendance-card edits into useful journal data.  The card is edited a
 * cell at a time, so storing the affected lesson/exam and its before/after
 * values is far more useful than one generic "card updated" event.
 */
function diffAttendance(oldCard?: AttendanceCard, newCard?: AttendanceCard): AttendanceChange | null {
  if (!newCard || JSON.stringify(oldCard || {}) === JSON.stringify(newCard)) return null;

  const diffs: HistoryDiff[] = [];
  const summaries: string[] = [];
  const examChanges: AttendanceChange['examChanges'] = [];
  const oldAttendance = oldCard || ({} as AttendanceCard);

  (Object.keys(ATTENDANCE_FIELD_LABELS) as Array<keyof typeof ATTENDANCE_FIELD_LABELS>).forEach((field) => {
    const isDate = field === 'submissionDate' || field === 'issueDate';
    const diff = makeDiff(
      `attendance.${field}`,
      ATTENDANCE_FIELD_LABELS[field],
      isDate ? dateValue(oldAttendance[field] as string | undefined) : oldAttendance[field],
      isDate ? dateValue(newCard[field] as string | undefined) : newCard[field],
    );
    if (diff) diffs.push(diff);
  });

  const compareLessons = (
    key: 'codeLessons' | 'drivingLessons',
    kind: string,
  ) => {
    const oldLessons = new Map((oldAttendance[key] || []).map((lesson) => [lesson.num, lesson]));
    const newLessons = new Map((newCard[key] || []).map((lesson) => [lesson.num, lesson]));
    const lessonNumbers = new Set([...oldLessons.keys(), ...newLessons.keys()]);

    for (const num of lessonNumbers) {
      const oldLesson = oldLessons.get(num);
      const newLesson = newLessons.get(num);
      const label = describeLesson(newLesson || oldLesson, kind);
      const lessonDiffs = [
        makeDiff(`${key}.${num}.date`, `${label} — التاريخ`, dateValue(oldLesson?.date), dateValue(newLesson?.date)),
        makeDiff(`${key}.${num}.time`, `${label} — التوقيت`, oldLesson?.time, newLesson?.time),
        makeDiff(`${key}.${num}.signed`, `${label} — تم التأشير عليها`, oldLesson?.signed, newLesson?.signed),
      ].filter((diff): diff is HistoryDiff => Boolean(diff));
      if (lessonDiffs.length === 0) continue;

      diffs.push(...lessonDiffs);
      if (oldLesson?.date !== newLesson?.date && newLesson?.date) {
        summaries.push(`تم تسجيل ${label} بتاريخ ${formatHistoryDate(newLesson.date)}${newLesson.time ? ` الساعة ${newLesson.time}` : ''}`);
      } else {
        summaries.push(`تم تعديل ${label}`);
      }
    }
  };

  compareLessons('codeLessons', 'حصة قانون المرور');
  compareLessons('drivingLessons', 'حصة السياقة والمناورات');

  const oldExams = new Map((oldAttendance.exams || []).map((exam) => [exam.num, exam]));
  const newExams = new Map((newCard.exams || []).map((exam) => [exam.num, exam]));
  const examNumbers = new Set([...oldExams.keys(), ...newExams.keys()]);
  for (const num of examNumbers) {
    const oldExam = oldExams.get(num);
    const newExam = newExams.get(num);
    const label = `محاولة الامتحان رقم ${num}`;
    const examDiffs = [
      makeDiff(`exams.${num}.date`, `${label} — التاريخ`, dateValue(oldExam?.date), dateValue(newExam?.date)),
      makeDiff(`exams.${num}.observation`, `${label} — النتيجة/الملاحظة`, oldExam?.observation, newExam?.observation),
      makeDiff(`exams.${num}.examiner`, `${label} — الممتحن`, oldExam?.examiner, newExam?.examiner),
    ].filter((diff): diff is HistoryDiff => Boolean(diff));
    if (examDiffs.length === 0) continue;

    diffs.push(...examDiffs);
    examChanges.push({ oldExam, newExam });
  }

  return { diffs, examChanges, summaries };
}

/** Build all history entries for a client update (info + stage + payment + docs). */
function buildUpdateHistory(oldC: Client, newC: Partial<Client>): ClientHistoryEntry[] {
  const entries: ClientHistoryEntry[] = [];

  // Info field changes
  const infoDiffs = diffClients(oldC, newC);
  if (infoDiffs.length > 0) {
    entries.push(createHistoryEntry('info_update', `تم تعديل بيانات المتدرب — ${describeDiffs(infoDiffs)}`, { diffs: infoDiffs }));
  }

  // Older client records may not yet contain a card.  Compare against the
  // blank card they would have received, so opening the card does not create
  // dozens of false "unchecked lesson" changes.
  const attendanceChange = diffAttendance(
    oldC.attendance || createInitialAttendanceCard(oldC.registrationDate),
    newC.attendance,
  );

  // Stage change. A successful exam and its promotion are one event, so the
  // journal reads as one complete story rather than an exam entry plus an
  // unrelated "stage changed" entry.
  const oldStage = oldC.stage || 'قانون المرور';
  const newStage = newC.stage || oldStage;
  const resultChange = attendanceChange?.examChanges.find(({ oldExam, newExam }) =>
    Boolean(
      newExam?.date &&
      newExam.observation &&
      newExam.observation !== oldExam?.observation &&
      ['ناجح', 'راسب', 'غائب'].includes(newExam.observation),
    )
  );
  let stageWasLoggedWithExam = false;

  if (resultChange?.newExam) {
    const { oldExam, newExam } = resultChange;
    const result = newExam.observation as 'ناجح' | 'راسب' | 'غائب';
    const examDiffs = (attendanceChange?.diffs || []).filter((diff) =>
      diff.field.startsWith(`exams.${newExam.num}.`),
    );
    const date = formatHistoryDate(newExam.date);
    let summary: string;

    if (result === 'ناجح') {
      summary = `نجح في امتحان مرحلة «${oldStage}» بتاريخ ${date}`;
      if (newStage !== oldStage) {
        summary += `، وتمت ترقيته من «${oldStage}» إلى «${newStage}»`;
        examDiffs.push({ field: 'stage', label: 'مرحلة التكوين', oldValue: oldStage, newValue: newStage });
        stageWasLoggedWithExam = true;
      }
    } else if (result === 'راسب') {
      summary = `كانت نتيجة امتحان مرحلة «${oldStage}» بتاريخ ${date}: راسب`;
    } else {
      summary = `تغيب عن امتحان مرحلة «${oldStage}» بتاريخ ${date}`;
    }

    entries.push(createHistoryEntry('exam_result', summary, { diffs: examDiffs }));
  }

  if (newStage !== oldStage && !stageWasLoggedWithExam) {
    entries.push(createHistoryEntry('stage_change', `تغيير المرحلة من "${oldStage}" إلى "${newStage}"`, {
      diffs: [{ field: 'stage', label: 'مرحلة التكوين', oldValue: oldStage, newValue: newStage }],
    }));
  }

  // Payment change
  const oldPaid = Number(oldC.paidAmount ?? 0);
  const newPaid = Number(newC.paidAmount ?? oldPaid);
  if (newPaid !== oldPaid) {
    const diff = newPaid - oldPaid;
    if (diff > 0) {
      const remaining = Math.max(0, Number(newC.totalAmount ?? oldC.totalAmount ?? 35000) - newPaid);
      entries.push(createHistoryEntry('payment', `تم تسديد دفعة بمبلغ ${new Intl.NumberFormat('ar-DZ').format(diff)} د.ج — المتبقي: ${new Intl.NumberFormat('ar-DZ').format(remaining)} د.ج`, { amount: diff }));
    } else {
      const paidDiff: HistoryDiff = {
        field: 'paidAmount',
        label: 'إجمالي المبلغ المدفوع',
        oldValue: `${oldPaid}`,
        newValue: `${newPaid}`,
      };
      entries.push(createHistoryEntry(
        'payment',
        `تم تصحيح إجمالي المبلغ المدفوع — ${describeDiffs([paidDiff])}`,
        { amount: diff, diffs: [paidDiff] },
      ));
    }
  }

  // Total amount change
  const oldTotal = Number(oldC.totalAmount ?? 35000);
  const newTotal = Number(newC.totalAmount ?? oldTotal);
  if (newTotal !== oldTotal) {
    const totalDiff = { field: 'totalAmount', label: 'المبلغ الإجمالي', oldValue: `${oldTotal}`, newValue: `${newTotal}` };
    entries.push(createHistoryEntry('info_update', `تم تعديل المبلغ الإجمالي — ${describeDiffs([totalDiff])}`, {
      diffs: [totalDiff],
    }));
  }

  // Document changes
  const oldDocs = new Set(oldC.receivedDocuments || []);
  const newDocs = new Set((newC.receivedDocuments as string[] | undefined) || [...oldDocs]);
  const addedDocs = [...newDocs].filter((d) => !oldDocs.has(d));
  const removedDocs = [...oldDocs].filter((d) => !newDocs.has(d));
  if (addedDocs.length > 0 || removedDocs.length > 0) {
    const docNames = (ids: string[]) =>
      ids.map((id) => {
        const doc = (oldC.documents || []).find((d) => d.id === id);
        return doc ? doc.title : id;
      });
    const parts: string[] = [];
    if (addedDocs.length > 0) parts.push(`استلام: ${docNames(addedDocs).join('، ')}`);
    if (removedDocs.length > 0) parts.push(`سحب: ${docNames(removedDocs).join('، ')}`);
    entries.push(createHistoryEntry('document_update', `تحديث وثائق الملف — ${parts.join(' | ')}`));
  }

  // Record exact attendance-card edits: the field/lesson/exam and every value
  // before and after it. Standard exam results are already recorded above.
  if (attendanceChange) {
    const resultExamNumber = resultChange?.newExam?.num;
    const remainingDiffs = attendanceChange.diffs.filter(
      (diff) => resultExamNumber === undefined || !diff.field.startsWith(`exams.${resultExamNumber}.`),
    );
    if (remainingDiffs.length > 0) {
      const affectedLessons = attendanceChange.summaries;
      const remainingExamNumbers = attendanceChange.examChanges
        .map((change) => change.newExam?.num ?? change.oldExam?.num)
        .filter((num): num is number => num !== undefined && num !== resultExamNumber);
      const summaryParts = [...affectedLessons];
      if (remainingExamNumbers.length > 0) {
        summaryParts.push(`تم تعديل محاولة الامتحان رقم ${remainingExamNumbers.join('، ')}`);
      }
      if (summaryParts.length === 0) {
        summaryParts.push(`تم تعديل: ${remainingDiffs.map((diff) => diff.label).join('، ')}`);
      }
      entries.push(createHistoryEntry('attendance', summaryParts.join(' — '), { diffs: remainingDiffs }));
    }
  }

  return entries;
}

export const clientService = {
  create(input: CreateClientInput): Promise<CreatedClient> {
    const regNum = input.registrationNumber?.trim() || undefined;
    const agreedAmount = Number(input.totalAmount ?? 35000);
    const creationHistory: ClientHistoryEntry[] = [
      createHistoryEntry(
        'creation',
        `تم تسجيل المتدرب — تكوين صنف ${input.training || 'B'} — المبلغ المتفق عليه: ${new Intl.NumberFormat('ar-DZ').format(agreedAmount)} د.ج`,
      ),
    ];
    const initialPaid = Number(input.paidAmount ?? 0);
    if (initialPaid > 0) {
      const remaining = Math.max(0, Number(input.totalAmount ?? 35000) - initialPaid);
      creationHistory.push(
        createHistoryEntry('payment', `دفعة أولى بمبلغ ${new Intl.NumberFormat('ar-DZ').format(initialPaid)} د.ج — المتبقي: ${new Intl.NumberFormat('ar-DZ').format(remaining)} د.ج`, { amount: initialPaid }),
      );
    }
    if (input.receivedDocuments.length > 0) {
      const titles = input.receivedDocuments.map((documentId) =>
        input.documents.find((document) => document.id === documentId)?.title || documentId,
      );
      creationHistory.push(createHistoryEntry(
        'document_update',
        `الوثائق المستلمة عند فتح الملف: ${titles.join('، ')}`,
      ));
    }
    const attendanceCard = input.attendance || createInitialAttendanceCard(input.registrationDate);
    const client: Client = {
      id: crypto.randomUUID(),
      ...input,
      registrationNumber: regNum,
      paidAmount: Number(input.paidAmount ?? 0),
      totalAmount: agreedAmount,
      stage: input.stage || 'قانون المرور',
      attendance: attendanceCard,
      color: '#e8e5ff',
      history: creationHistory,
    };
    storeClients([...ensureDemoClients(), client]);
    if (window.autoEcole) {
      try {
        void window.autoEcole.clients.create({ ...input, registrationNumber: regNum, history: creationHistory });
      } catch (e) {
        console.warn('Electron sqlite create warning:', e);
      }
    }
    return Promise.resolve({ id: client.id });
  },

  list(): Promise<Client[]> {
    return Promise.resolve(ensureDemoClients().filter((c) => !c.isArchived));
  },

  getArchiveYears(): Promise<number[]> {
    const years = getStoredArchiveYears();
    const currentYear = new Date().getFullYear();
    if (years.length === 0) {
      return Promise.resolve([currentYear]);
    }
    if (!years.includes(currentYear)) {
      return Promise.resolve([currentYear, ...years].sort((a, b) => b - a));
    }
    return Promise.resolve(years);
  },

  listArchived(year: number): Promise<Client[]> {
    return Promise.resolve(getStoredArchivedClients(year));
  },

  archiveClient(id: string | number, targetYear?: number): Promise<Client> {
    const idStr = String(id).trim();
    const clients = ensureDemoClients();
    const clientIndex = clients.findIndex(
      (c) => String(c.id).trim() === idStr || (c.registrationNumber && String(c.registrationNumber).trim() === idStr),
    );

    if (clientIndex === -1) {
      return Promise.reject(new Error('تعذر العثور على ملف المتدرب في قائمة العملاء الحاليين.'));
    }

    const client = clients[clientIndex];
    if (client.stage !== 'منتهي') {
      return Promise.reject(new Error('لا يمكن أرشفة ملف المتدرب إلا بعد إنهاء التكوين بنجاح (المرحلة: منتهي).'));
    }

    const currentYear = new Date().getFullYear();
    const year = targetYear && targetYear >= 2000
      ? targetYear
      : client.registrationDate
      ? (new Date(client.registrationDate).getFullYear() || currentYear)
      : currentYear;

    const historyEntry = createHistoryEntry('archive', `تمت أرشفة ملف المتدرب في أرشيف سنة ${year}`);
    const updatedHistory = [...(client.history || []), historyEntry];

    const archivedClient: Client = {
      ...client,
      isArchived: true,
      archiveYear: year,
      archivedAt: nowISO(),
      history: updatedHistory,
    };

    // Remove from active clients
    const remainingActive = clients.filter((_, idx) => idx !== clientIndex);
    storeClients(remainingActive);

    // Save to year archive
    const existingArchived = getStoredArchivedClients(year).filter(
      (c) => String(c.id).trim() !== idStr && (!c.registrationNumber || String(c.registrationNumber).trim() !== idStr),
    );
    storeArchivedClients(year, [archivedClient, ...existingArchived]);

    return Promise.resolve(archivedClient);
  },

  restoreClient(id: string | number): Promise<Client> {
    const idStr = String(id).trim();
    const archivedResult = findInAllArchives(idStr);

    if (!archivedResult) {
      return Promise.reject(new Error('تعذر العثور على ملف المتدرب في الأرشيف.'));
    }

    const { client, year } = archivedResult;
    const historyEntry = createHistoryEntry('restore', 'تم استرجاع ملف المتدرب من الأرشيف إلى قائمة العملاء الحاليين');
    const updatedHistory = [...(client.history || []), historyEntry];

    const restoredClient: Client = {
      ...client,
      isArchived: false,
      archiveYear: undefined,
      archivedAt: undefined,
      history: updatedHistory,
    };

    // Remove from year archive
    const existingArchived = getStoredArchivedClients(year).filter(
      (c) => String(c.id).trim() !== idStr && (!c.registrationNumber || String(c.registrationNumber).trim() !== idStr),
    );
    storeArchivedClients(year, existingArchived);

    // Add back to active clients
    const activeClients = ensureDemoClients().filter(
      (c) => String(c.id).trim() !== idStr && (!c.registrationNumber || String(c.registrationNumber).trim() !== idStr),
    );
    storeClients([restoredClient, ...activeClients]);

    return Promise.resolve(restoredClient);
  },

  find(id: string): Promise<Client | null> {
    const idStr = String(id).trim();
    const activeClients = ensureDemoClients();
    const foundActive = activeClients.find(
      (client) => String(client.id).trim() === idStr || (client.registrationNumber && String(client.registrationNumber).trim() === idStr),
    );
    if (foundActive) {
      return Promise.resolve(foundActive);
    }
    const archivedResult = findInAllArchives(idStr);
    return Promise.resolve(archivedResult ? archivedResult.client : null);
  },

  update(id: string, changes: Client): Promise<Client> {
    const idStr = String(id).trim();
    const clients = ensureDemoClients();
    const clientIndex = clients.findIndex(
      (client) => String(client.id).trim() === idStr || (client.registrationNumber && String(client.registrationNumber).trim() === idStr),
    );

    if (clientIndex !== -1) {
      const oldClient = clients[clientIndex];
      const newHistoryEntries = buildUpdateHistory(oldClient, changes);
      const existingHistory = oldClient.history || [];
      const mergedHistory = [...existingHistory, ...newHistoryEntries];
      const updatedClient = { ...oldClient, ...changes, id: oldClient.id, history: mergedHistory };
      const updatedClients = [...clients];
      updatedClients[clientIndex] = updatedClient;
      storeClients(updatedClients);
      return Promise.resolve(updatedClient);
    }

    // Check if in archive
    const archivedResult = findInAllArchives(idStr);
    if (archivedResult) {
      const { client: oldClient, year } = archivedResult;
      const newHistoryEntries = buildUpdateHistory(oldClient, changes);
      const existingHistory = oldClient.history || [];
      const mergedHistory = [...existingHistory, ...newHistoryEntries];
      const updatedClient = { ...oldClient, ...changes, id: oldClient.id, history: mergedHistory };
      const yearArchived = getStoredArchivedClients(year);
      const idx = yearArchived.findIndex(
        (c) => String(c.id).trim() === idStr || (c.registrationNumber && String(c.registrationNumber).trim() === idStr),
      );
      if (idx !== -1) {
        yearArchived[idx] = updatedClient;
      }
      storeArchivedClients(year, yearArchived);
      return Promise.resolve(updatedClient);
    }

    return Promise.reject(new Error('تعذر العثور على ملف العميل.'));
  },

  /** Record a payment as a single financial event, with an optional receipt note. */
  recordPayment(id: string, amount: number, note?: string): Promise<Client> {
    const idStr = String(id).trim();
    const clients = ensureDemoClients();
    const clientIndex = clients.findIndex(
      (client) => String(client.id).trim() === idStr || (client.registrationNumber && String(client.registrationNumber).trim() === idStr),
    );

    if (!Number.isFinite(amount) || amount <= 0) return Promise.reject(new Error('يرجى إدخال مبلغ صحيح.'));

    if (clientIndex !== -1) {
      const oldClient = clients[clientIndex];
      const paidAmount = Number(oldClient.paidAmount ?? 0) + amount;
      const remaining = Math.max(0, Number(oldClient.totalAmount ?? 35000) - paidAmount);
      const noteSuffix = note?.trim() ? ` — ملاحظة: ${note.trim()}` : '';
      const entry = createHistoryEntry(
        'payment',
        `تم تسديد دفعة بمبلغ ${new Intl.NumberFormat('ar-DZ').format(amount)} د.ج — المتبقي: ${new Intl.NumberFormat('ar-DZ').format(remaining)} د.ج${noteSuffix}`,
        { amount, note: note?.trim() || undefined },
      );
      const updatedClient = { ...oldClient, paidAmount, history: [...(oldClient.history || []), entry] };
      const updatedClients = [...clients];
      updatedClients[clientIndex] = updatedClient;
      storeClients(updatedClients);
      return Promise.resolve(updatedClient);
    }

    const archivedResult = findInAllArchives(idStr);
    if (archivedResult) {
      const { client: oldClient, year } = archivedResult;
      const paidAmount = Number(oldClient.paidAmount ?? 0) + amount;
      const remaining = Math.max(0, Number(oldClient.totalAmount ?? 35000) - paidAmount);
      const noteSuffix = note?.trim() ? ` — ملاحظة: ${note.trim()}` : '';
      const entry = createHistoryEntry(
        'payment',
        `تم تسديد دفعة بمبلغ ${new Intl.NumberFormat('ar-DZ').format(amount)} د.ج — المتبقي: ${new Intl.NumberFormat('ar-DZ').format(remaining)} د.ج${noteSuffix}`,
        { amount, note: note?.trim() || undefined },
      );
      const updatedClient = { ...oldClient, paidAmount, history: [...(oldClient.history || []), entry] };
      const yearArchived = getStoredArchivedClients(year);
      const idx = yearArchived.findIndex(
        (c) => String(c.id).trim() === idStr || (c.registrationNumber && String(c.registrationNumber).trim() === idStr),
      );
      if (idx !== -1) {
        yearArchived[idx] = updatedClient;
      }
      storeArchivedClients(year, yearArchived);
      return Promise.resolve(updatedClient);
    }

    return Promise.reject(new Error('تعذر العثور على ملف العميل.'));
  },

  /** Add a manual admin note to the client's history journal. */
  addNote(id: string, noteText: string): Promise<Client> {
    const idStr = String(id).trim();
    const clients = ensureDemoClients();
    const clientIndex = clients.findIndex(
      (client) => String(client.id).trim() === idStr || (client.registrationNumber && String(client.registrationNumber).trim() === idStr),
    );

    if (clientIndex !== -1) {
      const oldClient = clients[clientIndex];
      const entry = createHistoryEntry('note', noteText, { note: noteText });
      const updatedHistory = [...(oldClient.history || []), entry];
      const updatedClient = { ...oldClient, history: updatedHistory };
      const updatedClients = [...clients];
      updatedClients[clientIndex] = updatedClient;
      storeClients(updatedClients);
      return Promise.resolve(updatedClient);
    }

    const archivedResult = findInAllArchives(idStr);
    if (archivedResult) {
      const { client: oldClient, year } = archivedResult;
      const entry = createHistoryEntry('note', noteText, { note: noteText });
      const updatedHistory = [...(oldClient.history || []), entry];
      const updatedClient = { ...oldClient, history: updatedHistory };
      const yearArchived = getStoredArchivedClients(year);
      const idx = yearArchived.findIndex(
        (c) => String(c.id).trim() === idStr || (c.registrationNumber && String(c.registrationNumber).trim() === idStr),
      );
      if (idx !== -1) {
        yearArchived[idx] = updatedClient;
      }
      storeArchivedClients(year, yearArchived);
      return Promise.resolve(updatedClient);
    }

    return Promise.reject(new Error('تعذر العثور على ملف العميل.'));
  },

  /** Permanently delete a client by ID. */
  delete(id: string): Promise<void> {
    const idStr = String(id).trim();
    const clients = ensureDemoClients();
    const filtered = clients.filter(
      (c) => String(c.id).trim() !== idStr && !(c.registrationNumber && String(c.registrationNumber).trim() === idStr),
    );
    if (filtered.length === clients.length) {
      return Promise.reject(new Error('تعذر العثور على العميل.'));
    }
    storeClients(filtered);
    return Promise.resolve();
  },
};

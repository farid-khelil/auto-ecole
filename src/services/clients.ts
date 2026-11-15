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
const DEMO_CLIENTS_SEEDED_KEY = 'auto-ecole.demo-clients-seeded-v12';
const ARCHIVE_STORAGE_PREFIX = 'auto-ecole.archive.';
const ARCHIVE_YEARS_KEY = 'auto-ecole.archive-years';

const standardDocuments: ClientDocument[] = [
  { id: 'birth-certificate', title: 'شهادة ميلاد' },
  { id: 'residence-certificate', title: 'شهادة الإقامة' },
  { id: 'medical-certificate', title: 'شهادة طبية' },
  { id: 'identity-copy', title: 'نسخة من بطاقة التعريف الوطنية أو رخصة السياقة' },
  { id: 'identity-photos', title: '6 صور شمسية' },
];

const demoClients: Client[] = [
  {
    id: '001',
    registrationNumber: '001',
    name: 'أمين خليفي',
    phone: '0551 24 68 91',
    birthDate: '2003-05-12',
    birthPlace: 'الجزائر العاصمة',
    email: 'amine.khelifi@example.com',
    address: 'الجزائر العاصمة',
    training: 'B',
    registrationDate: '2026-10-18',
    receivedDocuments: ['birth-certificate', 'residence-certificate', 'medical-certificate', 'identity-copy'],
    documents: standardDocuments,
    paidAmount: 35000,
    totalAmount: 35000,
    stage: 'مناورات',
    color: '#ece5f8',
    history: [
      { id: 'demo-h1', timestamp: '2026-10-18T09:00:00.000Z', action: 'creation', summary: 'تم تسجيل المتدرب — تكوين صنف B' },
      { id: 'demo-h2', timestamp: '2026-10-18T09:05:00.000Z', action: 'document_update', summary: 'تحديث وثائق الملف — استلام: شهادة ميلاد، شهادة الإقامة' },
      { id: 'demo-h3', timestamp: '2026-10-18T10:00:00.000Z', action: 'payment', summary: 'دفعة أولى بمبلغ 15٬000 د.ج — المتبقي: 20٬000 د.ج', amount: 15000 },
      { id: 'demo-h4', timestamp: '2026-10-19T14:30:00.000Z', action: 'document_update', summary: 'تحديث وثائق الملف — استلام: شهادة طبية، نسخة من بطاقة التعريف الوطنية أو رخصة السياقة' },
      { id: 'demo-h5', timestamp: '2026-10-20T11:00:00.000Z', action: 'payment', summary: 'تم تسديد دفعة بمبلغ 20٬000 د.ج — المتبقي: 0 د.ج', amount: 20000 },
      { id: 'demo-h6', timestamp: '2026-10-21T08:30:00.000Z', action: 'stage_change', summary: 'تغيير المرحلة من "قانون المرور" إلى "مناورات"', diffs: [{ field: 'stage', label: 'مرحلة التكوين', oldValue: 'قانون المرور', newValue: 'مناورات' }] },
      { id: 'demo-h7', timestamp: '2026-10-22T09:15:00.000Z', action: 'note', summary: 'المترشح ملتزم بالحصص — أداء جيد في المناورات', note: 'المترشح ملتزم بالحصص — أداء جيد في المناورات' },
    ],
  },
  {
    id: '002',
    registrationNumber: '002',
    name: 'سارة بن علي',
    phone: '0662 18 42 05',
    birthDate: '2004-11-22',
    birthPlace: 'بومرداس',
    email: 'sara.benali@example.com',
    address: 'بومرداس',
    training: 'B',
    registrationDate: '2026-10-14',
    receivedDocuments: ['birth-certificate', 'residence-certificate'],
    documents: standardDocuments,
    paidAmount: 15000,
    totalAmount: 35000,
    stage: 'قانون المرور',
    color: '#ffe9d5',
    history: [
      { id: 'demo-s1', timestamp: '2026-10-14T08:30:00.000Z', action: 'creation', summary: 'تم تسجيل المتدرب — تكوين صنف B' },
      { id: 'demo-s2', timestamp: '2026-10-14T08:45:00.000Z', action: 'payment', summary: 'دفعة أولى بمبلغ 15٬000 د.ج — المتبقي: 20٬000 د.ج', amount: 15000 },
      { id: 'demo-s3', timestamp: '2026-10-14T09:00:00.000Z', action: 'document_update', summary: 'تحديث وثائق الملف — استلام: شهادة ميلاد، شهادة الإقامة' },
      { id: 'demo-s4', timestamp: '2026-10-17T10:00:00.000Z', action: 'note', summary: 'تم التواصل هاتفياً — تذكير بموعد حصة قانون المرور', note: 'تم التواصل هاتفياً — تذكير بموعد حصة قانون المرور' },
    ],
  },
  {
    id: '003',
    registrationNumber: '003',
    name: 'ياسين مرابط',
    phone: '0770 56 31 27',
    birthDate: '2001-02-08',
    birthPlace: 'البليدة',
    email: 'yassine.merabet@example.com',
    address: 'البليدة',
    training: 'B',
    registrationDate: '2026-10-08',
    receivedDocuments: ['birth-certificate', 'residence-certificate', 'medical-certificate'],
    documents: standardDocuments,
    paidAmount: 35000,
    totalAmount: 35000,
    stage: 'مناورات',
    color: '#d6f6d6',
    history: [
      { id: 'demo-y1', timestamp: '2026-10-08T10:00:00.000Z', action: 'creation', summary: 'تم تسجيل المتدرب — تكوين صنف B' },
      { id: 'demo-y2', timestamp: '2026-10-08T10:15:00.000Z', action: 'payment', summary: 'دفعة أولى بمبلغ 20٬000 د.ج — المتبقي: 15٬000 د.ج', amount: 20000 },
      { id: 'demo-y3', timestamp: '2026-10-10T14:00:00.000Z', action: 'info_update', summary: 'تم تعديل بيانات المتدرب — رقم الهاتف: من «0770 00 00 00» إلى «0770 56 31 27»', diffs: [{ field: 'phone', label: 'رقم الهاتف', oldValue: '0770 00 00 00', newValue: '0770 56 31 27' }] },
      { id: 'demo-y4', timestamp: '2026-10-12T09:00:00.000Z', action: 'document_update', summary: 'تحديث وثائق الملف — استلام: شهادة ميلاد، شهادة الإقامة، شهادة طبية' },
      { id: 'demo-y5', timestamp: '2026-10-15T16:00:00.000Z', action: 'payment', summary: 'تم تسديد دفعة بمبلغ 15٬000 د.ج — المتبقي: 0 د.ج', amount: 15000 },
      { id: 'demo-y6', timestamp: '2026-10-18T08:00:00.000Z', action: 'stage_change', summary: 'تغيير المرحلة من "قانون المرور" إلى "مناورات"', diffs: [{ field: 'stage', label: 'مرحلة التكوين', oldValue: 'قانون المرور', newValue: 'مناورات' }] },
    ],
  },
  {
    id: '004',
    registrationNumber: '004',
    name: 'هيبة منصوري',
    phone: '0558 72 16 83',
    birthDate: '2005-07-19',
    birthPlace: 'تيبازة',
    email: 'hiba.mansouri@example.com',
    address: 'تيبازة',
    training: 'A',
    registrationDate: '2026-10-02',
    receivedDocuments: ['birth-certificate', 'medical-certificate'],
    documents: standardDocuments,
    paidAmount: 10000,
    totalAmount: 25000,
    stage: 'قانون المرور',
    color: '#fce4e4',
  },
  {
    id: '005',
    registrationNumber: '005',
    name: 'رياض جوادي',
    phone: '0793 45 09 62',
    birthDate: '1999-03-30',
    birthPlace: 'الجزائر العاصمة',
    email: 'riadh.djouadi@example.com',
    address: 'الجزائر العاصمة',
    training: 'B',
    registrationDate: '2026-09-22',
    receivedDocuments: ['birth-certificate', 'residence-certificate', 'medical-certificate', 'identity-copy', 'identity-photos'],
    documents: standardDocuments,
    paidAmount: 35000,
    totalAmount: 35000,
    stage: 'سياقة عامة',
    color: '#e0efff',
  },
  {
    id: '006',
    registrationNumber: '006',
    name: 'لينا ناصر',
    phone: '0561 38 74 20',
    birthDate: '2005-09-02',
    birthPlace: 'المدية',
    email: 'lina.nasser@example.com',
    address: 'المدية',
    training: 'B',
    registrationDate: '2026-09-12',
    receivedDocuments: ['birth-certificate', 'identity-photos'],
    documents: standardDocuments,
    paidAmount: 20000,
    totalAmount: 35000,
    stage: 'قانون المرور',
    color: '#f1ecfa',
  },
  {
    id: '007',
    registrationNumber: '007',
    name: 'كريم بلقاسم',
    phone: '0555 12 34 56',
    birthDate: '1992-04-15',
    birthPlace: 'الجزائر العاصمة',
    email: 'karim.belkacem@example.com',
    address: 'الرويبة',
    training: 'C',
    registrationDate: '2026-08-25',
    receivedDocuments: ['birth-certificate', 'residence-certificate', 'medical-certificate', 'identity-copy'],
    documents: standardDocuments,
    paidAmount: 40000,
    totalAmount: 40000,
    stage: 'سياقة عامة',
    color: '#fff0d5',
  },
  {
    id: '008',
    registrationNumber: '008',
    name: 'مراد حميدي',
    phone: '0661 98 76 54',
    birthDate: '1988-11-03',
    birthPlace: 'البليدة',
    email: 'mourad.hamidi@example.com',
    address: 'بوفاريك',
    training: 'D',
    registrationDate: '2026-08-10',
    receivedDocuments: ['birth-certificate', 'residence-certificate', 'medical-certificate', 'identity-copy'],
    documents: standardDocuments,
    paidAmount: 45000,
    totalAmount: 45000,
    stage: 'مناورات',
    color: '#d6f6f6',
  },
  {
    id: '009',
    registrationNumber: '009',
    name: 'فاطمة الزهراء قاسمي',
    phone: '0552 89 12 34',
    birthDate: '2002-08-14',
    birthPlace: 'وهران',
    email: 'fatima.kacemi@example.com',
    address: 'بئر مراد رايس',
    training: 'B',
    registrationDate: '2026-07-20',
    receivedDocuments: ['birth-certificate', 'residence-certificate', 'medical-certificate'],
    documents: standardDocuments,
    paidAmount: 35000,
    totalAmount: 35000,
    stage: 'سياقة عامة',
    color: '#d6f6d6',
  },
  {
    id: '010',
    registrationNumber: '010',
    name: 'عبد الرحمن طاهري',
    phone: '0772 34 56 78',
    birthDate: '1996-01-28',
    birthPlace: 'تيزي وزو',
    email: 'abderrahmane.tahri@example.com',
    address: 'درارية',
    training: 'C',
    registrationDate: '2026-07-05',
    receivedDocuments: ['birth-certificate', 'identity-copy'],
    documents: standardDocuments,
    paidAmount: 25000,
    totalAmount: 40000,
    stage: 'قانون المرور',
    color: '#ffe9d5',
  },
  {
    id: '011',
    registrationNumber: '011',
    name: 'مريم بوزيد',
    phone: '0664 77 88 99',
    birthDate: '2004-06-17',
    birthPlace: 'سطيف',
    email: 'meriem.bouzid@example.com',
    address: 'القبة',
    training: 'B',
    registrationDate: '2026-06-18',
    receivedDocuments: ['birth-certificate', 'residence-certificate', 'medical-certificate', 'identity-photos'],
    documents: standardDocuments,
    paidAmount: 35000,
    totalAmount: 35000,
    stage: 'سياقة عامة',
    color: '#ece5f8',
  },
  {
    id: '012',
    registrationNumber: '012',
    name: 'وليد لعريبي',
    phone: '0550 11 22 33',
    birthDate: '1998-10-09',
    birthPlace: 'عنابة',
    email: 'walid.laribi@example.com',
    address: 'الشراقة',
    training: 'B',
    registrationDate: '2026-05-24',
    receivedDocuments: ['birth-certificate', 'residence-certificate', 'identity-copy'],
    documents: standardDocuments,
    paidAmount: 35000,
    totalAmount: 35000,
    stage: 'منتهي',
    color: '#e2e8f0',
  },
];

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
  const isCurrentVersion = window.localStorage.getItem(DEMO_CLIENTS_SEEDED_KEY);
  if (!isCurrentVersion) {
    const stored = getStoredClients();
    // Keep any user-created custom clients (those with UUID or not matching demo IDs)
    const demoIds = new Set(demoClients.map((d) => String(d.id)));
    const demoNames = new Set(demoClients.map((d) => d.name.trim().toLowerCase()));
    const customUserClients = stored.filter(
      (c) => !demoIds.has(String(c.id)) && !demoNames.has((c.name || '').trim().toLowerCase())
    );

    const merged = [...demoClients, ...customUserClients];
    storeClients(merged);
    window.localStorage.setItem(DEMO_CLIENTS_SEEDED_KEY, 'true');
    return getStoredClients();
  }

  const stored = getStoredClients();
  // Ensure duplicates in existing storage are filtered out
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const cleaned: Client[] = [];
  let hadDuplicates = false;

  for (const c of stored) {
    const idKey = String(c.id).trim();
    const nameKey = (c.name || '').trim().toLowerCase();
    if (seenIds.has(idKey) || (nameKey && seenNames.has(nameKey))) {
      hadDuplicates = true;
      continue;
    }
    seenIds.add(idKey);
    if (nameKey) seenNames.add(nameKey);
    cleaned.push(c);
  }

  if (hadDuplicates || cleaned.length === 0) {
    const listToSave = cleaned.length > 0 ? cleaned : demoClients;
    storeClients(listToSave);
    return listToSave;
  }

  return cleaned;
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
};

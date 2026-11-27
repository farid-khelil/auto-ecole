import type { Client } from './clients';
import { createInitialAttendanceCard } from './attendance';

export type ExamResult = 'ناجح' | 'راسب' | 'غائب';

export interface CandidatesListRecord {
  id: string;
  depositDate?: string;    // تاريخ الإيداع الخاص بالقائمة
  examDate?: string;       // تاريخ الامتحان
  transmittalNumber?: string; // الرقم المرجعي في جدول الإرسال
  transmittalDate?: string;   // تاريخ التحرير في جدول الإرسال
  createdAt: string;       // تاريخ الإنشاء
  notes?: string;          // ملاحظات
  candidates: Client[];    // قائمة المترشحين المحددين
  results?: Record<string, ExamResult>; // نتائج المترشحين في الامتحان
}

/**
 * A candidates list stores a snapshot so it remains usable if a client is
 * later removed. For active clients, however, profile data is authoritative:
 * resolving it here prevents stale stages, phone numbers, or addresses in a
 * list from disagreeing with the client profile.
 */
export function getCurrentCandidates(
  record: CandidatesListRecord,
  allClients: Client[] = [],
): Client[] {
  if (allClients.length === 0) return record.candidates || [];

  return (record.candidates || []).map((candidate) =>
    allClients.find((client) =>
      String(client.id) === String(candidate.id) ||
      Boolean(candidate.registrationNumber && client.registrationNumber === candidate.registrationNumber),
    ) || candidate,
  );
}

/**
 * Checks whether a training category belongs to Class A or B (أ أو ب).
 * Matches 'A', 'A1', 'B', 'BE' or Arabic 'أ', 'ا', 'ب'.
 * All other categories (C, D, etc.) return false.
 */
export function isClassAB(training?: string): boolean {
  if (!training) return false;
  const clean = training
    .trim()
    .toUpperCase()
    .replace(/^(الصنف|صنف|فئة|الفئة)\s*/, '');
  return (
    clean.startsWith('A') ||
    clean.startsWith('B') ||
    clean.startsWith('أ') ||
    clean.startsWith('ا') ||
    clean.startsWith('ب')
  );
}

/**
 * Formats a candidate's birth date for official candidate lists (النموذج 02):
 * - If only the year is known (e.g. "1975", "1975-00-00", "1975-xx-xx", "xx/xx/1975"),
 *   formats as "xx/xx/YYYY".
 * - If a full date is provided (YYYY-MM-DD or DD/MM/YYYY), formats as "DD/MM/YYYY".
 */
export function formatCandidateBirthDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // 1. Check if already in format xx/xx/YYYY or XX/XX/YYYY or 00/00/YYYY
  const xxMatch = trimmed.match(/^(?:xx|XX|00)[/-](?:xx|XX|00)[/-](\d{4})$/);
  if (xxMatch) {
    return `xx/xx/${xxMatch[1]}`;
  }

  // 2. Check if YYYY-xx-xx or YYYY-XX-XX or YYYY-00-00 or YYYY/00/00
  const yxxMatch = trimmed.match(/^(\d{4})[/-](?:xx|XX|00)[/-](?:xx|XX|00)$/);
  if (yxxMatch) {
    return `xx/xx/${yxxMatch[1]}`;
  }

  // 3. Check if only a 4-digit year: "1975"
  if (/^\d{4}$/.test(trimmed)) {
    return `xx/xx/${trimmed}`;
  }

  // 4. Standard YYYY-MM-DD or DD-MM-YYYY format
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [year, month, day] = parts;
      if (month === '00' || month.toLowerCase() === 'xx' || day === '00' || day.toLowerCase() === 'xx') {
        return `xx/xx/${year}`;
      }
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    if (parts[2].length === 4) {
      const [day, month, year] = parts;
      if (month === '00' || month.toLowerCase() === 'xx' || day === '00' || day.toLowerCase() === 'xx') {
        return `xx/xx/${year}`;
      }
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }

  // 5. Fallback: contains 4-digit year without valid day/month
  const yearMatch = trimmed.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch && (trimmed.toLowerCase().includes('xx') || trimmed.includes('00') || trimmed.length <= 7)) {
    return `xx/xx/${yearMatch[1]}`;
  }

  return trimmed;
}

const STORAGE_KEY = 'auto-ecole.candidates-lists';

export const candidatesListService = {
  async getAll(): Promise<CandidatesListRecord[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as CandidatesListRecord[];
    } catch {
      return [];
    }
  },

  async getById(id: string): Promise<CandidatesListRecord | null> {
    const lists = await this.getAll();
    return lists.find((l) => l.id === id) || null;
  },

  async create(record: Omit<CandidatesListRecord, 'id' | 'createdAt'>): Promise<CandidatesListRecord> {
    const lists = await this.getAll();
    const newRecord: CandidatesListRecord = {
      ...record,
      id: `list-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    lists.unshift(newRecord);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    return newRecord;
  },

  async update(
    id: string,
    changes: Partial<Omit<CandidatesListRecord, 'id' | 'createdAt'>>
  ): Promise<CandidatesListRecord> {
    const lists = await this.getAll();
    const index = lists.findIndex((list) => list.id === id);

    if (index === -1) {
      throw new Error('Candidates list not found');
    }

    const updatedRecord: CandidatesListRecord = {
      ...lists[index],
      ...changes,
    };
    lists[index] = updatedRecord;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    return updatedRecord;
  },

  async delete(id: string): Promise<void> {
    const lists = await this.getAll();
    const filtered = lists.filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },
};

/**
 * Calculates the "تاريخ آخر امتحان" (date of last exam) for a candidate:
 * - If the candidate has previously taken an exam (from attendance or previous lists),
 *   returns the latest prior exam date.
 * - If it is their first exam, returns an empty string ("").
 */
export function getCandidateLastExamDate(
  candidate: Client,
  record: CandidatesListRecord,
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = []
): string {
  const fullClient =
    allClients.find(
      (c) =>
        String(c.id) === String(candidate.id) ||
        (candidate.registrationNumber && c.registrationNumber === candidate.registrationNumber)
    ) || candidate;

  const currentExamDate = record.examDate?.trim();
  const candidateExamDates: string[] = [];

  // 1. Gather exam dates from client attendance card
  if (fullClient.attendance?.exams) {
    for (const ex of fullClient.attendance.exams) {
      if (ex.date && ex.date.trim()) {
        candidateExamDates.push(ex.date.trim());
      }
    }
  }

  // 2. Gather exam dates from other lists
  for (const otherList of allLists) {
    if (otherList.id === record.id) continue;
    if (!otherList.examDate || !otherList.examDate.trim()) continue;

    const inList = (otherList.candidates || []).some(
      (c) =>
        String(c.id) === String(candidate.id) ||
        (candidate.registrationNumber && c.registrationNumber === candidate.registrationNumber)
    );

    if (inList) {
      candidateExamDates.push(otherList.examDate.trim());
    }
  }

  // 3. Filter for strictly prior exam dates (before current list exam date)
  const priorExamDates = candidateExamDates.filter((dateStr) => {
    if (currentExamDate) {
      return dateStr < currentExamDate;
    }
    const today = new Date().toISOString().split('T')[0];
    return dateStr <= today;
  });

  priorExamDates.sort((a, b) => b.localeCompare(a));

  if (priorExamDates.length > 0) {
    return priorExamDates[0];
  }

  return "";
}

/**
 * Checks whether a candidate is taking an exam for the very first time.
 * Returns true ONLY if the candidate has never taken any exam before.
 */
export function isCandidateFirstExam(
  candidate: Client,
  record: CandidatesListRecord,
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = []
): boolean {
  const fullClient =
    allClients.find(
      (c) =>
        String(c.id) === String(candidate.id) ||
        Boolean(candidate.registrationNumber && c.registrationNumber === candidate.registrationNumber)
    ) || candidate;

  // 1. Stage check: anyone whose stage is beyond "قانون المرور" (e.g. مناورات, سياقة عامة, منتهي)
  // has already taken at least one exam previously.
  const stage = (fullClient.stage || candidate.stage || '').trim();
  if (stage && stage !== 'قانون المرور') {
    return false;
  }

  // 2. Check last exam date via getCandidateLastExamDate
  const lastExamDate = getCandidateLastExamDate(candidate, record, allLists, allClients);
  if (lastExamDate) {
    return false;
  }

  // 3. Attendance card check: look for any past exam attempt with a date or recorded observation
  if (fullClient.attendance?.exams) {
    const currentExamDate = record.examDate?.trim();
    for (const ex of fullClient.attendance.exams) {
      if (ex.date && ex.date.trim()) {
        const d = ex.date.trim();
        if (currentExamDate ? d < currentExamDate : true) {
          if (d !== currentExamDate) return false;
        }
      }
      if (ex.observation && ex.observation.trim()) {
        if (!currentExamDate || ex.date?.trim() !== currentExamDate) {
          return false;
        }
      }
    }
  }

  // 4. Other lists check: did they appear in an earlier list or have results in another list?
  const currentExamDate = record.examDate?.trim();
  const currentOrderDate = currentExamDate || record.depositDate?.trim() || record.createdAt?.trim() || '';

  for (const otherList of allLists) {
    if (otherList.id === record.id) continue;

    const inOtherList = (otherList.candidates || []).some(
      (c) =>
        String(c.id) === String(candidate.id) ||
        Boolean(candidate.registrationNumber && c.registrationNumber === candidate.registrationNumber)
    );

    if (!inOtherList) continue;

    const otherResult =
      otherList.results?.[String(candidate.id)] ||
      (candidate.registrationNumber && otherList.results?.[candidate.registrationNumber]);
    if (otherResult) {
      return false;
    }

    const otherOrderDate =
      otherList.examDate?.trim() ||
      otherList.depositDate?.trim() ||
      otherList.createdAt?.trim() ||
      '';

    if (otherOrderDate && currentOrderDate && otherOrderDate < currentOrderDate) {
      return false;
    }

    if (otherList.examDate && otherList.examDate.trim()) {
      if (!currentExamDate || otherList.examDate.trim() < currentExamDate) {
        return false;
      }
    }
  }

  // 5. History check: check if any prior exam result history exists
  if (fullClient.history) {
    const hasPriorExamResult = fullClient.history.some(
      (h) => h.action === 'exam_result'
    );
    if (hasPriorExamResult) {
      return false;
    }
  }

  return true;
}

/**
 * Returns only the candidates in a list record who are taking their exam for the very first time.
 */
export function getFirstTimeCandidates(
  record: CandidatesListRecord,
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = []
): Client[] {
  const currentCandidates = getCurrentCandidates(record, allClients);
  return currentCandidates.filter((c) =>
    isCandidateFirstExam(c, record, allLists, allClients)
  );
}


/**
 * Returns the next training stage in the progression sequence.
 */
export function getNextStage(currentStage?: string): string {
  if (currentStage === 'قانون المرور') return 'مناورات';
  if (currentStage === 'مناورات') return 'سياقة عامة';
  if (currentStage === 'سياقة عامة') return 'منتهي';
  return 'منتهي';
}

/**
 * Applies an exam result ('ناجح' | 'راسب' | 'غائب') to a client:
 * - Updates attendance card exams with the examDate and observation
 * - If 'ناجح': advances the candidate's stage automatically to the next stage
 * - The client service records the detailed journal entry when this snapshot
 *   is saved, using the authoritative before/after values.
 */
export function applyExamResultToClient(
  client: Client,
  examDate: string,
  result: ExamResult,
  stageAtExam?: string
): Client {
  const currentStage = stageAtExam || client.stage || 'قانون المرور';
  const attendance = client.attendance
    ? { ...client.attendance }
    : createInitialAttendanceCard(client.registrationDate);
  const exams = [...(attendance.exams || [])];

  // Look for exam with this exact date, or first slot without a date
  let examIdx = exams.findIndex((e) => e.date === examDate);
  if (examIdx === -1) {
    examIdx = exams.findIndex((e) => !e.date);
  }

  if (examIdx >= 0) {
    exams[examIdx] = {
      ...exams[examIdx],
      date: examDate,
      observation: result,
    };
  } else {
    exams.push({
      num: exams.length + 1,
      date: examDate,
      observation: result,
    });
  }

  attendance.exams = exams;

  let newStage = client.stage;

  if (result === 'ناجح') {
    newStage = getNextStage(currentStage);
  }

  return {
    ...client,
    stage: newStage,
    attendance,
  };
}



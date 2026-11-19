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



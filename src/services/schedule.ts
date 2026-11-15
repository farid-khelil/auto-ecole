import { clientService, type Client } from './clients';
import {
  candidatesListService,
  type CandidatesListRecord,
  getCurrentCandidates,
} from './candidates-lists';

export interface ExamSessionAppointment {
  id: string;
  listId: string;
  stage: string;
  title: string; // e.g. "امتحان مناورات"
  examDate: string; // YYYY-MM-DD
  time: string; // "08:30"
  listReference: string;
  depositDate?: string;
  candidateCount: number;
  candidates: Array<{
    id: string | number;
    name: string;
    registrationNumber?: string;
    stage: string;
    result?: string;
  }>;
  notes?: string;
}

export interface CommonSession {
  id: string;
  title: string;
  type: 'code' | 'driving' | 'exam';
  lessonNum?: number;
  dayOfWeek: number; // 0 = Sunday (الأحد), 1 = Monday (الإثنين), ..., 6 = Saturday (السبت)
  time: string; // HH:MM, e.g. "09:00"
  durationMinutes?: number;
  locationOrRoom?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export const DAYS_OF_WEEK_AR = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

const COMMON_SESSIONS_STORAGE_KEY = 'auto-ecole.common-sessions';
const SESSIONS_SEEDED_KEY = 'auto-ecole.sessions-seeded-v2';
const SESSIONS_CLEANUP_KEY = 'auto-ecole.sessions-cleanup-v3';

const DEFAULT_COMMON_SESSIONS: CommonSession[] = [
  {
    id: 'common-1',
    title: 'حصة قانون المرور الأسبوعية (كود)',
    type: 'code',
    dayOfWeek: 0, // الأحد
    time: '09:00',
    durationMinutes: 90,
    locationOrRoom: 'قاعة الدروس النظرية',
    notes: 'حصة أسبوعية مشتركة لجميع المترشحين الجدد في صنف B',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'common-2',
    title: 'حصة قانون المرور والتمارين',
    type: 'code',
    dayOfWeek: 2, // الثلاثاء
    time: '14:00',
    durationMinutes: 90,
    locationOrRoom: 'قاعة الدروس النظرية',
    notes: 'مراجعة الإشارات وحل تمارين الامتحانات',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'common-3',
    title: 'تدريب تطبيقي - مناورات وسياقة',
    type: 'driving',
    dayOfWeek: 1, // الإثنين
    time: '08:30',
    notes: 'حصة تطبيقية لمناورات الركن (الكرينو)',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'common-4',
    title: 'مراجعة عامة واختبار تجريبي',
    type: 'exam',
    dayOfWeek: 4, // الخميس
    time: '10:00',
    durationMinutes: 60,
    locationOrRoom: 'قاعة الدروس',
    notes: 'امتحان تجريبي للمقبلين على اجتياز امتحان قانون المرور',
    active: true,
    createdAt: new Date().toISOString(),
  },
];

function seedDefaultSessions() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!localStorage.getItem(SESSIONS_SEEDED_KEY)) {
    if (!localStorage.getItem(COMMON_SESSIONS_STORAGE_KEY)) {
      localStorage.setItem(
        COMMON_SESSIONS_STORAGE_KEY,
        JSON.stringify(DEFAULT_COMMON_SESSIONS)
      );
    }
    localStorage.setItem(SESSIONS_SEEDED_KEY, 'true');
  }
}

seedDefaultSessions();

function removeDeprecatedDrivingSessionDetails() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (localStorage.getItem(SESSIONS_CLEANUP_KEY)) return;

  try {
    const raw = localStorage.getItem(COMMON_SESSIONS_STORAGE_KEY);
    if (raw) {
      const sessions = JSON.parse(raw) as CommonSession[];
      const updatedSessions = sessions.map((session) =>
        session.id === 'common-3'
          ? (() => {
              const { durationMinutes, locationOrRoom, ...sessionWithoutDetails } = session;
              return sessionWithoutDetails;
            })()
          : session
      );
      localStorage.setItem(COMMON_SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    }
  } catch {
    // Leave malformed stored schedules untouched; getCommonSessions handles the fallback.
  }

  localStorage.setItem(SESSIONS_CLEANUP_KEY, 'true');
}

removeDeprecatedDrivingSessionDetails();

export const scheduleService = {
  /**
   * Exam appointments grouped by exam session (e.g. "امتحان مناورات")
   * for all candidates in that list, rather than repeating for each candidate.
   */
  async getExamAppointments(): Promise<ExamSessionAppointment[]> {
    try {
      const [lists, allClients] = await Promise.all([
        candidatesListService.getAll(),
        clientService.list(),
      ]);

      const examSessions: ExamSessionAppointment[] = [];

      for (const list of lists) {
        const cleanExamDate = list.examDate?.trim();
        if (!cleanExamDate) continue;

        const currentCandidates = getCurrentCandidates(list, allClients);
        if (currentCandidates.length === 0) continue;

        const ref = list.transmittalNumber
          ? String(list.transmittalNumber)
          : list.depositDate
          ? `قائمة إيداع ${list.depositDate}`
          : `قائمة امتحان ${cleanExamDate}`;

        examSessions.push({
          id: `exam-session-${list.id}`,
          listId: list.id,
          stage: 'امتحان',
          title: 'امتحان',
          examDate: cleanExamDate,
          time: '08:30',
          listReference: ref,
          depositDate: list.depositDate,
          candidateCount: currentCandidates.length,
          candidates: currentCandidates.map((c) => ({
            id: c.id,
            name: c.name,
            registrationNumber: c.registrationNumber,
            stage: c.stage || 'امتحان',
            result: list.results?.[String(c.id)],
          })),
          notes: list.notes || '',
        });
      }

      examSessions.sort((a, b) => a.examDate.localeCompare(b.examDate));
      return examSessions;
    } catch (err) {
      console.error('Failed to get exam sessions:', err);
      return [];
    }
  },

  /** Returns all exam sessions in which a specific candidate is enrolled */
  async getExamsForClient(clientId: string | number): Promise<ExamSessionAppointment[]> {
    const all = await this.getExamAppointments();
    return all.filter((s) => s.candidates.some((c) => String(c.id) === String(clientId)));
  },

  // ─── Common / Recurring Weekly Sessions ──────────────────────────────
  async getCommonSessions(): Promise<CommonSession[]> {
    try {
      const raw = localStorage.getItem(COMMON_SESSIONS_STORAGE_KEY);
      if (!raw) return DEFAULT_COMMON_SESSIONS;
      return JSON.parse(raw) as CommonSession[];
    } catch {
      return DEFAULT_COMMON_SESSIONS;
    }
  },

  async saveCommonSession(
    session: Omit<CommonSession, 'id' | 'createdAt'> & { id?: string }
  ): Promise<CommonSession> {
    const list = await this.getCommonSessions();
    let saved: CommonSession;

    if (session.id) {
      saved = {
        ...session,
        id: session.id,
        createdAt:
          list.find((s) => s.id === session.id)?.createdAt ||
          new Date().toISOString(),
      };
      const idx = list.findIndex((s) => s.id === session.id);
      if (idx !== -1) {
        list[idx] = saved;
      } else {
        list.push(saved);
      }
    } else {
      saved = {
        ...session,
        id: `common-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      list.push(saved);
    }

    localStorage.setItem(COMMON_SESSIONS_STORAGE_KEY, JSON.stringify(list));
    return saved;
  },

  async deleteCommonSession(id: string): Promise<void> {
    const list = await this.getCommonSessions();
    const filtered = list.filter((s) => s.id !== id);
    localStorage.setItem(COMMON_SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
  },

  /**
   * Helper: Generates sequential dates according to active common study sessions.
   * Used by Easy Fill in AttendanceCard.
   */
  async generateSequentialSchedule(
    startDateStr: string,
    type: 'code' | 'driving',
    count: number
  ): Promise<Array<{ date: string; time: string }>> {
    const commonSessions = await this.getCommonSessions();
    const activeSessions = commonSessions.filter(
      (s) => s.active && s.type === type
    );

    const fallbackDays =
      type === 'code'
        ? [
            { day: 0, time: '09:00' }, // Sunday
            { day: 2, time: '14:00' }, // Tuesday
          ]
        : [
            { day: 1, time: '08:30' }, // Monday
            { day: 3, time: '10:00' }, // Wednesday
          ];

    const weeklySlots =
      activeSessions.length > 0
        ? activeSessions.map((s) => ({ day: s.dayOfWeek, time: s.time }))
        : fallbackDays;

    weeklySlots.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));

    const results: Array<{ date: string; time: string }> = [];
    const curDate = startDateStr ? new Date(startDateStr) : new Date();

    if (isNaN(curDate.getTime())) {
      curDate.setTime(Date.now());
    }

    let attempts = 0;
    while (results.length < count && attempts < 500) {
      attempts++;
      const dayOfWeek = curDate.getDay();
      const matchingSlot = weeklySlots.find((slot) => slot.day === dayOfWeek);

      if (matchingSlot) {
        const y = curDate.getFullYear();
        const m = String(curDate.getMonth() + 1).padStart(2, '0');
        const d = String(curDate.getDate()).padStart(2, '0');
        results.push({
          date: `${y}-${m}-${d}`,
          time: matchingSlot.time,
        });
      }

      curDate.setDate(curDate.getDate() + 1);
    }

    return results;
  },
};

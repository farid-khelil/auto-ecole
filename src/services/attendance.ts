export type AttendanceLesson = {
  num: number;
  title: string;
  date?: string;
  time?: string;
  signed?: boolean;
};

export type AttendanceExam = {
  num: number;
  date?: string;
  observation?: string;
  examiner?: string;
};

export type AttendanceCard = {
  fileNumber?: string;
  birthPlace?: string;
  submissionDate?: string;
  obtainedLicenseNumber?: string;
  issueDate?: string;
  schoolName?: string;
  photo?: string;
  codeLessons: AttendanceLesson[];
  drivingLessons: AttendanceLesson[];
  exams: AttendanceExam[];
};

/** Returns the most recent dated exam attempt recorded on an attendance card. */
export function getLatestExam(attendance?: AttendanceCard): AttendanceExam | undefined {
  return attendance?.exams.reduce<AttendanceExam | undefined>((latest, exam) => {
    if (!exam.date) return latest;
    if (!latest?.date || exam.date > latest.date) return exam;
    return latest;
  }, undefined);
}

export const DEFAULT_CODE_LESSONS: { num: number; title: string }[] = [
  { num: 1, title: 'الإشارات الطرقية' },
  { num: 2, title: 'التعرف على أصناف الإشارات' },
  { num: 3, title: 'لوحات الإرشاد' },
  { num: 4, title: 'تابع' },
  { num: 5, title: 'مراجعة عامة' },
  { num: 6, title: 'إشارات ملتقى الطرق' },
  { num: 7, title: 'اللوحات الإضافية' },
  { num: 8, title: 'الإشارات الضوئية' },
  { num: 9, title: 'الإشارات الأفقية' },
  { num: 10, title: 'ملتقى الطرق وأنواعه' },
  { num: 11, title: 'المعالم' },
  { num: 12, title: 'مراجعة عامة وتمارين' },
  { num: 13, title: 'التنظيم' },
  { num: 14, title: 'حالات سحب رخصة السياقة' },
  { num: 15, title: 'الطريق السيار' },
  { num: 16, title: 'الوقاية والأمن عبر الطرق' },
  { num: 17, title: 'السياقة الوقائية' },
  { num: 18, title: 'مراجعة' },
  { num: 19, title: 'المركبة' },
  { num: 20, title: 'البيئة الطرقية' },
  { num: 21, title: 'علم الحوادث' },
  { num: 22, title: 'الإسعاف' },
  { num: 23, title: 'مراجعة' },
  { num: 24, title: 'تمارين' },
  { num: 25, title: 'مراجعة وتمارين' },
];

export const DEFAULT_DRIVING_LESSONS: { num: number; title: string }[] = [
  { num: 1, title: 'إستخدام أجهزة القيادة' },
  { num: 2, title: 'تشغيل السيارة والإنطلاق بالسرعة 1' },
  { num: 3, title: 'السرعة 1 و 2' },
  { num: 4, title: 'السرعة 1 2 3 2' },
  { num: 5, title: 'السرعة 1 2 3 4 3' },
  { num: 6, title: 'السرعة 1 2 3 4 3 2' },
  { num: 7, title: 'الذهاب والإياب على طريق هادئ' },
  { num: 8, title: 'رد فعل المركبة تجاه حركة المقود' },
  { num: 9, title: 'تابع' },
  { num: 10, title: 'مراقبة المسار في خط مستقيم' },
  { num: 11, title: 'تابع' },
  { num: 12, title: 'تابع' },
  { num: 13, title: 'المسار المتعرج' },
  { num: 14, title: 'استخدام المكبس' },
  { num: 15, title: 'تابع' },
  { num: 16, title: 'تابع' },
  { num: 17, title: 'الإنطلاق والتوقف في المرتفعات' },
  { num: 18, title: 'كيفية إستخدام المكابح' },
  { num: 19, title: 'إستخدام علبة السرعة' },
  { num: 20, title: 'التدرب على السير إلى الوراء' },
  { num: 21, title: 'تابع' },
  { num: 22, title: 'تابع' },
  { num: 23, title: 'تابع' },
  { num: 24, title: 'تابع' },
  { num: 25, title: 'تابع' },
  { num: 26, title: 'ملتقى الطرق' },
  { num: 27, title: 'مسالك الدخول' },
  { num: 28, title: 'مراجعة عامة للدروس السابقة' },
  { num: 29, title: 'تابع' },
  { num: 30, title: 'وضعية الجبل' },
];

export function createInitialAttendanceCard(registrationDate?: string): AttendanceCard {
  return {
    fileNumber: '',
    birthPlace: '',
    submissionDate: registrationDate || '',
    obtainedLicenseNumber: '',
    issueDate: '',
    codeLessons: DEFAULT_CODE_LESSONS.map((l) => ({
      ...l,
      date: '',
      time: '',
      signed: false,
    })),
    drivingLessons: DEFAULT_DRIVING_LESSONS.map((l) => ({
      ...l,
      date: '',
      time: '',
      signed: false,
    })),
    exams: Array.from({ length: 15 }, (_, i) => ({
      num: i + 1,
      date: '',
      observation: '',
      examiner: '',
    })),
  };
}

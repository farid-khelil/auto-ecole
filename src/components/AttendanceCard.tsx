import React, { useState, useEffect, useRef } from 'react';
import type { Client } from '../services/clients';
import {
  type AttendanceCard as AttendanceCardType,
  type AttendanceLesson,
  type AttendanceExam,
  createInitialAttendanceCard,
} from '../services/attendance';
import { AttendancePage1Svg, AttendancePage2Svg } from './AttendanceCardSvgs';
import Icon from './Icon.tsx';
import {
  scheduleService,
  type CommonSession,
  type ExamSessionAppointment,
  DAYS_OF_WEEK_AR,
} from '../services/schedule';
import '../styles/attendance-card.css';

interface AttendanceCardProps {
  client: Client;
  isEditing: boolean;
  onUpdate: (updatedAttendance: AttendanceCardType) => void;
}

function formatDateDisplay(d?: string): string {
  if (!d) return '';
  const trimmed = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, day] = trimmed.split('-');
    return `${day}/${m}/${y}`;
  }
  return trimmed;
}

export default function AttendanceCard({
  client,
  isEditing,
  onUpdate,
}: AttendanceCardProps) {
  const attendance: AttendanceCardType =
    client.attendance || createInitialAttendanceCard(client.registrationDate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'driving' | 'code' | 'exams'>('driving');
  const [commonSessions, setCommonSessions] = useState<CommonSession[]>([]);
  const [clientExams, setClientExams] = useState<ExamSessionAppointment[]>([]);
  const [zoomMode, setZoomMode] = useState<'auto' | '100%' | '75%' | '50%'>('auto');
  const [fitScale, setFitScale] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Field values with defaults
  const school =
    attendance.schoolName ||
    localStorage.getItem('auto-ecole.school-name') ||
    'مدرسة النجاح لتعليم السياقة';

  const name = client.name || '';
  const birthDateFormatted = formatDateDisplay(client.birthDate);
  const birth = birthDateFormatted
    ? `${birthDateFormatted}${client.birthPlace ? ' - ' + client.birthPlace : ''}`
    : client.birthPlace || '';
  const address = client.address || '';
  const deposit = formatDateDisplay(attendance.submissionDate || client.registrationDate);
  const fileno = attendance.fileNumber || client.registrationNumber || String(client.id || '');
  const cat = client.training || 'B';
  const phone = client.phone || '';
  const license = attendance.obtainedLicenseNumber || '';
  const date = formatDateDisplay(
    attendance.issueDate || client.registrationDate || new Date().toISOString().slice(0, 10)
  );

  // Responsive fit scale calculation
  useEffect(() => {
    function computeFit() {
      if (zoomMode === '100%') {
        setFitScale(1);
        return;
      }
      if (zoomMode === '75%') {
        setFitScale(0.75);
        return;
      }
      if (zoomMode === '50%') {
        setFitScale(0.5);
        return;
      }
      if (viewportRef.current) {
        const availableWidth = viewportRef.current.clientWidth - 48;
        const pagePixelWidth = (841.92 * 96) / 72; // ~1122.56px
        const scale = Math.min(1, Math.max(0.4, availableWidth / pagePixelWidth));
        setFitScale(scale);
      }
    }

    computeFit();
    window.addEventListener('resize', computeFit);
    return () => window.removeEventListener('resize', computeFit);
  }, [zoomMode]);

  useEffect(() => {
    if (!drawerOpen) return;
    void Promise.all([
      scheduleService.getCommonSessions(),
      scheduleService.getExamsForClient(client.id),
    ]).then(([sessions, exams]) => {
      setCommonSessions(sessions);
      setClientExams(exams);
    }).catch((error) => {
      console.error('Failed to load shared sessions:', error);
    });
  }, [client.id, drawerOpen]);

  function updateField<K extends keyof AttendanceCardType>(field: K, value: AttendanceCardType[K]) {
    const updated: AttendanceCardType = {
      ...attendance,
      [field]: value,
    };
    onUpdate(updated);
  }

  function handleSchoolChange(newSchool: string) {
    localStorage.setItem('auto-ecole.school-name', newSchool);
    updateField('schoolName', newSchool);
  }

  function updateLesson(
    type: 'codeLessons' | 'drivingLessons',
    num: number,
    changes: Partial<AttendanceLesson>
  ) {
    const list = [...attendance[type]];
    const idx = list.findIndex((l) => l.num === num);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...changes };
      updateField(type, list);
    }
  }

  function markLessonToday(type: 'codeLessons' | 'drivingLessons', num: number) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    updateLesson(type, num, { date: today, time, signed: true });
  }

  function updateExam(num: number, changes: Partial<AttendanceExam>) {
    const list = [...attendance.exams];
    const idx = list.findIndex((e) => e.num === num);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...changes };
      updateField('exams', list);
    }
  }

  function markExamToday(num: number) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    updateExam(num, { date: today });
  }

  function applyExamAppointmentToFirstEmptyAttempt(exam: ExamSessionAppointment) {
    const candidate = exam.candidates.find((item) => String(item.id) === String(client.id));
    const observation = candidate?.result ? `النتيجة: ${candidate.result}` : `امتحان ${exam.stage}`;
    const existingAttempt = attendance.exams.find((attempt) => attempt.date === exam.examDate);

    if (existingAttempt) {
      updateExam(existingAttempt.num, { observation });
      return;
    }

    const nextAttempt = attendance.exams.find((attempt) => !attempt.date);
    if (nextAttempt) {
      updateExam(nextAttempt.num, { date: exam.examDate, observation });
    }
  }

  function getNextDateForSession(
    type: 'codeLessons' | 'drivingLessons',
    session: CommonSession
  ): string {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const latestRegisteredDate = attendance[type]
      .map((lesson) => lesson.date)
      .filter((date): date is string => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date)))
      .sort()
      .at(-1);

    const startDate = latestRegisteredDate && latestRegisteredDate >= todayStr
      ? new Date(`${latestRegisteredDate}T00:00:00`)
      : new Date(`${todayStr}T00:00:00`);
    if (latestRegisteredDate && latestRegisteredDate >= todayStr) {
      startDate.setDate(startDate.getDate() + 1);
    }

    const daysUntilSession = (session.dayOfWeek - startDate.getDay() + 7) % 7;
    startDate.setDate(startDate.getDate() + daysUntilSession);
    return `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  }

  function applyCommonSessionToFirstEmptyLesson(session: CommonSession) {
    if (drawerTab === 'exams') return;

    const type = drawerTab === 'code' ? 'codeLessons' : 'drivingLessons';
    const nextLesson = attendance[type].find((lesson) => !lesson.date);
    if (nextLesson) {
      updateLesson(type, nextLesson.num, {
        date: getNextDateForSession(type, session),
        time: session.time,
        signed: true,
      });
    }
  }

  // Open standalone HTML template filled with this candidate data in a new window
  function openStandalonePrint() {
    window.print();
  }

  const completedDriving = attendance.drivingLessons.filter((l) => Boolean(l.date)).length;
  const completedCode = attendance.codeLessons.filter((l) => Boolean(l.date)).length;
  const visibleCommonSessions = drawerTab === 'exams'
    ? []
    : commonSessions.filter(
        (session) => session.active && session.type === (drawerTab === 'code' ? 'code' : 'driving')
      );
  const activeLessonList = drawerTab === 'code'
    ? attendance.codeLessons
    : attendance.drivingLessons;

  return (
    <div className="attendance-card-wrapper">
      {/* Top Toolbar */}
      <div className="attendance-top-bar no-print">
        <div className="attendance-bar-title">
          <h3>بطاقة المداومة والتكوين الرسمية</h3>
          <span className="attendance-bar-hint">
            قانون المرور: {completedCode}/25 &bull; السياقة والمناورات: {completedDriving}/30
          </span>
        </div>

        <div className="attendance-bar-actions">
          {/* Toggle Management Drawer */}
          <button
            type="button"
            className={`card-btn ${drawerOpen ? 'accent' : ''}`}
            onClick={() => setDrawerOpen(!drawerOpen)}
          >
            <span><Icon name={drawerOpen ? 'close' : 'edit'} size={16} /> {drawerOpen ? 'إخفاء المحرر' : 'تعديل الحصص والامتحانات'}</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            className="card-btn primary"
            onClick={openStandalonePrint}
            title="طباعة البطاقة الرسمية على ورقتين A4 Landscape"
          >
            <span><Icon name="print" size={16} /> طباعة البطاقة الرسمية</span>
          </button>
        </div>
      </div>

      {/* Management Drawer (Quick Date & Exam Entry) */}
      {drawerOpen && (
        <div className="attendance-drawer no-print">
          <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h4 className="drawer-title">
                <span>تعديل سجل الحصص والامتحانات الميدانية للمترشح</span>
              </h4>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                تنعكس التعديلات مباشرة على البطاقة الرسمية أدناه وتُحفظ تلقائياً
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {visibleCommonSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="card-btn magic"
                  onClick={() => applyCommonSessionToFirstEmptyLesson(session)}
                  disabled={activeLessonList.every((lesson) => lesson.date)}
                  title={`تسجيل موعد ${DAYS_OF_WEEK_AR[session.dayOfWeek]} الساعة ${session.time} في أول خانة فارغة`}
                >
                  <span><Icon name="calendar" size={16} /> {DAYS_OF_WEEK_AR[session.dayOfWeek]} {session.time}</span>
                </button>
              ))}
              {drawerTab === 'exams' && clientExams.map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  className="card-btn magic"
                  onClick={() => applyExamAppointmentToFirstEmptyAttempt(exam)}
                  disabled={attendance.exams.every((attempt) => attempt.date)}
                  title={`تسجيل ${exam.title} بتاريخ ${exam.examDate} في المحاولة الفارغة التالية`}
                >
                  <span><Icon name="calendar" size={16} /> {exam.title} {exam.examDate}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="drawer-tabs">
            <button
              type="button"
              className={`drawer-tab-btn ${drawerTab === 'driving' ? 'active' : ''}`}
              onClick={() => setDrawerTab('driving')}
            >
              حصص السياقة والمناورات ({completedDriving} / 30)
            </button>
            <button
              type="button"
              className={`drawer-tab-btn ${drawerTab === 'code' ? 'active' : ''}`}
              onClick={() => setDrawerTab('code')}
            >
              حصص قانون المرور ({completedCode} / 25)
            </button>
            <button
              type="button"
              className={`drawer-tab-btn ${drawerTab === 'exams' ? 'active' : ''}`}
              onClick={() => setDrawerTab('exams')}
            >
              سجل الامتحانات ({attendance.exams.filter((e) => e.date).length} محاولات)
            </button>
          </div>

          {/* Driving Lessons Editor */}
          {drawerTab === 'driving' && (
            <div className="drawer-table-wrapper">
              <table className="drawer-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>الحصة</th>
                    <th>موضوع الدرس / نوع الحصة</th>
                    <th style={{ width: '150px' }}>التاريخ</th>
                    <th style={{ width: '120px' }}>التوقيت</th>
                    <th style={{ width: '85px' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.drivingLessons.map((lesson) => (
                    <tr key={lesson.num} className={lesson.date ? 'done' : ''}>
                      <td style={{ fontWeight: 800, color: '#5b46cc' }}>
                        {String(lesson.num).padStart(2, '0')}
                      </td>
                      <td style={{ fontWeight: 700 }}>{lesson.title}</td>
                      <td>
                        <input
                          type="date"
                          className="drawer-input"
                          value={lesson.date || ''}
                          onChange={(e) =>
                            updateLesson('drivingLessons', lesson.num, { date: e.target.value })
                          }
                          style={{ width: '135px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="drawer-input"
                          value={lesson.time || ''}
                          onChange={(e) =>
                            updateLesson('drivingLessons', lesson.num, { time: e.target.value })
                          }
                          placeholder="الوقت"
                          style={{ width: '95px' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-today"
                            onClick={() => markLessonToday('drivingLessons', lesson.num)}
                            title="تعيين تاريخ اليوم والوقت الحالي"
                          >
                            اليوم
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Code Lessons Editor */}
          {drawerTab === 'code' && (
            <div className="drawer-table-wrapper">
              <table className="drawer-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>الحصة</th>
                    <th>موضوع الدرس / نوع الحصة</th>
                    <th style={{ width: '150px' }}>التاريخ</th>
                    <th style={{ width: '120px' }}>التوقيت</th>
                    <th style={{ width: '85px' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.codeLessons.map((lesson) => (
                    <tr key={lesson.num} className={lesson.date ? 'done' : ''}>
                      <td style={{ fontWeight: 800, color: '#5b46cc' }}>
                        {String(lesson.num).padStart(2, '0')}
                      </td>
                      <td style={{ fontWeight: 700 }}>{lesson.title}</td>
                      <td>
                        <input
                          type="date"
                          className="drawer-input"
                          value={lesson.date || ''}
                          onChange={(e) =>
                            updateLesson('codeLessons', lesson.num, { date: e.target.value })
                          }
                          style={{ width: '135px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="drawer-input"
                          value={lesson.time || ''}
                          onChange={(e) =>
                            updateLesson('codeLessons', lesson.num, { time: e.target.value })
                          }
                          placeholder="الوقت"
                          style={{ width: '95px' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-today"
                            onClick={() => markLessonToday('codeLessons', lesson.num)}
                            title="تعيين تاريخ اليوم والوقت الحالي"
                          >
                            اليوم
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Exams Editor */}
          {drawerTab === 'exams' && (
            <div className="drawer-table-wrapper">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  سجل الامتحانات ({attendance.exams.filter((e) => e.date).length} محاولات مسجلة)
                </span>
              </div>
              <table className="drawer-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>الامتحان</th>
                    <th style={{ width: '160px' }}>التاريخ (DATE)</th>
                    <th style={{ width: '180px' }}>الملاحظة (OBSERVATION)</th>
                    <th>اسم الممتحن (EXAMINATEUR)</th>
                    <th style={{ width: '80px' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.exams.map((exam) => (
                    <tr key={exam.num} className={exam.date ? 'done' : ''}>
                      <td style={{ fontWeight: 800, color: '#5b46cc' }}>
                        {exam.num === 1 ? '01 ère examen' : `${String(exam.num).padStart(2, '0')} em examen`}
                      </td>
                      <td>
                        <input
                          type="date"
                          className="drawer-input"
                          value={exam.date || ''}
                          onChange={(e) => updateExam(exam.num, { date: e.target.value })}
                          style={{ width: '140px' }}
                        />
                      </td>
                      <td>
                        <select
                          className="drawer-input"
                          value={exam.observation || ''}
                          onChange={(e) => updateExam(exam.num, { observation: e.target.value })}
                          style={{ width: '160px' }}
                        >
                          <option value="">— اختر الملاحظة —</option>
                          <option value="ناجح">ناجح</option>
                          <option value="راسب">راسب</option>
                          <option value="غائب">غائب</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="drawer-input"
                          value={exam.examiner || ''}
                          onChange={(e) => updateExam(exam.num, { examiner: e.target.value })}
                          placeholder="اسم الممتحن"
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-today"
                          onClick={() => markExamToday(exam.num)}
                        >
                          اليوم
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pages Viewport (Screen & Print) */}
      <div
        className="attendance-pages-viewport"
        ref={viewportRef}
        style={{ ['--fit' as string]: fitScale }}
      >
        {/* PAGE 1: Candidate Info + 30 Driving Lessons */}
        <section className="page" id="page1">
          <AttendancePage1Svg
            drivingLessons={attendance.drivingLessons}
            formatDateDisplay={formatDateDisplay}
            deposit={deposit}
            fileno={fileno}
            phone={phone}
            license={license}
            date={date}
          />

          {/* Interactive Overlay Fields */}
          <div
            className="fld ab"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="مدرسة تعليم السياقة (انقر للتعديل)"
            style={{ left: '40pt', top: '32.44pt', width: '210pt', height: '16.7pt' }}
            onBlur={(e) => handleSchoolChange(e.currentTarget.textContent || '')}
          >
            {school}
          </div>

          <div
            className="fld a"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="الاسم واللقب"
            style={{ left: '40pt', top: '209.88pt', width: '251pt', height: '16.7pt' }}
          >
            {name}
          </div>

          <div
            className="fld a"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="تاريخ ومكان الميلاد"
            style={{ left: '40pt', top: '234.12pt', width: '251pt', height: '16.7pt' }}
          >
            {birth}
          </div>

          <div
            className="fld a"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="العنوان"
            style={{ left: '40pt', top: '258.36pt', width: '246pt', height: '16.7pt' }}
          >
            {address}
          </div>

          <div
            className="fld a"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="تاريخ الإيداع"
            style={{ left: '40.1pt', top: '282.38pt', width: '280.1pt', height: '16.7pt' }}
            onBlur={(e) => updateField('submissionDate', e.currentTarget.textContent || '')}
          >
            {deposit}
          </div>

          <div
            className="fld a"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="رقم الملف"
            style={{ left: '41.3pt', top: '314.54pt', width: '291.8pt', height: '16.7pt' }}
            onBlur={(e) => updateField('fileNumber', e.currentTarget.textContent || '')}
          >
            {fileno}
          </div>

          <div
            className="fld a"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="الصنف"
            style={{ left: '40pt', top: '347.2pt', width: '298pt', height: '16.7pt' }}
          >
            {cat}
          </div>

          <div
            className="fld a"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="رقم الهاتف"
            style={{ left: '165.9pt', top: '380.08pt', width: '163.4pt', height: '16.7pt' }}
          >
            {phone}
          </div>

          <div
            className="fld a"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="رقم الرخصة المحصل عليها"
            style={{ left: '163.7pt', top: '412.27pt', width: '89.8pt', height: '16.7pt' }}
            onBlur={(e) => updateField('obtainedLicenseNumber', e.currentTarget.textContent || '')}
          >
            {license}
          </div>

          <div
            className="fld a"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title="تاريخ الصدور"
            style={{ left: '232.6pt', top: '444.43pt', width: '120.7pt', height: '16.7pt' }}
            onBlur={(e) => updateField('issueDate', e.currentTarget.textContent || '')}
          >
            {date}
          </div>
        </section>

        {/* PAGE 2: 25 Code Lessons + 15 Exam Records */}
        <section className="page" id="page2">
          <AttendancePage2Svg
            codeLessons={attendance.codeLessons}
            exams={attendance.exams}
            formatDateDisplay={formatDateDisplay}
          />
        </section>
      </div>

    </div>
  );
}

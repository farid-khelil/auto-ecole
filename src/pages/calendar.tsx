import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Icon from '../components/Icon';
import {
  scheduleService,
  type ExamSessionAppointment,
  type CommonSession,
  DAYS_OF_WEEK_AR,
} from '../services/schedule';
import { candidatesListService } from '../services/candidates-lists';
import '../styles/calendar.css';

interface DayEvent {
  id: string;
  kind: 'common' | 'exam';
  title: string;
  time: string;
  type: 'code' | 'driving' | 'exam';
  badge: string;
  subtitle: string;
  notes?: string;
  rawCommon?: CommonSession;
  rawExam?: ExamSessionAppointment;
}

export default function CalendarPage() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'common' | 'appointments'>('calendar');
  const [examSessions, setExamSessions] = useState<ExamSessionAppointment[]>([]);
  const [commonSessions, setCommonSessions] = useState<CommonSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Calendar Date State
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  // Common Session Modal state
  const [isCommonModalOpen, setIsCommonModalOpen] = useState(false);
  const [editingCommon, setEditingCommon] = useState<CommonSession | null>(null);

  // Common Session Form state
  const [comFormTitle, setComFormTitle] = useState<string>('');
  const [comFormType, setComFormType] = useState<'code' | 'driving' | 'exam'>('code');
  const [comFormDay, setComFormDay] = useState<number>(0); // 0 = Sunday
  const [comFormTime, setComFormTime] = useState<string>('09:00');
  const [comFormLocation, setComFormLocation] = useState<string>('قاعة الدروس النظرية');
  const [comFormNotes, setComFormNotes] = useState<string>('');

  // Search and filter
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Load Data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [exams, commons] = await Promise.all([
          scheduleService.getExamAppointments(),
          scheduleService.getCommonSessions(),
        ]);
        setExamSessions(exams);
        setCommonSessions(commons);
      } catch (err) {
        console.error('Failed to load schedule data:', err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // ─── Month Navigation ──────────────────────────────────────────
  function prevMonth() {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  }

  function goToday() {
    const today = new Date();
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateStr(today.toISOString().slice(0, 10));
  }

  // ─── Common Sessions Handlers ──────────────────────────────────
  function openNewCommonSession() {
    setEditingCommon(null);
    setComFormTitle('حصة قانون المرور الأسبوعية');
    setComFormType('code');
    setComFormDay(0); // الأحد
    setComFormTime('09:00');
    setComFormLocation('قاعة الدروس النظرية');
    setComFormNotes('');
    setIsCommonModalOpen(true);
  }

  function openEditCommonSession(session: CommonSession) {
    setEditingCommon(session);
    setComFormTitle(session.title);
    setComFormType(session.type);
    setComFormDay(session.dayOfWeek);
    setComFormTime(session.time);
    setComFormLocation(session.locationOrRoom || '');
    setComFormNotes(session.notes || '');
    setIsCommonModalOpen(true);
  }

  async function handleSaveCommonSession(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...(editingCommon ? { id: editingCommon.id } : {}),
      title: comFormTitle,
      type: comFormType,
      dayOfWeek: Number(comFormDay),
      time: comFormTime,
      durationMinutes: 90,
      locationOrRoom: comFormLocation,
      notes: comFormNotes,
      active: editingCommon ? editingCommon.active : true,
    };

    const saved = await scheduleService.saveCommonSession(payload);
    setCommonSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setIsCommonModalOpen(false);
  }

  async function handleDeleteCommonSession(id: string) {
    if (!window.confirm('هل أنت متأكد من حذف هذه الحصة؟')) return;
    await scheduleService.deleteCommonSession(id);
    setCommonSessions((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleToggleCommonSessionActive(session: CommonSession) {
    const updated = await scheduleService.saveCommonSession({
      ...session,
      active: !session.active,
    });
    setCommonSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }



  // ─── Calendar Month Matrix Generation ──────────────────────────
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthNameAr = new Intl.DateTimeFormat('ar-DZ', { month: 'long', year: 'numeric' }).format(viewDate);

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

  const calendarCells: Array<{
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    dayOfWeek: number;
  }> = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, d);
    const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      dayOfWeek: prevDate.getDay(),
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = (startingDayOfWeek + d - 1) % 7;
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      dayOfWeek,
    });
  }

  const remainingCells = (7 - (calendarCells.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(year, month + 1, d);
    const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      dayOfWeek: nextDate.getDay(),
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // Unified Events on selected day
  const selectedDateObj = new Date(selectedDateStr);
  const selectedDayOfWeek = isNaN(selectedDateObj.getTime()) ? 0 : selectedDateObj.getDay();

  const selectedDayExams = examSessions.filter((s) => s.examDate === selectedDateStr);
  const selectedDayCommonSessions = commonSessions.filter(
    (s) => s.active && s.dayOfWeek === selectedDayOfWeek
  );

  const unifiedDayEvents: DayEvent[] = [
    ...selectedDayCommonSessions.map(
      (cs): DayEvent => ({
        id: `common-${cs.id}`,
        kind: 'common',
        title: cs.title,
        time: cs.time,
        type: cs.type,
        badge:
          cs.type === 'code'
            ? 'قانون المرور'
            : cs.type === 'driving'
            ? 'سياقة ومناورات'
            : 'امتحان تجريبي',
        subtitle: cs.locationOrRoom || 'قاعة الدروس النظرية',
        notes: cs.notes,
        rawCommon: cs,
      })
    ),
    // Represented as the overall exam session (e.g. "امتحان مناورات"), not individual candidates
    ...selectedDayExams.map(
      (ex): DayEvent => ({
        id: `exam-session-${ex.id}`,
        kind: 'exam',
        title: ex.title, // e.g. "امتحان مناورات"
        time: ex.time,
        type: 'exam',
        badge: ex.title,
        subtitle: `القائمة: ${ex.listReference}`,
        notes: ex.notes,
        rawExam: ex,
      })
    ),
  ].sort((a, b) => a.time.localeCompare(b.time));

  // Filtered Exam Sessions for Tab 2
  const filteredExams = examSessions.filter((s) => {
    return (
      !searchFilter ||
      s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.listReference.toLowerCase().includes(searchFilter.toLowerCase())
    );
  });

  return (
    <div className="calendar-page-layout">
      <Sidebar />

      <main className="calendar-main-content">
        {/* Top Header - Standardized with single primary action */}
        <div className="cal-header">
          <div className="cal-header-info">
            <div className="cal-title-row">
              <div className="cal-title-icon">
                <Icon name="calendar" size={20} />
              </div>
              <div>
                <h1 className="cal-title">إدارة المواعيد والتقويم</h1>
                <p className="cal-subtitle">برمجة ومتابعة حصص قانون المرور، السياقة، والامتحانات الرسمية</p>
              </div>
            </div>
          </div>

          <div className="cal-header-actions">
            <button
              type="button"
              className="cal-btn primary"
              onClick={openNewCommonSession}
            >
              <Icon name="plus" size={16} />
              <span>+ إضافة حدث / حصة</span>
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="cal-tabs-container">
          <div className="cal-tabs">
            <button
              type="button"
              className={`cal-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <Icon name="calendar" size={16} />
              <span>التقويم التفاعلي</span>
            </button>
            <button
              type="button"
              className={`cal-tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
              onClick={() => setActiveTab('appointments')}
            >
              <Icon name="document" size={16} />
              <span>جلسات الامتحانات الرسمية</span>
              <span className="cal-tab-badge">{examSessions.length}</span>
            </button>
            <button
              type="button"
              className={`cal-tab-btn ${activeTab === 'common' ? 'active' : ''}`}
              onClick={() => setActiveTab('common')}
            >
              <Icon name="clock" size={16} />
              <span>جدول الحصص المشتركة الأسبوعي</span>
              <span className="cal-tab-badge">{commonSessions.length}</span>
            </button>
          </div>
        </div>

        {/* TAB 1: CALENDAR VIEW */}
        {activeTab === 'calendar' && (
          <div className="cal-view-wrapper">
            {/* Main Calendar Card */}
            <div className="cal-card">
              <div className="cal-nav-bar">
                <div className="cal-nav-title">
                  <span className="cal-nav-month">{monthNameAr}</span>
                </div>
                <div className="cal-nav-controls">
                  {/* View Mode Switcher */}
                  <div className="cal-view-switcher" role="group" aria-label="طريقة عرض التقويم">
                    <button
                      type="button"
                      className={`cal-switcher-btn ${calendarViewMode === 'month' ? 'active' : ''}`}
                      onClick={() => setCalendarViewMode('month')}
                    >
                      شهر
                    </button>
                    <button
                      type="button"
                      className={`cal-switcher-btn ${calendarViewMode === 'week' ? 'active' : ''}`}
                      onClick={() => setCalendarViewMode('week')}
                    >
                      أسبوع
                    </button>
                    <button
                      type="button"
                      className={`cal-switcher-btn ${calendarViewMode === 'day' ? 'active' : ''}`}
                      onClick={() => setCalendarViewMode('day')}
                    >
                      يوم
                    </button>
                  </div>

                  <button
                    type="button"
                    className="cal-btn"
                    onClick={goToday}
                    title="الانتقال إلى اليوم الحالي"
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    className="cal-icon-btn"
                    onClick={prevMonth}
                    title="الشهر السابق"
                    aria-label="الشهر السابق"
                  >
                    {/* RTL: Previous is Right Chevron */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="cal-icon-btn"
                    onClick={nextMonth}
                    title="الشهر التالي"
                    aria-label="الشهر التالي"
                  >
                    {/* RTL: Next is Left Chevron */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Day Headers (Sun - Sat) with Weekend Softly Shaded */}
              <div className="cal-grid">
                {DAYS_OF_WEEK_AR.map((dayName, idx) => (
                  <div key={dayName} className={`cal-day-header ${idx === 5 || idx === 6 ? 'is-weekend' : ''}`}>
                    {dayName}
                  </div>
                ))}

                {/* Day Cells */}
                {calendarCells.map((cell, idx) => {
                  const isSelected = cell.dateStr === selectedDateStr;
                  const isToday = cell.dateStr === todayStr;
                  const isWeekend = cell.dayOfWeek === 5 || cell.dayOfWeek === 6;

                  const cellExams = examSessions.filter((s) => s.examDate === cell.dateStr);
                  const cellCommons = commonSessions.filter(
                    (s) => s.active && s.dayOfWeek === cell.dayOfWeek
                  );

                  const allEvents = [
                    ...cellCommons.map((cs) => ({
                      id: `common-${cs.id}`,
                      time: cs.time,
                      title: cs.title,
                      type: cs.type,
                    })),
                    ...cellExams.map((ex) => ({
                      id: `exam-${ex.id}`,
                      time: ex.time,
                      title: ex.title,
                      type: 'exam' as const,
                    })),
                  ].sort((a, b) => a.time.localeCompare(b.time));

                  const visibleEvents = allEvents.slice(0, 2);
                  const overflowCount = allEvents.length - visibleEvents.length;

                  return (
                    <div
                      key={idx}
                      className={`cal-day-cell ${
                        cell.isCurrentMonth ? '' : 'other-month'
                      } ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isWeekend ? 'is-weekend' : ''}`}
                      onClick={() => setSelectedDateStr(cell.dateStr)}
                    >
                      <div className="cal-day-number">{cell.dayNum}</div>

                      <div className="cal-events-list">
                        {visibleEvents.map((evt) => (
                          <div
                            key={evt.id}
                            className={`cal-event-pill ${evt.type}`}
                            title={`${evt.title} (${evt.time})`}
                          >
                            <span className="cal-pill-time">{evt.time}</span>
                            <span className="cal-pill-title">{evt.title}</span>
                          </div>
                        ))}

                        {overflowCount > 0 && (
                          <div className="cal-more-pill">
                            +{overflowCount} مواعيد إضافية
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Semantic Legend Bar Under Calendar */}
              <div className="cal-legend-bar">
                <div className="cal-legend-item">
                  <span className="cal-legend-dot code" />
                  <span>دروس نظرية (قانون المرور)</span>
                </div>
                <div className="cal-legend-item">
                  <span className="cal-legend-dot driving" />
                  <span>تدريب تطبيقي (سياقة ومناورات)</span>
                </div>
                <div className="cal-legend-item">
                  <span className="cal-legend-dot exam" />
                  <span>امتحانات رسمية</span>
                </div>
                <div className="cal-legend-item">
                  <span className="cal-legend-dot common" />
                  <span>حصص مشتركة / مراجعة</span>
                </div>
              </div>
            </div>

            {/* Selected Day Sidebar Panel (UNIFIED EVENTS LIST) */}
            <div className="cal-side-panel">
              <div className="cal-card">
                <div className="cal-side-header">
                  <h3 className="cal-side-title">أحداث ومواعيد هذا اليوم</h3>
                  <div className="cal-side-date">
                    {DAYS_OF_WEEK_AR[selectedDayOfWeek]} &bull; {selectedDateStr}
                  </div>
                </div>

                <div className="cal-side-body">
                  <button
                    type="button"
                    className="cal-btn primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={openNewCommonSession}
                  >
                    <span>+ إضافة حصة / حدث جديد</span>
                  </button>

                  {/* UNIFIED LIST OF ALL EVENTS WITH INVITING EMPTY STATE */}
                  {unifiedDayEvents.length === 0 ? (
                    <div className="cal-empty-state">
                      <div className="cal-empty-icon">
                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <circle cx="12" cy="15" r="2" />
                        </svg>
                      </div>
                      <div className="cal-empty-title">لا توجد مواعيد مبرمجة</div>
                      <p className="cal-empty-desc">
                        لم يتم تسجيل أي حصص نظرية، تطبيقية، أو امتحانات رسمية لهذا اليوم ({DAYS_OF_WEEK_AR[selectedDayOfWeek]} {selectedDateStr}).
                      </p>
                      <button
                        type="button"
                        className="cal-btn primary"
                        style={{ justifyContent: 'center' }}
                        onClick={openNewCommonSession}
                      >
                        <span>+ برمجة حصة في هذا اليوم</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {unifiedDayEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="cal-side-item"
                          style={{
                            borderRight:
                              evt.type === 'exam'
                                ? '3px solid #ef4444'
                                : '3px solid #7e22ce',
                          }}
                        >
                          <div className="cal-side-item-top">
                            <span className={`cal-type-badge ${evt.type}`}>
                              {evt.badge}
                            </span>
                            <span className="cal-time-badge">{evt.time}</span>
                          </div>

                          <div className="cal-side-item-title">{evt.title}</div>
                          <div className="cal-side-item-client">{evt.subtitle}</div>

                          {evt.notes && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                              {evt.notes}
                            </div>
                          )}

                          {/* ONLY FOR EXAM: JUST A BUTTON THAT TAKES TO THE LIST (NO EDIT, NO DELETE) */}
                          {evt.kind === 'exam' && evt.rawExam && (
                            <Link
                              to={`/candidates-lists/${evt.rawExam.listId}`}
                              style={{ textDecoration: 'none', display: 'block', marginTop: '10px' }}
                            >
                              <button
                                type="button"
                                className="cal-btn primary"
                                style={{
                                  width: '100%',
                                  justifyContent: 'center',
                                  padding: '8px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                }}
                              >
                                <Icon name="document" size={14} />
                                <span>عرض القائمة</span>
                              </button>
                            </Link>
                          )}

                          {/* EDIT AND DELETE BUTTONS ONLY FOR COMMON RECURRING SESSIONS */}
                          {evt.kind === 'common' && evt.rawCommon && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                              <button
                                type="button"
                                className="cal-btn"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  flex: 1,
                                  justifyContent: 'center',
                                }}
                                onClick={() => openEditCommonSession(evt.rawCommon!)}
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                className="cal-btn danger"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  flex: 1,
                                  justifyContent: 'center',
                                }}
                                onClick={() => handleDeleteCommonSession(evt.rawCommon!.id)}
                              >
                                حذف
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXAM SESSIONS FROM CANDIDATES LISTS */}
        {activeTab === 'appointments' && (
          <div className="appointments-table-container">
            <div className="table-filter-bar">
              <input
                type="text"
                className="table-filter-input"
                placeholder="البحث بنوع الامتحان، أو مرجع القائمة..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <Link to="/candidates-lists" style={{ textDecoration: 'none' }}>
                  <button type="button" className="cal-btn primary">
                    <span>+ إدارة قوائم الامتحانات</span>
                  </button>
                </Link>
              </div>
            </div>

            <table className="cal-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>تاريخ الامتحان</th>
                  <th>جلسة الامتحان</th>
                  <th>رقم</th>
                  <th>ملاحظات</th>
                  <th style={{ width: '140px' }}>قائمة الامتحان</th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      لا توجد جلسات امتحانات مسجلة تطابق البحث، أو لم يتم تحديد تاريخ الامتحان في القوائم بعد.
                    </td>
                  </tr>
                ) : (
                  filteredExams.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{session.examDate}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{session.time}</div>
                      </td>
                      <td>
                        <span className="cal-type-badge exam">
                          {session.title}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#475569' }}>{session.listReference}</div>
                        {session.depositDate && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            تاريخ الإيداع: {session.depositDate}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {session.notes || '—'}
                      </td>
                      <td>
                        <Link to={`/candidates-lists/${session.listId}`} style={{ textDecoration: 'none' }}>
                          <button
                            type="button"
                            className="cal-btn primary"
                            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
                          >
                            عرض القائمة
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: COMMON SESSIONS TAB */}
        {activeTab === 'common' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  جدول الحصص والدروس المشتركة الأسبوعية
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  الحصص التي تتكرر أسبوعياً ويعتمد عليها زر «التعبئة السريعة» في بطاقة المداومة الرسمية
                </span>
              </div>
              <button
                type="button"
                className="cal-btn primary"
                onClick={openNewCommonSession}
              >
                <span>+ إضافة حصة أسبوعية جديدة</span>
              </button>
            </div>

            <div className="common-sessions-grid">
              {commonSessions.map((session) => (
                <div
                  key={session.id}
                  className={`common-session-card ${session.active ? '' : 'inactive'}`}
                >
                  <div className="common-card-header">
                    <span className="common-day-badge">
                      {DAYS_OF_WEEK_AR[session.dayOfWeek]}
                    </span>
                    <span className="common-time-pill">{session.time}</span>
                  </div>

                  <h4 className="common-card-title">{session.title}</h4>

                  <div className="common-card-meta">
                    <div className="common-card-meta-row">
                      <span className={`cal-type-badge ${session.type}`}>
                        {session.type === 'code'
                          ? 'قانون المرور'
                          : session.type === 'driving'
                          ? 'سياقة ومناورات'
                          : 'امتحان / اختبار'}
                      </span>
                    </div>
                    {session.locationOrRoom && (
                      <div className="common-card-meta-row">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        <span>{session.locationOrRoom}</span>
                      </div>
                    )}
                    {session.notes && (
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                        {session.notes}
                      </div>
                    )}
                  </div>

                  <div className="common-card-footer">
                    <button
                      type="button"
                      className="cal-btn"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => handleToggleCommonSessionActive(session)}
                    >
                      {session.active ? 'مفعلة' : 'معطلة'}
                    </button>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="cal-btn"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => openEditCommonSession(session)}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="cal-btn danger"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => handleDeleteCommonSession(session.id)}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>



      {/* COMMON SESSION MODAL */}
      {isCommonModalOpen && (
        <div className="cal-modal-overlay">
          <div className="cal-modal">
            <div className="cal-modal-header">
              <h3 className="cal-modal-title">
                {editingCommon ? 'تعديل حصة مشتركة' : 'إضافة حصة أسبوعية مشتركة'}
              </h3>
              <button
                type="button"
                className="cal-icon-btn"
                onClick={() => setIsCommonModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCommonSession}>
              <div className="cal-modal-body">
                <div className="cal-form-group">
                  <label className="cal-form-label">عنوان الحصة المشتركة</label>
                  <input
                    type="text"
                    className="cal-form-input"
                    value={comFormTitle}
                    onChange={(e) => setComFormTitle(e.target.value)}
                    placeholder="مثال: حصة قانون المرور الأسبوعية (الأحد 09:00)"
                    required
                  />
                </div>

                <div className="cal-form-row">
                  <div className="cal-form-group">
                    <label className="cal-form-label">نوع الحصة</label>
                    <select
                      className="cal-form-select"
                      value={comFormType}
                      onChange={(e) => setComFormType(e.target.value as any)}
                    >
                      <option value="code">قانون المرور</option>
                      <option value="driving">سياقة ومناورات</option>
                      <option value="exam">مراجعة عامة واختبار تجريبي</option>
                    </select>
                  </div>

                  <div className="cal-form-group">
                    <label className="cal-form-label">يوم الحصة في الأسبوع</label>
                    <select
                      className="cal-form-select"
                      value={comFormDay}
                      onChange={(e) => setComFormDay(Number(e.target.value))}
                    >
                      {DAYS_OF_WEEK_AR.map((dayName, idx) => (
                        <option key={dayName} value={idx}>
                          {dayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="cal-form-row">
                  <div className="cal-form-group">
                    <label className="cal-form-label">التوقيت</label>
                    <input
                      type="time"
                      className="cal-form-input"
                      value={comFormTime}
                      onChange={(e) => setComFormTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="cal-form-group">
                    <label className="cal-form-label">مكان التدريب / القاعة</label>
                    <input
                      type="text"
                      className="cal-form-input"
                      value={comFormLocation}
                      onChange={(e) => setComFormLocation(e.target.value)}
                      placeholder="مثال: قاعة الدروس النظرية"
                    />
                  </div>
                </div>

                <div className="cal-form-group">
                  <label className="cal-form-label">ملاحظات أو تفاصيل</label>
                  <textarea
                    className="cal-form-textarea"
                    rows={2}
                    value={comFormNotes}
                    onChange={(e) => setComFormNotes(e.target.value)}
                    placeholder="ملاحظات حول موضوع الدرس أو الفئة المستهدفة..."
                  />
                </div>
              </div>

              <div className="cal-modal-footer">
                <button
                  type="button"
                  className="cal-btn"
                  onClick={() => setIsCommonModalOpen(false)}
                >
                  إلغاء
                </button>
                <button type="submit" className="cal-btn primary">
                  {editingCommon ? 'حفظ التعديلات' : 'إضافة الحصة المشتركة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

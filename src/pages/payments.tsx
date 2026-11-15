import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { clientService, type Client } from '../services/clients';
import { candidatesListService, type CandidatesListRecord } from '../services/candidates-lists';
import UpdateButton from '../components/UpdateButton';
import { vehicleService, calculateDocumentStatus, VEHICLES_UPDATED_EVENT } from '../services/vehicles';
import { matchesArabicSearch } from '../services/arabic-search';
import '../styles/payments.css';

const MONTH_NAMES_AR = [
  'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const DOW_SHORT_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ar-DZ').format(amount) + ' د.ج';
}

function getArabicDate() {
  return new Intl.DateTimeFormat('ar-DZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function getInitials(name?: string) {
  if (!name) return 'م';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [candidateLists, setCandidateLists] = useState<CandidatesListRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [alertDays, setAlertDays] = useState(() => vehicleService.getAlertDays());
  const [vehicleSummary, setVehicleSummary] = useState(() => vehicleService.getSummary());

  // Record Payment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalClientId, setModalClientId] = useState<string>('');
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [toast, setToast] = useState<string>('');

  const loadData = () => {
    void Promise.all([clientService.list(), candidatesListService.getAll()]).then(([cList, lists]) => {
      setClients(cList);
      setCandidateLists(lists);
    });
  };

  useEffect(() => {
    loadData();
    const updateVehicles = () => {
      setVehicleSummary(vehicleService.getSummary());
      setAlertDays(vehicleService.getAlertDays());
    };
    window.addEventListener(VEHICLES_UPDATED_EVENT, updateVehicles);
    return () => window.removeEventListener(VEHICLES_UPDATED_EVENT, updateVehicles);
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Financial Stats
  const stats = useMemo(() => {
    let expected = 0;
    let collected = 0;
    let fullyPaid = 0;
    let partialPaid = 0;
    let notPaid = 0;
    let activeStudents = 0;

    clients.forEach((c) => {
      const tot = Number(c.totalAmount ?? 35000);
      const paid = Number(c.paidAmount ?? 0);
      const rem = Math.max(0, tot - paid);

      expected += tot;
      collected += paid;

      if (rem === 0) {
        fullyPaid += 1;
      } else if (paid > 0) {
        partialPaid += 1;
      } else {
        notPaid += 1;
      }

      if (c.stage !== 'منتهي') {
        activeStudents += 1;
      }
    });

    const outstanding = Math.max(0, expected - collected);
    const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    const pendingCount = partialPaid + notPaid;
    const avgPaid = clients.length > 0 ? Math.round(collected / clients.length) : 0;
    const avgOwed = clients.length > 0 ? Math.round(outstanding / clients.length) : 0;

    return {
      expected,
      collected,
      outstanding,
      rate,
      fullyPaid,
      partialPaid,
      notPaid,
      pendingCount,
      activeStudents,
      avgPaid,
      avgOwed,
    };
  }, [clients]);

  // Donut circumference parameters (r = 54, circumference = 2 * PI * 54 = 339.292)
  const donutValues = useMemo(() => {
    const C = 339.292;
    const paidDash = (stats.rate / 100) * C;
    const unpaidDash = C - paidDash;
    return {
      strokeDasharray: `${paidDash.toFixed(1)} ${unpaidDash.toFixed(1)}`,
      rate: stats.rate,
    };
  }, [stats.rate]);

  // Current Month Registrations & Spline Area Chart
  const chartData = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const today = now.getDate();

    // Registrations per day up to today
    const dailyCounts: number[] = Array.from({ length: today }, () => 0);
    let monthTotal = 0;

    clients.forEach((c) => {
      if (!c.registrationDate) return;
      const d = new Date(c.registrationDate);
      if (!isNaN(d.getTime()) && d.getFullYear() === curYear && d.getMonth() === curMonth) {
        monthTotal++;
        const dayIdx = d.getDate() - 1;
        if (dayIdx >= 0 && dayIdx < today) {
          dailyCounts[dayIdx]++;
        }
      }
    });

    const safeDaily = dailyCounts.length > 0 ? dailyCounts : [1];
    const maxV = Math.max(1, ...safeDaily);
    const peakI = safeDaily.indexOf(maxV);
    const avg = monthTotal / Math.max(1, safeDaily.length);

    // Coordinate scalers (width 760, height 240, inner height 200, bottom 220, top 20)
    const len = Math.max(2, safeDaily.length);
    const X = (i: number) => 10 + (i / (len - 1)) * 740;
    const Y = (v: number) => 220 - v * (200 / maxV);
    const clampY = (y: number) => Math.min(220, Math.max(20, y));

    const pts = safeDaily.map((v, i) => [X(i), Y(v)]);
    let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6);
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6);
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    const last = pts[pts.length - 1];
    const areaPath = d + ' L' + last[0].toFixed(1) + ' 220 L' + pts[0][0].toFixed(1) + ' 220 Z';

    const pct = (n: number, of: number) => ((n / of) * 100).toFixed(2) + '%';
    const gridLines = [0, Math.round(maxV / 3), Math.round((2 * maxV) / 3), maxV].map((v) => ({
      top: pct(Y(v), 240),
      label: String(v),
    }));

    // Generate step day labels (1, 5, 10, 15, 20, 25, 30...)
    const xLabels: { left: string; text: string }[] = [];
    const step = Math.max(1, Math.floor(len / 6));
    for (let day = 1; day <= len; day += step) {
      xLabels.push({ left: pct(X(day - 1), 760), text: String(day) });
    }
    if (xLabels[xLabels.length - 1]?.text !== String(len)) {
      xLabels.push({ left: pct(X(len - 1), 760), text: String(len) });
    }

    return {
      monthTotal,
      avg: avg.toFixed(1),
      bestLabel: `${peakI + 1} ${MONTH_NAMES_AR[curMonth]} · ${maxV} مسجلين`,
      todayLeft: pct(X(Math.min(today - 1, len - 1)), 760),
      avgTop: pct(Y(avg), 240),
      peakLeft: pct(X(peakI), 760),
      peakTop: pct(Y(maxV), 240),
      peakLabel: `${peakI + 1} ${MONTH_NAMES_AR[curMonth]} · ${maxV} جديد`,
      gridLines,
      xLabels,
      linePath: d,
      areaPath,
      curMonthName: MONTH_NAMES_AR[curMonth],
      curYear,
      dailyCounts: safeDaily,
      today,
    };
  }, [clients]);

  // 6-Month Stacked History
  const historyData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthName = MONTH_NAMES_AR[month];

      const monthClients = clients.filter((c) => {
        if (!c.registrationDate) return i === 0;
        const cd = new Date(c.registrationDate);
        return !isNaN(cd.getTime()) && cd.getFullYear() === year && cd.getMonth() === month;
      });

      let exp = 0;
      let col = 0;
      monthClients.forEach((c) => {
        const tot = Number(c.totalAmount ?? 35000);
        const paid = Number(c.paidAmount ?? 0);
        exp += tot;
        col += paid;
      });

      let rate = 100;
      if (i === 0) {
        rate = stats.rate;
      } else if (exp > 0) {
        rate = Math.round((col / exp) * 100);
      } else {
        rate = 92 - i * 3;
      }

      const unpaidPercent = Math.max(0, 100 - rate);
      const unpaidH = `${(unpaidPercent * 0.84).toFixed(1)}px`;

      months.push({
        monthName,
        rate: `${rate}%`,
        unpaidH,
        isCurrent: i === 0,
      });
    }
    return months;
  }, [clients, stats.rate]);

  // Unpaid Students Watchlist
  const unpaidStudents = useMemo(() => {
    return clients
      .map((c) => {
        const tot = Number(c.totalAmount ?? 35000);
        const paid = Number(c.paidAmount ?? 0);
        const rem = Math.max(0, tot - paid);
        const pct = tot > 0 ? Math.min(100, Math.round((paid / tot) * 100)) : 0;
        return {
          id: c.id,
          name: c.name,
          init: getInitials(c.name),
          tot,
          paid,
          rem,
          pct,
          status: rem > 15000 ? 'متأخر منذ فترة' : 'مستحق قريباً',
        };
      })
      .filter((c) => c.rem > 0)
      .filter((c) => {
        if (!searchQuery.trim()) return true;
        return matchesArabicSearch(c.name, searchQuery);
      })
      .sort((a, b) => b.rem - a.rem)
      .slice(0, 6);
  }, [clients, searchQuery]);

  // Candidates by Category Breakdown
  const categoriesBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      'صنف ب (B)': 0,
      'صنف أ (A)': 0,
      'صنف ج (C)': 0,
      'صنف د (D)': 0,
    };

    clients.forEach((c) => {
      const tr = (c.training || '').toUpperCase();
      if (tr.includes('A') || tr.includes('أ')) counts['صنف أ (A)']++;
      else if (tr.includes('C') || tr.includes('ج')) counts['صنف ج (C)']++;
      else if (tr.includes('D') || tr.includes('د')) counts['صنف د (D)']++;
      else counts['صنف ب (B)']++;
    });

    const entries = Object.entries(counts).map(([name, count]) => ({ name, count }));
    const total = entries.reduce((s, e) => s + e.count, 0);
    const maxCount = Math.max(1, ...entries.map((e) => e.count));
    const avg = total > 0 ? Math.round(total / entries.length) : 0;

    return {
      entries: entries.map((e) => ({
        ...e,
        pct: `${Math.round((e.count / maxCount) * 100)}%`,
      })),
      avg,
      avgPct: `${Math.round((avg / maxCount) * 100)}%`,
    };
  }, [clients]);

  // Vehicles Fleet Info
  const fleetInfo = useMemo(() => {
    const list = vehicleService.list();
    const total = list.length;
    let inService = 0;
    let alerts: { vehicleName: string; docName: string; daysRemaining: number }[] = [];

    list.forEach((v) => {
      v.documents.forEach((d) => {
        const s = calculateDocumentStatus(d.expiryDate, alertDays);
        if (s.status === 'expired' || s.status === 'expiring_soon') {
          inService++;
          alerts.push({ vehicleName: v.name, docName: d.name, daysRemaining: s.daysRemaining });
        }
      });
    });

    const inLesson = Math.min(3, Math.max(1, total - inService - 1));
    const free = Math.max(0, total - inLesson - Math.min(1, inService));

    return {
      total: total || 6,
      inLesson: inLesson || 3,
      free: free || 2,
      inService: Math.max(1, inService),
      topAlert: alerts[0],
    };
  }, [alertDays, vehicleSummary]);

  // Upcoming Exams List
  const upcomingExams = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return candidateLists
      .filter((l) => Boolean(l.examDate && l.examDate >= todayStr))
      .sort((a, b) => (a.examDate || '').localeCompare(b.examDate || ''))
      .slice(0, 4)
      .map((l) => {
        const d = new Date(l.examDate || '');
        const day = d.getDate();
        const dow = DOW_SHORT_AR[d.getDay()] || 'سبت';
        return {
          id: l.id,
          day: String(day),
          dow,
          title: l.transmittalNumber ? `إرسال رقم ${l.transmittalNumber}` : 'امتحان تطبيقي',
          meta: `${l.candidates?.length || 0} مترشحين · 09:00`,
        };
      });
  }, [candidateLists]);

  // Payment Modal actions
  const handleOpenPaymentModal = (clientId?: string | number) => {
    if (clientId) {
      setModalClientId(String(clientId));
      const target = clients.find((c) => String(c.id) === String(clientId));
      if (target) {
        const rem = Math.max(0, Number(target.totalAmount ?? 35000) - Number(target.paidAmount ?? 0));
        setPaymentAmountInput(rem > 0 ? String(rem) : '5000');
      }
    } else if (clients.length > 0) {
      const firstPending = clients.find((c) => Number(c.paidAmount ?? 0) < Number(c.totalAmount ?? 35000));
      const target = firstPending || clients[0];
      setModalClientId(String(target.id));
      const rem = Math.max(0, Number(target.totalAmount ?? 35000) - Number(target.paidAmount ?? 0));
      setPaymentAmountInput(rem > 0 ? String(rem) : '5000');
    }
    setPaymentNote('');
    setIsModalOpen(true);
  };

  const modalClient = useMemo(() => {
    return clients.find((c) => String(c.id) === String(modalClientId));
  }, [clients, modalClientId]);

  const modalClientRemaining = useMemo(() => {
    if (!modalClient) return 0;
    const tot = Number(modalClient.totalAmount ?? 35000);
    const paid = Number(modalClient.paidAmount ?? 0);
    return Math.max(0, tot - paid);
  }, [modalClient]);

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmountInput);
    if (isNaN(amount) || amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح.');
      return;
    }
    if (!modalClient) {
      alert('يرجى اختيار مترشح.');
      return;
    }

    const currentPaid = Number(modalClient.paidAmount ?? 0);
    const updated: Client = {
      ...modalClient,
      paidAmount: currentPaid + amount,
    };

    void clientService.update(String(modalClient.id), updated).then(() => {
      loadData();
      setIsModalOpen(false);
      setToast(`تم تسجيل دفعة بنجاح بمبلغ ${formatCurrency(amount)} للمترشح ${modalClient.name}`);
    });
  };

  // Sparkline bars for Aside blue card
  const asideBars = useMemo(() => {
    const len = chartData.dailyCounts.length;
    const maxVal = Math.max(1, ...chartData.dailyCounts);
    return chartData.dailyCounts.map((v, i) => {
      const h = Math.max(15, Math.round((v / maxVal) * 100));
      return {
        height: `${h}%`,
        active: i === len - 1,
      };
    });
  }, [chartData.dailyCounts]);

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-layout">
        {/* MAIN PANEL */}
        <main className="dashboard-main">
          {/* Header */}
          <header className="dashboard-header">
            <div className="dashboard-title-box">
              <h1>المدفوعات والمداخيل</h1>
              <div className="dashboard-date-sub">{getArabicDate()}</div>
            </div>

            <div className="dashboard-header-actions">
              <div className="search-input-wrap">
                <span className="search-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="بحث في المترشحين والمستحقات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="dashboard-search-input"
                />
              </div>

              <button type="button" className="btn-primary-action" onClick={() => handleOpenPaymentModal()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5v14" />
                </svg>
                تسجيل دفعة جديدة
              </button>

              <UpdateButton compact />

              <div className="dashboard-notif-wrap">
                <button
                  type="button"
                  className={`btn-ghost-notif ${fleetInfo.topAlert ? 'has-alerts' : ''}`}
                  onClick={() => setIsNotifOpen((p) => !p)}
                  title="مركز الإشعارات والتنبيهات"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  {fleetInfo.topAlert && <span className="notif-badge-dot" />}
                </button>

                {isNotifOpen && (
                  <div className="notif-popover">
                    <div className="notif-popover-head">
                      <div className="notif-popover-title">التنبيهات السريعة</div>
                      <button type="button" className="btn-modal-close" onClick={() => setIsNotifOpen(false)}>✕</button>
                    </div>
                    <div className="notif-popover-list">
                      {fleetInfo.topAlert ? (
                        <div className="notif-popover-item" onClick={() => { navigate('/vehicles'); setIsNotifOpen(false); }}>
                          <span style={{ color: '#ffc78a', fontSize: '16px' }}>⚠️</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>{fleetInfo.topAlert.vehicleName}</div>
                            <div style={{ fontSize: '12px', color: '#9a9cab' }}>{fleetInfo.topAlert.docName} (متبقي {fleetInfo.topAlert.daysRemaining} يوم)</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#9a9cab', textAlign: 'center', padding: '16px 0' }}>لا توجد تنبيهات عاجلة حالياً</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* KPI ROW (4 CARDS) */}
          <section className="dashboard-kpi-row" aria-label="Key numbers">
            {/* Card 1: Active students */}
            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon-box blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span>المترشحون النشطون</span>
              </div>
              <div>
                <div className="kpi-val">{stats.activeStudents}</div>
                <div className="kpi-sub">+{chartData.monthTotal} مسجل في {chartData.curMonthName}</div>
              </div>
            </div>

            {/* Card 2: Total Collected */}
            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon-box blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" x2="12" y1="20" y2="10" />
                    <line x1="18" x2="18" y1="20" y2="4" />
                    <line x1="6" x2="6" y1="20" y2="16" />
                  </svg>
                </span>
                <span>المبالغ المحصلة</span>
              </div>
              <div>
                <div className="kpi-val">{formatCurrency(stats.collected)}</div>
                <div className="kpi-sub">{stats.rate}% من المتوقع الكلي</div>
              </div>
            </div>

            {/* Card 3: Outstanding dues */}
            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon-box amber">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                <span>المستحقات المعلقة</span>
              </div>
              <div>
                <div className="kpi-val amber">{formatCurrency(stats.outstanding)}</div>
                <div className="kpi-sub">{stats.pendingCount} مترشح لم يكتمل سدادهم</div>
              </div>
            </div>

            {/* Card 4: Upcoming Exams */}
            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon-box purple">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="8" height="4" x="8" y="2" rx="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <path d="m9 14 2 2 4-4" />
                  </svg>
                </span>
                <span>الامتحانات القادمة</span>
              </div>
              <div>
                <div className="kpi-val">{upcomingExams.length}</div>
                <div className="kpi-sub">قوائم امتحانات مبرمجة في الموعد</div>
              </div>
            </div>
          </section>

          {/* CHART BIG SECTION: NEW STUDENTS */}
          <section className="big-card-section">
            <header className="big-card-header">
              <div>
                <h2 className="big-card-title">المترشحون الجدد</h2>
                <p className="big-card-sub">
                  شهر {chartData.curMonthName} {chartData.curYear} · التسجيلات اليومية المضافة
                </p>
              </div>
              <span className="aside-count-badge">شهر {chartData.curMonthName}</span>
            </header>

            <div>
              <div className="chart-stats-triplet">
                <div className="chart-stat-item">
                  <div className="chart-stat-number">{chartData.monthTotal}</div>
                  <div className="chart-stat-label">إجمالي المسجلين هذا الشهر</div>
                </div>
                <div className="chart-stat-item">
                  <div className="chart-stat-number">{chartData.avg}</div>
                  <div className="chart-stat-label">المعدل اليومي</div>
                </div>
                <div className="chart-stat-item">
                  <div className="chart-stat-number">{chartData.bestLabel}</div>
                  <div className="chart-stat-label">أفضل يوم في التسجيل</div>
                </div>
              </div>

              <div className="chart-canvas-box">
                <div className="chart-inner-canvas" role="img" aria-label="Line chart of new students added per day">
                  {/* Grid lines */}
                  {chartData.gridLines.map((g, i) => (
                    <div key={i} className="chart-grid-line" style={{ top: g.top }}>
                      <span className="chart-grid-label">{g.label}</span>
                      <div className="chart-grid-rule" />
                    </div>
                  ))}

                  {/* Today indicator line */}
                  <div className="chart-today-line" style={{ left: chartData.todayLeft }} />
                  <div className="chart-today-badge" style={{ left: chartData.todayLeft }}>اليوم</div>

                  {/* Spline Area and Line SVG */}
                  <svg viewBox="0 0 760 240" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                    <path d={chartData.areaPath} fill="rgba(91,140,255,0.12)" stroke="none" />
                    <path d={chartData.linePath} fill="none" stroke="#5b8cff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>

                  {/* Average dashed horizontal line */}
                  <div className="chart-avg-line" style={{ top: chartData.avgTop }} />
                  <div className="chart-avg-badge" style={{ top: chartData.avgTop }}>معدل {chartData.avg} / يوم</div>

                  {/* Peak tooltip point */}
                  <div className="chart-peak-dot" style={{ left: chartData.peakLeft, top: chartData.peakTop }} />
                  <div className="chart-peak-tooltip" style={{ left: chartData.peakLeft, top: chartData.peakTop }}>
                    {chartData.peakLabel}
                  </div>
                </div>

                {/* X-axis labels */}
                <div className="chart-x-labels" aria-hidden="true">
                  {chartData.xLabels.map((x, i) => (
                    <span key={i} className="chart-x-label" style={{ left: x.left }}>{x.text}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ROW OF 2 CARDS: PAID VS UNPAID + UNPAID STUDENTS */}
          <div className="cards-two-col-row">
            {/* Card 1: Paid vs unpaid */}
            <section className="card-half">
              <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0 }}>نسبة التحصيل المالي</h2>
                  <p style={{ fontSize: '13px', color: '#9a9cab', margin: '4px 0 0' }}>
                    شهر {chartData.curMonthName} · {clients.length} مترشح مسجل
                  </p>
                </div>
                <span className="pill-rate-badge">{stats.rate}% تم تحصيله</span>
              </header>

              <div className="donut-stats-wrap">
                {/* Donut SVG */}
                <div className="donut-visual-box" role="img" aria-label={`Donut chart: ${stats.rate}% collected`}>
                  <svg viewBox="0 0 140 140" width="128" height="128" aria-hidden="true">
                    <circle cx="70" cy="70" r="54" fill="none" stroke="#f59a3d" strokeWidth="14" />
                    <circle
                      cx="70"
                      cy="70"
                      r="54"
                      fill="none"
                      stroke="#5b8cff"
                      strokeWidth="14"
                      strokeDasharray={donutValues.strokeDasharray}
                    />
                  </svg>
                  <div className="donut-visual-center">
                    <div className="donut-visual-percent">{stats.rate}%</div>
                    <div className="donut-visual-sub">محصل</div>
                  </div>
                </div>

                {/* Breakdown Legend */}
                <div className="donut-legend-breakdown">
                  <div>
                    <div className="donut-legend-row-label">
                      <span className="legend-dot" style={{ background: '#5b8cff' }} />
                      مدفوع ومحصل
                    </div>
                    <div className="donut-legend-row-val">
                      {stats.fullyPaid + stats.partialPaid} <span>مترشح</span>
                    </div>
                    <div className="donut-legend-row-sub">{formatCurrency(stats.collected)} تم استلامها</div>
                  </div>

                  <div>
                    <div className="donut-legend-row-label">
                      <span className="legend-dot" style={{ background: '#f59a3d' }} />
                      غير مدفوع
                    </div>
                    <div className="donut-legend-row-val" style={{ color: '#ffc78a' }}>
                      {stats.pendingCount} <span>مترشح</span>
                    </div>
                    <div className="donut-legend-row-sub">{formatCurrency(stats.outstanding)} مستحقات معلقة</div>
                  </div>
                </div>
              </div>

              {/* 3-Column Metrics Strip */}
              <div className="triplet-metrics-strip">
                <div className="triplet-col">
                  <div className="triplet-col-label">متوسط المدفوع للمترشح</div>
                  <div className="triplet-col-val">{formatCurrency(stats.avgPaid)}</div>
                </div>
                <div className="triplet-col">
                  <div className="triplet-col-label">متوسط المتبقي للمترشح</div>
                  <div className="triplet-col-val">{formatCurrency(stats.avgOwed)}</div>
                </div>
                <div className="triplet-col">
                  <div className="triplet-col-label">المبلغ المتوقع الإجمالي</div>
                  <div className="triplet-col-val">{formatCurrency(stats.expected)}</div>
                </div>
              </div>

              {/* Share of billed amount collected, last 6 months */}
              <div className="history-bars-section">
                <div className="history-section-title">نسبة المبالغ المحصلة خلال الأشهر الستة الأخيرة</div>
                <div className="history-bars-row" role="img" aria-label="Stacked bars of share collected each month">
                  {historyData.map((h, i) => (
                    <div key={i} className="history-single-bar-col">
                      <div className="history-bar-tube">
                        <div className="history-bar-unpaid" style={{ height: h.unpaidH }} />
                        <div className="history-bar-paid" />
                      </div>
                      <div className="history-month-txt" style={{ color: h.isCurrent ? '#ffffff' : '#b4b6c4' }}>
                        {h.monthName}
                      </div>
                      <div className="history-pct-txt">{h.rate}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Card 2: Unpaid students */}
            <section className="card-half">
              <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0 }}>المستحقات المعلقة</h2>
                  <p style={{ fontSize: '13px', color: '#9a9cab', margin: '4px 0 0' }}>
                    أهم {unpaidStudents.length} من أصل {stats.pendingCount} مترشح
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost-action"
                  onClick={() => handleOpenPaymentModal()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  تسجيل دفعة
                </button>
              </header>

              <div className="unpaid-students-list">
                {unpaidStudents.map((u) => (
                  <div key={u.id} className="unpaid-student-row">
                    <div className="unpaid-avatar-circle">{u.init}</div>
                    <div className="unpaid-info-col">
                      <div className="unpaid-name-and-owed">
                        <span>{u.name}</span>
                        <span>{formatCurrency(u.rem)}</span>
                      </div>
                      <div className="unpaid-progress-track">
                        <div className="unpaid-progress-fill" style={{ width: `${u.pct}%` }} />
                      </div>
                      <div className="unpaid-meta-row">
                        <span>مدفوع {formatCurrency(u.paid)} من {formatCurrency(u.tot)}</span>
                        <span className="unpaid-status-tag">{u.status}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-remind-ghost"
                      onClick={() => handleOpenPaymentModal(u.id)}
                      title={`تسجيل دفعة لـ ${u.name}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="14" x="2" y="5" rx="2" />
                        <line x1="2" x2="22" y1="10" y2="10" />
                      </svg>
                    </button>
                  </div>
                ))}

                {unpaidStudents.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: '#9a9cab', fontSize: '13px' }}>
                    {searchQuery ? 'لا يوجد مترشحون يطابقون البحث.' : 'جميع المترشحين سددوا كامل المبالغ المستحقة!'}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ROW OF 2 CARDS: CATEGORIES BREAKDOWN & VEHICLES FLEET */}
          <div className="cards-two-col-row">
            {/* Card 1: Students per category */}
            <section className="card-half">
              <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0 }}>المترشحون حسب الأصناف</h2>
                  <p style={{ fontSize: '13px', color: '#9a9cab', margin: '4px 0 0' }}>توزيع المترشحين المسجلين حسب صنف الرخصة</p>
                </div>
                <span className="aside-count-badge">المعدل {categoriesBreakdown.avg}</span>
              </header>

              <div className="categories-bars-list">
                {categoriesBreakdown.entries.map((r, i) => (
                  <div key={i} className="category-bar-row">
                    <span className="category-bar-name">{r.name}</span>
                    <div className="category-track">
                      <div className="category-fill" style={{ width: r.pct }} />
                      <div className="category-avg-marker" style={{ left: categoriesBreakdown.avgPct }} />
                    </div>
                    <span className="category-count-label">{r.count}</span>
                  </div>
                ))}
              </div>

              <div className="category-footer-note">
                <span style={{ width: 0, height: '14px', borderLeft: '2px dashed rgba(255,255,255,0.55)' }} />
                المعدل: {categoriesBreakdown.avg} مترشح لكل صنف
              </div>
            </section>

            {/* Card 2: Vehicles Fleet Status */}
            <section className="card-half">
              <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0 }}>حظيرة المركبات</h2>
                  <p style={{ fontSize: '13px', color: '#9a9cab', margin: '4px 0 0' }}>حالة أسطول مركبات التدريب</p>
                </div>
                <span className="aside-count-badge">{fleetInfo.total} إجمالي</span>
              </header>

              {/* Multi-segment status bar */}
              <div className="fleet-segmented-bar" role="img" aria-label="Fleet status bar">
                <div className="fleet-segment" style={{ flex: fleetInfo.inLesson, background: '#5b8cff', borderRadius: '7px 3px 3px 7px' }} />
                <div className="fleet-segment" style={{ flex: fleetInfo.free, background: '#4a4d5c', borderRadius: '3px' }} />
                <div className="fleet-segment" style={{ flex: fleetInfo.inService, background: '#f59a3d', borderRadius: '3px 7px 7px 3px' }} />
              </div>

              <div className="fleet-stats-triplet">
                <div className="fleet-stat-col">
                  <div className="fleet-stat-label">
                    <span className="legend-dot" style={{ background: '#5b8cff' }} />
                    في تدريب
                  </div>
                  <div className="fleet-stat-number">{fleetInfo.inLesson}</div>
                </div>
                <div className="fleet-stat-col">
                  <div className="fleet-stat-label">
                    <span className="legend-dot" style={{ background: '#4a4d5c' }} />
                    شاغرة
                  </div>
                  <div className="fleet-stat-number">{fleetInfo.free}</div>
                </div>
                <div className="fleet-stat-col">
                  <div className="fleet-stat-label">
                    <span className="legend-dot" style={{ background: '#f59a3d' }} />
                    صيانة وتنبيه
                  </div>
                  <div className="fleet-stat-number">{fleetInfo.inService}</div>
                </div>
              </div>

              {fleetInfo.topAlert ? (
                <div className="fleet-alert-box" onClick={() => navigate('/vehicles')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{fleetInfo.topAlert.vehicleName} · {fleetInfo.topAlert.docName} متبقي {fleetInfo.topAlert.daysRemaining} يوم</span>
                </div>
              ) : (
                <div className="fleet-alert-box" style={{ background: 'rgba(34,197,94,0.12)', color: '#86efac' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>جميع وثائق وفحوصات المركبات سارية المفعول</span>
                </div>
              )}
            </section>
          </div>
        </main>

        {/* RIGHT PANEL: MONEY & EXAMS */}
        <aside className="dashboard-aside" aria-label="Money and exams">
          <div className="aside-title-row">
            <h2>المداخيل والامتحانات</h2>
            <span className="aside-title-sub">{chartData.curMonthName} {chartData.curYear}</span>
          </div>

          {/* Section 1: Collected in current month blue card */}
          <section className="aside-blue-card">
            <div className="aside-blue-head">
              <div>
                <div className="aside-blue-label">المحصل هذا الشهر</div>
                <div className="aside-blue-amount">{formatCurrency(stats.collected)}</div>
              </div>
              <span className="aside-blue-pill">{stats.rate}% من المتوقع</span>
            </div>
            <div className="aside-blue-bars" aria-hidden="true">
              {asideBars.map((b, i) => (
                <div
                  key={i}
                  className={`aside-blue-bar-col ${b.active ? 'active' : ''}`}
                  style={{ height: b.height }}
                />
              ))}
            </div>
            <div className="aside-blue-foot">
              المداخيل اليومية لشهر {chartData.curMonthName}
            </div>
          </section>

          {/* Section 2: Quick Collection Status Card */}
          <section style={{ background: '#1f2027', border: '1px solid #2a2c36', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0 }}>مؤشرات السداد المالي</h3>
              <span className="aside-count-badge">{stats.rate}%</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9a9cab', marginBottom: '6px' }}>
                  <span>سداد كامل</span>
                  <span style={{ fontWeight: 700, color: '#86efac' }}>{stats.fullyPaid} مترشح</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: '#2a2c36', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '3px', background: '#22c55e', width: `${clients.length > 0 ? (stats.fullyPaid / clients.length) * 100 : 0}%` }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9a9cab', marginBottom: '6px' }}>
                  <span>سداد جزئي</span>
                  <span style={{ fontWeight: 700, color: '#5b8cff' }}>{stats.partialPaid} مترشح</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: '#2a2c36', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '3px', background: '#5b8cff', width: `${clients.length > 0 ? (stats.partialPaid / clients.length) * 100 : 0}%` }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9a9cab', marginBottom: '6px' }}>
                  <span>لم يسدد بعد</span>
                  <span style={{ fontWeight: 700, color: '#ffc78a' }}>{stats.notPaid} مترشح</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: '#2a2c36', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '3px', background: '#f59a3d', width: `${clients.length > 0 ? (stats.notPaid / clients.length) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Upcoming Exams */}
          <section className="aside-exams-card">
            <header className="aside-exams-head">
              <h3 className="aside-exams-title">الامتحانات القادمة</h3>
              <span className="aside-title-sub">
                {candidateLists.reduce((acc, l) => acc + (l.candidates?.length || 0), 0)} مترشح
              </span>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {upcomingExams.map((ex) => (
                <div
                  key={ex.id}
                  className="aside-exam-row"
                  onClick={() => navigate(`/candidates-lists/${ex.id}`)}
                >
                  <div className="aside-exam-date-box">
                    <span className="aside-exam-date-day">{ex.day}</span>
                    <span className="aside-exam-date-dow">{ex.dow}</span>
                  </div>
                  <div className="aside-exam-details">
                    <div className="aside-exam-title">{ex.title}</div>
                    <div className="aside-exam-sub">{ex.meta}</div>
                  </div>
                </div>
              ))}

              {upcomingExams.length === 0 && (
                <div style={{ padding: '16px 0', fontSize: '13px', color: '#9a9cab' }}>
                  لا توجد امتحانات مبرمجة قادمة حالياً.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">تسجيل دفعة مالية جديدة</h3>
              <button type="button" className="btn-modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Select Client */}
              <div className="modal-form-group">
                <label className="modal-form-label">المترشح</label>
                <select
                  className="modal-select"
                  value={modalClientId}
                  onChange={(e) => {
                    setModalClientId(e.target.value);
                    const target = clients.find((c) => String(c.id) === e.target.value);
                    if (target) {
                      const rem = Math.max(0, Number(target.totalAmount ?? 35000) - Number(target.paidAmount ?? 0));
                      setPaymentAmountInput(rem > 0 ? String(rem) : '5000');
                    }
                  }}
                  required
                >
                  <option value="">اختر المترشح...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({formatCurrency(Number(c.paidAmount ?? 0))} / {formatCurrency(Number(c.totalAmount ?? 35000))})
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Preview Summary */}
              {modalClient && (
                <div className="modal-client-preview">
                  <div className="modal-client-details">
                    <div><strong>المترشح:</strong> {modalClient.name}</div>
                    <div style={{ color: '#9a9cab' }}>
                      الإجمالي: {formatCurrency(Number(modalClient.totalAmount ?? 35000))} · المدفوع: {formatCurrency(Number(modalClient.paidAmount ?? 0))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', color: '#9a9cab' }}>المتبقي الحالي:</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: modalClientRemaining > 0 ? '#ffc78a' : '#86efac' }}>
                      {formatCurrency(modalClientRemaining)}
                    </div>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div className="modal-form-group">
                <label className="modal-form-label">المبلغ المدفوع (د.ج)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  placeholder="مثال: 15000"
                  className="modal-input"
                  style={{ fontSize: '16px', fontWeight: 700 }}
                />
              </div>

              {/* Note */}
              <div className="modal-form-group">
                <label className="modal-form-label">ملاحظات (اختياري)</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="مثال: وصل دفعة رقم 102، شطر أول..."
                  className="modal-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-modal-confirm"
                >
                  تأكيد وحفظ الدفعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="dashboard-toast">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

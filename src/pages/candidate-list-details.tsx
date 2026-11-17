import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import DocumentPreviewModal from '../components/DocumentPreviewModal.tsx';
import Icon from '../components/Icon.tsx';
import {
  candidatesListService,
  type CandidatesListRecord,
  type ExamResult,
  getCandidateLastExamDate,
  getCurrentCandidates,
  getNextStage,
  applyExamResultToClient,
} from '../services/candidates-lists';
import { clientService, type Client } from '../services/clients';
import { generateFilledXlsx } from '../services/xlsx-generator';
import {
  downloadCandidatesListPdf,
  generateCandidatesListPdf,
} from '../services/candidates-pdf';
import {
  downloadTransmittalLetter,
  getTransmittalLetterHtml,
} from '../services/transmittal-letter';
import { matchesArabicSearch } from '../services/arabic-search';
import '../styles/candidates-list.css';

type PreviewDocument = 'model02' | 'transmittal';

export default function CandidateListDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [list, setList] = useState<CandidatesListRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search & filter within this list's candidates
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<'stage' | 'pack' | null>(null);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterContainerRef.current && !filterContainerRef.current.contains(event.target as Node)) {
        setOpenFilter(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Both document buttons use this one preview flow.
  const [activePreview, setActivePreview] = useState<PreviewDocument | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const model02FrameRef = useRef<HTMLIFrameElement>(null);
  const transmittalFrameRef = useRef<HTMLIFrameElement>(null);
  const [transmittalNumber, setTransmittalNumber] = useState('');
  const [transmittalDate, setTransmittalDate] = useState('');

  function openDocumentPreview(document: PreviewDocument) {
    if (document === 'transmittal' && list) {
      setTransmittalNumber(list.transmittalNumber || '');
      setTransmittalDate(list.transmittalDate || list.depositDate || '');
    }
    setActivePreview(document);
  }

  function closeDocumentPreview() {
    setActivePreview(null);
  }

  async function saveTransmittalDetails() {
    if (!list) return;

    try {
      const updated = await candidatesListService.update(list.id, {
        transmittalNumber,
        transmittalDate,
      });
      setList(updated);
      setAllLists((lists) => lists.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      console.error('Failed to save transmittal details:', err);
      showToast('تعذر حفظ بيانات جدول الإرسال');
    }
  }

  const [allLists, setAllLists] = useState<CandidatesListRecord[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);

  useEffect(() => {
    async function fetchList() {
      if (!id) return;
      setIsLoading(true);
      const [found, storedLists, storedClients] = await Promise.all([
        candidatesListService.getById(id),
        candidatesListService.getAll().catch(() => []),
        clientService.list().catch(() => []),
      ]);
      setList(found);
      setAllLists(storedLists);
      setAllClients(storedClients);
      setIsLoading(false);
    }
    void fetchList();
  }, [id]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Results remain a local draft until the user saves them all at once.
  // An empty string explicitly means that a previously saved result is being cleared.
  const [pendingResults, setPendingResults] = useState<Record<string, ExamResult | ''>>({});
  const [isSavingResults, setIsSavingResults] = useState(false);
  // Legacy modal state is retained while this screen uses the inline batch editor.
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [modalResults, setModalResults] = useState<Record<string, ExamResult>>({});

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  function handleResultChange(candidateId: string, result: ExamResult | '') {
    if (!list) return;

    setPendingResults((current) => {
      const next = { ...current };
      const savedResult = list.results?.[candidateId] || '';
      if (result === savedResult) delete next[candidateId];
      else next[candidateId] = result;
      return next;
    });
  }

  function handleSetAllResults(result: Extract<ExamResult, 'ناجح' | 'راسب'>) {
    if (!list) return;

    const next: Record<string, ExamResult | ''> = {};
    list.candidates.forEach((candidate) => {
      const candidateId = String(candidate.id);
      if (list.results?.[candidateId] !== result) next[candidateId] = result;
    });
    setPendingResults(next);
  }

  async function handleSaveResults() {
    if (!list || Object.keys(pendingResults).length === 0) return;

    setIsSavingResults(true);
    try {
      const updatedResults = { ...(list.results || {}) };
      const updatedClientsById = new Map<string, Client>();
      const examDate = list.examDate || new Date().toISOString().slice(0, 10);

      for (const candidate of list.candidates) {
        const candidateId = String(candidate.id);
        const result = pendingResults[candidateId];
        if (result === undefined) continue;

        if (!result) {
          delete updatedResults[candidateId];
          continue;
        }

        updatedResults[candidateId] = result;
        const storedClient = allClients.find((client) => String(client.id) === candidateId) || candidate;
        const clientWithResult = applyExamResultToClient(
          storedClient,
          examDate,
          result,
          candidate.stage || 'قانون المرور'
        );
        const savedClient = await clientService.update(candidateId, clientWithResult);
        updatedClientsById.set(candidateId, savedClient);
      }

      const updatedCandidates = list.candidates.map((candidate) => {
        const savedClient = updatedClientsById.get(String(candidate.id));
        return savedClient ? { ...candidate, ...savedClient } : candidate;
      });
      const updatedList = await candidatesListService.update(list.id, {
        results: updatedResults,
        candidates: updatedCandidates,
      });

      setList(updatedList);
      setAllClients((clients) =>
        clients.map((client) => updatedClientsById.get(String(client.id)) || client)
      );
      setPendingResults({});
      showToast('تم حفظ نتائج الامتحان بنجاح');
    } catch (err) {
      console.error('Failed to save exam results:', err);
      alert('حدث خطأ أثناء حفظ نتائج الامتحان');
    } finally {
      setIsSavingResults(false);
    }
  }

  async function handleSaveBatchResults(batchResults: Record<string, ExamResult>) {
    if (!list) return;
    const updatedList = await candidatesListService.update(list.id, { results: batchResults });
    setList(updatedList);
    setIsResultsModalOpen(false);
  }

  // Handle PDF generation when opening the file modal
  useEffect(() => {
    let isCurrent = true;
    let generatedUrl: string | null = null;

    setViewingPdfUrl(null);
    if (activePreview !== 'model02' || !list) {
      setIsPdfLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsPdfLoading(true);

    generateCandidatesListPdf(list, allLists, allClients)
      .then((pdfBytes) => {
        if (!isCurrent) return;
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        generatedUrl = URL.createObjectURL(blob);
        setViewingPdfUrl(generatedUrl);
        setIsPdfLoading(false);
      })
      .catch((err) => {
        console.error('Failed to generate PDF for preview:', err);
        if (isCurrent) setIsPdfLoading(false);
      });

    return () => {
      isCurrent = false;
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    };
  }, [activePreview, list, allLists, allClients]);

  function formatDate(val?: string) {
    if (!val) return '—';
    try {
      return new Intl.DateTimeFormat('ar-DZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(`${val}T00:00:00`));
    } catch {
      return val;
    }
  }

  async function handleDelete() {
    if (!list) return;
    if (window.confirm('هل أنت متأكد من حذف هذه القائمة نهائياً؟')) {
      await candidatesListService.delete(list.id);
      navigate('/candidates-lists');
    }
  }

  // Candidate-list records are snapshots. Resolve each active candidate from
  // the client registry so the displayed stage always matches their profile.
  const currentCandidates = useMemo(
    () => (list ? getCurrentCandidates(list, allClients) : []),
    [list, allClients],
  );

  const availableStages = useMemo(() => {
    const stages = Array.from(new Set(currentCandidates.map((c) => c.stage || 'قانون المرور'))).filter(Boolean);
    return stages.length > 0 ? stages : ['قانون المرور', 'مناورات', 'سياقة عامة'];
  }, [currentCandidates]);

  const availablePacks = useMemo(() => {
    const packs = Array.from(new Set(currentCandidates.map((c) => c.training || 'صنف ب'))).filter(Boolean);
    return packs.length > 0 ? packs : ['صنف ب'];
  }, [currentCandidates]);

  function toggleStageFilter(stage: string) {
    setSelectedStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  }

  function togglePackFilter(pack: string) {
    setSelectedPacks((prev) =>
      prev.includes(pack) ? prev.filter((p) => p !== pack) : [...prev, pack]
    );
  }

  function toggleFilterPanel(filterType: 'stage' | 'pack') {
    setOpenFilter((prev) => (prev === filterType ? null : filterType));
  }

  // Filter candidates in current list
  const filteredCandidates = useMemo(() => {
    return currentCandidates.filter((c) => {
      const candidateTarget = `${c.name || ''} ${c.phone || ''} ${c.address || ''}`;
      const matchesQ = matchesArabicSearch(candidateTarget, searchQuery);

      const matchesStage =
        selectedStages.length === 0 || selectedStages.includes(c.stage || 'قانون المرور');
      const clientPack = c.training || 'صنف ب';
      const matchesPack =
        selectedPacks.length === 0 || selectedPacks.includes(clientPack);

      return matchesQ && matchesStage && matchesPack;
    });
  }, [currentCandidates, searchQuery, selectedStages, selectedPacks]);

  // Statistics breakdown
  const stats = useMemo(() => {
    let codeCount = 0;
    let manoeuvresCount = 0;
    let conduiteCount = 0;

    currentCandidates.forEach((c) => {
      const st = c.stage || 'قانون المرور';
      if (st === 'سياقة عامة') conduiteCount++;
      else if (st === 'مناورات') manoeuvresCount++;
      else codeCount++;
    });

    return {
      total: currentCandidates.length,
      codeCount,
      manoeuvresCount,
      conduiteCount,
    };
  }, [currentCandidates]);

  if (isLoading) {
    return (
      <main className="dashboard-shell" dir="rtl" lang="ar">
        <Sidebar />
        <section className="content">
          <div style={{ textAlign: 'center', padding: '100px 20px', color: '#666' }}>
            جاري تحميل تفاصيل القائمة...
          </div>
        </section>
      </main>
    );
  }

  if (!list) {
    return (
      <main className="dashboard-shell" dir="rtl" lang="ar">
        <Sidebar />
        <section className="content">
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ color: '#b16b18', marginBottom: '12px' }}><Icon name="warning" size={40} /></div>
            <h2 style={{ fontSize: '20px', color: '#20243d' }}>القائمة المطلوبة غير موجودة</h2>
            <p style={{ color: '#8890a4', marginTop: '8px' }}>
              قد تكون القائمة حذفت أو أن الرابط غير صحيح.
            </p>
            <button
              type="button"
              className="btn-print-list"
              style={{ margin: '20px auto 0' }}
              onClick={() => navigate('/candidates-lists')}
            >
              ← العودة إلى قوائم المترشحين
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell" dir="rtl" lang="ar">
      <Sidebar />
      <section className="content">
        {/* Topbar & Breadcrumbs */}
        <div className="topbar">
          <div className="crumb" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/" style={{ color: '#8890a4', textDecoration: 'none' }}>
              الإدارة
            </Link>
            <span style={{ color: '#c4c8d4' }}>/</span>
            <Link to="/candidates-lists" style={{ color: '#8890a4', textDecoration: 'none' }}>
              قوائم المترشحين
            </Link>
            <span style={{ color: '#c4c8d4' }}>/</span>
            <span style={{ fontWeight: 800, color: '#20243d' }}>تفاصيل القائمة</span>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="btn-back-link"
              onClick={() => navigate('/candidates-lists')}
            >
              ← العودة إلى القوائم
            </button>
          </div>
        </div>

        {/* Page Header Banner */}
        <div className="list-details-header">
          <div className="list-details-title-box">
            <div className="list-badge-icon"><Icon name="list" size={30} /></div>
            <div>
              <h1 className="list-details-title">
                قائمة مترشحي الامتحان — {formatDate(list.examDate)}
              </h1>
              <div className="list-details-subtitle">
                <span><Icon name="upload" size={14} /> تاريخ الإيداع: <strong>{formatDate(list.depositDate)}</strong></span>
                <span className="dot-sep">•</span>
                <span><Icon name="calendar" size={14} /> تاريخ الإنشاء: <strong>{new Date(list.createdAt).toLocaleDateString('ar-DZ')}</strong></span>
                <span className="dot-sep">•</span>
                <span><Icon name="users" size={14} /> العدد: <strong>{list.candidates.length} مترشح</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Including File Button */}
          <div className="list-details-actions">
            <button
              type="button"
              className="btn-open-file"
              onClick={() => openDocumentPreview('model02')}
              title="عرض وطباعة النموذج 02 الرسمي وتحميل الملفات"
            >
              <Icon name="document" size={18} />
              <span>ملف القائمة (النموذج 02)</span>
            </button>

            <button
              type="button"
              className="btn-open-file"
              style={{ background: '#1d6f42', color: '#fff' }}
              onClick={async () => {
                try {
                  await generateFilledXlsx(list, allLists, allClients);
                } catch (err) {
                  console.error('Error generating xlsx:', err);
                  alert('حدث خطأ أثناء توليد ملف Excel');
                }
              }}
              title="تحميل قائمة المترشحين الرسمية كملف Excel (.xlsx)"
            >
              <Icon name="chart" size={18} />
              <span>تحميل Excel</span>
            </button>

            <button
              type="button"
              className="btn-open-file"
              onClick={() => openDocumentPreview('transmittal')}
              title="معاينة وطباعة وتحميل جدول الإرسال"
            >
              <Icon name="send" size={18} />
              <span>جدول الإرسال</span>
            </button>

            <button
              type="button"
              className="btn-action-edit"
              style={{ padding: '8px 12px', height: '40px' }}
              onClick={() => navigate(`/candidates-lists?edit=${encodeURIComponent(list.id)}`)}
              title="تعديل هذه القائمة"
            >
              <Icon name="edit" size={17} /> تعديل
            </button>

            <button
              type="button"
              className="btn-action-delete"
              style={{ padding: '8px 12px', height: '40px' }}
              onClick={handleDelete}
              title="حذف هذه القائمة"
            >
              <Icon name="trash" size={17} /> حذف
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="list-stats-grid">
          <div className="list-stat-card">
            <div className="stat-label">إجمالي المترشحين</div>
            <div className="stat-value" style={{ color: '#ffffff' }}>
              {stats.total}
              <span className="stat-unit">مترشح</span>
            </div>
          </div>

          <div className="list-stat-card">
            <div className="stat-label">قانون المرور</div>
            <div className="stat-value" style={{ color: '#6f58d5' }}>
              {stats.codeCount}
              <span className="stat-unit">مترشح</span>
            </div>
          </div>

          <div className="list-stat-card">
            <div className="stat-label">المناورات</div>
            <div className="stat-value" style={{ color: '#b16b18' }}>
              {stats.manoeuvresCount}
              <span className="stat-unit">مترشح</span>
            </div>
          </div>

          <div className="list-stat-card">
            <div className="stat-label">السياقة العامة</div>
            <div className="stat-value" style={{ color: '#25805f' }}>
              {stats.conduiteCount}
              <span className="stat-unit">مترشح</span>
            </div>
          </div>
        </div>

        {/* Candidates Table Card */}
        <section className="table-card" style={{ marginTop: '20px' }}>
          <div className="table-tools">
            <div>
              <h2 className="table-title">المترشحون المسجلون في القائمة</h2>
              <div className="table-subtitle">
                عرض {filteredCandidates.length} من أصل {list.candidates.length} مترشح
              </div>
            </div>

            <div className="candidates-search-box">
              <div className="candidates-search-input-wrapper">
                <Icon name="search" size={17} />
                <input
                  type="text"
                  placeholder="ابحث عن مترشح..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filters-container" ref={filterContainerRef}>
                <div className="filter-buttons-frame">
                  <button
                    type="button"
                    className={`filter-toggle ${openFilter === 'stage' ? 'open' : ''} ${selectedStages.length > 0 ? 'has-selection' : ''}`}
                    onClick={() => toggleFilterPanel('stage')}
                  >
                    <span className="filter-toggle-label">التقدم</span>
                    {selectedStages.length > 0 && <span className="filter-toggle-meta">{selectedStages.length}</span>}
                  </button>
                  <button
                    type="button"
                    className={`filter-toggle ${openFilter === 'pack' ? 'open' : ''} ${selectedPacks.length > 0 ? 'has-selection' : ''}`}
                    onClick={() => toggleFilterPanel('pack')}
                  >
                    <span className="filter-toggle-label">التكوين</span>
                    {selectedPacks.length > 0 && <span className="filter-toggle-meta">{selectedPacks.length}</span>}
                  </button>
                </div>

                <div className={`filter-options-side ${openFilter ? 'open' : ''}`}>
                  {openFilter === 'stage' && (
                    <>
                      {availableStages.map((stage) => (
                        <label
                          key={stage}
                          className={`filter-chip ${selectedStages.includes(stage) ? 'active' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="filter-chip-input"
                            checked={selectedStages.includes(stage)}
                            onChange={() => toggleStageFilter(stage)}
                          />
                          <span>{stage}</span>
                        </label>
                      ))}
                      {selectedStages.length > 0 && (
                        <button
                          type="button"
                          className="filter-clear-btn"
                          onClick={() => setSelectedStages([])}
                          title="إلغاء التحديد"
                        >
                          <Icon name="close" size={14} /> مسح
                        </button>
                      )}
                    </>
                  )}
                  {openFilter === 'pack' && (
                    <>
                      {availablePacks.map((pack) => (
                        <label
                          key={pack}
                          className={`filter-chip ${selectedPacks.includes(pack) ? 'active' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="filter-chip-input"
                            checked={selectedPacks.includes(pack)}
                            onChange={() => togglePackFilter(pack)}
                          />
                          <span>{pack}</span>
                        </label>
                      ))}
                      {selectedPacks.length > 0 && (
                        <button
                          type="button"
                          className="filter-clear-btn"
                          onClick={() => setSelectedPacks([])}
                          title="إلغاء التحديد"
                        >
                          <Icon name="close" size={14} /> مسح
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="exam-results-actions" aria-label="إجراءات نتائج الامتحان">
                <span className="exam-results-actions-label">تحديد الجميع:</span>
                <button
                  type="button"
                  className="btn-set-all-result btn-set-all-pass"
                  onClick={() => handleSetAllResults('ناجح')}
                >
                  الجميع ناجح
                </button>
                <button
                  type="button"
                  className="btn-set-all-result btn-set-all-fail"
                  onClick={() => handleSetAllResults('راسب')}
                >
                  الجميع راسب
                </button>
                <button
                  type="button"
                  className="btn-set-all-result"
                  onClick={() => setPendingResults({})}
                  disabled={Object.keys(pendingResults).length === 0}
                >
                  إلغاء تحديد الكل
                </button>
                <button
                  type="button"
                  className="btn-save-exam-results"
                  disabled={isSavingResults || Object.keys(pendingResults).length === 0}
                  onClick={() => void handleSaveResults()}
                  title="حفظ كل النتائج المحددة"
                >
                  <Icon name="check" size={16} />
                  {isSavingResults
                    ? 'جارٍ الحفظ...'
                    : `حفظ النتائج${Object.keys(pendingResults).length ? ` (${Object.keys(pendingResults).length})` : ''}`}
                </button>
              </div>
            </div>
          </div>

          <div className="table-scroll">
            <table className="lists-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                  <th>الاسم واللقب</th>
                  <th>تاريخ ومكان الميلاد</th>
                  <th>رقم الهاتف</th>
                  <th>العنوان</th>
                  <th>الصنف</th>
                  <th>نوع الامتحان</th>
                  <th>تاريخ آخر امتحان</th>
                  <th style={{ minWidth: '135px' }}>نتيجة الامتحان</th>
                  <th style={{ textAlign: 'center' }}>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map((client, idx) => {
                  const candResult = list?.results?.[String(client.id)] || '';
                  const displayedResult = pendingResults[String(client.id)] ?? candResult;
                  return (
                    <tr key={client.id || idx}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#8890a4' }}>
                        {idx + 1}
                      </td>
                      <td>
                        <Link
                          to={`/clients/${client.id}`}
                          style={{
                            textDecoration: 'none',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '13.5px',
                          }}
                          className="candidate-name-link"
                        >
                          {client.name}
                        </Link>
                      </td>
                      <td>
                        <span>{client.birthDate || '—'}</span>
                        {client.birthPlace && (
                          <span style={{ color: '#8890a4', fontSize: '11px', display: 'block' }}>
                            بـ {client.birthPlace}
                          </span>
                        )}
                      </td>
                      <td dir="ltr" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {client.phone || '—'}
                      </td>
                      <td style={{ color: '#555b6d' }}>{client.address || '—'}</td>
                      <td>
                        <span
                          style={{
                            background: '#f1f3f7',
                            color: '#20243d',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '12px',
                          }}
                        >
                          {client.training || 'B'}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            background:
                              client.stage === 'منتهي'
                                ? '#f1f5f9'
                                : client.stage === 'سياقة عامة'
                                ? '#e7f6ef'
                                : client.stage === 'مناورات'
                                ? '#fff2dc'
                                : '#f0edff',
                            color:
                              client.stage === 'منتهي'
                                ? '#475569'
                                : client.stage === 'سياقة عامة'
                                ? '#25805f'
                                : client.stage === 'مناورات'
                                ? '#b16b18'
                                : '#6f58d5',
                          }}
                        >
                          {client.stage || 'قانون المرور'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#334155', fontSize: '12.5px' }}>
                          {(() => {
                            const lastDate = getCandidateLastExamDate(
                              client,
                              list || { id: '', createdAt: '', candidates: [] },
                              allLists,
                              allClients
                            );
                            return lastDate ? formatDate(lastDate) : '';
                          })()}
                        </span>
                      </td>
                      <td>
                        <select
                          className="exam-result-select"
                          value={displayedResult}
                          onChange={(e) => handleResultChange(String(client.id), e.target.value as ExamResult | '')}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                            border: '1.5px solid',
                            outline: 'none',
                            backgroundColor: '#2d384d',
                            color:
                              displayedResult === 'ناجح'
                                ? '#86efac'
                                : displayedResult === 'راسب'
                                ? '#fca5a5'
                                : displayedResult === 'غائب'
                                ? '#fde68a'
                                : '#ffffff',
                            borderColor: '#3b4863',
                          }}
                          title="تحديد نتيجة الامتحان — تُحفظ جميع النتائج بزر الحفظ"
                        >
                          <option value="">— حدد النتيجة —</option>
                          <option value="ناجح">ناجح</option>
                          <option value="راسب">راسب</option>
                          <option value="غائب">غائب</option>
                        </select>
                      </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link
                        to={`/clients/${client.id}`}
                        className="btn-action-view"
                        style={{ display: 'inline-flex', textDecoration: 'none' }}
                      >
                        <Icon name="user" size={16} /> ملف المترشح
                      </Link>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>

            {filteredCandidates.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8890a4' }}>
                لا يوجد أي مترشح يطابق البحث
              </div>
            )}
          </div>
        </section>
      </section>

      {/* FILE MODAL: View & Print & Download Official Document */}
      {activePreview === 'model02' && (
        <DocumentPreviewModal
          title={<><Icon name="document" size={20} /> النموذج رقم 02: قائمة المترشحين</>}
          summary={<>
            <strong>{formatDate(list.depositDate)}</strong>
            {list.examDate && <> • تاريخ الامتحان: <strong>{formatDate(list.examDate)}</strong></>}{' '}
            • عدد المترشحين: <strong>{list.candidates.length}</strong>
          </>}
          onClose={closeDocumentPreview}
          preview={isPdfLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#fff', fontSize: '15px', fontWeight: 700 }}>
              جاري تجهيز وعرض النموذج رقم 02 الرسمي...
            </div>
          ) : viewingPdfUrl ? (
            <iframe ref={model02FrameRef} src={viewingPdfUrl} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} title="معاينة النموذج رقم 02" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#ffb4ab', fontSize: '14px' }}>
              حدث خطأ أثناء تحميل معاينة النموذج.
            </div>
          )}
          downloadLabel="تحميل النموذج 02 (PDF)"
          onDownload={async () => {
            try {
              await downloadCandidatesListPdf(list, allLists, allClients);
            } catch (err) {
              console.error('Error downloading pdf:', err);
              alert('حدث خطأ أثناء تحميل ملف PDF');
            }
          }}
          secondaryDownloadLabel="تحميل Excel (.xlsx)"
          secondaryDownloadTitle="تحميل القائمة كملف إكسل مطابق للنموذج الرسمي"
          onSecondaryDownload={async () => {
            try {
              await generateFilledXlsx(list, allLists, allClients);
            } catch (err) {
              console.error('Error downloading xlsx:', err);
              alert('حدث خطأ أثناء تحميل ملف Excel');
            }
          }}
          printLabel="طباعة النموذج 02"
          onPrint={() => model02FrameRef.current?.contentWindow?.print()}
        />
      )}

      {/* TRANSMITTAL MODAL: Preview / Print / Download */}
      {activePreview === 'transmittal' && (
        <DocumentPreviewModal
          title={<><Icon name="send" size={20} /> جــــــــــــــــدول إرســــــــــــال</>}
          summary={<>تاريخ الإيداع: <strong>{formatDate(list.depositDate)}</strong>{' • '}عدد المترشحين: <strong>{list.candidates.length}</strong></>}
          controls={
            <>
              <label className="document-preview-field">
                <span>الرقــــــــــــــــم</span>
                <input
                  type="text"
                  value={transmittalNumber}
                  onChange={(event) => setTransmittalNumber(event.target.value)}
                  onBlur={() => void saveTransmittalDetails()}
                  placeholder="رقم الإرسال"
                />
              </label>
              <label className="document-preview-field">
                <span>التاريخ</span>
                <input
                  type="date"
                  value={transmittalDate}
                  onChange={(event) => setTransmittalDate(event.target.value)}
                  onBlur={() => void saveTransmittalDetails()}
                />
              </label>
            </>
          }
          onClose={closeDocumentPreview}
          preview={<iframe ref={transmittalFrameRef} srcDoc={getTransmittalLetterHtml(list, { referenceNumber: transmittalNumber, date: transmittalDate })} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} title="معاينة جدول الإرسال" />}
          downloadLabel="تحميل جدول الإرسال"
          downloadTitle="تنزيل جدول الإرسال كملف HTML قابل للطباعة"
          onDownload={() => downloadTransmittalLetter(list, { referenceNumber: transmittalNumber, date: transmittalDate })}
          printLabel="طباعة جدول الإرسال"
          onPrint={() => transmittalFrameRef.current?.contentWindow?.print()}
        />
      )}

      {/* EXAM RESULTS MODAL: Fast Batch Recording */}
      {isResultsModalOpen && list && (
        <div className="candidates-modal-overlay" onClick={() => setIsResultsModalOpen(false)}>
          <div
            className="candidates-modal-card"
            style={{ maxWidth: '820px', width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="candidates-modal-header" style={{ borderBottom: '1px solid var(--border-card)', padding: '18px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--success-tint)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    تسجيل نتائج الامتحان
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    تاريخ الامتحان: <strong>{formatDate(list.examDate)}</strong> • سيتم ترقية مرحلة المترشحين الناجحين تلقائياً وحفظها
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setIsResultsModalOpen(false)}
                title="إغلاق"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div style={{ padding: '12px 24px', background: 'var(--bg-card-alt)', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                تحديد سريع للجميع:
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--success-border)',
                    background: 'var(--success-tint)',
                    color: 'var(--success)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    const next: Record<string, ExamResult> = {};
                    list.candidates.forEach((c) => { next[String(c.id)] = 'ناجح'; });
                    setModalResults(next);
                  }}
                >
                  الجميع ناجح
                </button>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--danger-border)',
                    background: 'var(--danger-tint)',
                    color: 'var(--danger-text)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    const next: Record<string, ExamResult> = {};
                    list.candidates.forEach((c) => { next[String(c.id)] = 'راسب'; });
                    setModalResults(next);
                  }}
                >
                  الجميع راسب
                </button>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-card)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => setModalResults({})}
                >
                  مسح الكل
                </button>
              </div>
            </div>

            {/* Candidates Table inside Modal */}
            <div style={{ maxHeight: '55vh', overflowY: 'auto', padding: '0' }}>
              <table className="lists-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th>المترشح</th>
                    <th>المرحلة الحالية</th>
                    <th>نتيجة الامتحان</th>
                    <th>الترقية بعد النجاح</th>
                  </tr>
                </thead>
                <tbody>
                  {list.candidates.map((c, idx) => {
                    const cIdStr = String(c.id);
                    const currentRes = modalResults[cIdStr] || '';
                    const curStage = c.stage || 'قانون المرور';
                    const nextSt = getNextStage(curStage);

                    return (
                      <tr key={c.id || idx}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {idx + 1}
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '13.5px' }}>{c.name}</div>
                          {c.registrationNumber && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>رقم: {c.registrationNumber}</div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              background: 'var(--bg-card-alt)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {curStage}
                          </span>
                        </td>
                        <td>
                          <select
                            value={currentRes}
                            onChange={(e) => {
                              const val = e.target.value as ExamResult | '';
                              setModalResults((prev) => {
                                const next = { ...prev };
                                if (!val) delete next[cIdStr];
                                else next[cIdStr] = val;
                                return next;
                              });
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              border: '1px solid var(--border-input)',
                              outline: 'none',
                              backgroundColor:
                                currentRes === 'ناجح'
                                  ? 'var(--success-tint)'
                                  : currentRes === 'راسب'
                                  ? 'var(--danger-tint)'
                                  : currentRes === 'غائب'
                                  ? 'var(--warning-tint)'
                                  : 'var(--bg-input)',
                              color:
                                currentRes === 'ناجح'
                                  ? 'var(--success)'
                                  : currentRes === 'راسب'
                                  ? 'var(--danger-text)'
                                  : currentRes === 'غائب'
                                  ? 'var(--warning-text)'
                                  : 'var(--text-secondary)',
                            }}
                          >
                            <option value="">— اختر النتيجة —</option>
                            <option value="ناجح">✅ ناجح</option>
                            <option value="راسب">❌ راسب</option>
                            <option value="غائب">⚠️ غائب</option>
                          </select>
                        </td>
                        <td>
                          {currentRes === 'ناجح' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                background: 'var(--success-tint)',
                                color: 'var(--success)',
                                border: '1px solid var(--success-border)',
                              }}
                            >
                              ترقية إلى {nextSt} ↗
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {currentRes ? 'تبقى المرحلة دون تغيير' : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div
              className="candidates-modal-footer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderTop: '1px solid var(--border-card)',
                background: 'var(--bg-card-alt)',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', fontSize: '12.5px', fontWeight: 700 }}>
                {(() => {
                  const vals = Object.values(modalResults);
                  const pass = vals.filter((v) => v === 'ناجح').length;
                  const fail = vals.filter((v) => v === 'راسب').length;
                  const abs = vals.filter((v) => v === 'غائب').length;
                  return (
                    <>
                      <span style={{ color: 'var(--success)' }}>ناجح: {pass}</span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: 'var(--danger)' }}>راسب: {fail}</span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: 'var(--warning)' }}>غائب: {abs}</span>
                    </>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-card)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={() => setIsResultsModalOpen(false)}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 22px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: 'var(--success)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={() => handleSaveBatchResults(modalResults)}
                >
                  <Icon name="check" size={16} />
                  <span>حفظ وتطبيق النتائج تلقائياً</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            fontSize: '13.5px',
            fontWeight: 700,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </main>
  );
}

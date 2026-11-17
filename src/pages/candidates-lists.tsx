import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import Icon from '../components/Icon.tsx';
import DocumentPreviewModal from '../components/DocumentPreviewModal.tsx';
import { clientService, type Client } from '../services/clients';
import { candidatesListService, type CandidatesListRecord } from '../services/candidates-lists';
import { generateFilledXlsx } from '../services/xlsx-generator';
import { downloadCandidatesListPdf, generateCandidatesListPdf } from '../services/candidates-pdf';
import { matchesArabicSearch } from '../services/arabic-search';
import '../styles/candidates-list.css';

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function hasMissingResults(list: CandidatesListRecord) {
  return (list.candidates || []).some((candidate) => !list.results?.[String(candidate.id)]);
}

export default function CandidatesListsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lists, setLists] = useState<CandidatesListRecord[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [showOverdueResultsOnly, setShowOverdueResultsOnly] = useState(
    () => searchParams.get('results') === 'overdue',
  );

  // Modal / Creation flow state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingList, setEditingList] = useState<CandidatesListRecord | null>(null);
  const [newDepositDate, setNewDepositDate] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<'stage' | 'pack' | null>(null);
  const filterContainerRef = React.useRef<HTMLDivElement>(null);

  // A candidate may later be removed from the main register. Keep that saved
  // snapshot available while editing so it is not silently removed from a list.
  const editorClients = useMemo(() => {
    if (!editingList) return allClients;
    const currentIds = new Set(allClients.map((client) => String(client.id)));
    return [
      ...allClients,
      ...editingList.candidates.filter((client) => !currentIds.has(String(client.id))),
    ];
  }, [allClients, editingList]);

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

  // Preview / Print state
  const [viewingList, setViewingList] = useState<CandidatesListRecord | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const model02FrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let isCurrent = true;
    let generatedUrl: string | null = null;

    setViewingPdfUrl(null);
    if (!viewingList) {
      setIsPdfLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsPdfLoading(true);

    generateCandidatesListPdf(viewingList, lists, allClients)
      .then((pdfBytes) => {
        if (!isCurrent) return;
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        generatedUrl = URL.createObjectURL(blob);
        setViewingPdfUrl(generatedUrl);
        setIsPdfLoading(false);
      })
      .catch((err) => {
        console.error("Failed to generate PDF for preview:", err);
        if (isCurrent) setIsPdfLoading(false);
      });

    return () => {
      isCurrent = false;
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    };
  }, [viewingList, lists, allClients]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const [storedLists, storedClients] = await Promise.all([
      candidatesListService.getAll(),
      clientService.list(),
    ]);
    setLists(storedLists);
    setAllClients(storedClients);

    const editListId = searchParams.get('edit');
    const listToEdit = storedLists.find((list) => list.id === editListId);
    if (listToEdit) {
      openEditModal(listToEdit);
      setSearchParams({}, { replace: true });
    }
  }

  const availableStages = useMemo(() => {
    const stages = Array.from(new Set(editorClients.map((c) => c.stage || 'قانون المرور'))).filter(Boolean);
    return stages.length > 0 ? stages : ['قانون المرور', 'مناورات', 'سياقة عامة'];
  }, [editorClients]);

  const availablePacks = useMemo(() => {
    const packs = Array.from(new Set(editorClients.map((c) => c.training || 'صنف ب'))).filter(Boolean);
    return packs.length > 0 ? packs : ['صنف ب'];
  }, [editorClients]);

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

  // Filter clients inside the creation modal
  const filteredClients = useMemo(() => {
    return editorClients.filter((c) => {
      const candidateTarget = `${c.name || ''} ${c.phone || ''} ${c.address || ''} ${c.registrationNumber || ''}`;
      const matchesQ = matchesArabicSearch(candidateTarget, searchQuery);

      const matchesStage =
        selectedStages.length === 0 || selectedStages.includes(c.stage || 'قانون المرور');
      const clientPack = c.training || 'صنف ب';
      const matchesPack =
        selectedPacks.length === 0 || selectedPacks.includes(clientPack);

      return matchesQ && matchesStage && matchesPack;
    });
  }, [editorClients, searchQuery, selectedStages, selectedPacks]);

  const allFilteredSelected =
    filteredClients.length > 0 &&
    filteredClients.every((c) => selectedClientIds.includes(String(c.id)));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredClients.map((c) => String(c.id)));
      setSelectedClientIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const newIds = new Set([
        ...selectedClientIds,
        ...filteredClients.map((c) => String(c.id)),
      ]);
      setSelectedClientIds(Array.from(newIds));
    }
  }

  function toggleClient(id: string) {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function openCreateModal() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setNewDepositDate(today);
    setNewExamDate(today);
    setSelectedClientIds([]);
    setSearchQuery('');
    setSelectedStages([]);
    setSelectedPacks([]);
    setOpenFilter(null);
    setEditingList(null);
    setIsCreateOpen(true);
  }

  function openEditModal(list: CandidatesListRecord, e?: React.MouseEvent) {
    e?.stopPropagation();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setNewDepositDate(list.depositDate || today);
    setNewExamDate(list.examDate || today);
    setSelectedClientIds(list.candidates.map((candidate) => String(candidate.id)));
    setSearchQuery('');
    setSelectedStages([]);
    setSelectedPacks([]);
    setOpenFilter(null);
    setIsCreateOpen(false);
    setEditingList(list);
  }

  function closeEditor() {
    setIsCreateOpen(false);
    setEditingList(null);
  }

  async function handleSaveList() {
    if (!newDepositDate) {
      alert('يرجى تحديد تاريخ الإيداع');
      return;
    }
    if (!newExamDate) {
      alert('يرجى تحديد تاريخ الامتحان');
      return;
    }
    if (selectedClientIds.length === 0) {
      alert('يرجى تحديد مترشح واحد على الأقل في القائمة');
      return;
    }

    const selectedCandidates = editorClients.filter((c) =>
      selectedClientIds.includes(String(c.id))
    );

    if (editingList) {
      const updated = await candidatesListService.update(editingList.id, {
        depositDate: newDepositDate,
        examDate: newExamDate,
        candidates: selectedCandidates,
      });
      setLists((prev) => prev.map((list) => (list.id === updated.id ? updated : list)));
      closeEditor();
      return;
    }

    const created = await candidatesListService.create({
      depositDate: newDepositDate,
      examDate: newExamDate,
      candidates: selectedCandidates,
    });

    setLists((prev) => [created, ...prev]);
    closeEditor();
    navigate(`/candidates-lists/${created.id}`);
  }

  async function handleDeleteList(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (window.confirm('هل أنت متأكد من حذف هذه القائمة؟')) {
      await candidatesListService.delete(id);
      setLists((prev) => prev.filter((l) => l.id !== id));
      if (viewingList?.id === id) {
        setViewingList(null);
      }
    }
  }

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

  const displayedLists = useMemo(() => {
    if (!showOverdueResultsOnly) return lists;
    const today = todayKey();
    return lists.filter((list) => Boolean(list.examDate && list.examDate < today && hasMissingResults(list)));
  }, [lists, showOverdueResultsOnly]);

  function showAllLists() {
    setShowOverdueResultsOnly(false);
    setSearchParams({}, { replace: true });
  }

return (
    <main className="dashboard-shell" dir="rtl" lang="ar">
      <Sidebar />
      <section className="content">
        {/* Topbar */}
        <div className="topbar">
          <div className="crumb">
            الإدارة
          </div>
          <div className="top-actions">
            <span className="admin">مدرسة السياقة</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            type="button"
            className="add-button"
            onClick={openCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>+</span> إنشاء قائمة جديدة
          </button>
        </div>

        {/* Lists Table / Cards */}
        <section className="table-card">
          <div className="table-tools">
            <div>
              <h2 className="table-title">القوائم المحفوظة</h2>
              <div className="table-subtitle">
                {showOverdueResultsOnly
                  ? `عرض ${displayedLists.length} قائمة متأخرة النتائج`
                  : `إجمالي ${lists.length} قائمة منشأة`}
              </div>
              {showOverdueResultsOnly && (
                <button type="button" className="clear-overdue-results-filter" onClick={showAllLists}>
                  <Icon name="close" size={14} /> عرض كل القوائم
                </button>
              )}
            </div>
          </div>

          <div className="table-scroll">
            <table className="lists-table">
              <thead>
                <tr>
                  <th>تاريخ الإيداع</th>
                  <th>تاريخ الامتحان</th>
                  <th>عدد المترشحين</th>
                  <th>تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody>
                {displayedLists.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/candidates-lists/${item.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '13px' }}>
                        <Icon name="upload" size={15} /> إيداع {formatDate(item.depositDate)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>
                        {formatDate(item.examDate)}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#ffffff' }}>
                        {item.candidates.length} مترشح
                      </strong>
                    </td>
                    <td style={{ color: '#8890a4' }}>
                      {new Date(item.createdAt).toLocaleDateString('ar-DZ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {lists.length === 0 && (
              <div style={{ textAlign: 'center', padding: '45px 20px', color: '#8890a4' }}>
                <div style={{ color: '#674fd7', marginBottom: '10px' }}><Icon name="list" size={36} /></div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#333849' }}>
                  لا توجد أي قائمة مترشحين بعد
                </div>
                <p style={{ fontSize: '12px', marginTop: '6px' }}>
                  انقر على زر <strong>"إنشاء قائمة جديدة"</strong> في الأعلى لتحديد تاريخ الإيداع واختيار المترشحين.
                </p>
              </div>
            )}
            {lists.length > 0 && displayedLists.length === 0 && showOverdueResultsOnly && (
              <div className="overdue-results-empty">لا توجد قوائم متأخرة تحتاج إلى إدخال نتائج.</div>
            )}
          </div>
        </section>
      </section>

      {/* MODAL 1: Create New List (Select Candidates) */}
      {(isCreateOpen || editingList) && (
        <div className="candidates-modal-overlay" onClick={closeEditor}>
          <div
            className="candidates-modal-card"
            style={{ maxWidth: '980px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="candidates-modal-header">
              <div>
                <h2>
                  <Icon name={editingList ? 'edit' : 'list'} size={20} /> {editingList ? 'تعديل قائمة المترشحين' : 'إنشاء قائمة مترشحين جديدة'}
                </h2>
                <p>{editingList ? 'حدّث التواريخ أو المترشحين المسجلين في هذه القائمة.' : 'حدد تاريخ الإيداع والامتحان ثم اختر المترشحين (نوع الامتحان تلقائي لكل مترشح حسب مرحلته)'}</p>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={closeEditor}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="candidates-modal-body">
              {/* Date pickers: تاريخ الإيداع & تاريخ الامتحان */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '20px',
                  flexWrap: 'wrap',
                  marginBottom: '18px',
                  background: 'var(--bg-card-alt)',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-card)',
                }}
              >
                <div style={{ flex: '1', minWidth: '220px', maxWidth: '300px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    تاريخ الإيداع *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDepositDate}
                    onChange={(e) => setNewDepositDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-input)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ flex: '1', minWidth: '220px', maxWidth: '300px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    تاريخ الامتحان *
                  </label>
                  <input
                    type="date"
                    required
                    value={newExamDate}
                    onChange={(e) => setNewExamDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-input)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Selection Bar & Search */}
              <div className="candidates-select-bar">
                <div className="selection-actions">
                  <button
                    type="button"
                    className="btn-select-all"
                    onClick={toggleSelectAll}
                  >
                    {allFilteredSelected ? 'إلغاء تحديد الكل' : 'تحديد كل المعروض'}
                  </button>
                  <span className="selection-count-badge">
                    تم تحديد: {selectedClientIds.length} مترشح
                  </span>
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
                </div>
              </div>

              {/* Candidates Selection Table */}
              <div style={{ overflowX: 'auto', maxHeight: '42vh' }}>
                <table className="candidates-selection-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          className="candidates-checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>#</th>
                      <th>الاسم واللقب</th>
                      <th>تاريخ الميلاد</th>
                      <th>العنوان</th>
                      <th>رقم الهاتف</th>
                      <th>الصنف</th>
                      <th>نوع الامتحان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client, idx) => {
                      const idStr = String(client.id);
                      const isChecked = selectedClientIds.includes(idStr);
                      return (
                        <tr
                          key={client.id}
                          className={isChecked ? 'selected' : ''}
                          onClick={() => toggleClient(idStr)}
                        >
                          <td
                            style={{ textAlign: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="candidates-checkbox"
                              checked={isChecked}
                              onChange={() => toggleClient(idStr)}
                            />
                          </td>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 750 }}>{client.name}</td>
                          <td>{client.birthDate || '—'}</td>
                          <td>{client.address || '—'}</td>
                          <td dir="ltr" style={{ textAlign: 'right' }}>
                            {client.phone}
                          </td>
                          <td style={{ fontWeight: 800 }}>{client.training}</td>
                          <td>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 750,
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="candidates-modal-footer">
              <button
                type="button"
                className="btn-close-modal"
                style={{ width: 'auto', padding: '0 16px', height: '38px' }}
                onClick={closeEditor}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-print-list"
                disabled={selectedClientIds.length === 0}
                onClick={handleSaveList}
              >
                <Icon name="check" size={17} /> {editingList ? 'حفظ التعديلات' : 'حفظ القائمة'} ({selectedClientIds.length} مترشح)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keep the official PDF in Electron's in-app preview; do not open blob URLs in another window. */}
      {viewingList && (
        <DocumentPreviewModal
          title={<><Icon name="document" size={20} /> النموذج رقم 02: قائمة المترشحين</>}
          summary={
            <>
              <strong>{formatDate(viewingList.depositDate)}</strong>
              {viewingList.examDate && <> • تاريخ الامتحان: <strong>{formatDate(viewingList.examDate)}</strong></>}{' '}
              • عدد المترشحين: <strong>{viewingList.candidates.length}</strong>
            </>
          }
          onClose={() => setViewingList(null)}
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
          secondaryDownloadLabel="تحميل Excel (.xlsx)"
          secondaryDownloadTitle="تحميل القائمة كملف إكسل مطابق للنموذج الرسمي"
          onSecondaryDownload={async () => {
            try {
              await generateFilledXlsx(viewingList, lists, allClients);
            } catch (err) {
              console.error('Error generating xlsx:', err);
              alert('حدث خطأ أثناء توليد ملف Excel');
            }
          }}
          downloadLabel="تحميل النموذج 02 (PDF)"
          onDownload={async () => {
            try {
              await downloadCandidatesListPdf(viewingList, lists, allClients);
            } catch (err) {
              console.error('Error downloading pdf:', err);
              alert('حدث خطأ أثناء تحميل ملف PDF');
            }
          }}
          printLabel="طباعة النموذج 02"
          onPrint={() => model02FrameRef.current?.contentWindow?.print()}
        />
      )}
    </main>
  );
}

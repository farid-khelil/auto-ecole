import React, { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.tsx';
import type { Client } from '../services/clients';
import { formatCandidateBirthDate } from '../services/candidates-lists';
import { matchesArabicSearch } from '../services/arabic-search';
import '../styles/candidates-list.css';

interface CandidatesListModalProps {
  clients: Client[];
  isOpen: boolean;
  onClose: () => void;
}

export default function CandidatesListModal({
  clients,
  isOpen,
  onClose,
}: CandidatesListModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<'stage' | 'pack' | null>(null);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const filterContainerRef = React.useRef<HTMLDivElement>(null);

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

  const availableStages = useMemo(() => {
    const stages = Array.from(new Set(clients.map((c) => c.stage || 'قانون المرور'))).filter(Boolean);
    return stages.length > 0 ? stages : ['قانون المرور', 'مناورات', 'سياقة عامة'];
  }, [clients]);

  const availablePacks = useMemo(() => {
    const packs = Array.from(new Set(clients.map((c) => c.training || 'صنف ب'))).filter(Boolean);
    return packs.length > 0 ? packs : ['صنف ب'];
  }, [clients]);

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

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const candidateTarget = `${c.name || ''} ${c.phone || ''} ${c.address || ''} ${c.registrationNumber || ''}`;
      const matchesQ = matchesArabicSearch(candidateTarget, searchQuery);

      const matchesStage =
        selectedStages.length === 0 || selectedStages.includes(c.stage || 'قانون المرور');
      const clientPack = c.training || 'صنف ب';
      const matchesPack =
        selectedPacks.length === 0 || selectedPacks.includes(clientPack);

      return matchesQ && matchesStage && matchesPack;
    });
  }, [clients, searchQuery, selectedStages, selectedPacks]);

  if (!isOpen) return null;

  const allFilteredSelected =
    filteredClients.length > 0 &&
    filteredClients.every((c) => selectedIds.includes(String(c.id)));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredClients.map((c) => String(c.id)));
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const newIds = new Set([
        ...selectedIds,
        ...filteredClients.map((c) => String(c.id)),
      ]);
      setSelectedIds(Array.from(newIds));
    }
  }

  function toggleClient(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  const selectedClients = clients.filter((c) =>
    selectedIds.includes(String(c.id))
  );

  function handleTriggerPrint() {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
    }, 100);
  }

  const todayStr = new Intl.DateTimeFormat('ar-DZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="candidates-modal-overlay" onClick={onClose}>
      <div
        className="candidates-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="candidates-modal-header">
          <div>
            <h2>
              <Icon name="list" size={20} /> قائمة المترشحين
            </h2>
            <p>
              حدد المترشحين لإنشاء وطباعة القائمة الرسمية مع كافة معلوماتهم
            </p>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            title="إغلاق"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Modal Body / Table View */}
        {!isPrintMode ? (
          <div className="candidates-modal-body">
            {/* Action Bar */}
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
                  تم تحديد: {selectedIds.length} من {clients.length} مترشح
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
            <div style={{ overflowX: 'auto', maxHeight: '52vh' }}>
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
                    <th>التقدم</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client, idx) => {
                    const idStr = String(client.id);
                    const isChecked = selectedIds.includes(idStr);
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
                        <td style={{ fontWeight: 750 }}>
                          <div>{client.name}</div>
                          {client.registrationNumber && (
                            <div style={{ fontSize: '10px', color: '#674fd7', fontWeight: 700 }}>
                              {client.registrationNumber}
                            </div>
                          )}
                        </td>
                        <td>{client.birthDate ? formatCandidateBirthDate(client.birthDate) : '—'}</td>
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
                              fontWeight: 700,
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

              {filteredClients.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '30px',
                    color: '#8b91a2',
                  }}
                >
                  لا يوجد مترشحون يطابقون خيارات البحث.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Preview / Printable Document View */
          <div className="candidates-modal-body" style={{ background: '#f5f6fa' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px',
              }}
            >
              <button
                type="button"
                className="btn-select-all"
                onClick={() => setIsPrintMode(false)}
              >
                ← العودة إلى التحديد
              </button>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>
                معاينة القائمة الجاهزة للطباعة ({selectedClients.length} مترشح)
              </span>
            </div>

            <div className="printable-sheet">
              <div className="sheet-header">
                <div className="sheet-republic">
                  الجمهورية الجزائرية الديمقراطية الشعبية
                </div>
                <div className="sheet-ministry">
                  وزارة النقل — مديرية النقل الولائية
                </div>
                <div className="sheet-school-box">
                  <div>مدرسة تعليم السياقة: مدرسة الأمل للسياقة</div>
                  <div>التاريخ: {todayStr}</div>
                </div>
              </div>

              <div className="sheet-title">قائمة المترشحين</div>
              <div className="sheet-subtitle">
                سجل المترشحين الموجهين للاختبار / التكوين
              </div>

              <table className="sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: '35px' }}>الرقم</th>
                    <th>اللقب والاسم</th>
                    <th>تاريخ الميلاد</th>
                    <th>العنوان الكامل</th>
                    <th>رقم الهاتف</th>
                    <th style={{ width: '50px' }}>الصنف</th>
                    <th>المرحلة الحالية</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClients.map((client, index) => (
                    <tr key={client.id}>
                      <td style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ fontWeight: 800 }}>{client.name}</td>
                      <td>{client.birthDate ? formatCandidateBirthDate(client.birthDate) : '—'}</td>
                      <td>{client.address || '—'}</td>
                      <td dir="ltr" style={{ textAlign: 'center' }}>
                        {client.phone}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>
                        {client.training}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {client.stage || 'قانون المرور'}
                      </td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="sheet-footer-signatures">
                <div className="sheet-signature-box">
                  <div>إمضاء وختم مدرسة تعليم السياقة</div>
                </div>
                <div className="sheet-signature-box">
                  <div>إمضاء المفتش / الإدارة</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="candidates-modal-footer">
          <button
            type="button"
            className="btn-close-modal"
            style={{ width: 'auto', padding: '0 16px', height: '38px' }}
            onClick={onClose}
          >
            إغلاق
          </button>
          {!isPrintMode ? (
            <button
              type="button"
              className="btn-print-list"
              disabled={selectedIds.length === 0}
              onClick={() => setIsPrintMode(true)}
            >
              <Icon name="document" size={17} /> معاينة وطباعة القائمة ({selectedIds.length})
            </button>
          ) : (
            <button
              type="button"
              className="btn-print-list"
              onClick={handleTriggerPrint}
            >
              <Icon name="print" size={17} /> طباعة الآن
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

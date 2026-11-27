import React from 'react';
import AttendanceCard from '../AttendanceCard.tsx';
import Icon from '../Icon.tsx';
import { TRAINING_STAGES, type Client, type ClientHistoryEntry } from '../../services/clients';
import { getLatestExam, type AttendanceCard as AttendanceCardType } from '../../services/attendance';

export type ProfileMainContentProps = {
  client: Client;
  draft: Client;
  isEditing: boolean;
  activeMainTab: 'profile' | 'attendance' | 'history';
  historyFilter: HistoryFilter;
  onHistoryFilterChange: (filter: HistoryFilter) => void;
  onUpdateDraft: <K extends keyof Client>(field: K, value: Client[K]) => void;
  onToggleDocument: (id: string) => void;
  onToggleObtainedCategory: (category: string) => void;
  onAttendanceUpdate: (updatedAttendance: AttendanceCardType) => void;
  onOpenNoteModal: () => void;
  onSetNoteModalOpen: (value: boolean) => void;
};

export type HistoryFilter = 'all' | 'info' | 'payment' | 'stage' | 'document' | 'note';

function formatDate(value?: string) {
  if (!value) return 'غير محدد';
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return `مفترض: ${trimmed}`;
  }
  if (trimmed.startsWith('xx/xx/') || trimmed.startsWith('XX/XX/')) {
    return `مفترض: ${trimmed.slice(6)}`;
  }
  try {
    const d = new Date(`${trimmed}T00:00:00`);
    if (isNaN(d.getTime())) return trimmed;
    return new Intl.DateTimeFormat('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return trimmed;
  }
}

function formatCurrency(amount?: number) {
  const num = Number(amount ?? 0);
  return new Intl.NumberFormat('ar-DZ').format(num) + ' د.ج';
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat('ar-DZ', {
    day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}

function relativeHistoryTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'الآن';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

function historySummary(entry: ClientHistoryEntry) {
  if (entry.summary === 'تم تحديث بطاقة المداومة أو نتائج الامتحانات') {
    return 'تعديل قديم على بطاقة المداومة أو الامتحان — لا تتوفر تفاصيل الحصة أو النتيجة لأن هذا السجل أُنشئ قبل التتبع التفصيلي.';
  }
  return entry.summary;
}

const HISTORY_META: Record<ClientHistoryEntry['action'], { label: string; color: string }> = {
  creation: { label: 'إنشاء الملف', color: 'emerald' },
  info_update: { label: 'تعديل البيانات', color: 'blue' },
  stage_change: { label: 'تغيير المرحلة', color: 'purple' },
  payment: { label: 'دفعة مالية', color: 'teal' },
  document_update: { label: 'تحديث الوثائق', color: 'amber' },
  attendance: { label: 'المداومة والامتحانات', color: 'amber' },
  exam_result: { label: 'نتيجة امتحان', color: 'purple' },
  note: { label: 'ملاحظة إدارية', color: 'slate' },
  archive: { label: 'أرشفة الملف', color: 'slate' },
  restore: { label: 'استرجاع من الأرشيف', color: 'emerald' },
};

function historyMatchesFilter(entry: ClientHistoryEntry, filter: HistoryFilter) {
  if (filter === 'all') return true;
  if (filter === 'info') return entry.action === 'info_update';
  if (filter === 'payment') return entry.action === 'payment';
  if (filter === 'stage') return entry.action === 'stage_change' || entry.action === 'exam_result';
  if (filter === 'document') return entry.action === 'document_update' || entry.action === 'attendance';
  return entry.action === 'note';
}

export default function ProfileMainContent({
  client,
  draft,
  isEditing,
  activeMainTab,
  historyFilter,
  onHistoryFilterChange,
  onUpdateDraft,
  onToggleDocument,
  onToggleObtainedCategory,
  onAttendanceUpdate,
  onOpenNoteModal,
}: ProfileMainContentProps) {
  const currentClient = isEditing ? draft : client;
  const totalDocs = currentClient.documents?.length || 0;
  const receivedCount = currentClient.receivedDocuments?.filter((id) =>
    currentClient.documents?.some((doc) => doc.id === id)
  ).length || 0;

  const draftPaid = Number(draft.paidAmount ?? 0);
  const draftTotal = Number(draft.totalAmount ?? 35000);
  const remainingAmount = Math.max(0, draftTotal - draftPaid);

  const clientPaid = Number(client.paidAmount ?? 0);
  const clientTotal = Number(client.totalAmount ?? 35000);
  const clientRemaining = Math.max(0, clientTotal - clientPaid);
  const lastExam = getLatestExam(currentClient.attendance);

  const stageBadgeStyle =
    currentClient.stage === 'منتهي'
      ? { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }
      : currentClient.stage === 'سياقة عامة'
      ? { background: '#e7f6ef', color: '#25805f' }
      : currentClient.stage === 'مناورات'
      ? { background: '#fff2dc', color: '#b16b18' }
      : { background: '#f0edff', color: '#6f58d5' };

  return (
    <>
      {activeMainTab === 'profile' && (
        <div className="profile-grid">
          <div className="profile-main-col">
            <section className="profile-card">
              <h2 className="card-title">
                <span className="card-mark"><Icon name="user" size={18} /></span>المعلومات الشخصية
              </h2>
              <div className="detail-grid">
                <div>
                  <span className="detail-label">الاسم واللقب</span>
                  {isEditing ? (
                    <input className="detail-input" value={draft.name} onChange={(event) => onUpdateDraft('name', event.target.value)} placeholder="الاسم واللقب" />
                  ) : (
                    <div className="detail-value">{client.name || 'غير محدد'}</div>
                  )}
                </div>

                <div>
                  <span className="detail-label">رقم الهاتف</span>
                  {isEditing ? (
                    <input className="detail-input" value={draft.phone} onChange={(event) => onUpdateDraft('phone', event.target.value)} placeholder="رقم الهاتف" inputMode="tel" />
                  ) : (
                    <div className="detail-value">{client.phone || 'غير محدد'}</div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="detail-label" style={{ margin: 0 }}>تاريخ الميلاد</span>
                    {isEditing && (
                      <label style={{ fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#64748b' }}>
                        <input
                          type="checkbox"
                          checked={/^\d{4}$/.test(draft.birthDate || '') || (draft.birthDate || '').startsWith('xx/xx/')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const match = (draft.birthDate || '').match(/\b(19\d{2}|20\d{2})\b/);
                              onUpdateDraft('birthDate', match ? match[1] : '');
                            } else {
                              onUpdateDraft('birthDate', '');
                            }
                          }}
                        />
                        <span>سنة فقط</span>
                      </label>
                    )}
                  </div>
                  {isEditing ? (
                    (/^\d{4}$/.test(draft.birthDate || '') || (draft.birthDate || '').startsWith('xx/xx/')) ? (
                      <input
                        className="detail-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="سنة الميلاد (مثال: 1975)"
                        maxLength={4}
                        value={(draft.birthDate || '').replace(/^xx\/xx\//, '')}
                        onChange={(event) => onUpdateDraft('birthDate', event.target.value.replace(/\D/g, '').slice(0, 4))}
                      />
                    ) : (
                      <input
                        className="detail-input"
                        type="date"
                        value={draft.birthDate}
                        onChange={(event) => onUpdateDraft('birthDate', event.target.value)}
                      />
                    )
                  ) : (
                    <div className="detail-value">{formatDate(client.birthDate)}</div>
                  )}
                </div>

                <div>
                  <span className="detail-label">مكان الميلاد</span>
                  {isEditing ? (
                    <input className="detail-input" value={draft.birthPlace || ''} onChange={(event) => onUpdateDraft('birthPlace', event.target.value)} placeholder="مكان الميلاد" />
                  ) : (
                    <div className="detail-value">{client.birthPlace || 'غير محدد'}</div>
                  )}
                </div>

                <div>
                  <span className="detail-label">البريد الإلكتروني</span>
                  {isEditing ? (
                    <input className="detail-input" type="email" value={draft.email} onChange={(event) => onUpdateDraft('email', event.target.value)} placeholder="البريد الإلكتروني" />
                  ) : (
                    <div className="detail-value">{client.email || 'غير محدد'}</div>
                  )}
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="detail-label">العنوان</span>
                  {isEditing ? (
                    <input className="detail-input" value={draft.address} onChange={(event) => onUpdateDraft('address', event.target.value)} placeholder="العنوان الكامل" />
                  ) : (
                    <div className="detail-value">{client.address || 'غير محدد'}</div>
                  )}
                </div>
              </div>
            </section>

            <section className="profile-card documents-card">
              <h2 className="card-title">
                <span className="card-mark"><Icon name="check" size={18} /></span>وثائق الملف
                <span style={{ marginRight: 'auto', background: '#0155fe', color: '#ffffff', borderRadius: '20px', fontSize: '11px', fontWeight: 800, padding: '4px 10px' }}>
                  {receivedCount} / {totalDocs} مستلمة
                </span>
              </h2>

              {isEditing && (
                <div style={{ fontSize: '11px', color: '#8068e8', fontWeight: 600, marginBottom: '12px' }}>
                  (انقر على الوثيقة للتحديد أو الإلغاء)
                </div>
              )}

              <div className="document-list">
                {currentClient.documents?.map((document) => {
                  const isReceived = currentClient.receivedDocuments?.includes(document.id);
                  return (
                    <div
                      key={document.id}
                      className={`document-row ${isReceived ? 'done' : 'in-progress'} ${isEditing ? 'interactive' : ''}`}
                      onClick={() => onToggleDocument(document.id)}
                      role={isEditing ? 'button' : undefined}
                      tabIndex={isEditing ? 0 : undefined}
                    >
                      <span className="document-status" aria-label={isReceived ? 'محدد' : 'غير محدد'}>
                        {isReceived && <Icon name="check" size={15} />}
                      </span>

                      <div className="document-content">
                        <span className="document-title">{document.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="profile-card summary-card">
            <h2 className="card-title">
              <span className="card-mark"><Icon name="chart" size={18} /></span>التكوين والدفع
            </h2>

            <div style={{ marginBottom: 16 }}>
              <span className="detail-label">نوع التكوين</span>
              {isEditing ? (
                <select className="detail-input" value={draft.training} onChange={(event) => onUpdateDraft('training', event.target.value)}>
                  {['A', 'A1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D', 'DE', 'F'].map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <div className="training-name">{client.training || 'غير محدد'}</div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <span className="detail-label">الصنف أو الأصناف المتحصل عليها</span>
              {isEditing ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {['A', 'A1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D', 'DE', 'F'].map((cat) => {
                    const isSelected = draft.obtainedCategories?.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => onToggleObtainedCategory(cat)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: isSelected ? '1.5px solid #25805f' : '1px solid #d5d8e2',
                          background: isSelected ? '#e7f6ef' : '#ffffff',
                          color: isSelected ? '#25805f' : '#4b5563',
                          cursor: 'pointer',
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {client.obtainedCategories && client.obtainedCategories.length > 0 ? (
                    client.obtainedCategories.map((cat) => (
                      <span
                        key={cat}
                        style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 750, background: '#e7f6ef', color: '#25805f' }}
                      >
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '13px', color: '#8892a0', fontWeight: 600 }}>لا توجد أصناف سابقة</span>
                  )}
                </div>
              )}
            </div>

            <div className="summary-line">
              <span>رقم التسجيل</span>
              {isEditing ? (
                <input className="detail-input" value={draft.registrationNumber || ''} onChange={(event) => onUpdateDraft('registrationNumber', event.target.value)} style={{ maxWidth: '160px' }} />
              ) : (
                <b style={{ color: client.registrationNumber ? '#ffffff' : '#61687c' }}>{client.registrationNumber || 'غير محدد'}</b>
              )}
            </div>

            <div className="summary-line">
              {isEditing ? (
                <input type="date" value={draft.registrationDate} onChange={(event) => onUpdateDraft('registrationDate', event.target.value)} style={{ maxWidth: '160px' }} />
              ) : (
                <b>{formatDate(client.registrationDate)}</b>
              )}
            </div>

            <div className="summary-line">
              <span>آخر امتحان</span>
              <b>{lastExam?.date ? formatDate(lastExam.date) : 'لا يوجد امتحان مسجل'}</b>
            </div>

            <div className="summary-line">
              <span>التقدم</span>
              {isEditing ? (
                <select className="detail-input" value={draft.stage || 'قانون المرور'} onChange={(event) => onUpdateDraft('stage', event.target.value)} style={{ maxWidth: '150px' }}>
                  {TRAINING_STAGES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              ) : (
                <span className="badge" style={{ ...stageBadgeStyle, fontSize: '11px', fontWeight: 750, padding: '4px 10px', borderRadius: '20px' }}>
                  {client.stage || 'قانون المرور'}
                </span>
              )}
            </div>

            <div className="summary-line">
              <span>المبلغ المدفوع</span>
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="number" min="0" className="detail-input" value={draft.paidAmount ?? 0} onChange={(event) => onUpdateDraft('paidAmount', Number(event.target.value))} style={{ maxWidth: '110px' }} />
                  <span style={{ fontSize: '11px', color: '#8d93a3' }}>د.ج</span>
                </div>
              ) : (
                <b style={{ color: '#25805f' }}>{formatCurrency(client.paidAmount)}</b>
              )}
            </div>

            <div className="summary-line">
              <span>المبلغ الإجمالي</span>
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="number" min="0" className="detail-input" value={draft.totalAmount ?? 35000} onChange={(event) => onUpdateDraft('totalAmount', Number(event.target.value))} style={{ maxWidth: '110px' }} />
                  <span style={{ fontSize: '11px', color: '#8d93a3' }}>د.ج</span>
                </div>
              ) : (
                <b>{formatCurrency(client.totalAmount)}</b>
              )}
            </div>

            <div className="summary-line">
              <span>المبلغ المتبقي</span>
              <b style={{ color: (isEditing ? remainingAmount : clientRemaining) > 0 ? '#7c0d0d' : '#23974e' }}>
                {formatCurrency(isEditing ? remainingAmount : clientRemaining)}
              </b>
            </div>
          </aside>
        </div>
      )}

      {activeMainTab === 'attendance' && (
        <AttendanceCard client={draft || currentClient} isEditing={isEditing} onUpdate={onAttendanceUpdate} />
      )}

      {activeMainTab === 'history' && (() => {
        const entries = [...(client.history || [])]
          .filter((entry) => historyMatchesFilter(entry, historyFilter))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const filters: { id: HistoryFilter; label: string }[] = [
          { id: 'all', label: 'الكل' },
          { id: 'info', label: 'البيانات' },
          { id: 'payment', label: 'المدفوعات' },
          { id: 'stage', label: 'المراحل' },
          { id: 'document', label: 'الوثائق والمداومة' },
          { id: 'note', label: 'الملاحظات' },
        ];

        return (
          <section className="history-panel">
            <div className="history-toolbar">
              <div>
                <h2>سجل التعديلات والنشاط</h2>
                <p>تسلسل زمني لكل ما تم على ملف المتدرب.</p>
              </div>
              <button className="button primary history-note-button" type="button" onClick={onOpenNoteModal}>
                + إضافة ملاحظة
              </button>
            </div>

            <div className="history-filters" aria-label="تصفية سجل النشاط">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={historyFilter === filter.id ? 'active' : ''}
                  onClick={() => onHistoryFilterChange(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {entries.length === 0 ? (
              <div className="history-empty">لا توجد أحداث مطابقة لهذا التصنيف حتى الآن.</div>
            ) : (
              <div className="history-timeline">
                {entries.map((entry) => {
                  const meta = HISTORY_META[entry.action];
                  return (
                    <article className="history-event" key={entry.id}>
                      <div className={`history-node ${meta.color}`} aria-hidden="true" />
                      <div className="history-event-card">
                        <div className="history-event-head">
                          <span className={`history-badge ${meta.color}`}>{meta.label}</span>
                          <time title={formatHistoryDate(entry.timestamp)}>{relativeHistoryTime(entry.timestamp)}</time>
                        </div>
                        <p>{historySummary(entry)}</p>
                        <div className="history-event-date">{formatHistoryDate(entry.timestamp)}</div>
                        {entry.diffs?.map((diff, index) => (
                          <div className="history-diff" key={`${entry.id}-${diff.field}-${index}`}>
                            <span className="history-diff-label">{diff.label}</span>
                            <span className="history-diff-old">{diff.oldValue || 'فارغ'}</span>
                            <span className="history-diff-arrow"><Icon name="arrow" size={15} /></span>
                            <span className="history-diff-new">{diff.newValue || 'فارغ'}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })()}
    </>
  );
}

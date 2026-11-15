import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.tsx';
import Icon from '../components/Icon.tsx';
import {
  vehicleService,
  calculateDocumentStatus,
  STANDARD_DOCUMENTS,
  type Vehicle,
  type VehicleDocument,
  type VehicleStatus,
  type StandardDocumentKey,
  VEHICLES_UPDATED_EVENT,
  getTodayDateString,
} from '../services/vehicles';
import { matchesArabicSearch } from '../services/arabic-search';
import '../styles/vehicles.css';

interface RenewTarget {
  vehicle: Vehicle;
  document: VehicleDocument;
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alertDays, setAlertDaysState] = useState<number>(vehicleService.getAlertDays());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alerts' | 'active' | 'maintenance'>('all');

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [renewTarget, setRenewTarget] = useState<RenewTarget | null>(null);
  const [renewDate, setRenewDate] = useState('');
  const [renewIssueDate, setRenewIssueDate] = useState('');
  const [renewDocNum, setRenewDocNum] = useState('');

  // Form State for Add / Edit
  const [formName, setFormName] = useState('');
  const [formPlate, setFormPlate] = useState('');
  const [formCategory, setFormCategory] = useState('صنف ب (B)');
  const [formModelYear, setFormModelYear] = useState('');
  const [formFuelType, setFormFuelType] = useState<'بنزين' | 'مازوت' | 'غاز (GPL)' | 'أخرى'>('بنزين');
  const [formStatus, setFormStatus] = useState<VehicleStatus>('active');
  const [formNotes, setFormNotes] = useState('');
  const [formDocuments, setFormDocuments] = useState<VehicleDocument[]>([]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = () => {
    setVehicles(vehicleService.list());
    setAlertDaysState(vehicleService.getAlertDays());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener(VEHICLES_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(VEHICLES_UPDATED_EVENT, handleUpdate);
  }, []);

  // Summary statistics
  const summary = useMemo(() => {
    let active = 0;
    let maintenance = 0;
    let expired = 0;
    let expiringSoon = 0;

    for (const v of vehicles) {
      if (v.status === 'active') active++;
      else if (v.status === 'maintenance') maintenance++;

      for (const doc of v.documents) {
        const s = calculateDocumentStatus(doc.expiryDate, alertDays);
        if (s.status === 'expired') expired++;
        else if (s.status === 'expiring_soon') expiringSoon++;
      }
    }

    return {
      total: vehicles.length,
      active,
      maintenance,
      expired,
      expiringSoon,
      totalAlerts: expired + expiringSoon,
    };
  }, [vehicles, alertDays]);

  // Urgent list of expiring/expired items
  const urgentAlertItems = useMemo(() => {
    const items: Array<{
      vehicle: Vehicle;
      doc: VehicleDocument;
      status: ReturnType<typeof calculateDocumentStatus>;
    }> = [];

    for (const v of vehicles) {
      for (const doc of v.documents) {
        const status = calculateDocumentStatus(doc.expiryDate, alertDays);
        if (status.status === 'expired' || status.status === 'expiring_soon') {
          items.push({ vehicle: v, doc, status });
        }
      }
    }

    // Sort expired first, then by days remaining ascending
    return items.sort((a, b) => a.status.daysRemaining - b.status.daysRemaining);
  }, [vehicles, alertDays]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Search query filter
      if (searchQuery.trim()) {
        const matchesName = matchesArabicSearch(v.name, searchQuery);
        const matchesPlate = v.plateNumber.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCat = matchesArabicSearch(v.category, searchQuery);
        if (!matchesName && !matchesPlate && !matchesCat) return false;
      }

      // Tab filter
      if (statusFilter === 'active') return v.status === 'active';
      if (statusFilter === 'maintenance') return v.status === 'maintenance';
      if (statusFilter === 'alerts') {
        return v.documents.some((doc) => {
          const s = calculateDocumentStatus(doc.expiryDate, alertDays);
          return s.status === 'expired' || s.status === 'expiring_soon';
        });
      }

      return true;
    });
  }, [vehicles, searchQuery, statusFilter, alertDays]);

  // Open modal to add a new vehicle
  const handleOpenAdd = () => {
    setEditingVehicle(null);
    setFormName('');
    setFormPlate('');
    setFormCategory('صنف ب (B)');
    setFormModelYear(new Date().getFullYear().toString());
    setFormFuelType('بنزين');
    setFormStatus('active');
    setFormNotes('');

    // Prepopulate the 4 standard documents
    const defaultDocs: VehicleDocument[] = STANDARD_DOCUMENTS.map((std, idx) => ({
      id: `doc-${Date.now()}-${idx}`,
      key: std.key,
      name: std.name,
      expiryDate: '',
      issueDate: getTodayDateString(),
      documentNumber: '',
      notes: '',
    }));
    setFormDocuments(defaultDocs);
    setIsAddEditOpen(true);
  };

  // Open modal to edit an existing vehicle
  const handleOpenEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormName(v.name);
    setFormPlate(v.plateNumber);
    setFormCategory(v.category);
    setFormModelYear(v.modelYear || '');
    setFormFuelType(v.fuelType || 'بنزين');
    setFormStatus(v.status);
    setFormNotes(v.notes || '');

    // Ensure all 4 standard documents exist
    const existing = [...v.documents];
    for (const std of STANDARD_DOCUMENTS) {
      if (!existing.some((d) => d.key === std.key)) {
        existing.push({
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          key: std.key,
          name: std.name,
          expiryDate: '',
          issueDate: getTodayDateString(),
        });
      }
    }
    setFormDocuments(existing);
    setIsAddEditOpen(true);
  };

  // Add a custom document to the form
  const handleAddCustomDoc = () => {
    setFormDocuments((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        key: 'custom',
        name: 'المراقبة التقنية (Contrôle technique)',
        expiryDate: '',
        issueDate: getTodayDateString(),
        documentNumber: '',
        notes: '',
      },
    ]);
  };

  // Remove a custom document
  const handleRemoveDoc = (id: string) => {
    setFormDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Update a field inside formDocuments
  const handleUpdateDocField = (id: string, field: keyof VehicleDocument, value: string) => {
    setFormDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  // Save vehicle (create or update)
  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPlate.trim()) {
      alert('يرجى إدخال اسم المركبة ورقم الترقيم (Matricule)');
      return;
    }

    if (editingVehicle) {
      vehicleService.update(editingVehicle.id, {
        name: formName.trim(),
        plateNumber: formPlate.trim(),
        category: formCategory,
        modelYear: formModelYear.trim(),
        fuelType: formFuelType,
        status: formStatus,
        notes: formNotes.trim(),
        documents: formDocuments,
      });
      showToast('تم تحديث بيانات المركبة والوثائق بنجاح');
    } else {
      vehicleService.create({
        name: formName.trim(),
        plateNumber: formPlate.trim(),
        category: formCategory,
        modelYear: formModelYear.trim(),
        fuelType: formFuelType,
        status: formStatus,
        notes: formNotes.trim(),
        documents: formDocuments,
      });
      showToast('تمت إضافة المركبة الجديدة بنجاح');
    }

    setIsAddEditOpen(false);
  };

  // Delete vehicle
  const handleDeleteVehicle = (v: Vehicle) => {
    if (window.confirm(`هل أنت متأكد من رغبتك في حذف المركبة "${v.name}" (${v.plateNumber})؟`)) {
      vehicleService.delete(v.id);
      showToast(`تم حذف المركبة "${v.name}" بنجاح`);
    }
  };

  // Quick renew handler
  const handleOpenRenew = (vehicle: Vehicle, doc: VehicleDocument) => {
    setRenewTarget({ vehicle, document: doc });
    setRenewDate(doc.expiryDate || getTodayDateString());
    setRenewIssueDate(getTodayDateString());
    setRenewDocNum(doc.documentNumber || '');
  };

  const handleSaveRenew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTarget || !renewDate) return;

    vehicleService.renewDocument(
      renewTarget.vehicle.id,
      renewTarget.document.id,
      renewDate,
      renewIssueDate,
      renewDocNum
    );

    showToast(`تم تجديد ${renewTarget.document.name} للمركبة ${renewTarget.vehicle.name} بنجاح`);
    setRenewTarget(null);
  };

  // Quick preset adder for renewal date (e.g. +6 months, +1 year)
  const handleAddMonthsToRenew = (months: number) => {
    const base = renewDate ? new Date(renewDate) : new Date();
    base.setMonth(base.getMonth() + months);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    setRenewDate(`${y}-${m}-${d}`);
  };

  return (
    <div className="vehicles-page">
      <Sidebar />

      <main className="vehicles-content">
        {/* Topbar */}
        <div className="vehicles-topbar">
          <div className="vehicles-crumb">
            الرئيسية / <b>إدارة المركبات والسيارات</b>
          </div>
          {toastMessage && (
            <div style={{
              background: 'var(--success-tint)',
              color: 'var(--success)',
              padding: '6px 16px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)'
            }}>
              ✓ {toastMessage}
            </div>
          )}
        </div>

        {/* Page Head */}
        <div className="vehicles-page-head">
          <div>
            <div className="vehicles-eyebrow">أسطول المدرسة والسلامة</div>
            <h1>إدارة المركبات والسيارات</h1>
            <p>متابعة وتجديد الوثائق الإجبارية (التأمين، البطاقة الرمادية، مطفأة الحريق، صندوق الإسعاف) والتنبيهات الموقوتة</p>
          </div>

          <div className="vehicles-head-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleOpenAdd}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>إضافة سيارة جديدة</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="vehicles-stats-grid">
          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">إجمالي أسطول السيارات</span>
              <span className="kpi-value">{summary.total}</span>
              <span className="kpi-sub">{summary.active} نشطة في التدريب</span>
            </div>
            <div className="kpi-icon-wrap purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
              </svg>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">سيارات نشطة بالخدمة</span>
              <span className="kpi-value">{summary.active}</span>
              <span className="kpi-sub">{summary.maintenance} في الصيانة</span>
            </div>
            <div className="kpi-icon-wrap green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">تنتهي قريباً (خلال {alertDays} أيام)</span>
              <span className="kpi-value" style={{ color: summary.expiringSoon > 0 ? '#c26900' : undefined }}>
                {summary.expiringSoon}
              </span>
              <span className="kpi-sub">تتطلب التجديد قريباً</span>
            </div>
            <div className="kpi-icon-wrap amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">وثائق منتهية الصلاحية</span>
              <span className="kpi-value" style={{ color: summary.expired > 0 ? '#d93025' : undefined }}>
                {summary.expired}
              </span>
              <span className="kpi-sub">تحتاج تجديداً عاجلاً</span>
            </div>
            <div className="kpi-icon-wrap red">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>
        </div>

        {/* Urgent Alert Banner (shown when any document is expired or expiring soon) */}
        {urgentAlertItems.length > 0 && (
          <div className={`alert-banner ${summary.expired === 0 ? 'warning-only' : ''}`}>
            <div className="alert-banner-header">
              <div className="alert-banner-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>
                  مركز التنبيهات: هناك {urgentAlertItems.length} {urgentAlertItems.length === 1 ? 'وثيقة أو تجهيز' : 'وثائق وتجهيزات'} تتطلب انتباهك فوراً
                </span>
              </div>

              <div
                className="alert-timer-chip"
                onClick={() => {
                  window.dispatchEvent(new Event(VEHICLES_UPDATED_EVENT));
                }}
              >
                <span>⏱ التنبيه مبرمج على {alertDays} أيام قبل الانتهاء</span>
                <span style={{ textDecoration: 'underline', color: 'var(--primary)', fontWeight: 700 }}>تعديل</span>
              </div>
            </div>

            <div className="alert-items-list">
              {urgentAlertItems.slice(0, 5).map(({ vehicle, doc, status }) => (
                <div
                  key={`${vehicle.id}-${doc.id}`}
                  className={`alert-item-row ${status.status === 'expiring_soon' ? 'is-expiring' : ''}`}
                >
                  <div className="alert-item-details">
                    <span className="alert-item-vehicle">{vehicle.name}</span>
                    <span className="matricule-plate" style={{ fontSize: '11px', padding: '1px 6px' }}>{vehicle.plateNumber}</span>
                    <span className="alert-item-doc">← <b>{doc.name}</b></span>
                    <span style={{ fontSize: '12px', color: '#596882' }}>(تاريخ الانتهاء: {doc.expiryDate})</span>
                  </div>

                  <div className="alert-item-actions">
                    <span className={`status-badge ${status.badgeClass}`}>
                      {status.label}
                    </span>
                    <button
                      type="button"
                      className="btn-renew-mini"
                      onClick={() => handleOpenRenew(vehicle, doc)}
                    >
                      تجديد الآن
                    </button>
                  </div>
                </div>
              ))}

              {urgentAlertItems.length > 5 && (
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#596882', marginTop: '4px' }}>
                  و {urgentAlertItems.length - 5} وثائق وتجهيزات أخرى تتطلب التجديد.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search & Filters Bar */}
        <div className="vehicles-filters-bar">
          <div className="vehicles-search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="ابحث باسم السيارة، رقم الترقيم، الصنف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-tabs">
            <button
              type="button"
              className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              جميع السيارات ({vehicles.length})
            </button>

            <button
              type="button"
              className={`filter-tab ${statusFilter === 'alerts' ? 'active' : ''}`}
              onClick={() => setStatusFilter('alerts')}
            >
              تتطلب انتباهاً
              {summary.totalAlerts > 0 && (
                <span className="badge" style={{ background: summary.expired > 0 ? '#fdebee' : '#fef4e8', color: summary.expired > 0 ? '#d93025' : '#c26900' }}>
                  {summary.totalAlerts}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`filter-tab ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              نشطة بالخدمة ({summary.active})
            </button>

            <button
              type="button"
              className={`filter-tab ${statusFilter === 'maintenance' ? 'active' : ''}`}
              onClick={() => setStatusFilter('maintenance')}
            >
              في الصيانة ({summary.maintenance})
            </button>
          </div>
        </div>

        {/* Vehicles Cards Grid */}
        {filteredVehicles.length === 0 ? (
          <div className="empty-vehicles-state">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3>لا توجد سيارات مطابقة</h3>
            <p>لم يتم العثور على أي سيارة تطابق معايير البحث أو التصفية الحالية.</p>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '12px' }}
              onClick={handleOpenAdd}
            >
              + إضافة سيارة جديدة
            </button>
          </div>
        ) : (
          <div className="vehicles-grid">
            {filteredVehicles.map((vehicle) => {
              // Calculate vehicle flags
              const hasExpired = vehicle.documents.some(
                (d) => calculateDocumentStatus(d.expiryDate, alertDays).status === 'expired'
              );
              const hasExpiring = vehicle.documents.some(
                (d) => calculateDocumentStatus(d.expiryDate, alertDays).status === 'expiring_soon'
              );

              return (
                <div
                  key={vehicle.id}
                  className={`vehicle-card ${hasExpired ? 'has-expired' : hasExpiring ? 'has-warning' : ''}`}
                >
                  {/* Card Head */}
                  <div className="vehicle-card-head">
                    <div className="vehicle-identity">
                      <div className="vehicle-name-row">
                        <h3 className="vehicle-title">{vehicle.name}</h3>
                        <span className="badge-category">{vehicle.category}</span>
                        <span className={`badge-status ${vehicle.status}`}>
                          {vehicle.status === 'active' ? 'نشطة' : vehicle.status === 'maintenance' ? 'في الصيانة' : 'متوقفة'}
                        </span>
                      </div>

                      {/* Matricule License Plate */}
                      <div className="matricule-plate" title="رقم الترقيم / Matricule">
                        {vehicle.plateNumber}
                      </div>

                      <div className="vehicle-meta-tags">
                        {vehicle.modelYear && (
                          <span className="vehicle-meta-item">
                            سنة: {vehicle.modelYear}
                          </span>
                        )}
                        {vehicle.fuelType && (
                          <span className="vehicle-meta-item">
                            • وقود: {vehicle.fuelType}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="vehicle-action-btns">
                      <button
                        type="button"
                        className="btn-icon-action"
                        title="تعديل بيانات المركبة"
                        onClick={() => handleOpenEdit(vehicle)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="btn-icon-action delete"
                        title="حذف المركبة"
                        onClick={() => handleDeleteVehicle(vehicle)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {vehicle.notes && (
                    <p className="vehicle-notes-snippet">{vehicle.notes}</p>
                  )}

                  {/* Documents & Safety Equipment Tracker */}
                  <div className="vehicle-docs-section">
                    <div className="vehicle-docs-heading">
                      <span>الوثائق والتجهيزات وصلاحيتها</span>
                      <span style={{ fontSize: '11px', color: '#7b879c' }}>
                        منبه: {alertDays} أيام
                      </span>
                    </div>

                    <div className="docs-grid">
                      {vehicle.documents.map((doc) => {
                        const statusInfo = calculateDocumentStatus(doc.expiryDate, alertDays);
                        return (
                          <div
                            key={doc.id}
                            className={`doc-row ${
                              statusInfo.status === 'expired'
                                ? 'doc-expired'
                                : statusInfo.status === 'expiring_soon'
                                ? 'doc-expiring'
                                : ''
                            }`}
                          >
                            <div className="doc-name-col">
                              <div className="doc-icon-badge">
                                {doc.key === 'insurance' ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                  </svg>
                                ) : doc.key === 'grey_card' ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="16" rx="2" />
                                    <line x1="7" y1="8" x2="17" y2="8" />
                                    <line x1="7" y1="12" x2="13" y2="12" />
                                  </svg>
                                ) : doc.key === 'fire_extinguisher' ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
                                  </svg>
                                ) : doc.key === 'first_aid' ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <line x1="12" y1="8" x2="12" y2="16" />
                                    <line x1="8" y1="12" x2="16" y2="12" />
                                  </svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                  </svg>
                                )}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div className="doc-name">{doc.name}</div>
                                {doc.documentNumber && (
                                  <div style={{ fontSize: '11px', color: '#7b879c' }}>
                                    رقم: {doc.documentNumber}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="doc-expiry-col">
                              <span className="doc-date-text">
                                {doc.expiryDate || 'غير محدد'}
                              </span>

                              <span className={`status-badge ${statusInfo.badgeClass}`}>
                                {statusInfo.label}
                              </span>

                              <button
                                type="button"
                                className="doc-renew-btn"
                                onClick={() => handleOpenRenew(vehicle, doc)}
                                title="تجديد تاريخ الصلاحية"
                              >
                                تجديد
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="vehicle-card-footer">
                    <span style={{ fontSize: '12px', color: '#7b879c' }}>
                      آخر تحديث: {new Date(vehicle.updatedAt).toLocaleDateString('ar-DZ')}
                    </span>

                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12.5px' }}
                      onClick={() => handleOpenEdit(vehicle)}
                    >
                      تعديل والوثائق
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Modal: Add / Edit Vehicle ── */}
      {isAddEditOpen && (
        <div className="modal-overlay" onClick={() => setIsAddEditOpen(false)}>
          <div className="modal-container large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editingVehicle ? 'تعديل بيانات المركبة والوثائق' : 'إضافة سيارة جديدة للمدرسة'}</h2>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setIsAddEditOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVehicle}>
              <div className="modal-body">
                <div className="form-section-title">بيانات المركبة الأساسية</div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>اسم وطراز السيارة <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="مثال: داسيا سانديرو (Dacia Sandero)"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>رقم الترقيم / Matricule <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="مثال: 01452 118 16"
                      value={formPlate}
                      onChange={(e) => setFormPlate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>صنف رخصة السياقة</label>
                    <select
                      className="form-select"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    >
                      <option value="صنف ب (B)">صنف ب (B) - سياحي</option>
                      <option value="صنف أ (A)">صنف أ (A) - دراجة نارية</option>
                      <option value="صنف ج (C)">صنف ج (C) - شاحنة</option>
                      <option value="صنف د (D)">صنف د (D) - حافلة</option>
                      <option value="صنف هـ (E)">صنف هـ (E) - مقطورة</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>سنة الصنع</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="مثال: 2021"
                      value={formModelYear}
                      onChange={(e) => setFormModelYear(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>نوع الوقود</label>
                    <select
                      className="form-select"
                      value={formFuelType}
                      onChange={(e) => setFormFuelType(e.target.value as any)}
                    >
                      <option value="بنزين">بنزين (Essence)</option>
                      <option value="مازوت">مازوت (Gasoil)</option>
                      <option value="غاز (GPL)">غاز (GPL)</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>حالة المركبة</label>
                    <select
                      className="form-select"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as VehicleStatus)}
                    >
                      <option value="active">نشطة ومتاحة للتدريب</option>
                      <option value="maintenance">في الصيانة / ورشة الإصلاح</option>
                      <option value="inactive">متوقفة عن الخدمة</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>ملاحظات إضافية</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="مثال: سيارة مجهزة بدواسات مزدوجة معتمدة"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Tracking Documents & Safety Items */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                  <div className="form-section-title" style={{ margin: 0 }}>
                    الوثائق وتجهيزات السلامة وتواريخ الصلاحية
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={handleAddCustomDoc}
                  >
                    + إضافة وثيقة إضافية
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {formDocuments.map((doc, idx) => (
                    <div key={doc.id} className="doc-form-card">
                      <div className="doc-form-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'var(--primary-tint)',
                            color: 'var(--primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700
                          }}>
                            {idx + 1}
                          </span>
                          {doc.key === 'custom' ? (
                            <input
                              type="text"
                              className="form-input"
                              style={{ width: '220px', padding: '4px 8px', fontSize: '13px' }}
                              value={doc.name}
                              onChange={(e) => handleUpdateDocField(doc.id, 'name', e.target.value)}
                              placeholder="اسم الوثيقة"
                            />
                          ) : (
                            <span>{doc.name}</span>
                          )}
                        </div>

                        {doc.key === 'custom' && (
                          <button
                            type="button"
                            className="btn-close-modal"
                            onClick={() => handleRemoveDoc(doc.id)}
                            title="حذف هذا البند"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="form-grid-3">
                        <div className="form-group">
                          <label>تاريخ انتهاء الصلاحية <span className="required">*</span></label>
                          <input
                            type="date"
                            className="form-input"
                            value={doc.expiryDate}
                            onChange={(e) => handleUpdateDocField(doc.id, 'expiryDate', e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>تاريخ الإصدار / الفحص</label>
                          <input
                            type="date"
                            className="form-input"
                            value={doc.issueDate || ''}
                            onChange={(e) => handleUpdateDocField(doc.id, 'issueDate', e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                          <label>رقم الوثيقة / الشهادة</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="اختياري"
                            value={doc.documentNumber || ''}
                            onChange={(e) => handleUpdateDocField(doc.id, 'documentNumber', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddEditOpen(false)}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary">
                  {editingVehicle ? 'حفظ التعديلات' : 'إضافة المركبة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Quick Renew Document ── */}
      {renewTarget && (
        <div className="modal-overlay" onClick={() => setRenewTarget(null)}>
          <div className="modal-container small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>تجديد الوثيقة / التجهيز</h2>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setRenewTarget(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRenew}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', padding: '14px', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                  <div>السيارة: <b>{renewTarget.vehicle.name}</b> ({renewTarget.vehicle.plateNumber})</div>
                  <div style={{ marginTop: '4px' }}>الوثيقة: <b>{renewTarget.document.name}</b></div>
                  <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                    تاريخ الانتهاء الحالي: {renewTarget.document.expiryDate || 'غير محدد'}
                  </div>
                </div>

                <div className="form-group">
                  <label>تاريخ انتهاء الصلاحية الجديد <span className="required">*</span></label>
                  <input
                    type="date"
                    className="form-input"
                    value={renewDate}
                    onChange={(e) => setRenewDate(e.target.value)}
                    required
                  />

                  {/* Preset Quick Buttons */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="preset-chip"
                      onClick={() => handleAddMonthsToRenew(6)}
                    >
                      + 6 أشهر
                    </button>
                    <button
                      type="button"
                      className="preset-chip"
                      onClick={() => handleAddMonthsToRenew(12)}
                    >
                      + سنة كاملة
                    </button>
                    <button
                      type="button"
                      className="preset-chip"
                      onClick={() => handleAddMonthsToRenew(24)}
                    >
                      + سنتين
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>تاريخ الإصدار / التجديد</label>
                  <input
                    type="date"
                    className="form-input"
                    value={renewIssueDate}
                    onChange={(e) => setRenewIssueDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>رقم الوصل / الوثيقة الجديد (اختياري)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="رقم بوليصة التأمين أو رقم الوصل"
                    value={renewDocNum}
                    onChange={(e) => setRenewDocNum(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRenewTarget(null)}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary">
                  تأكيد وحفظ التجديد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

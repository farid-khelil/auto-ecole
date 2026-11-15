import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Client } from '../../services/clients';
import Icon from '../Icon.tsx';

const PROFILE_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABb0lEQVR4nO2VS0oDQRCGPxV0YXTl4w7mEMasRRMfeATRhboRCa40Kx/nEHdKPIb43krIAXxGERdGpeAP9GZmMpMeUJgPajV/1V/dU90NGRn/kDGgClwB74pLYBcYTdt8AWgCPwHxCsylaf4toxNgEhhUFIBTfWsB5TS2vSmDzRDdljQvwIjPBqrOyqOoSbvjs4FrFbVtj2JKWhtMb7ypaK4D7ZC09su88RyjgWFpn3w2cKGiNu1RFKU999nAtoraUYviTNqKzwbGgUcVtqMWREWaBx1dr5SBLxnUNO05RdFZuWlKpMS8brqgq7glTSrMAPch5u0wzbRP4x7gwDG4AdaACectyAPrwK009mbsKbdrDlX0E1gGekO09m1FWsvZ79a85Jh3cg23KThNzCY1HwAaKmIrj8uqcutAf5IGlpx/HrbtQfQBd6qxmKSBYyXbwCVlQzWOkiTXlWzTnpS8czRj8xHjBYx6mq1WRsbf5BdeuXgU/C/QAwAAAABJRU5ErkJggg==';

type MainTab = 'profile' | 'attendance' | 'history';

export type ProfileHeaderProps = {
  client: Client;
  isEditing: boolean;
  isSaving: boolean;
  isDirty: boolean;
  isArchivingOrRestoring: boolean;
  activeMainTab: MainTab;
  advanceNotice: string;
  saveError: string;
  onOpenPaymentModal: () => void;
  onStartEditing: () => void;
  onSaveChanges: () => void;
  onCancelEdit: () => void;
  onPrintMedicalCert: () => void;
  onOpenConvocationModal: () => void;
  onOpenTransferModal: () => void;
  onOpenEvaluationCardModal: () => void;
  onArchiveClick: () => void;
  onRestoreClient: () => void;
  onTabChange: (tab: MainTab) => void;
  onPhotoUpload: (photoDataUrl: string) => void;
  onPhotoRemove: () => void;
};

export default function ProfileHeader({
  client,
  isEditing,
  isSaving,
  isDirty,
  isArchivingOrRestoring,
  activeMainTab,
  advanceNotice,
  saveError,
  onOpenPaymentModal,
  onStartEditing,
  onSaveChanges,
  onCancelEdit,
  onPrintMedicalCert,
  onOpenConvocationModal,
  onOpenTransferModal,
  onOpenEvaluationCardModal,
  onArchiveClick,
  onRestoreClient,
  onTabChange,
  onPhotoUpload,
  onPhotoRemove,
}: ProfileHeaderProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const currentPhoto = client.photo || client.attendance?.photo || '';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        const s = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * s);
        canvas.height = Math.round(img.height * s);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          onPhotoUpload(compressed);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <>
      <div className="profile-topbar">
        <div className="breadcrumb">الإدارة / العملاء / <b>ملف العميل</b></div>
        <span className="school-name">مدرسة الأمل للسياقة</span>
      </div>

      <div className="profile-heading">
        <div className="profile-person">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div className="profile-avatar-wrapper">
            <button
              type="button"
              className="profile-avatar-large"
              style={{ background: client.color || '#ece5f8' }}
              onClick={() => photoInputRef.current?.click()}
              title={currentPhoto ? 'انقر لتغيير صورة المتدرب' : 'انقر لتحميل صورة المتدرب'}
            >
              {currentPhoto ? (
                <img
                  src={currentPhoto}
                  alt={client.name || 'صورة المتدرب'}
                  className="profile-avatar-img"
                />
              ) : (
                <img
                  src={PROFILE_ICON}
                  alt="profile"
                  className="avatar-placeholder-img"
                />
              )}
              <div className="avatar-upload-overlay">
                <Icon name="camera" size={16} />
                <span>{currentPhoto ? 'تغيير' : 'تحميل'}</span>
              </div>
            </button>

            <button
              type="button"
              className="avatar-badge-btn"
              onClick={() => photoInputRef.current?.click()}
              title={currentPhoto ? 'تغيير صورة المتدرب' : 'تحميل صورة المتدرب'}
            >
              <Icon name="camera" size={13} />
            </button>

            {currentPhoto && (
              <button
                type="button"
                className="avatar-delete-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotoRemove();
                }}
                title="حذف صورة المتدرب"
              >
                <Icon name="close" size={11} />
              </button>
            )}
          </div>
          <div>
            <h1>{client.name || 'عميل جديد'}</h1>
            <div className="avatar-quick-actions">
              <button
                type="button"
                className="avatar-quick-btn"
                onClick={() => photoInputRef.current?.click()}
              >
                <Icon name="camera" size={13} />
                {currentPhoto ? 'تغيير الصورة' : 'إضافة صورة شخصية'}
              </button>
              {currentPhoto && (
                <button
                  type="button"
                  className="avatar-quick-btn danger"
                  onClick={onPhotoRemove}
                >
                  <Icon name="trash" size={12} />
                  حذف الصورة
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="heading-actions">
          {!isEditing && (
            <button
              className="button primary"
              type="button"
              onClick={onOpenPaymentModal}
              style={{
                background: '#3463d6',
                borderColor: '#3463d6',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <line x1="12" y1="14" x2="16" y2="14" />
              </svg>
              تسجيل دفعة
            </button>
          )}
          {!isEditing ? (
            <button className="button" type="button" onClick={onStartEditing}>تعديل الملف</button>
          ) : (
            <>
              <button className="button primary" type="button" onClick={onSaveChanges} disabled={isSaving || !isDirty}>
                {isSaving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
              </button>
              <button className="button" type="button" onClick={onCancelEdit}>إلغاء</button>
            </>
          )}
          <button
            className="button"
            type="button"
            title="طباعة الشهادة الطبية"
            onClick={onPrintMedicalCert}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="print" size={17} /> شهادة طبية
          </button>
          <button
            className="button"
            type="button"
            title="معاينة وطباعة إستدعاء الامتحان"
            onClick={onOpenConvocationModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="document" size={17} /> إستدعاء
          </button>
          <button
            className="button"
            type="button"
            title="معاينة وطباعة طلب تحويل ملف المترشح"
            onClick={onOpenTransferModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="document" size={17} /> طلب تحويل
          </button>
          <button
            className="button"
            type="button"
            title="معاينة وطباعة بطاقة تقييم المترشح"
            onClick={onOpenEvaluationCardModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="document" size={17} /> بطاقة تقييم
          </button>
          <Link className="back-button" to="/clients">العودة إلى المترشحين</Link>
        </div>
      </div>

      {client.isArchived && (
        <div className="archive-status-banner">
          <div className="archive-status-info">
            <span className="archive-status-icon">📁</span>
            <div>
              <strong>هذا الملف مؤرشف في أرشيف سنة {client.archiveYear || '—'}</strong>
              <p>تم إنهاء التكوين وأرشفة الملف. السجل محفوظ ويمكنك استرجاعه إلى قائمة العملاء الحاليين في أي وقت.</p>
            </div>
          </div>
          <button
            type="button"
            className="button primary"
            style={{ background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={onRestoreClient}
            disabled={isArchivingOrRestoring}
          >
            <Icon name="restore" size={16} />
            {isArchivingOrRestoring ? 'جارٍ الاسترجاع…' : 'استرجاع إلى العملاء الحاليين'}
          </button>
        </div>
      )}

      <div className="profile-tabs">
        <button
          type="button"
          className={`button ${activeMainTab === 'profile' ? 'primary' : ''}`}
          onClick={() => onTabChange('profile')}
          style={{ fontSize: '13px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          معلومات المتدرب العامة
        </button>

        <button
          type="button"
          className={`button ${activeMainTab === 'attendance' ? 'primary' : ''}`}
          onClick={() => onTabChange('attendance')}
          style={{ fontSize: '13px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          بطاقة المداومة والتكوين
        </button>

        <button
          type="button"
          className={`button ${activeMainTab === 'history' ? 'primary' : ''}`}
          onClick={() => onTabChange('history')}
          style={{ fontSize: '13px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="clock" size={17} /> سجل التعديلات والنشاط
        </button>
      </div>

      {saveError && <div className="save-error" role="alert">{saveError}</div>}
      {advanceNotice && (
        <div className="save-error" role="status" style={{ background: '#e7f6ef', color: '#25805f', borderColor: '#b7e8d0' }}>
          {advanceNotice}
        </div>
      )}
    </>
  );
}

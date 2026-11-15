import React, { useState, useEffect } from 'react';
import type { UpdaterStatusData } from '../electron-api';

interface UpdateButtonProps {
  className?: string;
  compact?: boolean;
  showTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
}

export default function UpdateButton({
  className = '',
  compact = false,
  showTrigger = true,
  open,
  onOpenChange,
}: UpdateButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  };
  const [currentVersion, setCurrentVersion] = useState<string>('0.1.0');
  const [status, setStatus] = useState<UpdaterStatusData['status'] | 'idle'>('idle');
  const [newVersion, setNewVersion] = useState<string>('');
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  const [downloadPercent, setDownloadPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [devMessage, setDevMessage] = useState<string>('');

  const isElectron = typeof window !== 'undefined' && Boolean(window.autoEcole?.updater);

  useEffect(() => {
    if (!isElectron || !window.autoEcole?.updater) return;

    // Get initial version
    void window.autoEcole.updater.getVersion().then((v) => {
      if (v) setCurrentVersion(v);
    });

    // Subscribe to updater events from main process
    const unsubscribe = window.autoEcole.updater.onStatus((data: UpdaterStatusData) => {
      if (data.status) {
        setStatus(data.status);
      }
      if (data.version) {
        setNewVersion(data.version);
      }
      if (data.releaseNotes) {
        setReleaseNotes(data.releaseNotes);
      }
      if (data.percent !== undefined) {
        setDownloadPercent(data.percent);
      }
      if (data.message) {
        setErrorMessage(data.message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isElectron]);

  const handleCheckForUpdates = async () => {
    if (!isElectron || !window.autoEcole?.updater) {
      setIsOpen(true);
      return;
    }

    setIsOpen(true);
    setStatus('checking');
    setErrorMessage('');
    setDevMessage('');

    try {
      const res = await window.autoEcole.updater.check();
      if (res.currentVersion) {
        setCurrentVersion(res.currentVersion);
      }

      if (res.status === 'dev-mode') {
        setStatus('dev-mode');
        setDevMessage(res.message || 'التطبيق قيد التشغيل في وضع التطوير (Development Mode)');
      } else if (!res.success) {
        setStatus('error');
        setErrorMessage(res.error || 'فشل الاتصال بخادم التحديثات');
      } else if (res.updateInfo?.version) {
        setStatus('available');
        setNewVersion(res.updateInfo.version);
        if (res.updateInfo.releaseNotes) {
          setReleaseNotes(res.updateInfo.releaseNotes);
        }
      } else {
        setStatus('not-available');
      }
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDownloadUpdate = async () => {
    if (!isElectron || !window.autoEcole?.updater) return;
    setStatus('downloading');
    setDownloadPercent(0);
    setErrorMessage('');

    try {
      const res = await window.autoEcole.updater.download();
      if (!res.success) {
        setStatus('error');
        setErrorMessage(res.error || 'فشل تحميل التحديث');
      }
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleInstallUpdate = async () => {
    if (!isElectron || !window.autoEcole?.updater) return;
    try {
      await window.autoEcole.updater.install();
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      {showTrigger && (
        <>
          {compact ? (
            <button
              type="button"
              className={`updater-compact-btn ${status === 'available' ? 'has-update' : ''} ${className}`}
              onClick={handleCheckForUpdates}
              title="تحديث التطبيق"
              aria-label="تحديث التطبيق"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              {status === 'available' && <span className="updater-pulse-dot" />}
            </button>
          ) : (
            <button
              type="button"
              className={`updater-sidebar-btn ${status === 'available' ? 'has-update' : ''} ${className}`}
              onClick={handleCheckForUpdates}
            >
              <div className="updater-sidebar-btn-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </div>
              <div className="updater-sidebar-btn-text">
                <span className="updater-btn-label">تحديث التطبيق</span>
                <span className="updater-btn-version">v{currentVersion}</span>
              </div>
              {status === 'available' ? (
                <span className="updater-badge-available">تحديث متاح</span>
              ) : (
                <span className="updater-badge-check">فحص</span>
              )}
            </button>
          )}
        </>
      )}

      {/* Update Modal Dialog */}
      {isOpen && (
        <div className="updater-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="updater-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="updater-modal-header">
              <div className="updater-modal-title-row">
                <div className="updater-modal-icon-badge">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                </div>
                <div>
                  <h3 className="updater-modal-title">تحديث تطبيق مدرسة السياقة</h3>
                  <div className="updater-modal-subtitle">الإصدار الحالي: <strong>v{currentVersion}</strong></div>
                </div>
              </div>
              <button
                type="button"
                className="updater-btn-close"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق النافذة"
              >
                ✕
              </button>
            </div>

            <div className="updater-modal-body">
              {!isElectron ? (
                <div className="updater-card info">
                  <div className="updater-card-icon">ℹ️</div>
                  <div>
                    <div className="updater-card-heading">تطبيق الويب</div>
                    <div className="updater-card-desc">
                      أنت تتصفح عبر متصفح الويب. تعمل ميزة التحديث التلقائي المباشر (Auto-Updater) داخل تطبيق سطح المكتب Electron.
                    </div>
                  </div>
                </div>
              ) : status === 'checking' ? (
                <div className="updater-state-box">
                  <div className="updater-spinner" />
                  <div className="updater-state-title">جارٍ التحقق من وجود تحديثات...</div>
                  <div className="updater-state-sub">يتم الاتصال بخادم التحديثات للتحقق من أحدث إصدار متاح.</div>
                </div>
              ) : status === 'available' ? (
                <div className="updater-state-box available">
                  <div className="updater-badge-pill new">إصدار جديد متاح</div>
                  <div className="updater-new-version">الإصدار: v{newVersion || 'الجديد'}</div>
                  {releaseNotes ? (
                    <div className="updater-release-notes">
                      <strong>ملاحظات الإصدار:</strong>
                      <p>{releaseNotes}</p>
                    </div>
                  ) : (
                    <div className="updater-state-sub">
                      يتوفر تحديث جديد يحتوي على تحسينات وإصلاحات مهمة للتطبيق. اضغط على زر التحميل أدناه لبدء التحديث.
                    </div>
                  )}
                </div>
              ) : status === 'downloading' ? (
                <div className="updater-state-box">
                  <div className="updater-state-title">جارٍ تحميل التحديث... ({downloadPercent}%)</div>
                  <div className="updater-progress-track">
                    <div className="updater-progress-fill" style={{ width: `${downloadPercent}%` }} />
                  </div>
                  <div className="updater-state-sub">يرجى الانتظار حتى يكتمل تنزيل حزمة التحديث.</div>
                </div>
              ) : status === 'downloaded' ? (
                <div className="updater-state-box success">
                  <div className="updater-success-icon">✓</div>
                  <div className="updater-state-title">تم تحميل التحديث بنجاح!</div>
                  <div className="updater-state-sub">
                    حزمة التحديث جاهزة الآن للتثبيت. سيتم إعادة تشغيل التطبيق تلقائياً وتطبيق التحديث الجديد.
                  </div>
                </div>
              ) : status === 'not-available' ? (
                <div className="updater-state-box success">
                  <div className="updater-success-icon">✓</div>
                  <div className="updater-state-title">أنت تستخدم آخر إصدار متوفر</div>
                  <div className="updater-state-sub">التطبيق محدث إلى آخر إصدار (v{currentVersion}). لا توجد تحديثات جديدة حالياً.</div>
                </div>
              ) : status === 'dev-mode' ? (
                <div className="updater-card dev">
                  <div className="updater-card-icon">⚡</div>
                  <div>
                    <div className="updater-card-heading">بيئة التطوير (Development Mode)</div>
                    <div className="updater-card-desc">
                      {devMessage}
                      <br />
                      عند بناء حزمة التطبيق النهائية (Production Build)، ستقوم ميزة <code>electron-updater</code> بفحص وتحميل وتثبيت التحديثات تلقائياً عبر GitHub Releases.
                    </div>
                  </div>
                </div>
              ) : status === 'error' ? (
                <div className="updater-card error">
                  <div className="updater-card-icon">⚠️</div>
                  <div>
                    <div className="updater-card-heading">تعذر التحقق من التحديث</div>
                    <div className="updater-card-desc">{errorMessage}</div>
                  </div>
                </div>
              ) : (
                <div className="updater-state-box">
                  <div className="updater-state-title">فحص التحديثات المتاحة</div>
                  <div className="updater-state-sub">اضغط على زر الفحص للتحقق مما إذا كان هناك إصدار جديد متوفر للتطبيق.</div>
                </div>
              )}
            </div>

            <div className="updater-modal-footer">
              <button
                type="button"
                className="updater-btn-secondary"
                onClick={() => setIsOpen(false)}
              >
                إغلاق
              </button>

              {status === 'available' ? (
                <button
                  type="button"
                  className="updater-btn-primary"
                  onClick={handleDownloadUpdate}
                >
                  تحميل التحديث الآن
                </button>
              ) : status === 'downloaded' ? (
                <button
                  type="button"
                  className="updater-btn-primary success"
                  onClick={handleInstallUpdate}
                >
                  إعادة التشغيل والتثبيت
                </button>
              ) : (
                <button
                  type="button"
                  className="updater-btn-primary"
                  onClick={handleCheckForUpdates}
                  disabled={status === 'checking' || status === 'downloading'}
                >
                  {status === 'checking' ? 'جارٍ الفحص...' : 'فحص التحديثات'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

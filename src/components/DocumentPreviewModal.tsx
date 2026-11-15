import type { ReactNode } from 'react';
import Icon from './Icon.tsx';

interface DocumentPreviewModalProps {
  title: ReactNode;
  summary?: ReactNode;
  controls?: ReactNode;
  preview: ReactNode;
  downloadLabel: string;
  downloadTitle?: string;
  onDownload: () => void | Promise<void>;
  secondaryDownloadLabel?: string;
  secondaryDownloadTitle?: string;
  onSecondaryDownload?: () => void | Promise<void>;
  printLabel: string;
  onPrint: () => void;
  onClose: () => void;
  closeLabel?: string;
}

/** Shared full-screen preview shell for printable and downloadable documents. */
export default function DocumentPreviewModal({
  title,
  summary,
  controls,
  preview,
  downloadLabel,
  downloadTitle,
  onDownload,
  secondaryDownloadLabel,
  secondaryDownloadTitle,
  onSecondaryDownload,
  printLabel,
  onPrint,
  onClose,
  closeLabel = 'إغلاق',
}: DocumentPreviewModalProps) {
  return (
    <div className="candidates-modal-overlay" onClick={onClose}>
      <section
        className="candidates-modal-card"
        style={{
          maxWidth: '1050px',
          width: '95vw',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'معاينة المستند'}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="candidates-modal-header" style={{ padding: '14px 20px' }}>
          <div>
            <h2>{title}</h2>
            {summary && <p>{summary}</p>}
            {controls && <div className="document-preview-controls">{controls}</div>}
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div
          className="candidates-modal-body"
          style={{
            flex: 1,
            padding: 0,
            background: 'var(--bg-card-alt)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {preview}
        </div>

        <footer
          className="candidates-modal-footer document-preview-footer"
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-card)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            className="btn-cancel"
            style={{ width: 'auto', padding: '0 16px', height: '38px' }}
            onClick={onClose}
          >
            {closeLabel}
          </button>
          {secondaryDownloadLabel && onSecondaryDownload && (
            <button
              type="button"
              className="btn-print-list document-preview-btn-secondary-download"
              onClick={onSecondaryDownload}
              title={secondaryDownloadTitle}
            >
              <Icon name="chart" size={17} /> {secondaryDownloadLabel}
            </button>
          )}
          <button
            type="button"
            className="btn-print-list document-preview-btn-download"
            onClick={onDownload}
            title={downloadTitle}
          >
            <Icon name="download" size={17} /> {downloadLabel}
          </button>
          <button
            type="button"
            className="btn-print-list document-preview-btn-print"
            onClick={onPrint}
          >
            <Icon name="print" size={17} /> {printLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

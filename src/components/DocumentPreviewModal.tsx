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

/** Full-screen preview page for printable and downloadable documents. */
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
  closeLabel = 'رجوع',
}: DocumentPreviewModalProps) {
  return (
    <div className="document-preview-page">
      <header className="document-preview-page-header">
        <button type="button" className="document-preview-back-btn" onClick={onClose} aria-label="رجوع">
          <Icon name="arrow" size={18} />
          <span>{closeLabel}</span>
        </button>

        <div className="document-preview-page-title">
          <h2>{title}</h2>
          {summary && <p>{summary}</p>}
        </div>

        <div className="document-preview-page-actions">
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
        </div>
      </header>

      <div className="document-preview-page-content">
        <div className="document-preview-page-body">
          {preview}
        </div>

        {controls && (
          <aside className="document-preview-page-sidebar">
            <h3>إعدادات المستند</h3>
            <div className="document-preview-sidebar-fields">
              {controls}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

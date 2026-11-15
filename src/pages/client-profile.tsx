import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import Icon from '../components/Icon.tsx';
import DocumentPreviewModal from '../components/DocumentPreviewModal.tsx';
import ProfileHeader from '../components/client-profile/ProfileHeader';
import ProfileMainContent, { type HistoryFilter } from '../components/client-profile/ProfileMainContent';
import { clientService, TRAINING_STAGES, type Client } from '../services/clients';
import { createInitialAttendanceCard, getLatestExam, type AttendanceCard as AttendanceCardType } from '../services/attendance';
import { printMedicalCertificate } from '../services/medical-cert';
import { getConvocationLetterHtml, downloadConvocationLetter, hourToArabic } from '../services/convocation-letter';
import { getTransferRequestHtml, downloadTransferRequest, splitClientName } from '../services/transfer-request';
import { getEvaluationCardHtml, downloadEvaluationCard } from '../services/evaluation-card';
import '../styles/client-profile.css';
import '../styles/payments.css';
import '../styles/candidates-list.css';

const TRAINING_OPTIONS = ['A', 'A1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D', 'DE', 'F'];
const PROFILE_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABb0lEQVR4nO2VS0oDQRCGPxV0YXTl4w7mEMasRRMfeATRhboRCa40Kx/nEHdKPIb43krIAXxGERdGpeAP9GZmMpMeUJgPajV/1V/dU90NGRn/kDGgClwB74pLYBcYTdt8AWgCPwHxCsylaf4toxNgEhhUFIBTfWsB5TS2vSmDzRDdljQvwIjPBqrOyqOoSbvjs4FrFbVtj2JKWhtMb7ypaK4D7ZC09su88RyjgWFpn3w2cKGiNu1RFKU999nAtoraUYviTNqKzwbGgUcVtqMWREWaBx1dr5SBLxnUNO05RdFZuWlKpMS8brqgq7glTSrMAPch5u0wzbRP4x7gwDG4AdaACectyAPrwK009mbsKbdrDlX0E1gGekO09m1FWsvZ79a85Jh3cg23KThNzCY1HwAaKmIrj8uqcutAf5IGlpx/HrbtQfQBd6qxmKSBYyXbwCVlQzWOkiTXlWzTnpS8czRj8xHjBYx6mq1WRsbf5BdeuXgU/C/QAwAAAABJRU5ErkJggg==';

function formatDate(value?: string) {
	if (!value) return 'غير محدد';
	return new Intl.DateTimeFormat('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function formatCurrency(amount?: number) {
	const num = Number(amount ?? 0);
	return new Intl.NumberFormat('ar-DZ').format(num) + ' د.ج';
}


function toClient(data: Partial<Client>, id: string): Client {
	const paid = Number(data.paidAmount ?? 0);
	const total = Number(data.totalAmount ?? 35000);
	const stage = data.stage || 'قانون المرور';
	const attendance = data.attendance || createInitialAttendanceCard(data.registrationDate);
	const photo = data.photo || attendance.photo || '';

	return {
		id: data.id || id,
		registrationNumber: data.registrationNumber || '',
		name: data.name || '',
		phone: data.phone || '',
		birthDate: data.birthDate || '',
		birthPlace: data.birthPlace || '',
		email: data.email || '',
		address: data.address || '',
		training: data.training || 'B',
		obtainedCategories: data.obtainedCategories || [],
		registrationDate: data.registrationDate || '',
		receivedDocuments: data.receivedDocuments || [],
		documents: data.documents || [],
		paidAmount: paid,
		totalAmount: total,
		stage,
		attendance,
		color: data.color || '#e8e5ff',
		history: data.history || [],
		photo,
	};
}

function editableValues(client: Client) {
	return JSON.stringify({
		registrationNumber: client.registrationNumber || '',
		name: client.name,
		phone: client.phone,
		birthDate: client.birthDate,
		birthPlace: client.birthPlace || '',
		email: client.email,
		address: client.address,
		training: client.training,
		obtainedCategories: [...(client.obtainedCategories || [])].sort(),
		registrationDate: client.registrationDate,
		paidAmount: Number(client.paidAmount ?? 0),
		totalAmount: Number(client.totalAmount ?? 0),
		stage: client.stage || 'قانون المرور',
		receivedDocuments: [...(client.receivedDocuments || [])].sort(),
		attendance: client.attendance,
		photo: client.photo || client.attendance?.photo || '',
	});
}

export default function ClientProfile() {
	const location = useLocation();
	const { id = '' } = useParams();
	const [client, setClient] = useState<Client | null>(null);
	const [draft, setDraft] = useState<Client | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState('');
	const [activeMainTab, setActiveMainTab] = useState<'profile' | 'attendance' | 'history'>('profile');
	const [advanceNotice, setAdvanceNotice] = useState('');

	// Payment Modal State (must be before any early return)
	const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
	const [paymentAmountInput, setPaymentAmountInput] = useState('');
	const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'cheque'>('cash');
	const [paymentNote, setPaymentNote] = useState('');
	const [paymentToast, setPaymentToast] = useState('');
	const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
	const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
	const [noteText, setNoteText] = useState('');
	const [isSavingNote, setIsSavingNote] = useState(false);

	// Archive State
	const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
	const [archiveYearInput, setArchiveYearInput] = useState<number>(new Date().getFullYear());
	const [isArchivingOrRestoring, setIsArchivingOrRestoring] = useState(false);
	const [archiveToast, setArchiveToast] = useState('');

	// Convocation (إستدعاء) State
	const convocationFrameRef = useRef<HTMLIFrameElement>(null);
	const [isConvocationModalOpen, setIsConvocationModalOpen] = useState(false);
	const [convocationNumber, setConvocationNumber] = useState('2026/88');
	const [convocationIssuedDate, setConvocationIssuedDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [convocationExamDate, setConvocationExamDate] = useState('');
	const [convocationTime, setConvocationTime] = useState('08:00');

	// Transfer Request (طلب تحويل) State
	const transferFrameRef = useRef<HTMLIFrameElement>(null);
	const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
	const [transferNumber, setTransferNumber] = useState('02');
	const [transferYear, setTransferYear] = useState(() => new Date().getFullYear().toString());
	const [transferFrom, setTransferFrom] = useState('بوطيبة محمد');
	const [transferTo, setTransferTo] = useState('');
	const [transferLastName, setTransferLastName] = useState('');
	const [transferFirstName, setTransferFirstName] = useState('');
	const [transferBirth, setTransferBirth] = useState('');
	const [transferRegNum, setTransferRegNum] = useState('');
	const [transferReason, setTransferReason] = useState('قرب المدرسة الثانية من مقر الإقامة .');
	const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));

	// Evaluation Card (بطاقة تقييم) State
	const evaluationFrameRef = useRef<HTMLIFrameElement>(null);
	const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);

	const transferReferenceText = `${transferDate || new Date().toISOString().slice(0, 10)} رقم : ${transferNumber || '02'} / م.و.أ.ط/ ${transferYear || new Date().getFullYear().toString()}`;

	function updateTransferReferenceText(value: string) {
		const match = value.match(/(\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*رقم\s*:\s*(\d+)\s*\/\s*م\.و\.أ\.ط\/\s*(\d{4})/);
		if (!match) {
			setTransferNumber(value.trim() || '02');
			return;
		}
		const [, date, number, year] = match;
		setTransferDate(date.replace(/\//g, '-'));
		setTransferNumber(number);
		setTransferYear(year);
	}

	useEffect(() => {
		const routeClient = location.state ? toClient(location.state as Partial<Client>, id) : null;
		if (routeClient) {
			setClient(routeClient);
			setDraft(routeClient);
			if (routeClient.registrationDate) {
				const y = new Date(routeClient.registrationDate).getFullYear();
				if (y && y >= 2000) setArchiveYearInput(y);
			}
			return;
		}
		void clientService.find(id).then((storedClient) => {
			if (storedClient) {
				const full = toClient(storedClient, id);
				setClient(full);
				setDraft(full);
				if (full.registrationDate) {
					const y = new Date(full.registrationDate).getFullYear();
					if (y && y >= 2000) setArchiveYearInput(y);
				}
			}
		});
	}, [id, location.state]);

	useEffect(() => {
		if (paymentToast) {
			const timer = setTimeout(() => setPaymentToast(''), 3500);
			return () => clearTimeout(timer);
		}
	}, [paymentToast]);

	useEffect(() => {
		if (archiveToast) {
			const timer = setTimeout(() => setArchiveToast(''), 4000);
			return () => clearTimeout(timer);
		}
	}, [archiveToast]);

	

	async function handleRestoreClient() {
		if (!client) return;
		setIsArchivingOrRestoring(true);
		try {
			const updated = await clientService.restoreClient(String(client.id));
			const full = toClient(updated, String(client.id));
			setClient(full);
			setDraft(full);
			setArchiveToast('تم استرجاع ملف المتدرب بنجاح إلى قائمة العملاء الحاليين');
		} catch (err) {
			alert(err instanceof Error ? err.message : 'تعذر استرجاع الملف');
		} finally {
			setIsArchivingOrRestoring(false);
		}
	}

	if (!client || !draft) {
		return (
			<main className="profile-page" dir="rtl" lang="ar">
				<Sidebar />
				<section className="profile-content">جارٍ تحميل ملف العميل…</section>
			</main>
		);
	}

	const isDirty = editableValues(client) !== editableValues(draft);

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

	function handleOpenPaymentModal() {
		const rem = client ? Math.max(0, Number(client.totalAmount ?? 35000) - Number(client.paidAmount ?? 0)) : 0;
		setPaymentAmountInput(rem > 0 ? String(rem) : '5000');
		setPaymentMethod('cash');
		setPaymentNote('');
		setIsPaymentModalOpen(true);
	}

	function handleClosePaymentModal() {
		setIsPaymentModalOpen(false);
	}

	async function handleSubmitPayment(e: React.FormEvent) {
		e.preventDefault();
		const amount = parseFloat(paymentAmountInput);
		if (isNaN(amount) || amount <= 0) {
			alert('يرجى إدخال مبلغ صحيح.');
			return;
		}
		if (!client) return;

		try {
			const saved = await clientService.recordPayment(String(client.id), amount, paymentNote);
			const full = toClient(saved, String(client.id));
			setClient(full);
			setDraft(full);
			setIsPaymentModalOpen(false);
			setPaymentToast(`تم تسجيل دفعة بنجاح بمبلغ ${formatCurrency(amount)}`);
		} catch (err) {
			alert('حدث خطأ أثناء حفظ الدفعة. حاول مرة أخرى.');
		}
	}

	function updateDraft<K extends keyof Client>(field: K, value: Client[K]) {
		setDraft((current) => (current ? { ...current, [field]: value } : current));
	}

	function toggleDocument(id: string) {
		if (!isEditing) return;
		setDraft((current) => {
			if (!current) return current;
			const received = current.receivedDocuments || [];
			const nextReceived = received.includes(id)
				? received.filter((docId) => docId !== id)
				: [...received, id];
			return { ...current, receivedDocuments: nextReceived };
		});
	}

	function toggleObtainedCategory(category: string) {
		if (!isEditing) return;
		setDraft((current) => {
			if (!current) return current;
			const list = current.obtainedCategories || [];
			const nextList = list.includes(category)
				? list.filter((cat) => cat !== category)
				: [...list, category];
			return { ...current, obtainedCategories: nextList };
		});
	}

	async function handleAttendanceUpdate(updatedAttendance: AttendanceCardType) {
		if (!client) return;
		const updated = {
			...client,
			attendance: updatedAttendance,
		};
		setDraft(updated);
		try {
			const saved = await clientService.update(String(client.id), updated);
			const full = toClient(saved, String(client.id));
			setClient(full);
			setDraft(full);
		} catch {
			setSaveError('تعذر حفظ تحديث بطاقة المداومة. حاول مرة أخرى.');
		}
	}

	async function handlePhotoUpload(photoDataUrl: string) {
		if (!client) return;

		if (isEditing) {
			setDraft((current) => {
				if (!current) return current;
				return {
					...current,
					photo: photoDataUrl,
				};
			});
			return;
		}

		try {
			setIsSaving(true);
			setSaveError('');
			const updated: Client = {
				...client,
				photo: photoDataUrl,
			};
			const saved = await clientService.update(String(client.id), updated);
			const full = toClient(saved, String(client.id));
			setClient(full);
			setDraft(full);
			setAdvanceNotice('تم تحديث صورة المترشح بنجاح');
			window.setTimeout(() => setAdvanceNotice(''), 4000);
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : 'تعذر حفظ صورة المترشح.');
		} finally {
			setIsSaving(false);
		}
	}

	async function handlePhotoRemove() {
		if (!client) return;
		if (!window.confirm('هل أنت متأكد من حذف صورة المترشح؟')) return;

		if (isEditing) {
			setDraft((current) => {
				if (!current) return current;
				return {
					...current,
					photo: '',
				};
			});
			return;
		}

		try {
			setIsSaving(true);
			setSaveError('');
			const updated: Client = {
				...client,
				photo: '',
			};
			const saved = await clientService.update(String(client.id), updated);
			const full = toClient(saved, String(client.id));
			setClient(full);
			setDraft(full);
			setAdvanceNotice('تم حذف صورة المترشح');
			window.setTimeout(() => setAdvanceNotice(''), 4000);
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : 'تعذر حذف صورة المترشح.');
		} finally {
			setIsSaving(false);
		}
	}

	async function handleSaveNote(e: React.FormEvent) {
		e.preventDefault();
		const text = noteText.trim();
		if (!text || !client) return;
		setIsSavingNote(true);
		try {
			const saved = await clientService.addNote(String(client.id), text);
			const full = toClient(saved, String(client.id));
			setClient(full);
			setDraft(full);
			setNoteText('');
			setIsNoteModalOpen(false);
		} catch {
			setSaveError('تعذر حفظ الملاحظة. حاول مرة أخرى.');
		} finally {
			setIsSavingNote(false);
		}
	}

	async function handlePrintMedicalCert() {
		try {
			const fullName = (currentClient.name || '').trim();
			const parts = fullName.split(' ').filter(Boolean);
			// In Algerian conventions, first part or last part can be last/first name;
			// typically: first word is First Name, remaining is Last Name (or vice-versa)
			const firstName = parts.length > 0 ? parts[0] : '';
			const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';

			await printMedicalCertificate({
				firstName,
				lastName,
				birthDate: currentClient.birthDate || '',
				birthPlace: currentClient.birthPlace || '',
				address: currentClient.address || '',
				phone: currentClient.phone || '',
				email: currentClient.email || '',
			});
		} catch (error) {
			console.error('Error generating medical certificate PDF:', error);
			alert('حدث خطأ أثناء إعداد الشهادة الطبية للطباعة.');
		}
	}

	function handleOpenConvocationModal() {
		if (!currentClient) return;
		const latestExam = getLatestExam(currentClient.attendance);
		if (latestExam?.date && !convocationExamDate) {
			setConvocationExamDate(latestExam.date);
		} else if (!convocationExamDate) {
			setConvocationExamDate(new Date().toISOString().slice(0, 10));
		}
		setIsConvocationModalOpen(true);
	}

	function handleOpenTransferModal() {
		if (!currentClient) return;
		const { lastName, firstName } = splitClientName(currentClient.name || '');
		const birthDateFormatted = currentClient.birthDate ? currentClient.birthDate.replace(/-/g, '/') : '';
		const birthPlace = (currentClient.birthPlace || '').trim();
		const birth = birthDateFormatted
			? birthPlace
				? `${birthDateFormatted} بـ ${birthPlace}`
				: birthDateFormatted
			: birthPlace;

		setTransferLastName(lastName);
		setTransferFirstName(firstName);
		setTransferBirth(birth || '');
		setTransferRegNum(currentClient.registrationNumber || '');
		setTransferNumber('02');
		setTransferYear(new Date().getFullYear().toString());
		setTransferFrom('بوطيبة محمد');
		setTransferTo('');
		setTransferReason('قرب المدرسة الثانية من مقر الإقامة .');
		setTransferDate(new Date().toISOString().slice(0, 10));
		setIsTransferModalOpen(true);
	}

	function handleOpenEvaluationModal() {
		setIsEvaluationModalOpen(true);
	}

	function cancelEdit() {
		setDraft(client);
		setSaveError('');
		setIsEditing(false);
	}

	function getNextStage(currentStage?: string): string {
		if (currentStage === 'قانون المرور') return 'مناورات';
		if (currentStage === 'مناورات') return 'سياقة عامة';
		if (currentStage === 'سياقة عامة') return 'منتهي';
		return 'منتهي';
	}

	async function saveChanges() {
		if (!client || !draft || !isDirty) return;
		setIsSaving(true);
		setSaveError('');
		setAdvanceNotice('');
		try {
			// Check if any exam is now ناجح and client should advance stage
			const hasPassedExam = draft.attendance?.exams.some((e) => e.observation === 'ناجح') ?? false;
			const currentStage = draft.stage || 'قانون المرور';
			const nextStage = getNextStage(currentStage);
			const shouldAdvance = hasPassedExam && nextStage !== currentStage && draft.stage === client.stage;

			const finalDraft = shouldAdvance ? { ...draft, stage: nextStage } : draft;

			const savedClient = await clientService.update(String(client.id), finalDraft);
			const full = toClient(savedClient, String(client.id));
			setClient(full);
			setDraft(full);
			setIsEditing(false);

			if (shouldAdvance) {
				setAdvanceNotice(`تم ترقية المترشح تلقائياً إلى مرحلة: ${nextStage}`);
				window.setTimeout(() => setAdvanceNotice(''), 5000);
			}
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : 'تعذر حفظ التغييرات. حاول مرة أخرى.');
		} finally {
			setIsSaving(false);
		}
	}

	const stageBadgeStyle =
		currentClient.stage === 'منتهي'
			? { background: 'var(--bg-card-alt)', color: 'var(--text-secondary)' }
			: currentClient.stage === 'سياقة عامة'
			? { background: 'var(--success-tint)', color: 'var(--success)' }
			: currentClient.stage === 'مناورات'
			? { background: 'var(--warning-tint)', color: 'var(--warning-text)' }
			: { background: 'var(--primary-tint)', color: 'var(--primary)' };

	return (
		<main className="profile-page" dir="rtl" lang="ar">
			<Sidebar />
			<section className="profile-content">
<ProfileHeader
					client={currentClient}
					isEditing={isEditing}
					isSaving={isSaving}
					isDirty={isDirty}
					isArchivingOrRestoring={isArchivingOrRestoring}
					activeMainTab={activeMainTab}
					advanceNotice={advanceNotice}
					saveError={saveError}
					onOpenPaymentModal={handleOpenPaymentModal}
					onStartEditing={() => setIsEditing(true)}
					onSaveChanges={saveChanges}
					onCancelEdit={cancelEdit}
					onPrintMedicalCert={handlePrintMedicalCert}
					onOpenConvocationModal={handleOpenConvocationModal}
					onOpenTransferModal={handleOpenTransferModal}
					onOpenEvaluationCardModal={handleOpenEvaluationModal}
					onArchiveClick={() => setIsArchiveModalOpen(true)}
					onRestoreClient={handleRestoreClient}
					onTabChange={setActiveMainTab}
					onPhotoUpload={handlePhotoUpload}
					onPhotoRemove={handlePhotoRemove}
				/>

								<ProfileMainContent
					client={client}
					draft={draft}
					isEditing={isEditing}
					activeMainTab={activeMainTab}
					historyFilter={historyFilter}
					onHistoryFilterChange={setHistoryFilter}
					onUpdateDraft={updateDraft}
					onToggleDocument={toggleDocument}
					onToggleObtainedCategory={toggleObtainedCategory}
					onAttendanceUpdate={handleAttendanceUpdate}
					onOpenNoteModal={() => setIsNoteModalOpen(true)}
					onSetNoteModalOpen={setIsNoteModalOpen}
				/>

			</section>

			{/* Record Payment Modal */}
			{isPaymentModalOpen && (
				<div className="modal-overlay" onClick={handleClosePaymentModal}>
					<div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h3 className="modal-title">تسجيل دفعة مالية للمترشح</h3>
							<button type="button" className="btn-modal-close" onClick={handleClosePaymentModal}>
								<Icon name="close" size={18} />
							</button>
						</div>

						<form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
							{/* Client Summary Box */}
							<div className="modal-client-preview">
								<div className="modal-client-details">
									<div><strong>المترشح:</strong> {client.name}</div>
									<div style={{ color: '#9a9cab' }}>
										الإجمالي: {formatCurrency(clientTotal)} · المسدد: {formatCurrency(clientPaid)}
									</div>
								</div>
								<div style={{ textAlign: 'left' }}>
									<div style={{ fontSize: '11px', color: '#9a9cab' }}>المتبقي الحالي:</div>
									<div style={{ fontSize: '16px', fontWeight: 800, color: clientRemaining > 0 ? '#ffc78a' : '#86efac' }}>
										{formatCurrency(clientRemaining)}
									</div>
								</div>
							</div>

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

							

							{/* Notes */}
							<div className="modal-form-group">
								<label className="modal-form-label">ملاحظات (اختياري)</label>
								<input
									type="text"
									value={paymentNote}
									onChange={(e) => setPaymentNote(e.target.value)}
									placeholder="مثال: وصل دفعة رقم 105، شطر ثان..."
									className="modal-input"
								/>
							</div>

							<div className="modal-footer">
								<button
									type="button"
									className="btn-secondary"
									onClick={handleClosePaymentModal}
								>
									إلغاء
								</button>
								<button
									type="submit"
									className="btn-primary-submit"
								>
									تأكيد وحفظ الدفعة
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{isNoteModalOpen && (
				<div className="modal-overlay" onClick={() => setIsNoteModalOpen(false)}>
					<div className="modal-dialog history-note-modal" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h3 className="modal-title">إضافة ملاحظة إدارية</h3>
							<button type="button" className="btn-modal-close" onClick={() => setIsNoteModalOpen(false)}><Icon name="close" size={18} /></button>
						</div>
						<form onSubmit={handleSaveNote}>
							<label className="modal-form-label" htmlFor="history-note">الملاحظة</label>
							<textarea
								id="history-note"
								className="modal-input history-note-input"
								value={noteText}
								onChange={(event) => setNoteText(event.target.value)}
								placeholder="مثال: طلب المتدرب تأجيل موعد الامتحان…"
								autoFocus
								required
							/>
							<div className="modal-footer">
								<button type="button" className="btn-secondary" onClick={() => setIsNoteModalOpen(false)}>إلغاء</button>
								<button type="submit" className="btn-primary-submit" disabled={isSavingNote}>{isSavingNote ? 'جارٍ الحفظ…' : 'حفظ الملاحظة'}</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Toast Notification */}
			{paymentToast && (
				<div className="payments-toast">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="20 6 9 17 4 12" />
					</svg>
					<span>{paymentToast}</span>
				</div>
			)}

			{/* Archive Modal */}
			{isArchiveModalOpen && client && (
				<div className="archive-modal-overlay" onClick={() => setIsArchiveModalOpen(false)}>
					<div className="archive-modal" onClick={(e) => e.stopPropagation()}>
						<div className="archive-modal-title">
							<Icon name="archive" size={20} />
							<span>أرشفة ملف المتدرب</span>
						</div>
						<p className="archive-modal-desc">
							هل تريد أرشفة ملف المتدرب <strong>{client.name}</strong>؟
							سيتم نقل الملف من قائمة العملاء الحاليين إلى الأرشيف السنوي، ويمكنك استرجاعه في أي وقت.
						</p>

						<div className="archive-year-select-group">
							<label htmlFor="client-archive-year">اختر سنة الأرشيف:</label>
							<select
								id="client-archive-year"
								className="archive-year-select"
								value={archiveYearInput}
								onChange={(e) => setArchiveYearInput(Number(e.target.value))}
							>
								{[2027, 2026, 2025, 2024, 2023, 2022].map((y) => (
									<option key={y} value={y}>
										أرشيف سنة {y}
									</option>
								))}
							</select>
						</div>

						<div className="archive-modal-actions">
							<button
								type="button"
								className="button"
								onClick={() => setIsArchiveModalOpen(false)}
								disabled={isArchivingOrRestoring}
							>
								إلغاء
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Archive Toast */}
			{archiveToast && (
				<div className="toast-feedback">
					<Icon name="check" size={18} />
					<span>{archiveToast}</span>
				</div>
			)}

			{/* Convocation Modal */}
			{isConvocationModalOpen && currentClient && (
				<DocumentPreviewModal
					title={<><Icon name="document" size={20} /> إستــــــدعـــــــــاء</>}
					summary={<>المترشح: <strong>{currentClient.name}</strong>{' • '}الصنف: <strong>{currentClient.training || 'B'}</strong></>}
					controls={
						<>
							<label className="document-preview-field">
								<span>رقم الاستدعاء</span>
								<input
									type="text"
									value={convocationNumber}
									onChange={(event) => setConvocationNumber(event.target.value)}
									placeholder="مثال: 2026/88"
								/>
							</label>
							<label className="document-preview-field">
								<span>تاريخ التحرير</span>
								<input
									type="date"
									value={convocationIssuedDate}
									onChange={(event) => setConvocationIssuedDate(event.target.value)}
								/>
							</label>
							<label className="document-preview-field">
								<span>تاريخ الامتحان</span>
								<input
									type="date"
									value={convocationExamDate}
									onChange={(event) => setConvocationExamDate(event.target.value)}
								/>
							</label>
							<label className="document-preview-field">
								<span>الساعة ({hourToArabic(convocationTime)})</span>
								<input
									type="time"
									value={convocationTime}
									onChange={(event) => setConvocationTime(event.target.value)}
								/>
							</label>
						</>
					}
					onClose={() => setIsConvocationModalOpen(false)}
					preview={
						<iframe
							ref={convocationFrameRef}
							srcDoc={getConvocationLetterHtml(currentClient, {
								referenceNumber: convocationNumber,
								issuedDate: convocationIssuedDate,
								examDate: convocationExamDate,
								examTime: convocationTime,
							})}
							style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
							title="معاينة إستدعاء الامتحان"
						/>
					}
					downloadLabel="تحميل الاستدعاء"
					downloadTitle="تنزيل الاستدعاء كملف HTML قابل للطباعة"
					onDownload={() => downloadConvocationLetter(currentClient, {
						referenceNumber: convocationNumber,
						issuedDate: convocationIssuedDate,
						examDate: convocationExamDate,
						examTime: convocationTime,
					})}
					printLabel="طباعة الاستدعاء"
					onPrint={() => convocationFrameRef.current?.contentWindow?.print()}
				/>
			)}

			{/* Transfer Request Modal */}
			{isTransferModalOpen && currentClient && (
				<DocumentPreviewModal
					title={<><Icon name="document" size={20} /> طـلـب تـحـويـل مـلـف رخصة السياقة</>}
					summary={<>المترشح: <strong>{currentClient.name}</strong>{' • '}الصنف: <strong>{currentClient.training || 'B'}</strong></>}
					controls={
						<>
							<label className="document-preview-field">
								<span>رقم الطلب</span>
								<input
									type="text"
									value={transferReferenceText}
									onChange={(event) => updateTransferReferenceText(event.target.value)}
									placeholder="2026/11/05 رقم : 02 / م.و.أ.ط/ 2026"
								/>
							</label>
							<label className="document-preview-field">
								<span>من (المدرسة الأصلية)</span>
								<input
									type="text"
									value={transferFrom}
									onChange={(event) => setTransferFrom(event.target.value || 'بوطيبة محمد')}
									placeholder="بوطيبة محمد"
								/>
							</label>
							<label className="document-preview-field">
								<span>إلى مدرسة تعليم السياقة</span>
								<input
									type="text"
									value={transferTo}
									onChange={(event) => setTransferTo(event.target.value)}
									placeholder="دروش سعيد"
								/>
							</label>
							<label className="document-preview-field">
								<span>تاريخ التحرير</span>
								<input
									type="date"
									value={transferDate}
									onChange={(event) => setTransferDate(event.target.value)}
								/>
							</label>
						</>
					}
					onClose={() => setIsTransferModalOpen(false)}
					preview={
						<iframe
							ref={transferFrameRef}
							srcDoc={getTransferRequestHtml(currentClient, {
								referenceNumber: transferNumber,
								year: transferYear,
								transferFrom,
								transferTo,
								lastName: transferLastName,
								firstName: transferFirstName,
								birth: transferBirth,
								registrationNumber: transferRegNum,
								reason: transferReason,
								issuedDate: transferDate,
							})}
							style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
							title="معاينة طلب تحويل ملف رخصة السياقة"
						/>
					}
					downloadLabel="تحميل طلب التحويل"
					downloadTitle="تنزيل طلب التحويل كملف HTML قابل للطباعة"
					onDownload={() => downloadTransferRequest(currentClient, {
						referenceNumber: transferNumber,
						year: transferYear,
						transferFrom,
						transferTo,
						lastName: transferLastName,
						firstName: transferFirstName,
						birth: transferBirth,
						registrationNumber: transferRegNum,
						reason: transferReason,
						issuedDate: transferDate,
					})}
					printLabel="طباعة طلب التحويل"
					onPrint={() => transferFrameRef.current?.contentWindow?.print()}
				/>
			)}

			{/* Evaluation Card (بطاقة تقييم) Modal */}
			{isEvaluationModalOpen && currentClient && (
				<DocumentPreviewModal
					title={<><Icon name="document" size={20} /> بطاقة تقييم المترشحين لسياقة السيارات ذات المحرك</>}
					summary={<>المترشح: <strong>{currentClient.name}</strong>{' • '}الصنف: <strong>{currentClient.training || 'B'}</strong></>}
					onClose={() => setIsEvaluationModalOpen(false)}
					preview={
						<iframe
							ref={evaluationFrameRef}
							srcDoc={getEvaluationCardHtml(currentClient)}
							style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
							title="معاينة بطاقة تقييم المترشح"
						/>
					}
					downloadLabel="تحميل بطاقة التقييم"
					downloadTitle="تنزيل بطاقة التقييم كملف HTML قابل للطباعة"
					onDownload={() => downloadEvaluationCard(currentClient)}
					printLabel="طباعة بطاقة التقييم"
					onPrint={() => evaluationFrameRef.current?.contentWindow?.print()}
				/>
			)}
		</main>
	);
}

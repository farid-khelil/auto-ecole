import React, { FormEvent, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import Icon from '../components/Icon.tsx';
import { clientService, TRAINING_STAGES, type Client } from '../services/clients';
import { getMedicalCertificateHtml } from '../services/medical-cert-letter';
import '../styles/add-client.css';

const clientDocuments = [
	{ id: 'birth-certificate', title: 'شهادة ميلاد' },
	{ id: 'residence-certificate', title: 'شهادة الإقامة' },
	{ id: 'medical-certificate', title: 'شهادة طبية' },
	{ id: 'identity-copy', title: 'نسخة من بطاقة التعريف الوطنية أو رخصة السياقة' },
	{ id: 'identity-photos', title: '6 صور شمسية' },
];

const parentalAuthorization = { id: 'parental-authorization', title: 'تصريح أبوي' };

export default function AddClient() {
	const navigate = useNavigate();
	const [saved, setSaved] = useState(false);
	const [saveError, setSaveError] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [receivedDocuments, setReceivedDocuments] = useState<string[]>([]);
	const [stage, setStage] = useState<string>('قانون المرور');
	const [obtainedCategories, setObtainedCategories] = useState<string[]>([]);
	const [birthDate, setBirthDate] = useState('');
	const [paidAmount, setPaidAmount] = useState<number>(0);
	const [totalAmount, setTotalAmount] = useState<number>(35000);
	const [isGeneratingMedicalCertificate, setIsGeneratingMedicalCertificate] = useState(false);
	const [medicalCertificateFeedback, setMedicalCertificateFeedback] = useState('');
	const [photo, setPhoto] = useState<string>('');
	const formRef = useRef<HTMLFormElement>(null);
	const photoInputRef = useRef<HTMLInputElement>(null);

	function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files && e.target.files[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			alert('يرجى اختيار ملف صورة صالح.');
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
					setPhoto(canvas.toDataURL('image/jpeg', 0.88));
				}
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
		e.target.value = '';
	}

	const now = new Date();
	const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	const birthDateValue = birthDate ? new Date(`${birthDate}T00:00:00`) : null;
	const age = birthDateValue ? now.getFullYear() - birthDateValue.getFullYear() - (now < new Date(now.getFullYear(), birthDateValue.getMonth(), birthDateValue.getDate()) ? 1 : 0) : null;
	const documentsForClient = age !== null && age < 18 ? [...clientDocuments, parentalAuthorization] : clientDocuments;

	async function submitForm(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaveError('');
		setIsSaving(true);
		const formData = new FormData(event.currentTarget);
		const firstName = String(formData.get('firstName') || '').trim();
		const lastName = String(formData.get('lastName') || '').trim();
		const fullName = `${firstName} ${lastName}`.trim();
		const clientData = {
			registrationNumber: String(formData.get('registrationNumber') || '').trim() || undefined,
			name: fullName || 'بدون اسم',
			phone: String(formData.get('phone') || '').trim(),
			birthDate: String(formData.get('birthDate') || ''),
			birthPlace: String(formData.get('birthPlace') || ''),
			email: String(formData.get('email') || ''),
			address: String(formData.get('address') || ''),
			training: String(formData.get('training') || 'B'),
			obtainedCategories,
			registrationDate: String(formData.get('startDate') || '') || today,
			receivedDocuments,
			documents: documentsForClient,
			paidAmount: Number(paidAmount || 0),
			totalAmount: Number(totalAmount || 0),
			stage: stage || 'قانون المرور',
			photo: photo || undefined,
		};
		try {
			const client = await clientService.create(clientData);
			setSaved(true);
			window.setTimeout(
				() => navigate(`/clients/${clientData.registrationNumber || client.id}`, { state: clientData }),
				650
			);
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : 'تعذر حفظ ملف العميل. حاول مرة أخرى.');
		} finally {
			setIsSaving(false);
		}
	}

	function toggleDocument(id: string) {
		setReceivedDocuments((current) => current.includes(id) ? current.filter((documentId) => documentId !== id) : [...current, id]);
	}

	async function handleGenerateMedicalCertificate() {
		const form = formRef.current;
		if (!form) return;

		const formData = new FormData(form);
		const firstName = String(formData.get('firstName') || '').trim();
		const lastName = String(formData.get('lastName') || '').trim();
		if (!firstName || !lastName) {
			setMedicalCertificateFeedback('يرجى إدخال الاسم واللقب أولاً لإنشاء الشهادة الطبية.');
			const nameInput = form.elements.namedItem(firstName ? 'lastName' : 'firstName');
			if (nameInput instanceof HTMLInputElement) nameInput.focus();
			return;
		}

		setMedicalCertificateFeedback('');
		setIsGeneratingMedicalCertificate(true);
		try {
			const dummyClient: Partial<Client> = {
				name: `${lastName} ${firstName}`,
				birthDate: String(formData.get('birthDate') || ''),
				birthPlace: String(formData.get('birthPlace') || ''),
				address: String(formData.get('address') || ''),
				phone: String(formData.get('phone') || ''),
				email: String(formData.get('email') || ''),
				training: String(formData.get('training') || 'B'),
				photo,
			};

			const html = getMedicalCertificateHtml(dummyClient, {
				lastName,
				firstName,
				birthDate: dummyClient.birthDate,
				birthPlace: dummyClient.birthPlace,
				address: dummyClient.address,
				phone: dummyClient.phone,
				email: dummyClient.email,
				targetCategory: dummyClient.training,
				photo,
			});

			const iframe = document.createElement('iframe');
			iframe.style.position = 'fixed';
			iframe.style.right = '0';
			iframe.style.bottom = '0';
			iframe.style.width = '0';
			iframe.style.height = '0';
			iframe.style.border = '0';
			document.body.appendChild(iframe);
			iframe.srcdoc = html;
			iframe.onload = () => {
				setTimeout(() => {
					try {
						iframe.contentWindow?.focus();
						iframe.contentWindow?.print();
					} finally {
						setTimeout(() => {
							if (iframe.parentNode) {
								iframe.parentNode.removeChild(iframe);
							}
						}, 2000);
					}
				}, 250);
			};

			setMedicalCertificateFeedback('تم إرسال الشهادة الطبية للطباعة بنجاح.');
		} catch (error) {
			console.error('Error generating medical certificate PDF:', error);
			setMedicalCertificateFeedback('تعذر إنشاء الشهادة الطبية. حاول مجدداً.');
		} finally {
			setIsGeneratingMedicalCertificate(false);
		}
	}

	return (
		<main className="add-client-page" dir="rtl" lang="ar">
			<Sidebar />
			<section className="add-client-content">
				<div className="add-topbar">
					<div className="breadcrumb">الإدارة / العملاء / <b>عميل جديد</b></div>
					<span className="school-name">مدرسة الأمل للسياقة</span>
				</div>
				<div className="page-intro">
					<div className="eyebrow">إدارة التسجيلات</div>
					<h1>إضافة عميل جديد</h1>
					<p>أدخل معلومات المتدرب، المدفوعات ومرحلة التكوين لإنشاء ملفه ومتابعة تكوينه.</p>
				</div>
				{saved && <div className="saved">تم حفظ ملف العميل بنجاح. جارٍ الانتقال إلى ملف العميل…</div>}
				{saveError && <div className="saved" role="alert">{saveError}</div>}
				{medicalCertificateFeedback && <div className="certificate-feedback" role="status">{medicalCertificateFeedback}</div>}
				<form ref={formRef} className="client-form" onSubmit={submitForm}>
					<section className="form-card">
						<h2 className="section-title"><span className="section-mark"><Icon name="user" size={18} /></span>المعلومات الشخصية</h2>
						<div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', padding: '12px 16px', background: 'var(--bg-card-alt)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
							<input
								ref={photoInputRef}
								type="file"
								accept="image/*"
								style={{ display: 'none' }}
								onChange={handlePhotoSelect}
							/>
							<div
								style={{
									width: '64px',
									height: '64px',
									borderRadius: 'var(--radius-sm)',
									border: '1px dashed var(--border-input)',
									background: 'var(--bg-input)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									cursor: 'pointer',
									overflow: 'hidden',
									flex: 'none',
								}}
								onClick={() => photoInputRef.current?.click()}
								title={photo ? 'انقر لتغيير الصورة' : 'انقر لإضافة صورة'}
							>
								{photo ? (
									<img src={photo} alt="صورة المترشح" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
								) : (
									<div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
										<Icon name="camera" size={20} />
									</div>
								)}
							</div>
							<div>
								<div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>صورة المتدرب الشخصية</div>
								<div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>صورة شمسية تظهر في واجهة البرنامج وملف العميل</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
									<button
										type="button"
										className="button"
										style={{ padding: '4px 10px', fontSize: '12px' }}
										onClick={() => photoInputRef.current?.click()}
									>
										{photo ? 'تغيير الصورة' : 'اختيار صورة'}
									</button>
									{photo && (
										<button
											type="button"
											className="button"
											style={{ padding: '4px 10px', fontSize: '12px', color: '#ef4444', borderColor: '#fca5a5' }}
											onClick={() => setPhoto('')}
										>
											حذف
										</button>
									)}
								</div>
							</div>
						</div>
						<div className="fields">
							<div className="field">
								<label htmlFor="firstName">الاسم</label>
								<input id="firstName" name="firstName" placeholder="الاسم الكامل" />
							</div>
							<div className="field">
								<label htmlFor="lastName">اللقب</label>
								<input id="lastName" name="lastName" placeholder="اللقب" />
							</div>
							<div className="field">
								<label htmlFor="phone">رقم الهاتف</label>
								<input id="phone" name="phone" inputMode="tel" placeholder="رقم الهاتف" />
							</div>
							<div className="field">
								<label htmlFor="birthDate">تاريخ الميلاد</label>
								<input id="birthDate" name="birthDate" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
							</div>
							<div className="field">
								<label htmlFor="birthPlace">مكان الميلاد</label>
								<input id="birthPlace" name="birthPlace" />
							</div>
							<div className="field">
								<label htmlFor="email">البريد الإلكتروني</label>
								<input id="email" name="email" type="email" placeholder="البريد الإلكتروني" />
							</div>
							<div className="field full">
								<label htmlFor="address">العنوان</label>
								<input id="address" name="address" placeholder="العنوان" />
							</div>
						</div>
					</section>

					<section className="form-card">
						<h2 className="section-title"><span className="section-mark"><Icon name="list" size={18} /></span>معلومات التكوين والتقدم</h2>
						<div className="fields">
							<div className="field">
								<label htmlFor="registrationNumber">رقم التسجيل</label>
								<input id="registrationNumber" name="registrationNumber" />
							</div>
							<div className="field">
								<label htmlFor="training">نوع التكوين</label>
								<select id="training" name="training" defaultValue="B">
									<option value="A">A</option>
									<option value="A1">A1</option>
									<option value="B">B</option>
									<option value="BE">BE</option>
									<option value="C1">C1</option>
									<option value="C1E">C1E</option>
									<option value="C">C</option>
									<option value="CE">CE</option>
									<option value="D">D</option>
									<option value="DE">DE</option>
									<option value="F">F</option>
								</select>
							</div>
							<div className="field">
								<label htmlFor="startDate">تاريخ الإيداع</label>
								<input id="startDate" name="startDate" type="date" defaultValue={today} />
							</div>
							<div className="field">
								<label htmlFor="stage">التقدم</label>
								<select
									id="stage"
									value={stage}
									onChange={(e) => setStage(e.target.value)}
								>
									{TRAINING_STAGES.map((st) => (
										<option key={st} value={st}>
											{st}
										</option>
									))}
								</select>
							</div>
							<div className="field full">
								<label>الصنف أو الأصناف المتحصل عليها</label>
								<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
									{['A', 'A1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D', 'DE', 'F'].map((cat) => {
										const isSelected = obtainedCategories.includes(cat);
										return (
											<button
												key={cat}
												type="button"
												onClick={() =>
													setObtainedCategories((prev) =>
														prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
													)
												}
												style={{
													padding: '6px 12px',
													borderRadius: '6px',
													fontSize: '13px',
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
							</div>
						</div>
					</section>

					<section className="form-card">
						<h2 className="section-title"><span className="section-mark"><Icon name="chart" size={18} /></span>الدفع</h2>
						<div className="fields">
							<div className="field">
								<label htmlFor="paidAmount">المبلغ المدفوع (د.ج)</label>
								<input
									id="paidAmount"
									type="number"
									min="0"
									value={paidAmount}
									onChange={(e) => setPaidAmount(Number(e.target.value))}
									placeholder="0"
								/>
							</div>
							<div className="field">
								<label htmlFor="totalAmount">المبلغ الإجمالي (د.ج)</label>
								<input
									id="totalAmount"
									type="number"
									min="0"
									value={totalAmount}
									onChange={(e) => setTotalAmount(Number(e.target.value))}
									placeholder="35000"
								/>
							</div>
							<div className="field full">
								<label>المبلغ المتبقي</label>
								<div style={{ padding: '11px 12px', background: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)', fontWeight: 700, color: totalAmount - paidAmount > 0 ? 'var(--danger-text)' : 'var(--success)' }}>
									{new Intl.NumberFormat('ar-DZ').format(Math.max(0, totalAmount - paidAmount))} د.ج
								</div>
							</div>
						</div>
					</section>

					<section className="form-card">
						<div className="documents-title">
							<h2 className="section-title"><span className="section-mark"><Icon name="check" size={18} /></span>وثائق الملف</h2>
							<span className="document-count">{receivedDocuments.filter((id) => documentsForClient.some((document) => document.id === id)).length} / {documentsForClient.length} مستلمة</span>
						</div>
						<div className="documents-list">
							{documentsForClient.map((document) => {
								const isReceived = receivedDocuments.includes(document.id);
								return (
									<label className={`document-item ${isReceived ? 'checked' : ''}`} key={document.id}>
										<input type="checkbox" checked={isReceived} onChange={() => toggleDocument(document.id)} />
										<span className="document-copy"><strong>{document.title}</strong></span>
									</label>
								);
							})}
						</div>
					</section>

					<div className="form-actions">
						<button className="save-button" type="submit" disabled={isSaving}>{isSaving ? 'جارٍ الحفظ…' : 'حفظ العميل'}</button>
						<button
							className="medical-certificate-button"
							type="button"
							onClick={handleGenerateMedicalCertificate}
							disabled={isGeneratingMedicalCertificate}
						>
							<Icon name="print" size={17} />
							{isGeneratingMedicalCertificate ? 'جارٍ إنشاء الشهادة…' : 'شهادة طبية'}
						</button>
						<Link className="cancel-button" to="/">إلغاء</Link>
					</div>
				</form>
			</section>
		</main>
	);
}

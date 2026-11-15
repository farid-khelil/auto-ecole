import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import CandidatesListModal from '../components/CandidatesListModal.tsx';
import Icon from '../components/Icon.tsx';
import { clientService, type Client } from '../services/clients';
import { matchesArabicSearch } from '../services/arabic-search';
import { getLatestExam } from '../services/attendance';
import '../styles/home.css';

type DashboardClient = Client & {
	pack: string;
	date: string;
	paidAmount: number;
	totalAmount: number;
	remainingAmount: number;
	stage: string;
	color: string;
};

const PROFILE_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABb0lEQVR4nO2VS0oDQRCGPxV0YXTl4w7mEMasRRMfeATRhboRCa40Kx/nEHdKPIb43krIAXxGERdGpeAP9GZmMpMeUJgPajV/1V/dU90NGRn/kDGgClwB74pLYBcYTdt8AWgCPwHxCsylaf4toxNgEhhUFIBTfWsB5TS2vSmDzRDdljQvwIjPBqrOyqOoSbvjs4FrFbVtj2JKWhtMb7ypaK4D7ZC09su88RyjgWFpn3w2cKGiNu1RFKU999nAtoraUYviTNqKzwbGgUcVtqMWREWaBx1dr5SBLxnUNO05RdFZuWlKpMS8brqgq7glTSrMAPch5u0wzbRP4x7gwDG4AdaACectyAPrwK009mbsKbdrDlX0E1gGekO09m1FWsvZ79a85Jh3cg23KThNzCY1HwAaKmIrj8uqcutAf5IGlpx/HrbtQfQBd6qxmKSBYyXbwCVlQzWOkiTXlWzTnpS8czRj8xHjBYx6mq1WRsbf5BdeuXgU/C/QAwAAAABJRU5ErkJggg==';

function formatCurrency(amount: number) {
	return new Intl.NumberFormat('ar-DZ').format(amount) + ' د.ج';
}

function formatDate(value?: string) {
	if (!value) return '—';
	return new Intl.DateTimeFormat('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' })
		.format(new Date(`${value}T00:00:00`));
}

function toDashboardClient(client: Client): DashboardClient {
	const isValidDate = Boolean(client.registrationDate && !isNaN(new Date(`${client.registrationDate}T00:00:00`).getTime()));
	const date = isValidDate
		? new Intl.DateTimeFormat('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${client.registrationDate}T00:00:00`))
		: 'غير محدد';
	const paidAmount = Number(client.paidAmount ?? 0);
	const totalAmount = Number(client.totalAmount ?? 35000);
	const remainingAmount = Math.max(0, totalAmount - paidAmount);
	const stage = client.stage || 'قانون المرور';

	return {
		...client,
		name: client.name || 'بدون اسم',
		pack: String(client.training || 'B').trim(),
		date,
		paidAmount,
		totalAmount,
		remainingAmount,
		stage,
		color: client.color || '#e8e5ff',
	};
}

export default function Home() {
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParam = searchParams.get('tab');
	const initialTab = tabParam === 'archive'
		? 'archive'
		: tabParam === 'finished'
		? 'finished'
		: 'active';

	const [clients, setClients] = useState<DashboardClient[]>([]);
	const [query, setQuery] = useState('');
	const [statusTab, setStatusTab] = useState<'active' | 'finished' | 'archive'>(initialTab);
	const [selectedStages, setSelectedStages] = useState<string[]>([]);
	const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
	const [openFilter, setOpenFilter] = useState<'stage' | 'pack' | null>(null);
	const [remainingSortDirection, setRemainingSortDirection] = useState<'none' | 'asc' | 'desc'>('none');
	const [isCandidatesListOpen, setIsCandidatesListOpen] = useState(false);
	const filterContainerRef = React.useRef<HTMLDivElement>(null);

	// Archive Specific State
	const [archiveYears, setArchiveYears] = useState<number[]>([]);
	const [selectedArchiveYear, setSelectedArchiveYear] = useState<number>(new Date().getFullYear());
	const [archivedClients, setArchivedClients] = useState<DashboardClient[]>([]);
	const [isLoadingArchive, setIsLoadingArchive] = useState<boolean>(false);
	const [archiveModalTarget, setArchiveModalTarget] = useState<DashboardClient | null>(null);
	const [archiveTargetYear, setArchiveTargetYear] = useState<number>(new Date().getFullYear());
	const [actionToast, setActionToast] = useState<string>('');

	const loadActiveClients = () => {
		void clientService.list().then((storedClients) => setClients(storedClients.map(toDashboardClient)));
	};

	useEffect(() => {
		loadActiveClients();
		void clientService.getArchiveYears().then((years) => {
			setArchiveYears(years);
			if (years.length > 0 && !years.includes(selectedArchiveYear)) {
				setSelectedArchiveYear(years[0]);
			}
		});
	}, []);

	useEffect(() => {
		if (actionToast) {
			const timer = setTimeout(() => setActionToast(''), 4000);
			return () => clearTimeout(timer);
		}
	}, [actionToast]);

	// Load year-specific archive on demand ONLY when archive tab is active or year changes
	useEffect(() => {
		if (statusTab === 'archive') {
			setIsLoadingArchive(true);
			void clientService.listArchived(selectedArchiveYear).then((stored) => {
				setArchivedClients(stored.map(toDashboardClient));
				setIsLoadingArchive(false);
			});
		}
	}, [statusTab, selectedArchiveYear]);

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

	const counts = useMemo(() => {
		let active = 0;
		let finished = 0;
		for (const c of clients) {
			if (c.stage === 'منتهي') {
				finished++;
			} else {
				active++;
			}
		}
		return {
			active,
			finished,
		};
	}, [clients]);

	const availableStages = useMemo(() => {
		const sourceClients = statusTab === 'active'
			? clients.filter((client) => client.stage !== 'منتهي')
			: statusTab === 'finished'
			? clients.filter((client) => client.stage === 'منتهي')
			: archivedClients;
		return Array.from(new Set(sourceClients.map((client) => client.stage))).filter(Boolean);
	}, [clients, archivedClients, statusTab]);

	const availablePacks = useMemo(() => {
		const source = statusTab === 'archive' ? archivedClients : clients;
		return Array.from(new Set(source.map((client) => client.pack))).filter((pack) => pack.length > 0);
	}, [clients, archivedClients, statusTab]);

	const displayedClients = useMemo(() => {
		if (statusTab === 'archive') {
			return archivedClients.filter((client) => {
				const clientSearchTarget = `${client.name || ''} ${client.phone || ''} ${client.registrationNumber || ''} ${client.address || ''}`;
				const matchesQuery = matchesArabicSearch(clientSearchTarget, query);
				const matchesPack = selectedPacks.length === 0 || selectedPacks.includes(client.pack);
				return matchesQuery && matchesPack;
			});
		}

		const filteredClients = clients.filter((client) => {
			const isFinished = client.stage === 'منتهي';
			if (statusTab === 'active' && isFinished) return false;
			if (statusTab === 'finished' && !isFinished) return false;

			const clientSearchTarget = `${client.name || ''} ${client.phone || ''} ${client.registrationNumber || ''} ${client.address || ''}`;
			const matchesQuery = matchesArabicSearch(clientSearchTarget, query);

			const matchesStage = selectedStages.length === 0 || selectedStages.includes(client.stage);
			const matchesPack = selectedPacks.length === 0 || selectedPacks.includes(client.pack);

			return matchesQuery && matchesStage && matchesPack;
		});

		if (remainingSortDirection === 'none') {
			return filteredClients;
		}

		const sortedClients = [...filteredClients].sort((a, b) => a.remainingAmount - b.remainingAmount);
		return remainingSortDirection === 'asc' ? sortedClients : sortedClients.reverse();
	}, [clients, archivedClients, query, selectedStages, selectedPacks, remainingSortDirection, statusTab]);

	function toggleStageFilter(stage: string) {
		setSelectedStages((previous) =>
			previous.includes(stage)
				? previous.filter((item) => item !== stage)
				: [...previous, stage],
		);
	}

	function togglePackFilter(pack: string) {
		setSelectedPacks((previous) =>
			previous.includes(pack)
				? previous.filter((item) => item !== pack)
				: [...previous, pack],
		);
	}

	function toggleFilterPanel(filterType: 'stage' | 'pack') {
		setOpenFilter((previous) => (previous === filterType ? null : filterType));
	}

	function toggleRemainingSort() {
		setRemainingSortDirection((prev) => {
			if (prev === 'none') {
				return 'asc';
			}

			return prev === 'asc' ? 'desc' : 'asc';
		});
	}

	function getClientProfilePath(client: Client) {
		return `/clients/${client.registrationNumber || client.id}`;
	}

	function handleTabChange(newTab: 'active' | 'finished' | 'archive') {
		setStatusTab(newTab);
		if (newTab === 'archive') {
			setSearchParams({ tab: 'archive' });
		} else if (newTab === 'finished') {
			setSearchParams({ tab: 'finished' });
		} else {
			setSearchParams({});
		}
	}

	function handleOpenArchiveModal(client: DashboardClient, e?: React.MouseEvent) {
		if (e) e.stopPropagation();
		const currentYear = new Date().getFullYear();
		const clientYear = client.registrationDate ? new Date(client.registrationDate).getFullYear() : currentYear;
		setArchiveTargetYear(clientYear && clientYear >= 2000 ? clientYear : currentYear);
		setArchiveModalTarget(client);
	}

	async function handleConfirmArchive() {
		if (!archiveModalTarget) return;
		try {
			await clientService.archiveClient(archiveModalTarget.id, archiveTargetYear);
			setActionToast(`تمت أرشفة ملف المتدرب "${archiveModalTarget.name}" بنجاح في أرشيف سنة ${archiveTargetYear}`);
			setArchiveModalTarget(null);
			loadActiveClients();
			const updatedYears = await clientService.getArchiveYears();
			setArchiveYears(updatedYears);
		} catch (err) {
			alert(err instanceof Error ? err.message : 'تعذر أرشفة الملف');
		}
	}

	async function handleRestoreClient(client: DashboardClient, e?: React.MouseEvent) {
		if (e) e.stopPropagation();
		try {
			await clientService.restoreClient(client.id);
			setActionToast(`تم استرجاع المتدرب "${client.name}" بنجاح إلى قائمة العملاء الحاليين`);
			loadActiveClients();
			const updatedArchive = await clientService.listArchived(selectedArchiveYear);
			setArchivedClients(updatedArchive.map(toDashboardClient));
			const updatedYears = await clientService.getArchiveYears();
			setArchiveYears(updatedYears);
		} catch (err) {
			alert(err instanceof Error ? err.message : 'تعذر استرجاع الملف');
		}
	}

	const recentYears = useMemo(() => {
		const currentYear = new Date().getFullYear();
		const years = [];
		for (let y = currentYear + 1; y >= currentYear - 5; y--) {
			years.push(y);
		}
		return years;
	}, []);

	return (
		<main className="dashboard-shell" dir="rtl" lang="ar">
			<Sidebar onOpenCandidatesList={() => setIsCandidatesListOpen(true)} />
			<section className="content">
				<div className="topbar">
					<div className="crumb">الإدارة / <b>العملاء</b></div>
					<div className="top-actions">
						<button className="notice" aria-label="الإشعارات"><Icon name="document" size={17} /></button>
						<span className="admin">مدرسة الأمل للسياقة</span>
					</div>
				</div>

				<div className="page-head">
					<div>
						<div className="eyebrow">إدارة التسجيلات والأرشيف</div>
						<h1>{statusTab === 'archive' ? 'الأرشيف السنوي' : 'عملاؤك'}</h1>
						<p>
							{statusTab === 'archive'
								? `تصفح السجلات والأرشيف لسنة ${selectedArchiveYear}. يمكنك البحث واسترجاع أي ملف عند الحاجة.`
								: 'تابع ملفات المتدربين الحاليين، المدفوعات، والتقدم في التكوين حتى الحصول على الرخصة.'}
						</p>
					</div>
					<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
						<Link className="add-button" to="/clients/new">+&nbsp; عميل جديد</Link>
					</div>
				</div>

				<section className="table-card">
					<div className="table-tools">
						<div className="table-tools-header-row">
							<div className="table-tools-head">
								<h2 className="table-title">
									{statusTab === 'archive' ? `أرشيف سنة ${selectedArchiveYear}` : 'قائمة العملاء'}
								</h2>
								<div className="table-subtitle">عرض {displayedClients.length} ملف</div>
							</div>
							<div className="client-status-tabs" role="tablist">
								<button
									type="button"
									role="tab"
									aria-selected={statusTab === 'active'}
									className={`client-status-tab ${statusTab === 'active' ? 'active' : ''}`}
									onClick={() => handleTabChange('active')}
								>
									<span>العملاء الحاليون</span>
									<span className="client-status-badge">{counts.active}</span>
								</button>
								<button
									type="button"
									role="tab"
									aria-selected={statusTab === 'finished'}
									className={`client-status-tab ${statusTab === 'finished' ? 'active' : ''}`}
									onClick={() => handleTabChange('finished')}
								>
									<span>المنتهون مؤخراً</span>
									<span className="client-status-badge">{counts.finished}</span>
								</button>
								<button
									type="button"
									role="tab"
									aria-selected={statusTab === 'archive'}
									className={`client-status-tab ${statusTab === 'archive' ? 'active' : ''}`}
									onClick={() => handleTabChange('archive')}
								>
									<Icon name="archive" size={15} />
									<span>الأرشيف السنوي</span>
								</button>
							</div>
						</div>

						{/* Archive Year Navigation Bar (only rendered when archive tab is active) */}
						{statusTab === 'archive' && (
							<div className="archive-years-bar">
								<span className="archive-years-label">
									<Icon name="calendar" size={15} /> اختر السنة:
								</span>
								{archiveYears.map((year) => (
									<button
										key={year}
										type="button"
										className={`year-pill ${selectedArchiveYear === year ? 'active' : ''}`}
										onClick={() => setSelectedArchiveYear(year)}
									>
										سنة {year}
									</button>
								))}
							</div>
						)}

						<div className="controls-line">
							<label className="search">
								<Icon name="search" size={17} />
								<input
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder={statusTab === 'archive' ? `ابحث في أرشيف ${selectedArchiveYear}...` : 'ابحث عن عميل...'}
									aria-label="ابحث عن عميل"
								/>
							</label>
							<div className="filters-container" ref={filterContainerRef}>
								<div className="filter-buttons-frame">
									{statusTab !== 'archive' && (
										<button
											type="button"
											className={`filter-toggle ${openFilter === 'stage' ? 'open' : ''} ${selectedStages.length > 0 ? 'has-selection' : ''}`}
											onClick={() => toggleFilterPanel('stage')}
										>
											<span className="filter-toggle-label">التقدم</span>
											{selectedStages.length > 0 && <span className="filter-toggle-meta">{selectedStages.length}</span>}
										</button>
									)}
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

					<div className="table-scroll">
						{isLoadingArchive ? (
							<div className="empty" style={{ padding: '40px' }}>جارٍ تحميل أرشيف سنة {selectedArchiveYear}…</div>
						) : (
							<table>
								<thead>
									<tr>
										<th>رقم التسجيل</th>
										<th>العميل</th>
										<th>رقم الهاتف</th>
										<th>التكوين</th>
										{statusTab === 'archive' ? (
											<>
												<th>تاريخ التسجيل</th>
												<th>سنة الأرشيف</th>
												<th>الإجراءات</th>
											</>
										) : (
											<>
												<th>آخر امتحان</th>
												<th>
													<button
														type="button"
														onClick={toggleRemainingSort}
														style={{
															background: 'none',
															border: 'none',
															padding: 0,
															cursor: 'pointer',
															font: 'inherit',
															color: 'inherit',
															display: 'inline-flex',
															alignItems: 'center',
															gap: '4px',
														}}
														aria-label="فرز حسب المبلغ المتبقي"
													>
														<span>المتبقي</span>
														<span>
															{remainingSortDirection === 'asc'
																? '↑'
																: remainingSortDirection === 'desc'
																? '↓'
																: '↕'}
														</span>
													</button>
												</th>
												<th>التقدم</th>
												{statusTab === 'finished' && <th>الإجراءات</th>}
											</>
										)}
									</tr>
								</thead>
								<tbody>
									{displayedClients.map((client) => {
										const lastExam = getLatestExam(client.attendance);
										const stageBadgeStyle =
											client.stage === 'منتهي'
												? { background: 'var(--bg-card-alt)', color: 'var(--text-secondary)' }
												: client.stage === 'سياقة عامة'
												? { background: 'var(--success-tint)', color: 'var(--success)' }
												: client.stage === 'مناورات'
												? { background: 'var(--info-tint)', color: 'var(--info)' }
												: { background: 'var(--primary-tint)', color: 'var(--primary)' };

										return (
											<tr
												key={client.id}
												onClick={() => navigate(getClientProfilePath(client), { state: client })}
												style={{ cursor: 'pointer' }}
											>
												<td>{client.registrationNumber || '—'}</td>
												<td>
													<div className="client">
														<div className="client-avatar" style={{ background: client.color || 'var(--primary-tint)' }}>
															<img
																src={client.photo || client.attendance?.photo || PROFILE_ICON}
																alt="profile"
																style={
																	client.photo || client.attendance?.photo
																		? { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }
																		: { width: '62%', height: '62%', objectFit: 'contain', borderRadius: '50%', margin: 'auto', display: 'block' }
																}
															/>
														</div>
														<div>
															<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
																<span className="client-name">{client.name}</span>
															</div>
														</div>
													</div>
												</td>
												<td>{client.phone || '—'}</td>
												<td className="pack">{client.pack}</td>

												{statusTab === 'archive' ? (
													<>
														<td>{formatDate(client.registrationDate)}</td>
														<td>
															<span
																className="badge"
																style={{
																	background: 'var(--bg-card-alt)',
																	color: 'var(--text-secondary)',
																	border: '1px solid var(--border-card)',
																	fontSize: '11px',
																	fontWeight: 600,
																	padding: '4px 8px',
																	borderRadius: 'var(--radius-pill)',
																}}
															>
																أرشيف {client.archiveYear || selectedArchiveYear}
															</span>
														</td>
														<td onClick={(e) => e.stopPropagation()}>
															<button
																type="button"
																className="restore-action-btn"
																onClick={(e) => handleRestoreClient(client, e)}
																title="استرجاع إلى العملاء الحاليين"
															>
																<Icon name="restore" size={13} /> استرجاع
															</button>
														</td>
													</>
												) : (
													<>
														<td>{formatDate(lastExam?.date)}</td>
														<td>
															<span
																style={{
																	fontWeight: 700,
																	color: client.remainingAmount > 0 ? '#0062cc' : '#2a7f00',
																}}
															>
																{formatCurrency(client.remainingAmount)}
															</span>
														</td>
														<td>
															<span
																className="badge"
																style={{
																	...stageBadgeStyle,
																	fontSize: '11px',
																	fontWeight: 600,
																	padding: '4px 8px',
																	borderRadius: '4px',
																}}
															>
																{client.stage}
															</span>
														</td>
														{statusTab === 'finished' && (
															<td onClick={(e) => e.stopPropagation()}>
																<button
																	type="button"
																	className="archive-action-btn"
																	onClick={(e) => handleOpenArchiveModal(client, e)}
																	title="أرشفة هذا الملف في الأرشيف السنوي"
																>
																	<Icon name="archive" size={13} /> أرشفة
																</button>
															</td>
														)}
													</>
												)}
											</tr>
										);
									})}
								</tbody>
							</table>
						)}
						{!isLoadingArchive && displayedClients.length === 0 && (
							<div className="empty">
								{statusTab === 'archive'
									? `لا توجد ملفات مؤرشفة لسنة ${selectedArchiveYear}.`
									: 'لا يوجد عميل يطابق بحثك.'}
							</div>
						)}
					</div>
					<div className="table-footer">عرض {displayedClients.length} ملف</div>
				</section>
			</section>

			{/* Archive Confirmation Modal */}
			{archiveModalTarget && (
				<div className="archive-modal-overlay" onClick={() => setArchiveModalTarget(null)}>
					<div className="archive-modal" onClick={(e) => e.stopPropagation()}>
						<div className="archive-modal-title">
							<Icon name="archive" size={20} />
							<span>أرشفة ملف المترشح</span>
						</div>
						<p className="archive-modal-desc">
							هل تريد بالتأكيد أرشفة ملف المتدرب <strong>{archiveModalTarget.name}</strong>؟
							سيتم نقل الملف من قائمة العملاء الحاليين إلى الأرشيف السنوي، ويمكنك استرجاعه في أي وقت.
						</p>

						<div className="archive-year-select-group">
							<label htmlFor="archive-year-select">اختر سنة الأرشيف:</label>
							<select
								id="archive-year-select"
								className="archive-year-select"
								value={archiveTargetYear}
								onChange={(e) => setArchiveTargetYear(Number(e.target.value))}
							>
								{recentYears.map((y) => (
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
								onClick={() => setArchiveModalTarget(null)}
							>
								إلغاء
							</button>
							<button
								type="button"
								className="button primary"
								onClick={handleConfirmArchive}
								style={{ background: '#475569', borderColor: '#475569' }}
							>
								تأكيد الأرشفة
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Floating Action Toast */}
			{actionToast && (
				<div className="toast-feedback">
					<Icon name="check" size={18} />
					<span>{actionToast}</span>
				</div>
			)}

			<CandidatesListModal
				clients={clients}
				isOpen={isCandidatesListOpen}
				onClose={() => setIsCandidatesListOpen(false)}
			/>
		</main>
	);
}

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clientService } from '../services/clients';
import { vehicleService, VEHICLES_UPDATED_EVENT, calculateDocumentStatus } from '../services/vehicles';
import UpdateButton from './UpdateButton';
import '../styles/sidebar.css';
import '../styles/updater.css';
import logoImg from '../assets/logo.png';

interface SidebarProps {
	onOpenCandidatesList?: () => void;
}

function getInitialTheme(): 'dark' | 'light' {
	try {
		const saved = localStorage.getItem('theme');
		if (saved === 'light' || saved === 'dark') return saved;
	} catch { /* ignore */ }
	return 'dark';
}

export default function Sidebar({ onOpenCandidatesList }: SidebarProps) {
	const location = useLocation();
	const [studentCount, setStudentCount] = useState<number>(0);
	const [vehicleAlertSummary, setVehicleAlertSummary] = useState({ totalAlerts: 0, expiredCount: 0 });
	const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [profileUpdaterOpen, setProfileUpdaterOpen] = useState(false);

	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme);
		try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
	}, [theme]);

	useEffect(() => {
		void clientService.list().then((clients) => {
			setStudentCount(clients.length);
		});

		const updateAlerts = () => {
			const s = vehicleService.getSummary();
			setVehicleAlertSummary({ totalAlerts: s.totalAlerts, expiredCount: s.expiredCount });
		};

		updateAlerts();
		window.addEventListener(VEHICLES_UPDATED_EVENT, updateAlerts);
		return () => window.removeEventListener(VEHICLES_UPDATED_EVENT, updateAlerts);
	}, []);

	const isPayments = location.pathname === '/' || location.pathname === '/payments';
	const isClients = location.pathname.startsWith('/clients');
	const isCandidatesLists = location.pathname.startsWith('/candidates-lists');
	const isCalendar = location.pathname.startsWith('/calendar');
	const isVehicles = location.pathname.startsWith('/vehicles');

	function toggleTheme() {
		setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
	}

	return (
		<>
			{/* Mobile toggle button */}
			<button
				type="button"
				className="sidebar-mobile-toggle"
				onClick={() => setMobileOpen((prev) => !prev)}
				aria-label="تبديل القائمة الجانبية"
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<line x1="3" y1="12" x2="21" y2="12" />
					<line x1="3" y1="6" x2="21" y2="6" />
					<line x1="3" y1="18" x2="21" y2="18" />
				</svg>
			</button>

			{/* Mobile backdrop */}
			{mobileOpen && (
				<div
					className="sidebar-backdrop"
					onClick={() => setMobileOpen(false)}
					aria-hidden="true"
				/>
			)}

			<aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="الشريط الجانبي">
				{/* Brand Header */}
				<div className="sidebar-brand">
					<div className="sidebar-brand-icon">
						<img src={logoImg} alt="شعار مدرسة السياقة" className="sidebar-brand-logo-img" />
					</div>
					<div className="sidebar-brand-text">
						<div className="sidebar-brand-title">مدرسة السياقة</div>
						<div className="sidebar-brand-sub">إدارة المدرسة والمدفوعات</div>
					</div>
				</div>

				{/* Main Menu */}
				<nav className="sidebar-nav" aria-label="القائمة الرئيسية">
					<div className="sidebar-menu-label">القائمة الرئيسية</div>

					<Link to="/" style={{ textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
						<button
							type="button"
							className={`sidebar-nav-btn ${isPayments ? 'active' : ''}`}
							aria-current={isPayments ? 'page' : undefined}
						>
							<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
								<rect x="2" y="4" width="20" height="16" rx="2" />
								<line x1="2" y1="10" x2="22" y2="10" />
								<line x1="6" y1="15" x2="10" y2="15" />
							</svg>
							<span className="sidebar-nav-title">المدفوعات والمداخيل</span>
						</button>
					</Link>

					<Link to="/clients" style={{ textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
						<button
							type="button"
							className={`sidebar-nav-btn ${isClients ? 'active' : ''}`}
							aria-current={isClients ? 'page' : undefined}
						>
							<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
								<circle cx="9" cy="7" r="4" />
								<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
								<path d="M16 3.13a4 4 0 0 1 0 7.75" />
							</svg>
							<span className="sidebar-nav-title">المترشحين</span>
						</button>
					</Link>

					<Link to="/candidates-lists" style={{ textDecoration: 'none' }} onClick={() => { setMobileOpen(false); onOpenCandidatesList?.(); }}>
						<button
							type="button"
							className={`sidebar-nav-btn ${isCandidatesLists ? 'active' : ''}`}
							aria-current={isCandidatesLists ? 'page' : undefined}
						>
							<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
								<line x1="16" y1="2" x2="16" y2="6" />
								<line x1="8" y1="2" x2="8" y2="6" />
								<line x1="3" y1="10" x2="21" y2="10" />
							</svg>
							<span className="sidebar-nav-title">قوائم الامتحانات</span>
						</button>
					</Link>

					<Link to="/calendar" style={{ textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
						<button
							type="button"
							className={`sidebar-nav-btn ${isCalendar ? 'active' : ''}`}
							aria-current={isCalendar ? 'page' : undefined}
						>
							<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
								<circle cx="12" cy="12" r="10" />
								<polyline points="12 6 12 12 16 14" />
							</svg>
							<span className="sidebar-nav-title">المواعيد والتقويم</span>
						</button>
					</Link>

					<Link to="/vehicles" style={{ textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
						<button
							type="button"
							className={`sidebar-nav-btn ${isVehicles ? 'active' : ''}`}
							aria-current={isVehicles ? 'page' : undefined}
						>
							<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
								<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2" />
								<circle cx="7" cy="17" r="2" />
								<path d="M9 17h6" />
								<circle cx="17" cy="17" r="2" />
							</svg>
							<span className="sidebar-nav-title">إدارة المركبات</span>
							{vehicleAlertSummary.totalAlerts > 0 && (
								<span
									className={`sidebar-badge ${vehicleAlertSummary.expiredCount > 0 ? 'badge-danger' : 'badge-warning'}`}
									title={
										vehicleAlertSummary.expiredCount > 0
											? `${vehicleAlertSummary.expiredCount} وثائق منتهية الصلاحية!`
											: `${vehicleAlertSummary.totalAlerts} تنبيهات وثائق المركبات`
									}
								>
									{vehicleAlertSummary.expiredCount > 0 ? `منتهية (${vehicleAlertSummary.expiredCount})` : vehicleAlertSummary.totalAlerts}
								</span>
							)}
						</button>
					</Link>
				</nav>

				<div className="sidebar-spacer" />

				{/* User Profile & Logout at Bottom */}
				<div className="sidebar-footer">
					<div
						className="sidebar-profile-card"
						onClick={() => setProfileUpdaterOpen(true)}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								setProfileUpdaterOpen(true);
							}
						}}
						tabIndex={0}
						role="button"
						aria-label="فتح تحديث التطبيق"
					>
						<div className="sidebar-avatar-wrap">
							<div className="sidebar-avatar" title="مدير مدرسة السياقة">
								م
							</div>
						</div>
						<div className="sidebar-profile-info">
							<div className="sidebar-profile-name">مدير المدرسة</div>
							<div className="sidebar-profile-role">مسؤول النظام</div>
						</div>
						<UpdateButton
							showTrigger={false}
							open={profileUpdaterOpen}
							onOpenChange={setProfileUpdaterOpen}
						/>
						<button
							type="button"
							className="sidebar-theme-btn"
							onClick={(event) => {
									event.stopPropagation();
									toggleTheme();
								}}
							title={theme === 'dark' ? 'وضع النهار' : 'وضع الليل'}
							aria-label={theme === 'dark' ? 'تبديل إلى الوضع الفاتح' : 'تبديل إلى الوضع الداكن'}
						>
							{theme === 'dark' ? (
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<circle cx="12" cy="12" r="5" />
									<line x1="12" y1="1" x2="12" y2="3" />
									<line x1="12" y1="21" x2="12" y2="23" />
									<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
									<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
									<line x1="1" y1="12" x2="3" y2="12" />
									<line x1="21" y1="12" x2="23" y2="12" />
									<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
									<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
								</svg>
							) : (
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
								</svg>
							)}
						</button>
						<button
							type="button"
							className="sidebar-logout-btn"
							title="تسجيل الخروج"
							onClick={(event) => {
									event.stopPropagation();
									if (window.confirm('هل تريد تسجيل الخروج من النظام؟')) {
										window.location.reload();
									}
								}}
							aria-label="تسجيل الخروج"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
								<polyline points="16 17 21 12 16 7" />
								<line x1="21" y1="12" x2="9" y2="12" />
							</svg>
						</button>
					</div>
				</div>
			</aside>
		</>
	);
}

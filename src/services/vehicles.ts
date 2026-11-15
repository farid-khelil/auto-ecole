export type StandardDocumentKey = 'insurance' | 'grey_card' | 'fire_extinguisher' | 'first_aid' | 'custom';

export interface VehicleDocument {
  id: string;
  key: StandardDocumentKey;
  name: string;
  issueDate?: string;
  expiryDate: string; // YYYY-MM-DD
  documentNumber?: string;
  notes?: string;
}

export type VehicleStatus = 'active' | 'maintenance' | 'inactive';

export interface Vehicle {
  id: string;
  name: string; // e.g. "داسيا سانديرو - Dacia Sandero"
  plateNumber: string; // رقم الترقيم / Matricule, e.g. "01452 118 16"
  category: string; // e.g. "صنف ب (B)"
  modelYear?: string;
  chassisNumber?: string;
  fuelType?: 'بنزين' | 'مازوت' | 'غاز (GPL)' | 'أخرى';
  status: VehicleStatus;
  notes?: string;
  documents: VehicleDocument[];
  createdAt: string;
  updatedAt: string;
}

export type DocumentAlertStatus = 'expired' | 'expiring_soon' | 'valid' | 'none';

export interface DocumentStatusInfo {
  status: DocumentAlertStatus;
  daysRemaining: number;
  label: string;
  badgeClass: string;
}

export interface VehicleAlertSummary {
  totalVehicles: number;
  activeVehicles: number;
  maintenanceVehicles: number;
  expiredCount: number;
  expiringSoonCount: number;
  validCount: number;
  totalAlerts: number;
}

const VEHICLES_STORAGE_KEY = 'auto-ecole.vehicles.data';
const VEHICLES_SEEDED_KEY = 'auto-ecole.vehicles.seeded_v1';
const ALERT_DAYS_STORAGE_KEY = 'auto-ecole.vehicles.alert_days';
export const VEHICLES_UPDATED_EVENT = 'auto-ecole:vehicles-updated';

export const DEFAULT_ALERT_DAYS = 10;

export const STANDARD_DOCUMENTS: Array<{ key: StandardDocumentKey; name: string; description: string }> = [
  { key: 'insurance', name: 'تأمين المركبة (Assurance)', description: 'عقد التأمين الإجباري السنوي أو السداسي' },
  { key: 'grey_card', name: 'البطاقة الرمادية (Carte Grise)', description: 'البطاقة الرمادية / الفحص الدوري' },
  { key: 'fire_extinguisher', name: 'مطفأة الحريق (Extincteur)', description: 'تاريخ انتهاء صلاحية قارورة إطفاء الحريق' },
  { key: 'first_aid', name: 'صندوق الإسعافات (Trousse de secours)', description: 'صلاحية محتويات علبة الإسعافات الأولية' },
];

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes difference in calendar days between today and target date
 */
export function getDaysDifference(targetDateStr: string): number {
  if (!targetDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = targetDateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determines document status based on expiry date and user-configured threshold
 */
export function calculateDocumentStatus(expiryDate: string, alertDays: number = DEFAULT_ALERT_DAYS): DocumentStatusInfo {
  if (!expiryDate) {
    return {
      status: 'none',
      daysRemaining: 0,
      label: 'غير محدد',
      badgeClass: 'status-none',
    };
  }

  const days = getDaysDifference(expiryDate);

  if (days < 0) {
    const passed = Math.abs(days);
    return {
      status: 'expired',
      daysRemaining: days,
      label: passed === 0 ? 'انتهت اليوم' : `منتهية منذ ${passed} ${passed === 1 ? 'يوم' : passed === 2 ? 'يومين' : passed <= 10 ? 'أيام' : 'يوماً'}`,
      badgeClass: 'status-expired',
    };
  }

  if (days <= alertDays) {
    return {
      status: 'expiring_soon',
      daysRemaining: days,
      label: days === 0 ? 'تنتهي اليوم' : `باقي ${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : days <= 10 ? 'أيام' : 'يوماً'}`,
      badgeClass: 'status-expiring',
    };
  }

  return {
    status: 'valid',
    daysRemaining: days,
    label: `سارية (باقي ${days} يوم)`,
    badgeClass: 'status-valid',
  };
}

/**
 * Helper to add days to today's date for seed or renewal
 */
function addDaysToToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Seed initial sample vehicles for driving schools
 */
function getDemoVehicles(): Vehicle[] {
  return [
    {
      id: 'veh-demo-1',
      name: 'رينو كليو 4 (Renault Clio 4)',
      plateNumber: '02894 116 16',
      category: 'صنف ب (B)',
      modelYear: '2019',
      chassisNumber: 'VF15R040AH129841',
      fuelType: 'مازوت',
      status: 'active',
      notes: 'سيارة تدريب للمبتدئين في السياقة العامة والمناورات',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [
        {
          id: 'doc-1-1',
          key: 'insurance',
          name: 'تأمين المركبة (Assurance)',
          documentNumber: 'POL-2026-9921',
          issueDate: addDaysToToday(-350),
          expiryDate: addDaysToToday(5), // Expiring in 5 days (triggers 10-day alert!)
          notes: 'شركة التأمين SAA - وكالة الجزائر',
        },
        {
          id: 'doc-1-2',
          key: 'grey_card',
          name: 'البطاقة الرمادية (Carte Grise)',
          documentNumber: 'CG-16-09882',
          issueDate: '2019-04-12',
          expiryDate: addDaysToToday(120), // Valid
          notes: 'مسجلة باسم مدرسة السياقة',
        },
        {
          id: 'doc-1-3',
          key: 'fire_extinguisher',
          name: 'مطفأة الحريق (Extincteur)',
          documentNumber: 'EXT-ABC-2KG',
          issueDate: addDaysToToday(-360),
          expiryDate: addDaysToToday(8), // Expiring in 8 days (triggers 10-day alert!)
          notes: 'قارورة إطفاء مسحوق 2 كغ',
        },
        {
          id: 'doc-1-4',
          key: 'first_aid',
          name: 'صندوق الإسعافات (Trousse de secours)',
          documentNumber: 'SEC-2024',
          issueDate: addDaysToToday(-180),
          expiryDate: addDaysToToday(95), // Valid
          notes: 'تحتوي على الضمادات والمطهرات الأساسية',
        },
      ],
    },
    {
      id: 'veh-demo-2',
      name: 'داسيا سانديرو ستبواي (Dacia Sandero Stepway)',
      plateNumber: '08741 121 16',
      category: 'صنف ب (B)',
      modelYear: '2021',
      chassisNumber: 'UU15SD60BJ748291',
      fuelType: 'بنزين',
      status: 'active',
      notes: 'سيارة حديثة مزودة بدواسات مزدوجة معتمدة',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [
        {
          id: 'doc-2-1',
          key: 'insurance',
          name: 'تأمين المركبة (Assurance)',
          documentNumber: 'CAAR-88392-B',
          issueDate: addDaysToToday(-365),
          expiryDate: addDaysToToday(-2), // EXPIRED 2 days ago! (Urgent red alert!)
          notes: 'شركة CAAR - تتطلب تجديداً فورياً',
        },
        {
          id: 'doc-2-2',
          key: 'grey_card',
          name: 'البطاقة الرمادية (Carte Grise)',
          documentNumber: 'CG-16-19384',
          issueDate: '2021-08-15',
          expiryDate: addDaysToToday(240), // Valid
          notes: 'البطاقة البيومترية',
        },
        {
          id: 'doc-2-3',
          key: 'fire_extinguisher',
          name: 'مطفأة الحريق (Extincteur)',
          documentNumber: 'EXT-SAND-1',
          issueDate: addDaysToToday(-200),
          expiryDate: addDaysToToday(165), // Valid
          notes: 'تم فحص الضغط ومستوى الصلاحية',
        },
        {
          id: 'doc-2-4',
          key: 'first_aid',
          name: 'صندوق الإسعافات (Trousse de secours)',
          documentNumber: 'MED-KIT-2025',
          issueDate: addDaysToToday(-300),
          expiryDate: addDaysToToday(-7), // EXPIRED!
          notes: 'تحتاج استبدال المواد المنتهية',
        },
      ],
    },
    {
      id: 'veh-demo-3',
      name: 'هيونداي إكسنت (Hyundai Accent)',
      plateNumber: '00342 114 16',
      category: 'صنف ب (B)',
      modelYear: '2016',
      chassisNumber: 'KMHCT41BPGU39281',
      fuelType: 'غاز (GPL)',
      status: 'active',
      notes: 'سيارة مجهزة بنظام غاز وسياقة اقتصادية',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [
        {
          id: 'doc-3-1',
          key: 'insurance',
          name: 'تأمين المركبة (Assurance)',
          documentNumber: 'CIAR-22839',
          issueDate: addDaysToToday(-100),
          expiryDate: addDaysToToday(80), // Valid
          notes: 'تأمين شامل لمدة عام',
        },
        {
          id: 'doc-3-2',
          key: 'grey_card',
          name: 'البطاقة الرمادية (Carte Grise)',
          documentNumber: 'CG-16-01294',
          issueDate: '2016-02-10',
          expiryDate: addDaysToToday(180), // Valid
        },
        {
          id: 'doc-3-3',
          key: 'fire_extinguisher',
          name: 'مطفأة الحريق (Extincteur)',
          documentNumber: 'EXT-ACC-2K',
          issueDate: addDaysToToday(-60),
          expiryDate: addDaysToToday(300), // Valid
        },
        {
          id: 'doc-3-4',
          key: 'first_aid',
          name: 'صندوق الإسعافات (Trousse de secours)',
          documentNumber: 'SEC-ACC-2026',
          issueDate: addDaysToToday(-30),
          expiryDate: addDaysToToday(335), // Valid
        },
      ],
    },
  ];
}

function broadcastUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VEHICLES_UPDATED_EVENT));
  }
}

export const vehicleService = {
  getAlertDays(): number {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_ALERT_DAYS;
    const val = localStorage.getItem(ALERT_DAYS_STORAGE_KEY);
    if (!val) return DEFAULT_ALERT_DAYS;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) || parsed < 1 ? DEFAULT_ALERT_DAYS : parsed;
  },

  setAlertDays(days: number): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const validDays = Math.max(1, Math.min(180, days));
    localStorage.setItem(ALERT_DAYS_STORAGE_KEY, String(validDays));
    broadcastUpdate();
  },

  list(): Vehicle[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];

    const seeded = localStorage.getItem(VEHICLES_SEEDED_KEY);
    const stored = localStorage.getItem(VEHICLES_STORAGE_KEY);

    if (!seeded || !stored) {
      const demo = getDemoVehicles();
      localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(demo));
      localStorage.setItem(VEHICLES_SEEDED_KEY, 'true');
      return demo;
    }

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch (e) {
      console.error('Failed to parse vehicles from localStorage:', e);
      return [];
    }
  },

  get(id: string): Vehicle | undefined {
    const vehicles = this.list();
    return vehicles.find((v) => v.id === id);
  },

  save(vehicles: Vehicle[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles));
    broadcastUpdate();
  },

  create(input: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Vehicle {
    const vehicles = this.list();
    const newVehicle: Vehicle = {
      ...input,
      id: `veh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vehicles.unshift(newVehicle);
    this.save(vehicles);
    return newVehicle;
  },

  update(id: string, input: Partial<Omit<Vehicle, 'id' | 'createdAt'>>): Vehicle | null {
    const vehicles = this.list();
    const index = vehicles.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const updatedVehicle: Vehicle = {
      ...vehicles[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };

    vehicles[index] = updatedVehicle;
    this.save(vehicles);
    return updatedVehicle;
  },

  delete(id: string): boolean {
    const vehicles = this.list();
    const filtered = vehicles.filter((v) => v.id !== id);
    if (filtered.length === vehicles.length) return false;
    this.save(filtered);
    return true;
  },

  /**
   * Quick renewal helper for a single document
   */
  renewDocument(vehicleId: string, documentId: string, newExpiryDate: string, newIssueDate?: string, newDocNumber?: string): boolean {
    const vehicles = this.list();
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return false;

    const doc = vehicle.documents.find((d) => d.id === documentId);
    if (!doc) return false;

    doc.expiryDate = newExpiryDate;
    if (newIssueDate) doc.issueDate = newIssueDate;
    if (newDocNumber) doc.documentNumber = newDocNumber;

    vehicle.updatedAt = new Date().toISOString();
    this.save(vehicles);
    return true;
  },

  /**
   * Helper that returns aggregated alert counts for widgets and badges
   */
  getSummary(): VehicleAlertSummary {
    const vehicles = this.list();
    const alertDays = this.getAlertDays();

    let activeCount = 0;
    let maintenanceCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let validCount = 0;

    for (const v of vehicles) {
      if (v.status === 'active') activeCount++;
      else if (v.status === 'maintenance') maintenanceCount++;

      for (const doc of v.documents) {
        const status = calculateDocumentStatus(doc.expiryDate, alertDays);
        if (status.status === 'expired') {
          expiredCount++;
        } else if (status.status === 'expiring_soon') {
          expiringSoonCount++;
        } else if (status.status === 'valid') {
          validCount++;
        }
      }
    }

    return {
      totalVehicles: vehicles.length,
      activeVehicles: activeCount,
      maintenanceVehicles: maintenanceCount,
      expiredCount,
      expiringSoonCount,
      validCount,
      totalAlerts: expiredCount + expiringSoonCount,
    };
  },
};

import {
  AuditLogEntry,
  EquipmentItem,
  ExpiryAlertItem,
  ListConfig,
  ThemeMode,
  User,
  DrugItem,
  CheckItemState,
  InspectionHistoryRecord,
} from '../types';
import { DEFAULT_LISTS, ROOMS, INITIAL_MASTER_DATA } from '../constants/initialData';
import { INITIAL_DRUGS_DATA } from '../constants/initialDrugs';

export const STORAGE_KEYS = {
  API_URL: 'anesthesia_api_url',
  SHEET_URL: 'anesthesia_sheet_url',
  THEME: 'anesthesia_theme',
  USERS: 'anesthesia_users',
  SESSION: 'anesthesia_session',
  INSPECTOR: 'anesthesia_inspector',
  CUSTOM_LISTS: 'anesthesia_custom_lists',
  EQ: 'anesthesia_eq',
  GLOBAL_CHECKS: 'anesthesia_global_checks',
  LAST_SUBMITTED: 'anesthesia_last_submitted',
  AUDIT_LOGS: 'anesthesia_audit_logs',
  DRUGS: 'anesthesia_drug_inventory',
  HISTORY: 'inspection_history',
  ACCENT_COLOR: 'anesthesia_accent_color',
};

export function getStored<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export function getStoredString(key: string, defaultValue: string = ''): string {
  try {
    return localStorage.getItem(key) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setStoredString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error('Failed to save string to localStorage:', e);
  }
}

// Initialise Equipment dataset (Guarantees local master persistence & master data replacement)
export function getInitialEquipment(): Record<string, EquipmentItem[]> {
  const stored = getStored<Record<string, EquipmentItem[]> | null>(STORAGE_KEYS.EQ, null);
  if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
    return stored;
  }

  if (INITIAL_MASTER_DATA && INITIAL_MASTER_DATA.equipment && typeof INITIAL_MASTER_DATA.equipment === 'object') {
    setStored(STORAGE_KEYS.EQ, INITIAL_MASTER_DATA.equipment);
    return INITIAL_MASTER_DATA.equipment;
  }

  const SEED_NAMES = [
    'เครื่องดมยาสลบพร้อมเครื่องช่วยหายใจ (Anesthesia Machine)',
    'เครื่องติดตามสัญญาณชีพผู้ป่วย (Patient Monitor)',
    'เครื่องดูดเสมหะและของเหลว (Suction Unit)',
    'เครื่องให้สารน้ำทางหลอดเลือดดำ (Syringe Pump)',
  ];

  const eq: Record<string, EquipmentItem[]> = {};

  ROOMS.forEach((r) => {
    if (!r.m) return;
    if (r.id === 'store') {
      eq[r.id] = [
        {
          name: 'ถังออกซิเจนสำรองทางการแพทย์ (Oxygen Tank)',
          code: '432028000390',
          sap: '432028000390',
          spec: 'ถังขนาด 6 คิว พร้อมฝาครอบนิรภัย',
          source: 'เงินงบประมาณ',
          date: '7 ก.พ. 68',
          qty: '2',
          price: '14,000.00',
          img: '',
          no: '1',
          location: r.n,
        },
        {
          name: 'เกจวัดแรงดันออกซิเจนและ Flowmeter',
          code: '432028000391',
          sap: '432028000391',
          spec: 'เกจลดความดันพร้อมกระปุกน้ำกลั่น',
          source: 'เงินบำรุง',
          date: '7 ก.พ. 68',
          qty: '2',
          price: '5,600.00',
          img: '',
          no: '2',
          location: r.n,
        },
      ];
    } else if (r.seed) {
      eq[r.id] = SEED_NAMES.map((n, i) => ({
        name: n,
        code: i === 0 ? '432028000360' : `432028000${360 + i}`,
        sap: '432028000370',
        spec: 'มาตรฐานโรงพยาบาลทั่วไป',
        source: 'เงินงบประมาณ',
        date: '7 ก.พ. 68',
        qty: '1',
        price: '250,000.00',
        img: '',
        no: String(i + 1),
        location: r.n,
      }));
    } else {
      eq[r.id] = [];
    }
  });

  setStored(STORAGE_KEYS.EQ, eq);
  return eq;
}

// Initialise Lists (Bag & Cart) - Preserves user modifications and custom groups 100%
export function getInitialLists(): Record<'bag' | 'cart', ListConfig> {
  const stored = getStored<Record<'bag' | 'cart', ListConfig> | null>(STORAGE_KEYS.CUSTOM_LISTS, null);
  if (
    stored &&
    typeof stored === 'object' &&
    stored.bag &&
    stored.cart &&
    stored.bag.groups &&
    stored.cart.groups &&
    (Object.keys(stored.bag.groups).length > 0 || Object.keys(stored.cart.groups).length > 0)
  ) {
    return stored;
  }

  if (
    INITIAL_MASTER_DATA &&
    INITIAL_MASTER_DATA.lists &&
    typeof INITIAL_MASTER_DATA.lists === 'object' &&
    INITIAL_MASTER_DATA.lists.bag &&
    INITIAL_MASTER_DATA.lists.cart
  ) {
    setStored(STORAGE_KEYS.CUSTOM_LISTS, INITIAL_MASTER_DATA.lists);
    return INITIAL_MASTER_DATA.lists;
  }

  setStored(STORAGE_KEYS.CUSTOM_LISTS, DEFAULT_LISTS);
  return DEFAULT_LISTS;
}

// Initialise Drugs dataset
export function getInitialDrugs(): DrugItem[] {
  const stored = getStored<DrugItem[] | null>(STORAGE_KEYS.DRUGS, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }

  if (INITIAL_MASTER_DATA && Array.isArray(INITIAL_MASTER_DATA.drugs) && INITIAL_MASTER_DATA.drugs.length > 0) {
    setStored(STORAGE_KEYS.DRUGS, INITIAL_MASTER_DATA.drugs);
    return INITIAL_MASTER_DATA.drugs;
  }

  setStored(STORAGE_KEYS.DRUGS, INITIAL_DRUGS_DATA);
  return INITIAL_DRUGS_DATA;
}

// Full System Backup & Restore Schema
export interface FullSystemBackup {
  version: string;
  exportedAt: string;
  appName: string;
  settings: {
    apiUrl: string;
    sheetUrl: string;
    theme: ThemeMode;
    inspectorName?: string;
  };
  users: User[];
  currentUserSession?: string | null;
  equipment: Record<string, EquipmentItem[]>;
  lists: Record<'bag' | 'cart', ListConfig>;
  drugs: DrugItem[];
  globalChecks: Record<string, Record<string, CheckItemState>>;
  lastSubmitted: Record<string, string>;
  inspectionHistory: InspectionHistoryRecord[];
  auditLogs: AuditLogEntry[];
}

// Export all system data into a single structured object
export function exportFullBackup(): FullSystemBackup {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    appName: 'Anesthesia Check & Hospital Inventory',
    settings: {
      apiUrl: getStoredString(STORAGE_KEYS.API_URL, ''),
      sheetUrl: getStoredString(STORAGE_KEYS.SHEET_URL, ''),
      theme: (getStoredString(STORAGE_KEYS.THEME, 'light') as ThemeMode) || 'light',
      inspectorName: getStoredString(STORAGE_KEYS.INSPECTOR, ''),
    },
    users: getStored<User[]>(STORAGE_KEYS.USERS, []),
    currentUserSession: getStoredString(STORAGE_KEYS.SESSION, ''),
    equipment: getStored<Record<string, EquipmentItem[]>>(STORAGE_KEYS.EQ, {}),
    lists: getStored<Record<'bag' | 'cart', ListConfig>>(STORAGE_KEYS.CUSTOM_LISTS, DEFAULT_LISTS),
    drugs: getStored<DrugItem[]>(STORAGE_KEYS.DRUGS, INITIAL_DRUGS_DATA),
    globalChecks: getStored(STORAGE_KEYS.GLOBAL_CHECKS, {}),
    lastSubmitted: getStored(STORAGE_KEYS.LAST_SUBMITTED, {}),
    inspectionHistory: getStored<InspectionHistoryRecord[]>(STORAGE_KEYS.HISTORY, []),
    auditLogs: getStored<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, []),
  };
}

// Trigger automatic browser download of the JSON backup file
export function downloadBackupFile(): void {
  try {
    const data = exportFullBackup();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'master_app_data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to download backup file:', err);
    throw err;
  }
}

// Validate and import full JSON backup directly into LocalStorage
export function importFullBackup(jsonInput: string | object): {
  success: boolean;
  message: string;
  data?: FullSystemBackup;
} {
  try {
    let parsed: any = jsonInput;
    if (typeof jsonInput === 'string') {
      parsed = JSON.parse(jsonInput);
    }

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: 'ไฟล์ข้อมูล JSON ไม่ถูกต้อง' };
    }

    // Check for valid backup signature or modules
    const hasAnyModule =
      parsed.equipment ||
      parsed.lists ||
      parsed.drugs ||
      parsed.users ||
      parsed.settings ||
      parsed.inspectionHistory;

    if (!hasAnyModule) {
      return { success: false, message: 'โครงสร้างไฟล์ไม่ตรงกับข้อมูลสำรองของระบบ' };
    }

    // 1. Settings
    if (parsed.settings) {
      if (parsed.settings.apiUrl !== undefined) setStoredString(STORAGE_KEYS.API_URL, parsed.settings.apiUrl);
      if (parsed.settings.sheetUrl !== undefined) setStoredString(STORAGE_KEYS.SHEET_URL, parsed.settings.sheetUrl);
      if (parsed.settings.theme !== undefined) setStoredString(STORAGE_KEYS.THEME, parsed.settings.theme);
      if (parsed.settings.inspectorName !== undefined) setStoredString(STORAGE_KEYS.INSPECTOR, parsed.settings.inspectorName);
    }

    // 2. Users
    if (Array.isArray(parsed.users) && parsed.users.length > 0) {
      setStored(STORAGE_KEYS.USERS, parsed.users);
    }

    // 3. Equipment
    if (parsed.equipment && typeof parsed.equipment === 'object') {
      setStored(STORAGE_KEYS.EQ, parsed.equipment);
    }

    // 4. Emergency Lists (Bag & Cart)
    if (parsed.lists && typeof parsed.lists === 'object') {
      setStored(STORAGE_KEYS.CUSTOM_LISTS, parsed.lists);
    }

    // 5. Drugs
    if (Array.isArray(parsed.drugs) && parsed.drugs.length > 0) {
      setStored(STORAGE_KEYS.DRUGS, parsed.drugs);
    }

    // 6. Checks & Last Submitted
    if (parsed.globalChecks && typeof parsed.globalChecks === 'object') {
      setStored(STORAGE_KEYS.GLOBAL_CHECKS, parsed.globalChecks);
    }
    if (parsed.lastSubmitted && typeof parsed.lastSubmitted === 'object') {
      setStored(STORAGE_KEYS.LAST_SUBMITTED, parsed.lastSubmitted);
    }

    // 7. History & Audit Logs
    if (Array.isArray(parsed.inspectionHistory)) {
      setStored(STORAGE_KEYS.HISTORY, parsed.inspectionHistory);
    }
    if (Array.isArray(parsed.auditLogs)) {
      setStored(STORAGE_KEYS.AUDIT_LOGS, parsed.auditLogs);
    }

    return {
      success: true,
      message: 'นำเข้าข้อมูลสำรองลงระบบเรียบร้อยแล้ว',
      data: exportFullBackup(),
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + (err?.message || 'รูปแบบ JSON เสียหาย'),
    };
  }
}

// Expiration calculation
export function calculateExpirationStatus(expDateStr?: string): { daysRemaining: number; status: 'expired' | 'warning' | 'good' } {
  if (!expDateStr || !expDateStr.trim()) {
    return { daysRemaining: 9999, status: 'good' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expDate = new Date(expDateStr);
  if (isNaN(expDate.getTime())) {
    return { daysRemaining: 9999, status: 'good' };
  }
  expDate.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { daysRemaining: diffDays, status: 'expired' };
  } else if (diffDays <= 30) {
    return { daysRemaining: diffDays, status: 'warning' };
  } else {
    return { daysRemaining: diffDays, status: 'good' };
  }
}

// Extract all expiration alerts from Emergency Bag & Emergency Cart
export function getAllExpiryAlerts(lists: Record<'bag' | 'cart', ListConfig>): ExpiryAlertItem[] {
  const alerts: ExpiryAlertItem[] = [];

  (['bag', 'cart'] as const).forEach((type) => {
    const list = lists[type];
    if (!list || !list.groups) return;

    Object.entries(list.groups).forEach(([groupName, items]) => {
      items.forEach((item) => {
        if (item.exp) {
          const { daysRemaining, status } = calculateExpirationStatus(item.exp);
          if (status === 'expired' || status === 'warning') {
            alerts.push({
              item,
              category: type,
              categoryTitle: list.title,
              groupName,
              daysRemaining,
              status,
            });
          }
        }
      });
    });
  });

  // Sort by days remaining (expired first)
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// Audit Log Helpers
export function getLocalAuditLogs(): AuditLogEntry[] {
  return getStored<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, []);
}

export function addAuditLog(
  user: User | null,
  action: AuditLogEntry['action'],
  details: string,
  location: string = '-',
  apiUrl?: string
): AuditLogEntry {
  const logs = getLocalAuditLogs();
  const username = user?.username || 'anonymous';
  const name = user?.name || 'ผู้ใช้งาน';
  const now = new Date().toLocaleString('th-TH');

  const newEntry: AuditLogEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    time: now,
    timestamp: new Date().toISOString(),
    user: username,
    name,
    action,
    details,
    location,
  };

  const updatedLogs = [newEntry, ...logs].slice(0, 100); // keep last 100 in memory
  setStored(STORAGE_KEYS.AUDIT_LOGS, updatedLogs);

  // If API URL is provided, push to Google Sheets Audit Log sheet
  const activeApiUrl = apiUrl || getStoredString(STORAGE_KEYS.API_URL, '');
  if (activeApiUrl) {
    try {
      fetch(activeApiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          a: 'audit',
          user: username,
          name,
          action,
          details,
          location,
          time: now,
        }),
      }).catch((err) => console.log('Audit log async dispatch error:', err));
    } catch (e) {
      // ignore network errors
    }
  }

  return newEntry;
}

export function updateUserAvatar(userId: string, avatarUrl: string): User | null {
  const users = getStored<User[]>(STORAGE_KEYS.USERS, []);
  let updatedUser: User | null = null;
  const nextUsers = users.map((u) => {
    if (u.id === userId) {
      updatedUser = { ...u, avatar: avatarUrl };
      return updatedUser;
    }
    return u;
  });
  setStored(STORAGE_KEYS.USERS, nextUsers);

  // Also update session if matched
  const session = getStored<User | null>(STORAGE_KEYS.SESSION, null);
  if (session && session.id === userId && updatedUser) {
    setStored(STORAGE_KEYS.SESSION, updatedUser);
  }
  return updatedUser;
}

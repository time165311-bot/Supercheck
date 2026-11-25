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
import { diffDaysFromBangkokToday, getBangkokTodayIso } from '../utils/dateUtils';

export const STORAGE_KEYS = {
  API_URL: 'anesthesia_api_url',
  SHEET_URL: 'anesthesia_sheet_url',
  THEME: 'anesthesia_theme',
  USERS: 'anesthesia_users',
  SESSION: 'anesthesia_session',
  INSPECTOR: 'anesthesia_inspector',
  CUSTOM_LISTS: 'anesthesia_custom_lists',
  EQ: 'anesthesia_eq',
  EMER_WEEK_DATES: 'anesthesia_emer_week_dates',
  GLOBAL_CHECKS: 'anesthesia_global_checks',
  LAST_SUBMITTED: 'anesthesia_last_submitted',
  AUDIT_LOGS: 'anesthesia_audit_logs',
  DRUGS: 'anesthesia_drug_inventory',
  HISTORY: 'inspection_history',
  ACCENT_COLOR: 'anesthesia_accent_color',
  CHANNELS: 'anesthesia_channels',
  ACTIVE_CHANNEL_ID: 'anesthesia_active_channel_id',
};

export function getChannelDbKey(channelId: string): string {
  if (!channelId || channelId === 'channel_master') return 'server_db_master_data';
  return `server_db_${channelId}_data`;
}

export function getChannelListsKey(channelId: string): string {
  return `server_db_${channelId}_lists`;
}

export function getChannelChecksKey(channelId: string): string {
  return `server_db_${channelId}_checks`;
}

export function getChannelWeekDatesKey(channelId: string): string {
  return `server_db_${channelId}_week_dates`;
}

export function getChannelDeletedItemsKey(channelId: string): string {
  return `server_db_${channelId || 'channel_master'}_deleted_items`;
}

export function getDeletedItemIds(channelId: string = 'channel_master'): string[] {
  const list = getStored<string[]>(getChannelDeletedItemsKey(channelId), []);
  return Array.isArray(list) ? list.filter((x) => typeof x === 'string' && x.trim().length > 0) : [];
}

export function setDeletedItemIds(channelId: string = 'channel_master', ids: string[]): string[] {
  const deduped = Array.from(
    new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean))
  ).slice(-500);
  setStored(getChannelDeletedItemsKey(channelId), deduped);
  return deduped;
}

export function makeItemTombstoneTokens(
  categoryOrRoom: string,
  item: { id?: string; name?: string; code?: string; category?: string; groupName?: string } | null | undefined,
  fallbackKey?: string
): string[] {
  const tokens: string[] = [];
  const cat = String(categoryOrRoom || '').trim().toLowerCase();
  if (item?.id) tokens.push(`id:${String(item.id).trim()}`);
  if (fallbackKey) tokens.push(`key:${String(fallbackKey).trim()}`);
  const groupOrRoom = String(item?.category || item?.groupName || '').trim().toLowerCase();
  const cleanName = String(item?.name || '').trim().toLowerCase();
  if (cat && cleanName) {
    tokens.push(`sig:${cat}|${groupOrRoom}|${cleanName}`);
    if (!groupOrRoom) {
      tokens.push(`name:${cat}|${cleanName}`);
    }
  }
  if (item?.code && String(item.code).trim() && !String(item.code).startsWith('NEW-')) {
    tokens.push(`code:${cat}|${String(item.code).trim().toLowerCase()}`);
  }
  return Array.from(new Set(tokens));
}

export function addDeletedItemIds(channelId: string = 'channel_master', newTokens: string[]): string[] {
  if (!newTokens || newTokens.length === 0) return getDeletedItemIds(channelId);
  const existing = getDeletedItemIds(channelId);
  return setDeletedItemIds(channelId, [...existing, ...newTokens]);
}

export function removeDeletedItemIds(channelId: string = 'channel_master', tokensToRemove: string[]): string[] {
  if (!tokensToRemove || tokensToRemove.length === 0) return getDeletedItemIds(channelId);
  const removeSet = new Set(tokensToRemove.map((t) => String(t || '').trim()).filter(Boolean));
  const filtered = getDeletedItemIds(channelId).filter((t) => !removeSet.has(t));
  return setDeletedItemIds(channelId, filtered);
}

export function isItemTombstoned(
  categoryOrRoom: string,
  item: { id?: string; name?: string; code?: string; category?: string; groupName?: string } | null | undefined,
  tombstones: Set<string> | string[],
  fallbackKey?: string
): boolean {
  const set = tombstones instanceof Set ? tombstones : new Set(tombstones || []);
  if (set.size === 0 || !item) return false;
  const cat = String(categoryOrRoom || '').trim().toLowerCase();
  if (item.id && (set.has(`id:${String(item.id).trim()}`) || set.has(String(item.id).trim()))) return true;
  if (fallbackKey && (set.has(`key:${String(fallbackKey).trim()}`) || set.has(String(fallbackKey).trim()))) return true;
  const groupOrRoom = String(item.category || item.groupName || '').trim().toLowerCase();
  const cleanName = String(item.name || '').trim().toLowerCase();
  if (cat && cleanName) {
    if (set.has(`sig:${cat}|${groupOrRoom}|${cleanName}`)) return true;
    if (set.has(`name:${cat}|${cleanName}`)) return true;
  }
  if (item.code && String(item.code).trim() && !String(item.code).startsWith('NEW-')) {
    if (set.has(`code:${cat}|${String(item.code).trim().toLowerCase()}`)) return true;
  }
  return false;
}

export function filterEquipmentMapByTombstones(
  eqMap: Record<string, EquipmentItem[]>,
  tombstones: Set<string> | string[]
): Record<string, EquipmentItem[]> {
  const set = tombstones instanceof Set ? tombstones : new Set(tombstones || []);
  if (!eqMap || typeof eqMap !== 'object') return {};
  if (set.size === 0) return eqMap;
  const out: Record<string, EquipmentItem[]> = {};
  Object.entries(eqMap).forEach(([roomId, items]) => {
    out[roomId] = (items || []).filter((it, idx) => {
      const fb = it?.id || `${roomId}_${idx}`;
      return !isItemTombstoned(roomId, { ...it, category: roomId }, set, fb);
    });
  });
  return out;
}

export function filterListsMapByTombstones(
  listsMap: Record<string, ListConfig>,
  tombstones: Set<string> | string[]
): Record<string, ListConfig> {
  const set = tombstones instanceof Set ? tombstones : new Set(tombstones || []);
  if (!listsMap || typeof listsMap !== 'object') return listsMap;
  if (set.size === 0) return listsMap;
  const out: Record<string, ListConfig> = {};
  Object.entries(listsMap).forEach(([catKey, cfg]) => {
    if (!cfg || !cfg.groups) {
      out[catKey] = cfg;
      return;
    }
    const nextGroups: Record<string, EquipmentItem[]> = {};
    Object.entries(cfg.groups).forEach(([gName, items]) => {
      nextGroups[gName] = (items || []).filter((it, idx) => {
        const fb = it?.id || `${catKey}_${gName}_${idx}`;
        return !isItemTombstoned(catKey, { ...it, category: it.category || gName }, set, fb);
      });
    });
    out[catKey] = { ...cfg, groups: nextGroups };
  });
  return out;
}

export function filterDrugsByTombstones(
  drugs: DrugItem[],
  tombstones: Set<string> | string[]
): DrugItem[] {
  const set = tombstones instanceof Set ? tombstones : new Set(tombstones || []);
  if (!Array.isArray(drugs)) return [];
  if (set.size === 0) return drugs;
  return drugs.filter((d) => !isItemTombstoned('drug', d as any, set, d?.id));
}

export interface ChannelCyclePeriods {
  bagMonth?: string;
  cartMonth?: string;
  equipmentYear?: string;
}

export function getChannelCyclePeriodsKey(channelId: string): string {
  return `server_db_${channelId || 'channel_master'}_cycle_periods`;
}

export function getBangkokPeriodKeys(): { monthKey: string; yearKey: string } {
  const todayIso = getBangkokTodayIso();
  return {
    monthKey: todayIso.slice(0, 7),
    yearKey: todayIso.slice(0, 4),
  };
}

export function getStoredCyclePeriods(channelId: string): ChannelCyclePeriods {
  return getStored<ChannelCyclePeriods>(getChannelCyclePeriodsKey(channelId), {});
}

export function setStoredCyclePeriods(channelId: string, periods: ChannelCyclePeriods): void {
  setStored(getChannelCyclePeriodsKey(channelId), periods);
}

export function getStored<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function evictHeavyCachesFromLocalStorage(): void {
  const heavyKeys = [
    STORAGE_KEYS.HISTORY,
    STORAGE_KEYS.AUDIT_LOGS,
    'ha_audit_logs_cache',
    'anesthesia_requisitions',
  ];
  heavyKeys.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
}

export function setStored<T>(key: string, value: T): void {
  // Skip persisting bulky audit log / inspection history blobs in localStorage (Firestore handles them natively)
  if (key === STORAGE_KEYS.HISTORY || key === STORAGE_KEYS.AUDIT_LOGS || key === 'ha_audit_logs_cache') {
    return;
  }
  const serialized = JSON.stringify(value);
  try {
    localStorage.setItem(key, serialized);
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      evictHeavyCachesFromLocalStorage();
      try {
        localStorage.setItem(key, serialized);
        return;
      } catch (retryErr) {
        console.warn('localStorage quota exceeded after cache eviction:', retryErr);
      }
    } else {
      console.error('Failed to save to localStorage:', e);
    }
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
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      evictHeavyCachesFromLocalStorage();
      try {
        localStorage.setItem(key, value);
        return;
      } catch (retryErr) {
        console.warn('localStorage string quota exceeded after eviction:', retryErr);
      }
    } else {
      console.error('Failed to save string to localStorage:', e);
    }
  }
}

// Initialise Equipment dataset (Guarantees local master persistence & tombstones respected)
export function getInitialEquipment(): Record<string, EquipmentItem[]> {
  const tombstones = new Set(getDeletedItemIds('channel_master'));
  const stored = getStored<Record<string, EquipmentItem[]> | null>(STORAGE_KEYS.EQ, null);
  if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
    return filterEquipmentMapByTombstones(stored, tombstones);
  }

  if (INITIAL_MASTER_DATA && INITIAL_MASTER_DATA.equipment && typeof INITIAL_MASTER_DATA.equipment === 'object') {
    const filtered = filterEquipmentMapByTombstones(INITIAL_MASTER_DATA.equipment, tombstones);
    setStored(STORAGE_KEYS.EQ, filtered);
    return filtered;
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

  const filteredEq = filterEquipmentMapByTombstones(eq, tombstones);
  setStored(STORAGE_KEYS.EQ, filteredEq);
  return filteredEq;
}

// Initialise Lists (Bag, Cart & Ambulance) - Preserves user modifications, custom groups & deleted tombstones 100%
export function getInitialLists(): Record<'bag' | 'cart' | string, ListConfig> {
  const tombstones = new Set(getDeletedItemIds('channel_master'));
  const ensureAmbulance = (map: Record<string, ListConfig>): Record<string, ListConfig> => {
    if (map.ambulance && map.ambulance.groups) return map;
    return {
      ...map,
      ambulance: (INITIAL_MASTER_DATA?.lists as any)?.ambulance || DEFAULT_LISTS.ambulance,
    };
  };

  const stored = getStored<Record<string, ListConfig> | null>(STORAGE_KEYS.CUSTOM_LISTS, null);
  if (
    stored &&
    typeof stored === 'object' &&
    stored.bag &&
    stored.cart &&
    stored.bag.groups &&
    stored.cart.groups &&
    (Object.keys(stored.bag.groups).length > 0 || Object.keys(stored.cart.groups).length > 0 || Boolean(stored.ambulance))
  ) {
    return filterListsMapByTombstones(ensureAmbulance(stored), tombstones);
  }

  if (
    INITIAL_MASTER_DATA &&
    INITIAL_MASTER_DATA.lists &&
    typeof INITIAL_MASTER_DATA.lists === 'object' &&
    INITIAL_MASTER_DATA.lists.bag &&
    INITIAL_MASTER_DATA.lists.cart
  ) {
    const filtered = filterListsMapByTombstones(ensureAmbulance(INITIAL_MASTER_DATA.lists as any), tombstones);
    setStored(STORAGE_KEYS.CUSTOM_LISTS, filtered);
    return filtered;
  }

  const filteredDefault = filterListsMapByTombstones(DEFAULT_LISTS as any, tombstones);
  setStored(STORAGE_KEYS.CUSTOM_LISTS, filteredDefault);
  return filteredDefault;
}

// Initialise Drugs dataset
export function getInitialDrugs(): DrugItem[] {
  const tombstones = new Set(getDeletedItemIds('channel_master'));
  const stored = getStored<DrugItem[] | null>(STORAGE_KEYS.DRUGS, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return filterDrugsByTombstones(stored, tombstones);
  }

  if (INITIAL_MASTER_DATA && Array.isArray(INITIAL_MASTER_DATA.drugs) && INITIAL_MASTER_DATA.drugs.length > 0) {
    const filtered = filterDrugsByTombstones(INITIAL_MASTER_DATA.drugs, tombstones);
    setStored(STORAGE_KEYS.DRUGS, filtered);
    return filtered;
  }

  const filteredDefault = filterDrugsByTombstones(INITIAL_DRUGS_DATA, tombstones);
  setStored(STORAGE_KEYS.DRUGS, filteredDefault);
  return filteredDefault;
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

// Expiration calculation locked to Asia/Bangkok (UTC+7)
export function calculateExpirationStatus(expDateStr?: string): { daysRemaining: number; status: 'expired' | 'warning' | 'good' } {
  if (!expDateStr || !expDateStr.trim() || expDateStr.trim() === '-' || /no\s*exp/i.test(expDateStr)) {
    return { daysRemaining: 9999, status: 'good' };
  }

  const diffDays = diffDaysFromBangkokToday(expDateStr);
  if (diffDays === null) {
    return { daysRemaining: 9999, status: 'good' };
  }

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

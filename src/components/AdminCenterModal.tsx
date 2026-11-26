import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Activity,
  ArchiveRestore,
  Building2,
  Check,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  History,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import {
  CheckItemState,
  DrugItem,
  EquipmentItem,
  HaAuditLogEntry,
  ListConfig,
  Role,
  TrashItemRecord,
  User,
  WardChannel,
  WardPermissionLocks,
} from '../types';
import {
  deleteTrashItemInFirebase,
  measureFirestoreUsageClient,
  subscribeHaAuditLogs,
  testCloudConnectivity,
  type CloudConnectivityResult,
  type FirestoreUsageClientResult,
} from '../services/firebase';
import { testGasConnection } from '../services/api';
import { AdminPasscodeActionResult } from '../hooks/useAuth';
import { PinProtectionState } from '../context/DataContext';
import { UserManagement } from './UserManagement';

export interface WardBackupPayload {
  version: number;
  wardId: string;
  exportedAt: string;
  lists: Record<string, ListConfig>;
  drugs: DrugItem[];
  equipment: Record<string, EquipmentItem[]>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  emergencyWeekDates: Record<string, Record<number, string>>;
}

interface AdminCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  wardId: string;
  activeChannel: WardChannel;
  currentUser: User;
  allUsers: User[];
  hasAdminAccess: boolean;
  isAdmin: boolean;
  isSuperAdminUnlocked: boolean;
  adminPasscodeConfigured: boolean | null;
  fetchAdminPasscodeStatus: () => Promise<boolean | null>;
  onVerifyPasscode: (passcode: string) => Promise<AdminPasscodeActionResult>;
  onSetupPasscode: (passcode: string) => Promise<AdminPasscodeActionResult>;
  onChangePasscode: (newPasscode: string, currentPasscode?: string) => Promise<AdminPasscodeActionResult>;
  onLockSuperAdmin: () => void;
  onGoogleSignIn: () => Promise<User | null>;
  authLoading?: boolean;
  authError?: string | null;
  wardPermissionLocks: WardPermissionLocks;
  onUpdatePermissionLocks: (
    patch: Partial<WardPermissionLocks>,
    options?: { superAdminToken?: string | null; operatorName?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  superAdminToken: string | null;
  pinConfig: PinProtectionState;
  trashItems: TrashItemRecord[];
  onRestoreTrashItem: (
    trashItem: TrashItemRecord,
    linkedAuditLogId?: string
  ) => Promise<{ ok: boolean; message: string }>;
  onDeleteAuditLog: (logId: string) => Promise<{ ok: boolean; permissionDenied?: boolean }>;
  sheetUrl: string;
  apiUrl: string;
  onSaveSheetsConfig: (newApiUrl: string, newSheetUrl: string) => void;
  onSwitchWard: (
    wardCode: string,
    options?: { name?: string; duplicateFromMaster?: boolean }
  ) => Promise<{ ok: boolean; wardId: string; error?: string }>;
  drugs: DrugItem[];
  equipment: Record<string, EquipmentItem[]>;
  lists: Record<string, ListConfig>;
  globalChecks: Record<string, Record<string, CheckItemState>>;
  emergencyWeekDates: Record<string, Record<number, string>>;
  onImportBackupJson: (payload: WardBackupPayload) => Promise<{ ok: boolean; message: string }>;
  onUsersChange?: (updatedUsers: User[]) => void;
  onAddUser?: (
    username: string,
    name: string,
    password: string,
    role: Role
  ) => Promise<{ success: boolean; message: string }>;
  onUpdateRole?: (userId: string, role: Role) => void;
  onToggleActive?: (userId: string) => void;
  onResetPassword?: (userId: string, newPw: string) => Promise<void>;
  onDeleteUser?: (userId: string) => void;
}

type AdminTab = 'permissions' | 'audit' | 'system';

type AuditFilterKey =
  | 'ALL'
  | 'ADD'
  | 'UPDATE'
  | 'DELETE'
  | 'CHECK'
  | 'AURA_ACTION'
  | 'RESTORE'
  | 'PERMISSION_CHANGE'
  | 'SHEETS_SYNC';

const ACTION_FILTER_LABELS: Array<{ key: AuditFilterKey; label: string }> = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'ADD', label: 'เพิ่มรายการ' },
  { key: 'UPDATE', label: 'แก้ไข/สต็อก' },
  { key: 'DELETE', label: 'ลบรายการ' },
  { key: 'CHECK', label: 'ตรวจเช็ก' },
  { key: 'AURA_ACTION', label: 'Aura AI' },
  { key: 'RESTORE', label: 'กู้คืนข้อมูล' },
  { key: 'PERMISSION_CHANGE', label: 'สิทธิ์วอร์ด' },
  { key: 'SHEETS_SYNC', label: 'Google Sheets' },
];

function matchesActionFilter(action: string, filter: AuditFilterKey): boolean {
  if (filter === 'ALL') return true;
  const norm = String(action || '').toUpperCase();
  if (filter === 'ADD') return norm === 'ADD' || norm === 'ADD_EQUIPMENT';
  if (filter === 'UPDATE') {
    return norm === 'UPDATE' || norm === 'EDIT_EQUIPMENT' || norm === 'UPDATE_DRUG_STOCK';
  }
  if (filter === 'DELETE') {
    return (
      norm === 'DELETE' ||
      norm === 'DELETE_EQUIPMENT' ||
      norm === 'DELETE_SPECIFIC_ITEMS' ||
      norm.startsWith('CLEAR_')
    );
  }
  if (filter === 'CHECK') {
    return norm === 'CHECK' || norm === 'DEFECTIVE_FLAG' || action === 'เช็คของ';
  }
  if (filter === 'AURA_ACTION') {
    return norm === 'AURA_ACTION' || norm === 'AURA_UNDO_RESTORE';
  }
  if (filter === 'RESTORE') return norm === 'RESTORE' || norm === 'AURA_UNDO_RESTORE';
  if (filter === 'PERMISSION_CHANGE') return norm === 'PERMISSION_CHANGE' || norm === 'ROLE_CHANGE';
  if (filter === 'SHEETS_SYNC') return norm === 'SHEETS_SYNC';
  return norm === filter;
}

function getActionLabel(action: string): string {
  const norm = String(action || '').toUpperCase();
  switch (norm) {
    case 'ADD':
    case 'ADD_EQUIPMENT':
      return 'เพิ่มรายการ';
    case 'UPDATE':
    case 'EDIT_EQUIPMENT':
    case 'UPDATE_DRUG_STOCK':
      return 'แก้ไขข้อมูล';
    case 'DELETE':
    case 'DELETE_EQUIPMENT':
    case 'DELETE_SPECIFIC_ITEMS':
      return 'ลบรายการ';
    case 'CHECK':
    case 'DEFECTIVE_FLAG':
      return 'ตรวจเช็ก';
    case 'AURA_ACTION':
      return 'คำสั่ง Aura AI';
    case 'RESTORE':
    case 'AURA_UNDO_RESTORE':
      return 'กู้คืนข้อมูล';
    case 'PERMISSION_CHANGE':
      return 'เปลี่ยนสิทธิ์วอร์ด';
    case 'SHEETS_SYNC':
      return 'ตั้งค่า/ซิงค์ Sheets';
    default:
      if (norm.startsWith('CLEAR_')) return 'ล้างหมวดหมู่';
      return action || 'กิจกรรม';
  }
}

function getActionTextTone(action: string): string {
  const norm = String(action || '').toUpperCase();
  if (norm === 'DELETE' || norm === 'DELETE_EQUIPMENT' || norm === 'DELETE_SPECIFIC_ITEMS' || norm.startsWith('CLEAR_')) {
    return 'text-rose-400';
  }
  if (norm === 'RESTORE' || norm === 'AURA_UNDO_RESTORE' || norm === 'ADD' || norm === 'ADD_EQUIPMENT') {
    return 'text-emerald-400';
  }
  if (norm === 'PERMISSION_CHANGE' || norm === 'AURA_ACTION') {
    return 'text-amber-300';
  }
  return 'text-blue-400';
}

function formatThaiTimestamp(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function normalizeTrashTargetLabel(targetType?: string): string {
  switch (targetType) {
    case 'drug':
      return 'คลังยา & สารน้ำ';
    case 'bag':
      return 'กระเป๋าฉุกเฉิน';
    case 'cart':
      return 'รถฉุกเฉิน';
    case 'ambulance':
      return 'รถพยาบาลฉุกเฉิน';
    case 'room':
      return 'ครุภัณฑ์ห้องผ่าตัด';
    default:
      return targetType || 'รายการระบบ';
  }
}

export const AdminCenterModal: React.FC<AdminCenterModalProps> = ({
  isOpen,
  onClose,
  wardId,
  activeChannel,
  currentUser,
  allUsers,
  hasAdminAccess,
  isAdmin,
  isSuperAdminUnlocked,
  adminPasscodeConfigured,
  fetchAdminPasscodeStatus,
  onVerifyPasscode,
  onSetupPasscode,
  onChangePasscode,
  onLockSuperAdmin,
  onGoogleSignIn,
  authLoading = false,
  authError = null,
  wardPermissionLocks,
  onUpdatePermissionLocks,
  superAdminToken,
  pinConfig,
  trashItems,
  onRestoreTrashItem,
  onDeleteAuditLog,
  sheetUrl,
  apiUrl,
  onSaveSheetsConfig,
  onSwitchWard,
  drugs,
  equipment,
  lists,
  globalChecks,
  emergencyWeekDates,
  onImportBackupJson,
  onUsersChange,
  onAddUser,
  onUpdateRole,
  onToggleActive,
  onResetPassword,
  onDeleteUser,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('permissions');

  // Gate States
  const [passcodeInput, setPasscodeInput] = useState('');
  const [setupPasscode, setSetupPasscode] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState('');
  const [cooldownSec, setCooldownSec] = useState(0);

  // Tab 1: Locks & PIN
  const [lockSavingKey, setLockSavingKey] = useState<string | null>(null);
  const [permBanner, setPermBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  // Tab 2: Audit Log & Trash Restore
  const [auditLogs, setAuditLogs] = useState<HaAuditLogEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState<AuditFilterKey>('ALL');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [auditBanner, setAuditBanner] = useState<{
    type: 'ok' | 'err' | 'warn';
    text: string;
    offerGoogle?: boolean;
  } | null>(null);
  const [showTrashSection, setShowTrashSection] = useState(true);

  // Tab 3: System, Connectivity, Ward Switch, Passcode Change, Backup/Restore
  const [cloudCheck, setCloudCheck] = useState<CloudConnectivityResult | null>(null);
  const [usageStats, setUsageStats] = useState<FirestoreUsageClientResult | null>(null);
  const [gasCheck, setGasCheck] = useState<{ ok: boolean; msg: string } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const [editSheetUrl, setEditSheetUrl] = useState(sheetUrl);
  const [editApiUrl, setEditApiUrl] = useState(apiUrl);
  const [targetWardCode, setTargetWardCode] = useState('');
  const [targetWardName, setTargetWardName] = useState('');
  const [currentMasterInput, setCurrentMasterInput] = useState('');
  const [newMasterInput, setNewMasterInput] = useState('');
  const [confirmMasterInput, setConfirmMasterInput] = useState('');
  const [systemBanner, setSystemBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [pendingImportPayload, setPendingImportPayload] = useState<WardBackupPayload | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importingBackup, setImportingBackup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync Sheets inputs when props change
  useEffect(() => {
    setEditSheetUrl(sheetUrl);
    setEditApiUrl(apiUrl);
  }, [sheetUrl, apiUrl, isOpen]);

  // Query server passcode configuration whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setGateError('');
    setPermBanner(null);
    setAuditBanner(null);
    setSystemBanner(null);
    void fetchAdminPasscodeStatus();
  }, [isOpen, fetchAdminPasscodeStatus]);

  // Rate-limit countdown ticker
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = window.setTimeout(() => setCooldownSec((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [cooldownSec]);

  // Subscribe real-time Audit Logs when unlocked
  useEffect(() => {
    if (!isOpen || !hasAdminAccess) return;
    const unsub = subscribeHaAuditLogs(
      (logs) => {
        setAuditLogs(logs);
      },
      200,
      wardId
    );
    return () => unsub();
  }, [isOpen, hasAdminAccess, wardId]);

  const unRestoredTrash = useMemo(
    () => (trashItems || []).filter((t) => !t.restoredAt),
    [trashItems]
  );

  const trashById = useMemo(() => {
    const map = new Map<string, TrashItemRecord>();
    (trashItems || []).forEach((t) => {
      if (t.id) map.set(t.id, t);
    });
    return map;
  }, [trashItems]);

  const filteredLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (!matchesActionFilter(log.action, auditFilter)) return false;
      if (!q) return true;
      const haystack = [
        log.operatorName,
        log.userName,
        log.itemName,
        log.category,
        log.action,
        log.oldValue,
        log.newValue,
        log.details?.name,
        log.details?.itemName,
        log.details?.note,
        log.details?.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [auditLogs, auditFilter, auditSearch]);

  if (!isOpen) return null;

  const handleGateVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError('');
    const clean = passcodeInput.replace(/\D/g, '');
    if (!/^\d{6}$/.test(clean)) {
      setGateError('กรุณากรอกรหัสผ่าน Admin ตัวเลข 6 หลัก');
      return;
    }
    setGateBusy(true);
    const res = await onVerifyPasscode(clean);
    setGateBusy(false);
    if (!res.ok) {
      if (res.retryAfterSec) setCooldownSec(res.retryAfterSec);
      setGateError(res.message || 'รหัสผ่าน Admin 6 หลักไม่ถูกต้อง');
      return;
    }
    setPasscodeInput('');
  };

  const handleGateSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError('');
    const p1 = setupPasscode.replace(/\D/g, '');
    const p2 = setupConfirm.replace(/\D/g, '');
    if (!/^\d{6}$/.test(p1)) {
      setGateError('กรุณากำหนดรหัสผ่าน Master 6 หลักเป็นตัวเลขเท่านั้น');
      return;
    }
    if (p1 !== p2) {
      setGateError('รหัสผ่านยืนยัน 6 หลักไม่ตรงกัน');
      return;
    }
    setGateBusy(true);
    const res = await onSetupPasscode(p1);
    setGateBusy(false);
    if (!res.ok) {
      setGateError(res.message || 'ตั้งค่ารหัส Master 6 หลักไม่สำเร็จ');
      return;
    }
    setSetupPasscode('');
    setSetupConfirm('');
  };

  const handleToggleLock = async (
    key: 'lockStaffDeleteItems' | 'lockStaffEditStructure' | 'lockGoogleSheetsExport',
    nextVal: boolean
  ) => {
    setLockSavingKey(key);
    setPermBanner(null);
    const res = await onUpdatePermissionLocks(
      { [key]: nextVal },
      {
        superAdminToken,
        operatorName: currentUser.name,
      }
    );
    setLockSavingKey(null);
    if (res.ok) {
      setPermBanner({ type: 'ok', text: 'บันทึกสิทธิ์วอร์ดและซิงค์ทุกเครื่องเรียบร้อย' });
    } else {
      setPermBanner({
        type: 'err',
        text: res.error || 'บันทึกสิทธิ์วอร์ดไม่สำเร็จ',
      });
    }
  };

  const handleSaveWardPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPermBanner(null);
    setPinBusy(true);
    const res = await pinConfig.enableOrChangePin(pinNew.trim(), pinCurrent.trim());
    setPinBusy(false);
    if (!res.ok) {
      setPermBanner({ type: 'err', text: res.error || 'ตั้งค่ารหัส PIN 4 หลักไม่สำเร็จ' });
      return;
    }
    setPinNew('');
    setPinCurrent('');
    setPermBanner({ type: 'ok', text: 'อัปเดตรหัส PIN แก้ไขรายการ 4 หลักเรียบร้อยแล้ว' });
  };

  const handleDisableWardPin = async () => {
    setPermBanner(null);
    setPinBusy(true);
    const res = await pinConfig.disablePin(pinCurrent.trim());
    setPinBusy(false);
    if (!res.ok) {
      setPermBanner({ type: 'err', text: res.error || 'ปิดใช้งาน PIN ไม่สำเร็จ' });
      return;
    }
    setPinCurrent('');
    setPermBanner({ type: 'ok', text: 'ปิดการใช้งานรหัส PIN แก้ไขรายการแล้ว' });
  };

  const handleRestoreFromTrashOrLog = async (
    trashItem: TrashItemRecord,
    linkedAuditLogId?: string
  ) => {
    setRestoringId(trashItem.id);
    setAuditBanner(null);
    const res = await onRestoreTrashItem(trashItem, linkedAuditLogId);
    setRestoringId(null);
    setAuditBanner({
      type: res.ok ? 'ok' : 'err',
      text: res.message,
    });
  };

  const handleBuildSyntheticTrashFromLog = (log: HaAuditLogEntry): TrashItemRecord | null => {
    if (log.trashId && trashById.has(log.trashId)) {
      return trashById.get(log.trashId)!;
    }
    const payload = log.restorablePayload || log.details?.restorablePayload;
    if (!payload || typeof payload !== 'object') return null;
    const rawType = String(payload.targetType || log.targetCollection || '').toLowerCase();
    const targetType =
      rawType.includes('drug') || rawType.includes('medicine')
        ? 'drug'
        : rawType.includes('bag')
        ? 'bag'
        : rawType.includes('cart')
        ? 'cart'
        : rawType.includes('ambulance')
        ? 'ambulance'
        : 'room';
    return {
      id: log.trashId || `synthetic_${log.id || Date.now()}`,
      wardId,
      targetType,
      category: log.category || targetType,
      groupOrRoomId: payload.roomId || payload.category || log.details?.roomId || '',
      itemName: log.itemName || payload.name || log.details?.name || 'รายการที่ถูกลบ',
      payload,
      deletedBy: log.operatorName || log.userName,
      deletedAt: log.timestamp,
      restoredAt: log.restoredAt,
      restoredBy: log.restoredBy,
    };
  };

  const handleDeleteLogEntry = async (logId: string) => {
    setDeletingLogId(logId);
    setAuditBanner(null);
    const res = await onDeleteAuditLog(logId);
    setDeletingLogId(null);
    if (res.ok) {
      setAuditLogs((prev) => prev.filter((l) => l.id !== logId));
      setAuditBanner({ type: 'ok', text: 'ลบประวัติกิจกรรมที่เลือกเรียบร้อย' });
    } else if (res.permissionDenied) {
      setAuditBanner({
        type: 'warn',
        text: 'การลบบันทึกถาวรบน Firestore ต้องยืนยันสิทธิ์บัญชี Google Owner ด้วย',
        offerGoogle: true,
      });
    } else {
      setAuditBanner({ type: 'err', text: 'ไม่สามารถลบประวัติรายการนี้ได้' });
    }
  };

  const handleDismissTrashRecord = async (trashId: string) => {
    setAuditBanner(null);
    const res = await deleteTrashItemInFirebase(wardId, trashId);
    if (!res.ok && res.permissionDenied) {
      setAuditBanner({
        type: 'warn',
        text: 'การลบถังขยะถาวรบน Firestore ต้องยืนยันสิทธิ์บัญชี Google Owner ด้วย',
        offerGoogle: true,
      });
    }
  };

  const handleRunSystemHealthCheck = async () => {
    setCheckingHealth(true);
    setSystemBanner(null);
    try {
      const [fbRes, usageRes, gRes] = await Promise.all([
        testCloudConnectivity(wardId),
        measureFirestoreUsageClient([wardId]),
        editApiUrl.trim()
          ? testGasConnection(editApiUrl.trim())
          : Promise.resolve({ ok: false, message: 'ยังไม่ได้กำหนด Apps Script Web App URL' }),
      ]);
      setCloudCheck(fbRes);
      setUsageStats(usageRes);
      setGasCheck({ ok: gRes.ok, msg: gRes.message });
    } catch (err: any) {
      setSystemBanner({
        type: 'err',
        text: err?.message || 'ตรวจสอบสถานะระบบไม่สำเร็จ',
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleSaveSheetsSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSheetsConfig(editApiUrl.trim(), editSheetUrl.trim());
    setSystemBanner({ type: 'ok', text: 'บันทึกการเชื่อมต่อ Google Sheets & Apps Script แล้ว' });
  };

  const handleSwitchWardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemBanner(null);
    const res = await onSwitchWard(targetWardCode.trim(), {
      name: targetWardName.trim() || undefined,
      duplicateFromMaster: true,
    });
    if (!res.ok) {
      setSystemBanner({ type: 'err', text: res.error || 'สลับวอร์ดไม่สำเร็จ' });
      return;
    }
    setTargetWardCode('');
    setTargetWardName('');
    setSystemBanner({ type: 'ok', text: `เชื่อมต่อห้องวอร์ด ${res.wardId} แล้ว` });
  };

  const handleChangeMasterPasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemBanner(null);
    const pNew = newMasterInput.replace(/\D/g, '');
    const pConf = confirmMasterInput.replace(/\D/g, '');
    if (!/^\d{6}$/.test(pNew)) {
      setSystemBanner({ type: 'err', text: 'รหัส Master ใหม่ต้องเป็นตัวเลข 6 หลักเท่านั้น' });
      return;
    }
    if (pNew !== pConf) {
      setSystemBanner({ type: 'err', text: 'รหัสยืนยัน 6 หลักไม่ตรงกัน' });
      return;
    }
    const res = await onChangePasscode(pNew, currentMasterInput.replace(/\D/g, '') || undefined);
    if (!res.ok) {
      setSystemBanner({ type: 'err', text: res.message || 'เปลี่ยนรหัส Master ไม่สำเร็จ' });
      return;
    }
    setCurrentMasterInput('');
    setNewMasterInput('');
    setConfirmMasterInput('');
    setSystemBanner({ type: 'ok', text: 'เปลี่ยนรหัส Master 6 หลักเรียบร้อยแล้ว' });
  };

  const handleExportJsonBackup = () => {
    const payload: WardBackupPayload = {
      version: 1,
      wardId,
      exportedAt: new Date().toISOString(),
      lists,
      drugs,
      equipment,
      globalChecks,
      emergencyWeekDates,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anesthesia_${wardId}_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSystemBanner({ type: 'ok', text: `ดาวน์โหลดไฟล์สำรอง JSON วอร์ด ${wardId} แล้ว` });
  };

  const handleExportExcelBackup = () => {
    try {
      const wb = XLSX.utils.book_new();

      const drugRows = drugs.map((d, idx) => ({
        '#': idx + 1,
        ID: d.id,
        ชื่อยา: d.name,
        หมวด: d.category,
        คงเหลือ: d.remaining,
        หน่วย: d.unit || '',
        MinStock: d.minStock,
        EXP: d.expDate || d.exp || '-',
        Lot: d.lotNumber || '',
        หมายเหตุ: d.note || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(drugRows), 'คลังยาและสารน้ำ');

      const eqRows: Array<Record<string, any>> = [];
      Object.entries(equipment || {}).forEach(([roomId, items]) => {
        (items || []).forEach((it, idx) => {
          eqRows.push({
            ห้อง: roomId.toUpperCase(),
            ลำดับ: it.orderNumber || it.no || idx + 1,
            ชื่อครุภัณฑ์: it.name,
            รหัส: it.code || it.assetCode || '',
            สเปก: it.spec || '',
            จำนวน: it.qty || '1',
            สถานะ: it.status || 'ปกติ',
            สถานที่: it.location || '',
            หมายเหตุ: it.note || '',
          });
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eqRows), 'ครุภัณฑ์ห้องผ่าตัด');

      (['bag', 'cart', 'ambulance'] as const).forEach((cat) => {
        const sheetName =
          cat === 'bag' ? 'กระเป๋าฉุกเฉิน' : cat === 'cart' ? 'รถฉุกเฉิน' : 'รถพยาบาลฉุกเฉิน';
        const catRows: Array<Record<string, any>> = [];
        const groups = lists?.[cat]?.groups || {};
        Object.entries(groups).forEach(([groupName, groupItems]) => {
          (groupItems || []).forEach((it, idx) => {
            catRows.push({
              กลุ่ม: groupName,
              ลำดับ: idx + 1,
              ชื่อรายการ: it.name,
              จำนวน: it.unitText || it.qty || '1',
              EXP: it.exp || '-',
              สเปก: it.spec || '',
              หมายเหตุ: it.note || '',
            });
          });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), sheetName);
      });

      const auditRows = auditLogs.slice(0, 500).map((l) => ({
        เวลา: formatThaiTimestamp(l.timestamp),
        ผู้ดำเนินการ: l.operatorName || l.userName,
        กิจกรรม: getActionLabel(l.action),
        รายการ: l.itemName || l.details?.itemName || l.details?.name || l.targetId,
        หมวดหมู่: l.category || l.targetCollection,
        ค่าเดิม: l.oldValue || '',
        ค่าใหม่: l.newValue || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(auditRows), 'Audit_Log');

      XLSX.writeFile(
        wb,
        `anesthesia_${wardId}_export_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      setSystemBanner({ type: 'ok', text: `ส่งออกไฟล์ Excel (.xlsx) สำเร็จ` });
    } catch (err: any) {
      setSystemBanner({ type: 'err', text: err?.message || 'ส่งออก Excel ไม่สำเร็จ' });
    }
  };

  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSystemBanner(null);
    setPendingImportPayload(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (!parsed.lists && !Array.isArray(parsed.drugs) && !parsed.equipment)
      ) {
        setSystemBanner({
          type: 'err',
          text: 'โครงสร้างไฟล์สำรอง JSON ไม่ถูกต้อง (ไม่พบ lists, drugs หรือ equipment)',
        });
        return;
      }
      setPendingImportPayload({
        version: Number(parsed.version || 1),
        wardId: String(parsed.wardId || wardId),
        exportedAt: String(parsed.exportedAt || ''),
        lists: parsed.lists && typeof parsed.lists === 'object' ? parsed.lists : lists,
        drugs: Array.isArray(parsed.drugs) ? parsed.drugs : [],
        equipment: parsed.equipment && typeof parsed.equipment === 'object' ? parsed.equipment : {},
        globalChecks:
          parsed.globalChecks && typeof parsed.globalChecks === 'object' ? parsed.globalChecks : {},
        emergencyWeekDates:
          parsed.emergencyWeekDates && typeof parsed.emergencyWeekDates === 'object'
            ? parsed.emergencyWeekDates
            : {},
      });
      setImportFileName(file.name);
    } catch {
      setSystemBanner({ type: 'err', text: 'ไม่สามารถอ่านไฟล์ JSON ได้ กรุณาตรวจสอบไฟล์' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImportBackup = async () => {
    if (!pendingImportPayload) return;
    setImportingBackup(true);
    setSystemBanner(null);
    const res = await onImportBackupJson(pendingImportPayload);
    setImportingBackup(false);
    setSystemBanner({ type: res.ok ? 'ok' : 'err', text: res.message });
    if (res.ok) {
      setPendingImportPayload(null);
      setImportFileName('');
    }
  };

  const pendingEqCount = pendingImportPayload
    ? Object.values(pendingImportPayload.equipment || {}).reduce(
        (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
        0
      )
    : 0;
  const pendingListItemCount = pendingImportPayload
    ? (['bag', 'cart', 'ambulance'] as const).reduce((acc, cat) => {
        const groups = pendingImportPayload.lists?.[cat]?.groups || {};
        return (
          acc +
          Object.values(groups).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0)
        );
      }, 0)
    : 0;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-5xl bg-[#131314] text-[#E3E3E3] sm:rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <header className="flex items-center justify-between gap-4 px-5 py-4 bg-[#1E1F20] border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-[#E3E3E3] tracking-tight truncate">
              ศูนย์ควบคุมหลังบ้าน (Admin Control Center)
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5 truncate">
              <span className="font-mono tabular-nums">{wardId}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{activeChannel?.name || 'ห้องวอร์ดกลาง'}</span>
              {hasAdminAccess && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400">
                    {isAdmin ? 'Google Owner' : 'Master Passcode'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasAdminAccess && (
              <button
                type="button"
                onClick={() => {
                  onLockSuperAdmin();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-rose-500/15 text-zinc-200 hover:text-rose-300 border border-white/10 text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ล็อกออก (กลับสู่โหมดปกติ)</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-[#E3E3E3] transition cursor-pointer shrink-0"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {!hasAdminAccess ? (
          /* LOCK GATE SCREEN */
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex items-center justify-center">
            <div className="w-full max-w-md bg-[#1E1F20] border border-white/10 rounded-2xl p-6 sm:p-7 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-blue-400 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#E3E3E3]">
                    {adminPasscodeConfigured === false
                      ? 'ตั้งรหัสผ่าน Master 6 หลักครั้งแรก'
                      : 'ปลดล็อกสิทธิ์ผู้ดูแลระบบ (Super Admin)'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    {adminPasscodeConfigured === false
                      ? 'ยังไม่มีรหัสผ่าน Master บนเซิร์ฟเวอร์ กรุณากำหนดตัวเลข 6 หลักสำหรับปลดล็อกบนอุปกรณ์ที่ไม่ได้ล็อกอิน Google'
                      : 'กรอกรหัสผ่าน Master 6 หลัก หรือเข้าสู่ระบบด้วยบัญชี Google Owner เพื่อเข้าถึงการตั้งค่าสิทธิ์และกู้คืนข้อมูล'}
                  </p>
                </div>
              </div>

              {gateError && (
                <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
                  {gateError}
                </div>
              )}

              {adminPasscodeConfigured === false ? (
                <form onSubmit={handleGateSetup} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      กำหนดรหัส Master 6 หลัก
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={setupPasscode}
                      onChange={(e) => setSetupPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#131314] border border-white/15 text-[#E3E3E3] font-mono text-base tracking-[0.35em] text-center outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      ยืนยันรหัส Master 6 หลักอีกครั้ง
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={setupConfirm}
                      onChange={(e) => setSetupConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#131314] border border-white/15 text-[#E3E3E3] font-mono text-base tracking-[0.35em] text-center outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={gateBusy}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    {gateBusy ? 'กำลังบันทึกและปลดล็อก...' : 'ตั้งรหัส Master และเข้าสู่ระบบหลังบ้าน'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleGateVerify} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      รหัสผ่าน Master 6 หลัก
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={passcodeInput}
                      onChange={(e) => setPasscodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#131314] border border-white/15 text-[#E3E3E3] font-mono text-base tracking-[0.35em] text-center outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={gateBusy || cooldownSec > 0}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    {cooldownSec > 0
                      ? `กรุณารอสักครู่ (${cooldownSec} วินาที)`
                      : gateBusy
                      ? 'กำลังตรวจสอบ...'
                      : 'ปลดล็อกด้วยรหัส 6 หลัก'}
                  </button>
                </form>
              )}

              <div className="pt-4 border-t border-white/10 space-y-2.5">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => void onGoogleSignIn()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#131314] hover:bg-white/5 text-[#E3E3E3] border border-white/10 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{authLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google Owner'}</span>
                </button>
                {authError && <p className="text-xs text-rose-400 text-center">{authError}</p>}
                <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                  สถานะปลดล็อกเก็บไว้ในหน่วยความจำชั่วคราวเท่านั้น และจะล็อกกลับอัตโนมัติเมื่อรีเฟรชหน้าเว็บ
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* UNLOCKED ADMIN WORKSPACE */
          <>
            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1.5 px-5 py-2.5 bg-[#131314] border-b border-white/10 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('permissions')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'permissions'
                    ? 'bg-[#1E1F20] text-[#E3E3E3] border border-white/15'
                    : 'text-zinc-400 hover:text-[#E3E3E3] hover:bg-white/5 border border-transparent'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>สิทธิ์วอร์ด & ผู้ใช้</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-[#1E1F20] text-[#E3E3E3] border border-white/15'
                    : 'text-zinc-400 hover:text-[#E3E3E3] hover:bg-white/5 border border-transparent'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>
                  ประวัติความเคลื่อนไหว & กู้คืนข้อมูล ({unRestoredTrash.length > 0 ? `${unRestoredTrash.length} รอกู้คืน` : auditLogs.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'system'
                    ? 'bg-[#1E1F20] text-[#E3E3E3] border border-white/15'
                    : 'text-zinc-400 hover:text-[#E3E3E3] hover:bg-white/5 border border-transparent'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>สุขภาพระบบ, การเชื่อมต่อ & สำรองข้อมูล</span>
              </button>
            </nav>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* TAB 1: WARD PERMISSION LOCKS, PIN & USERS */}
              {activeTab === 'permissions' && (
                <div className="space-y-6">
                  {permBanner && (
                    <div
                      className={`px-4 py-2.5 rounded-xl text-xs border ${
                        permBanner.type === 'ok'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      }`}
                    >
                      {permBanner.text}
                    </div>
                  )}

                  {/* Ward Permission Locks */}
                  <section className="bg-[#1E1F20] border border-white/10 rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                      <div>
                        <h3 className="text-sm font-semibold text-[#E3E3E3]">
                          ควบคุมสิทธิ์การทำงานของเจ้าหน้าที่ในวอร์ด {wardId}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          โหมด Super Admin จะยังคงสิทธิ์เต็มเสมอ การล็อกมีผลเฉพาะเครื่องเจ้าหน้าที่ทั่วไปแบบ Real-time
                        </p>
                      </div>
                      {wardPermissionLocks.updatedAt && (
                        <span className="text-[11px] text-zinc-500 tabular-nums">
                          อัปเดตล่าสุด {formatThaiTimestamp(wardPermissionLocks.updatedAt)}
                          {wardPermissionLocks.updatedBy ? ` · ${wardPermissionLocks.updatedBy}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-white/10">
                      {[
                        {
                          key: 'lockStaffDeleteItems' as const,
                          title: 'ล็อกการลบรายการอุปกรณ์และยาของเจ้าหน้าที่',
                          desc: 'ซ่อนปุ่มลบรายการ ล้างทั้งหมด และบล็อกคำสั่งลบบน Aura Assistant สำหรับผู้ใช้งานทั่วไป',
                          value: wardPermissionLocks.lockStaffDeleteItems,
                        },
                        {
                          key: 'lockStaffEditStructure' as const,
                          title: 'ล็อกการเพิ่มรายการใหม่และแก้ไขโครงสร้างชื่อ/จำนวน',
                          desc: 'เจ้าหน้าที่ยังสามารถติ๊กตรวจเช็ก อัปเดตวันหมดอายุ (EXP) และสเปกได้ แต่เพิ่ม/เปลี่ยนชื่อ/จำนวนตั้งต้นไม่ได้',
                          value: wardPermissionLocks.lockStaffEditStructure,
                        },
                        {
                          key: 'lockGoogleSheetsExport' as const,
                          title: 'ล็อกการตั้งค่าและส่งออก Google Sheets',
                          desc: 'จำกัดสิทธิ์การแก้ไข URL และเปิด Google Sheets จากแถบนำทางสำหรับเจ้าหน้าที่ทั่วไป',
                          value: wardPermissionLocks.lockGoogleSheetsExport,
                        },
                      ].map((row) => (
                        <div
                          key={row.key}
                          className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#E3E3E3]">{row.title}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">{row.desc}</p>
                          </div>
                          <button
                            type="button"
                            disabled={lockSavingKey === row.key}
                            onClick={() => void handleToggleLock(row.key, !row.value)}
                            className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-50 ${
                              row.value
                                ? 'bg-amber-500/15 border-amber-500/35 text-amber-300 hover:bg-amber-500/25'
                                : 'bg-[#131314] border-white/15 text-zinc-300 hover:bg-white/5'
                            }`}
                          >
                            {row.value ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            <span>{row.value ? 'ล็อกอยู่ (Staff ห้ามใช้)' : 'เปิดใช้งานปกติ'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 4-digit Edit Guard PIN */}
                  <section className="bg-[#1E1F20] border border-white/10 rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                      <div>
                        <h3 className="text-sm font-semibold text-[#E3E3E3]">
                          รหัส PIN 4 หลักสำหรับป้องกันการแก้ไขรายการ (Edit PIN)
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          สถานะปัจจุบัน: {pinConfig.pinEnabled ? 'เปิดใช้งานการล็อก PIN 4 หลัก' : 'ปิดใช้งานอยู่'}
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveWardPin} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      {pinConfig.pinEnabled && (
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">PIN เดิม 4 หลัก</label>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={pinCurrent}
                            onChange={(e) => setPinCurrent(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="••••"
                            className="w-full px-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-[#E3E3E3] font-mono text-sm outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          {pinConfig.pinEnabled ? 'PIN ใหม่ 4 หลัก' : 'กำหนด PIN 4 หลัก'}
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={pinNew}
                          onChange={(e) => setPinNew(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="••••"
                          className="w-full px-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-[#E3E3E3] font-mono text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={pinBusy}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {pinConfig.pinEnabled ? 'เปลี่ยนรหัส PIN' : 'เปิดใช้ PIN 4 หลัก'}
                        </button>
                        {pinConfig.pinEnabled && (
                          <button
                            type="button"
                            disabled={pinBusy}
                            onClick={() => void handleDisableWardPin()}
                            className="px-3.5 py-2 rounded-lg bg-[#131314] hover:bg-rose-500/15 text-rose-300 border border-white/15 text-xs font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            ปิด PIN
                          </button>
                        )}
                      </div>
                    </form>
                  </section>

                  {/* User Management */}
                  <UserManagement
                    darkSurface
                    currentUser={currentUser}
                    users={allUsers}
                    onUsersChange={onUsersChange}
                    onAddUser={onAddUser}
                    onUpdateRole={onUpdateRole}
                    onToggleActive={onToggleActive}
                    onResetPassword={onResetPassword}
                    onDeleteUser={onDeleteUser}
                  />
                </div>
              )}

              {/* TAB 2: AUDIT LOG & TRASH RESTORE */}
              {activeTab === 'audit' && (
                <div className="space-y-5">
                  {auditBanner && (
                    <div
                      className={`px-4 py-3 rounded-xl text-xs border flex flex-wrap items-center justify-between gap-3 ${
                        auditBanner.type === 'ok'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                          : auditBanner.type === 'warn'
                          ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                          : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      }`}
                    >
                      <span>{auditBanner.text}</span>
                      {auditBanner.offerGoogle && !isAdmin && (
                        <button
                          type="button"
                          disabled={authLoading}
                          onClick={() => void onGoogleSignIn()}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#E3E3E3] text-xs font-medium transition cursor-pointer shrink-0"
                        >
                          เข้าสู่ระบบ Google Owner
                        </button>
                      )}
                    </div>
                  )}

                  {/* Restorable Trash Queue */}
                  <section className="bg-[#1E1F20] border border-white/10 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#E3E3E3]">
                          ถังขยะที่สามารถกู้คืนได้ทันที ({unRestoredTrash.length})
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          ทุกรายการที่ถูกลบจากคลังยา ครุภัณฑ์ กระเป๋า รถฉุกเฉิน และ Aura จะถูกสำรองไว้ที่นี่
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowTrashSection((p) => !p)}
                        className="px-3 py-1.5 rounded-lg bg-[#131314] hover:bg-white/5 border border-white/10 text-xs text-zinc-300 cursor-pointer shrink-0"
                      >
                        {showTrashSection ? 'ซ่อนรายการ' : 'แสดงรายการ'}
                      </button>
                    </div>

                    {showTrashSection && (
                      unRestoredTrash.length === 0 ? (
                        <p className="text-xs text-zinc-500 py-2">
                          ยังไม่มีรายการที่รอการกู้คืนในขณะนี้
                        </p>
                      ) : (
                        <div className="divide-y divide-white/10 max-h-64 overflow-y-auto">
                          {unRestoredTrash.map((trash) => (
                            <div
                              key={trash.id}
                              className="py-3 flex flex-wrap items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#E3E3E3] truncate">
                                  {trash.itemName}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-0.5">
                                  <span>{normalizeTrashTargetLabel(trash.targetType)}</span>
                                  {trash.groupOrRoomId && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{trash.groupOrRoomId}</span>
                                    </>
                                  )}
                                  <span aria-hidden="true">·</span>
                                  <span>ลบโดย {trash.deletedBy}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {formatThaiTimestamp(trash.deletedAt)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={restoringId === trash.id}
                                  onClick={() => void handleRestoreFromTrashOrLog(trash)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>{restoringId === trash.id ? 'กำลังกู้คืน...' : 'กู้คืนรายการ'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDismissTrashRecord(trash.id)}
                                  className="p-1.5 rounded-lg bg-[#131314] hover:bg-rose-500/15 text-zinc-400 hover:text-rose-300 border border-white/10 transition cursor-pointer"
                                  title="ลบออกจากถังขยะถาวร"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </section>

                  {/* Search & Action Filters */}
                  <section className="bg-[#1E1F20] border border-white/10 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-[#E3E3E3]">
                        ประวัติความเคลื่อนไหวแบบ Real-time ({filteredLogs.length})
                      </h3>
                      <div className="relative w-full sm:w-72">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={auditSearch}
                          onChange={(e) => setAuditSearch(e.target.value)}
                          placeholder="ค้นหาชื่อผู้ทำรายการ หรือชื่ออุปกรณ์..."
                          className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-xs text-[#E3E3E3] placeholder:text-zinc-500 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ACTION_FILTER_LABELS.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setAuditFilter(tab.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                            auditFilter === tab.key
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#131314] text-zinc-400 hover:text-[#E3E3E3] border border-white/10'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {filteredLogs.length === 0 ? (
                      <div className="py-10 text-center text-xs text-zinc-500">
                        ไม่พบประวัติกิจกรรมที่ตรงกับเงื่อนไขการค้นหา
                      </div>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {filteredLogs.map((log) => {
                          const syntheticTrash = handleBuildSyntheticTrashFromLog(log);
                          const isRestored = Boolean(log.restoredAt || syntheticTrash?.restoredAt);
                          const displayItem =
                            log.itemName ||
                            log.details?.itemName ||
                            log.details?.name ||
                            log.targetId ||
                            '-';
                          const displayCat = log.category || log.details?.category || log.targetCollection;
                          const displayOld = log.oldValue ?? log.details?.oldValue;
                          const displayNew = log.newValue ?? log.details?.newValue;
                          const actor = log.operatorName || log.userName || 'เจ้าหน้าที่';

                          return (
                            <div
                              key={log.id || `${log.timestamp}_${log.targetId}`}
                              className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className={`font-semibold ${getActionTextTone(log.action)}`}>
                                    {getActionLabel(log.action)}
                                  </span>
                                  <span aria-hidden="true" className="text-zinc-600">·</span>
                                  <span className="text-[#E3E3E3] font-medium truncate">
                                    {displayItem}
                                  </span>
                                  {displayCat && (
                                    <>
                                      <span aria-hidden="true" className="text-zinc-600">·</span>
                                      <span className="text-zinc-400">{displayCat}</span>
                                    </>
                                  )}
                                </div>

                                {(displayOld !== undefined || displayNew !== undefined) && (
                                  <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2">
                                    {displayOld !== undefined && displayOld !== '' && (
                                      <span className="text-rose-300/90 line-through">
                                        {typeof displayOld === 'string'
                                          ? displayOld
                                          : JSON.stringify(displayOld)}
                                      </span>
                                    )}
                                    {displayOld !== undefined && displayNew !== undefined && (
                                      <span aria-hidden="true" className="text-zinc-500">→</span>
                                    )}
                                    {displayNew !== undefined && displayNew !== '' && (
                                      <span className="text-emerald-300">
                                        {typeof displayNew === 'string'
                                          ? displayNew
                                          : JSON.stringify(displayNew)}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {log.details?.note && (
                                  <p className="text-xs text-zinc-400">{String(log.details.note)}</p>
                                )}

                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                                  <span>โดย {actor}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {formatThaiTimestamp(log.timestamp)}
                                  </span>
                                  {isRestored && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-emerald-400">
                                        กู้คืนแล้ว {log.restoredBy || syntheticTrash?.restoredBy || ''}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {syntheticTrash && !isRestored && (
                                  <button
                                    type="button"
                                    disabled={restoringId === syntheticTrash.id}
                                    onClick={() => void handleRestoreFromTrashOrLog(syntheticTrash, log.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                  >
                                    <ArchiveRestore className="w-3.5 h-3.5" />
                                    <span>
                                      {restoringId === syntheticTrash.id ? 'กำลังกู้คืน...' : 'กู้คืนรายการ'}
                                    </span>
                                  </button>
                                )}

                                {log.id && (
                                  <button
                                    type="button"
                                    disabled={deletingLogId === log.id}
                                    onClick={() => void handleDeleteLogEntry(log.id!)}
                                    className="p-1.5 rounded-lg bg-[#131314] hover:bg-rose-500/15 text-zinc-500 hover:text-rose-300 border border-white/10 transition cursor-pointer disabled:opacity-50"
                                    title="ลบบันทึกประวัติ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* TAB 3: SYSTEM HEALTH, SHEETS CONFIG, WARD SWITCH, PASSCODE & BACKUP */}
              {activeTab === 'system' && (
                <div className="space-y-6">
                  {systemBanner && (
                    <div
                      className={`px-4 py-2.5 rounded-xl text-xs border ${
                        systemBanner.type === 'ok'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      }`}
                    >
                      {systemBanner.text}
                    </div>
                  )}

                  {/* Health Check */}
                  <section className="bg-[#1E1F20] border border-white/10 rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#E3E3E3]">
                          ตรวจสอบสุขภาพระบบและการเชื่อมต่อ Cloud
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          ทดสอบการเชื่อมต่อ Firestore, ขนาดฐานข้อมูล และ Google Apps Script Endpoint แบบสด
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={checkingHealth}
                        onClick={() => void handleRunSystemHealthCheck()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
                        <span>{checkingHealth ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อทั้งหมด'}</span>
                      </button>
                    </div>

                    {(cloudCheck || gasCheck || usageStats) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
                        <div className="p-3.5 rounded-lg bg-[#131314] border border-white/10 space-y-1">
                          <div className="flex items-center justify-between text-zinc-400">
                            <span>Firebase Cloud</span>
                            <Cloud className="w-3.5 h-3.5" />
                          </div>
                          <p className={cloudCheck?.ok ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                            {cloudCheck ? (cloudCheck.ok ? `Online (${cloudCheck.latencyMs ?? 0} ms)` : 'Offline / Error') : '-'}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate">{cloudCheck?.msg || ''}</p>
                        </div>

                        <div className="p-3.5 rounded-lg bg-[#131314] border border-white/10 space-y-1">
                          <div className="flex items-center justify-between text-zinc-400">
                            <span>Firestore Documents</span>
                            <Database className="w-3.5 h-3.5" />
                          </div>
                          <p className="text-[#E3E3E3] font-medium font-mono tabular-nums">
                            {usageStats ? `${usageStats.docCount} เอกสาร · ${(usageStats.usedBytes / 1024).toFixed(1)} KB` : '-'}
                          </p>
                          <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
                            {usageStats ? `สื่อมีเดีย ${usageStats.embeddedMediaCount} รายการ` : ''}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-lg bg-[#131314] border border-white/10 space-y-1">
                          <div className="flex items-center justify-between text-zinc-400">
                            <span>Google Apps Script</span>
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </div>
                          <p className={gasCheck?.ok ? 'text-emerald-400 font-medium' : 'text-amber-300 font-medium'}>
                            {gasCheck ? (gasCheck.ok ? 'เชื่อมต่อสำเร็จ' : 'ไม่พร้อมใช้งาน') : '-'}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate">{gasCheck?.msg || ''}</p>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Backup & Restore */}
                  <section className="bg-[#1E1F20] border border-white/10 rounded-xl p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#E3E3E3]">
                        สำรองข้อมูล (Backup) และนำเข้าข้อมูล (Restore)
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        ส่งออกข้อมูลทั้งหมดของวอร์ด {wardId} เป็นไฟล์ JSON (สำหรับกู้คืนทั้งระบบ) หรือ Excel (.xlsx)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleExportJsonBackup}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#131314] hover:bg-white/5 text-[#E3E3E3] border border-white/15 text-xs font-medium transition cursor-pointer"
                      >
                        <FileJson className="w-4 h-4 text-blue-400" />
                        <span>ดาวน์โหลด Backup (.json)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportExcelBackup}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#131314] hover:bg-white/5 text-[#E3E3E3] border border-white/15 text-xs font-medium transition cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>ส่งออกรายงาน Excel (.xlsx)</span>
                      </button>

                      <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 text-xs font-medium transition cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>นำเข้าไฟล์สำรอง (.json)</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json,application/json"
                          onChange={handleSelectBackupFile}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {pendingImportPayload && (
                      <div className="p-4 rounded-xl bg-[#131314] border border-amber-500/30 space-y-3 text-xs">
                        <div className="flex items-start gap-2.5 text-amber-200">
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">ตรวจสอบไฟล์สำรอง: {importFileName}</p>
                            <p className="text-zinc-400 mt-1 tabular-nums">
                              คลังยา {pendingImportPayload.drugs.length} รายการ · ครุภัณฑ์ห้องผ่าตัด {pendingEqCount} รายการ · กระเป๋า/รถ {pendingListItemCount} รายการ
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={importingBackup}
                            onClick={() => void handleConfirmImportBackup()}
                            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition cursor-pointer disabled:opacity-50"
                          >
                            {importingBackup ? 'กำลังนำเข้าข้อมูล...' : 'ยืนยันนำเข้าและเขียนทับข้อมูลวอร์ด'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingImportPayload(null);
                              setImportFileName('');
                            }}
                            className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Google Sheets URLs & Ward Switch */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <form
                      onSubmit={handleSaveSheetsSettings}
                      className="bg-[#1E1F20] border border-white/10 rounded-xl p-5 space-y-3.5"
                    >
                      <h3 className="text-sm font-semibold text-[#E3E3E3]">
                        ตั้งค่าการเชื่อมต่อ Google Sheets & GAS
                      </h3>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Google Sheets URL</label>
                        <input
                          type="url"
                          value={editSheetUrl}
                          onChange={(e) => setEditSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="w-full px-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-xs text-[#E3E3E3] outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Apps Script Web App URL</label>
                        <input
                          type="url"
                          value={editApiUrl}
                          onChange={(e) => setEditApiUrl(e.target.value)}
                          placeholder="https://script.google.com/macros/s/..."
                          className="w-full px-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-xs text-[#E3E3E3] outline-none focus:border-blue-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition cursor-pointer"
                      >
                        บันทึกการเชื่อมต่อ Sheets
                      </button>
                    </form>

                    <form
                      onSubmit={handleSwitchWardSubmit}
                      className="bg-[#1E1F20] border border-white/10 rounded-xl p-5 space-y-3.5"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-zinc-400" />
                        <h3 className="text-sm font-semibold text-[#E3E3E3]">
                          สลับหรือสร้างห้องวอร์ดกลางใหม่
                        </h3>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">รหัสห้องวอร์ด (Ward Code)</label>
                        <input
                          type="text"
                          value={targetWardCode}
                          onChange={(e) => setTargetWardCode(e.target.value.toUpperCase())}
                          placeholder="เช่น ANES-OR2 หรือ WARD-ICU"
                          className="w-full px-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-xs text-[#E3E3E3] font-mono outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">ชื่อวอร์ด (ไม่บังคับ)</label>
                        <input
                          type="text"
                          value={targetWardName}
                          onChange={(e) => setTargetWardName(e.target.value)}
                          placeholder="เช่น ห้องผ่าตัดอาคารใหม่"
                          className="w-full px-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-xs text-[#E3E3E3] outline-none focus:border-blue-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[#131314] hover:bg-white/5 text-[#E3E3E3] border border-white/15 text-xs font-medium transition cursor-pointer"
                      >
                        เชื่อมต่อ / สร้างวอร์ด
                      </button>
                    </form>
                  </div>

                  {/* Change Master 6-digit Passcode */}
                  <form
                    onSubmit={handleChangeMasterPasscodeSubmit}
                    className="bg-[#1E1F20] border border-white/10 rounded-xl p-5 space-y-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-zinc-400" />
                      <h3 className="text-sm font-semibold text-[#E3E3E3]">
                        เปลี่ยนรหัสผ่าน Master Admin (6 หลัก)
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {!isSuperAdminUnlocked && isAdmin && (
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            รหัสเดิม 6 หลัก (ถ้ามี)
                          </label>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={currentMasterInput}
                            onChange={(e) =>
                              setCurrentMasterInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                            placeholder="••••••"
                            className="w-full px-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-xs text-[#E3E3E3] font-mono outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">รหัสใหม่ 6 หลัก</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={newMasterInput}
                          onChange={(e) => setNewMasterInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="••••••"
                          className="w-full px-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-xs text-[#E3E3E3] font-mono outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">ยืนยันรหัสใหม่ 6 หลัก</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={confirmMasterInput}
                          onChange={(e) =>
                            setConfirmMasterInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          placeholder="••••••"
                          className="w-full px-3 py-2 rounded-lg bg-[#131314] border border-white/15 text-xs text-[#E3E3E3] font-mono outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>อัปเดตรหัส Master 6 หลัก</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

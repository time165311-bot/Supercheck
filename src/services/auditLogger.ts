import { recordHaAuditLog, saveTrashItemToFirebase } from './firebase';
import { HaAuditLogEntry, TrashItemRecord, TrashTargetType, User } from '../types';
import { getActiveWardIdFromStorage, resolveWardId } from '../utils/wardUtils';

export function stringifyAuditValue(val: any): string | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  let str: string;
  if (typeof val === 'string') {
    str = val;
  } else if (typeof val === 'number' || typeof val === 'boolean') {
    str = String(val);
  } else {
    try {
      str = JSON.stringify(val);
    } catch {
      str = String(val);
    }
  }
  return str.length > 1800 ? `${str.slice(0, 1797)}...` : str;
}

export function resolveOperatorName(currentUser?: User | null, explicitName?: string): string {
  if (explicitName && explicitName.trim()) return explicitName.trim().slice(0, 150);
  if (currentUser?.name && currentUser.name.trim()) return currentUser.name.trim().slice(0, 150);
  if (typeof window !== 'undefined') {
    const stored =
      localStorage.getItem('user_display_name') || localStorage.getItem('user_name_default');
    if (stored && stored.trim()) return stored.trim().slice(0, 150);
  }
  return 'สาธิต';
}

/**
 * Universal HA/JCI Activity & Audit Logger scoped to the active Shared Ward Workspace
 */
export async function logAuditEvent(params: {
  action: HaAuditLogEntry['action'];
  targetCollection: string;
  targetId: string;
  details: Record<string, any>;
  currentUser?: User | null;
  userId?: string;
  userName?: string;
  operatorName?: string;
  role?: string;
  ipAddress?: string;
  wardId?: string;
  itemName?: string;
  category?: string;
  oldValue?: any;
  newValue?: any;
  trashId?: string;
  restorablePayload?: Record<string, any>;
}): Promise<string | null> {
  try {
    const user = params.currentUser;
    const resolvedWard = resolveWardId(
      params.wardId || (params.details?.channelId as string) || getActiveWardIdFromStorage()
    );
    const resolvedUserId =
      params.userId ||
      user?.id ||
      (typeof window !== 'undefined' ? localStorage.getItem('user_id_default') : null) ||
      'usr_ward_staff';
    const resolvedUserName = resolveOperatorName(user, params.operatorName || params.userName);
    const resolvedRole =
      params.role ||
      user?.role ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('user_display_position') || localStorage.getItem('user_position_default')
        : null) ||
      'พยาบาลวิสัญญี';

    const resolvedItemName =
      params.itemName ||
      (typeof params.details?.itemName === 'string' ? params.details.itemName : undefined) ||
      (typeof params.details?.name === 'string' ? params.details.name : undefined);

    const resolvedCategory =
      params.category ||
      (typeof params.details?.category === 'string' ? params.details.category : undefined);

    const resolvedOldValue = stringifyAuditValue(
      params.oldValue !== undefined ? params.oldValue : params.details?.oldValue
    );
    const resolvedNewValue = stringifyAuditValue(
      params.newValue !== undefined ? params.newValue : params.details?.newValue
    );

    const entry: HaAuditLogEntry = {
      timestamp: new Date().toISOString(),
      wardId: resolvedWard,
      userId: resolvedUserId,
      userName: resolvedUserName,
      operatorName: resolvedUserName,
      role: resolvedRole,
      action: params.action,
      targetCollection: params.targetCollection,
      targetId: params.targetId || 'ward_item',
      ...(resolvedItemName ? { itemName: String(resolvedItemName).slice(0, 300) } : {}),
      ...(resolvedCategory ? { category: String(resolvedCategory).slice(0, 150) } : {}),
      ...(resolvedOldValue !== undefined ? { oldValue: resolvedOldValue } : {}),
      ...(resolvedNewValue !== undefined ? { newValue: resolvedNewValue } : {}),
      ...(params.trashId ? { trashId: String(params.trashId).slice(0, 128) } : {}),
      ...(params.restorablePayload ? { restorablePayload: params.restorablePayload } : {}),
      details: {
        ...params.details,
        wardId: resolvedWard,
      },
      ipAddress:
        params.ipAddress ||
        (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
    };

    const logId = await recordHaAuditLog(entry, resolvedWard);
    return logId;
  } catch (error) {
    console.warn('[AuditLogger] Failed to write audit event:', error);
    return null;
  }
}

/**
 * Archives a full deleted item snapshot to `wards/{wardId}/trash` for Admin Restore
 */
export async function archiveDeletedItemToTrash(params: {
  wardId?: string;
  targetType: TrashTargetType;
  category?: string;
  groupOrRoomId?: string;
  itemName: string;
  payload: Record<string, any>;
  tombstoneTokens?: string[];
  deletedBy?: string;
  currentUser?: User | null;
}): Promise<string | null> {
  try {
    const resolvedWard = resolveWardId(params.wardId || getActiveWardIdFromStorage());
    const trashId = `trash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record: TrashItemRecord = {
      id: trashId,
      wardId: resolvedWard,
      targetType: params.targetType,
      category: params.category || params.targetType,
      groupOrRoomId: params.groupOrRoomId || '',
      itemName: String(params.itemName || 'รายการที่ถูกลบ').trim().slice(0, 300) || 'รายการที่ถูกลบ',
      payload: params.payload || {},
      tombstoneTokens: Array.isArray(params.tombstoneTokens) ? params.tombstoneTokens.slice(0, 20) : [],
      deletedBy: resolveOperatorName(params.currentUser, params.deletedBy),
      deletedAt: new Date().toISOString(),
    };

    const ok = await saveTrashItemToFirebase(record, resolvedWard);
    return ok ? record.id : null;
  } catch (err) {
    console.warn('[AuditLogger] Failed to archive deleted item to trash:', err);
    return null;
  }
}

import { recordHaAuditLog } from './firebase';
import { HaAuditLogEntry, User } from '../types';

/**
 * Universal HA/JCI Append-Only Audit Logger
 * Intercepts and records critical actions:
 * 1. UPDATE_DRUG_STOCK / ADD_EQUIPMENT / EDIT_EQUIPMENT / DELETE_EQUIPMENT
 * 2. ROLE_CHANGE / USER_UPDATE
 * 3. DEFECTIVE_FLAG / BYPASS_ITEM
 * 4. EXPORT_HA_REPORT / EXPORT_EXCEL
 * 5. FHIR_MEDICATION_DISPENSE
 */
export async function logAuditEvent(params: {
  action: HaAuditLogEntry['action'];
  targetCollection: string;
  targetId: string;
  details: Record<string, any>;
  currentUser?: User | null;
  userId?: string;
  userName?: string;
  role?: string;
  ipAddress?: string;
}): Promise<string | null> {
  try {
    const user = params.currentUser;
    const resolvedUserId = params.userId || user?.id || (typeof window !== 'undefined' ? localStorage.getItem('user_id_default') : null) || 'usr_anonymous';
    const resolvedUserName = params.userName || user?.name || (typeof window !== 'undefined' ? (localStorage.getItem('user_display_name') || localStorage.getItem('user_name_default')) : null) || 'พยาบาลวิสัญญี';
    const resolvedRole = params.role || user?.role || (typeof window !== 'undefined' ? (localStorage.getItem('user_display_position') || localStorage.getItem('user_position_default')) : null) || 'Nurse';

    const entry: HaAuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId: resolvedUserId,
      userName: resolvedUserName,
      role: resolvedRole,
      action: params.action,
      targetCollection: params.targetCollection,
      targetId: params.targetId,
      details: params.details,
      ipAddress: params.ipAddress || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
    };

    // Save to Firestore audit_logs collection
    const logId = await recordHaAuditLog(entry);

    // Keep recent audit logs in localStorage cache for offline auditing
    if (typeof window !== 'undefined') {
      try {
        const cacheKey = 'ha_audit_logs_cache';
        const existing = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        const updated = [{ ...entry, id: logId }, ...(Array.isArray(existing) ? existing.slice(0, 99) : [])];
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      } catch (err) {
        // Ignore cache storage errors
      }
    }

    return logId;
  } catch (error) {
    console.warn('[AuditLogger] Failed to write audit event:', error);
    return null;
  }
}

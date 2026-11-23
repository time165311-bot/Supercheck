import { ExpiryAlertItem } from '../types';

export const DISMISSED_ALERTS_STORAGE_KEY = 'anesthesia_dismissed_alerts';
export const ALERTS_UPDATED_EVENT = 'anesthesia_alerts_updated';

export function getExpiryAlertKey(alert: ExpiryAlertItem): string {
  return `${alert.category}_${alert.groupName || ''}_${alert.item.name}_${alert.item.exp || ''}`;
}

export function getDismissedAlertKeys(): string[] {
  try {
    const saved = localStorage.getItem(DISMISSED_ALERTS_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function dismissExpiryAlertKey(key: string): string[] {
  const existing = getDismissedAlertKeys();
  const updated = existing.includes(key) ? existing : [...existing, key];
  try {
    localStorage.setItem(DISMISSED_ALERTS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(ALERTS_UPDATED_EVENT, { detail: updated }));
  } catch {
    // ignore storage errors
  }
  return updated;
}

export function getVisibleExpiryAlerts(
  alerts: ExpiryAlertItem[] = [],
  dismissedKeys?: string[]
): ExpiryAlertItem[] {
  const keys = dismissedKeys ?? getDismissedAlertKeys();
  if (!Array.isArray(alerts) || alerts.length === 0) return [];
  if (keys.length === 0) return alerts;
  return alerts.filter((alert) => !keys.includes(getExpiryAlertKey(alert)));
}

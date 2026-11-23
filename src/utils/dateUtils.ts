/**
 * Timezone-safe date utilities locked to Asia/Bangkok (UTC+7).
 * Prevents UTC midnight off-by-1-day edge cases in expiry calculations.
 */

export const BANGKOK_TIME_ZONE = 'Asia/Bangkok';

/**
 * Returns current calendar date in Asia/Bangkok as "YYYY-MM-DD".
 */
export function getBangkokTodayIso(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BANGKOK_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback below
  }
  const nowUtcMs = Date.now() + 7 * 60 * 60 * 1000;
  return new Date(nowUtcMs).toISOString().slice(0, 10);
}

/**
 * Returns current timestamp in Bangkok ISO-like string or UTC ISO string.
 */
export function getBangkokYearCE(): number {
  return parseInt(getBangkokTodayIso().slice(0, 4), 10) || new Date().getFullYear();
}

/**
 * Parses common Thai Buddhist Era / Gregorian / short date formats into canonical "YYYY-MM-DD".
 * Supported inputs:
 * - "YYYY-MM-DD" (CE or BE >= 2400)
 * - "DD/MM/YYYY", "DD-MM-YYYY", "DD.MM.YYYY" (2-digit or 4-digit, CE or BE)
 * - "MM/YYYY", "MM/YY", "MM-YYYY" (normalized to first day of month "-01")
 */
export function normalizeExpDateToIso(expStr?: string | null): string {
  if (!expStr) return '';
  const raw = String(expStr).trim();
  if (!raw || raw === '-' || raw === 'null' || raw === 'undefined') return '';

  const normalizeYear = (yNum: number): number => {
    if (yNum >= 2400) return yNum - 543; // Full BE e.g. 2570 -> 2027
    if (yNum < 100) {
      // Heuristic: >= 55 usually short Thai BE e.g. 69, 70, 71 -> 2569 - 543 = 2026
      return yNum >= 55 ? 2500 + yNum - 543 : 2000 + yNum;
    }
    return yNum;
  };

  // 1. YYYY-MM-DD (or YYYY/MM/DD)
  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const year = normalizeYear(parseInt(isoMatch[1], 10));
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. DD/MM/YYYY or DD/MM/YY
  const dmyMatch = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = normalizeYear(parseInt(dmyMatch[3], 10));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. MM/YYYY or MM/YY
  const myMatch = raw.match(/^(\d{1,2})[-/.](\d{2,4})$/);
  if (myMatch) {
    const month = parseInt(myMatch[1], 10);
    const year = normalizeYear(parseInt(myMatch[2], 10));
    if (month >= 1 && month <= 12) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
    }
  }

  return '';
}

/**
 * Computes exact whole-day difference (expiryDate - bangkokToday) without UTC timezone drift.
 * Positive = days until expiry, 0 = expires today in Bangkok, Negative = expired N days ago.
 */
export function diffDaysFromBangkokToday(dateStr?: string | null): number | null {
  const iso = normalizeExpDateToIso(dateStr);
  if (!iso) return null;

  const [y, m, d] = iso.split('-').map(Number);
  const [by, bm, bd] = getBangkokTodayIso().split('-').map(Number);
  if (!y || !m || !d || !by || !bm || !bd) return null;

  const expUtcMidnight = Date.UTC(y, m - 1, d);
  const bkkUtcMidnight = Date.UTC(by, bm - 1, bd);
  return Math.round((expUtcMidnight - bkkUtcMidnight) / (1000 * 60 * 60 * 24));
}

/**
 * Checks whether an expiration date falls within the current Bangkok calendar year.
 */
export function isCurrentYearExpBangkok(dateStr?: string | null): boolean {
  const iso = normalizeExpDateToIso(dateStr);
  const currentYear = getBangkokYearCE();
  if (iso) {
    return parseInt(iso.slice(0, 4), 10) === currentYear;
  }
  if (!dateStr) return false;
  const raw = String(dateStr).trim();
  const currentBE = currentYear + 543;
  return raw.includes(String(currentYear)) || raw.includes(String(currentBE));
}

/**
 * Parses common Thai Buddhist Era / Gregorian / short date formats into a local Date
 * normalized cleanly to calendar year/month/day without shifting by UTC timezone offsets.
 */
export function parseBangkokDate(dateStr?: string | null): Date | null {
  const iso = normalizeExpDateToIso(dateStr);
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number);
    if (y && m && d) {
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
  }
  if (!dateStr || !dateStr.trim() || dateStr === '-' || /no\s*exp/i.test(dateStr) || /ไม่มี/i.test(dateStr)) {
    return null;
  }
  const fallback = new Date(dateStr.trim());
  return isNaN(fallback.getTime()) ? null : fallback;
}


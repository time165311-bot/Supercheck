import { User } from '../types';

export type AvatarRingKey = 'gold' | 'silver' | 'blue' | 'green' | 'purple' | 'rose' | 'slate';

export interface RingConfig {
  id: AvatarRingKey;
  label: string;
  emoji: string;
  ringClasses: string;
  dotBg: string;
}

export const RING_CONFIGS: Record<AvatarRingKey, RingConfig> = {
  gold: {
    id: 'gold',
    label: 'สีทอง',
    emoji: '🟡',
    ringClasses: 'ring-2 ring-amber-400 dark:ring-amber-300 ring-offset-2 ring-offset-white dark:ring-offset-[#242526] shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    dotBg: 'bg-amber-400',
  },
  silver: {
    id: 'silver',
    label: 'สีเงิน / พลาตินัม',
    emoji: '⚪',
    ringClasses: 'ring-2 ring-slate-300 dark:ring-slate-300 ring-offset-2 ring-offset-white dark:ring-offset-[#242526] shadow-[0_0_10px_rgba(203,213,225,0.6)]',
    dotBg: 'bg-slate-300 border border-slate-400',
  },
  blue: {
    id: 'blue',
    label: 'สีน้ำเงิน',
    emoji: '🔵',
    ringClasses: 'ring-2 ring-[#1877f2] dark:ring-[#2d88ff] ring-offset-2 ring-offset-white dark:ring-offset-[#242526] shadow-[0_0_10px_rgba(24,119,242,0.45)]',
    dotBg: 'bg-[#1877f2]',
  },
  green: {
    id: 'green',
    label: 'สีเขียว',
    emoji: '🟢',
    ringClasses: 'ring-2 ring-emerald-500 dark:ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-[#242526] shadow-[0_0_10px_rgba(16,185,129,0.45)]',
    dotBg: 'bg-emerald-500',
  },
  purple: {
    id: 'purple',
    label: 'สีม่วง',
    emoji: '🟣',
    ringClasses: 'ring-2 ring-purple-600 dark:ring-purple-400 ring-offset-2 ring-offset-white dark:ring-offset-[#242526] shadow-[0_0_10px_rgba(147,51,234,0.45)]',
    dotBg: 'bg-purple-600',
  },
  rose: {
    id: 'rose',
    label: 'สีชมพูโกลด์',
    emoji: '🌸',
    ringClasses: 'ring-2 ring-rose-400 dark:ring-rose-300 ring-offset-2 ring-offset-white dark:ring-offset-[#242526] shadow-[0_0_10px_rgba(251,113,133,0.5)]',
    dotBg: 'bg-rose-400',
  },
  slate: {
    id: 'slate',
    label: 'สีเทามินิมอล',
    emoji: '🩶',
    ringClasses: 'ring-2 ring-slate-400 dark:ring-slate-500 ring-offset-2 ring-offset-white dark:ring-offset-[#242526]',
    dotBg: 'bg-slate-400',
  },
};

export function getEffectiveAvatarRing(user?: User | null, overrideColor?: string): AvatarRingKey {
  if (!user) return 'slate';

  // If override color is explicitly provided in active state
  if (overrideColor && overrideColor in RING_CONFIGS) {
    return overrideColor as AvatarRingKey;
  }

  // Admin Customization
  if (user.role === 'admin') {
    const saved = localStorage.getItem(`user_avatar_ring_${user.id}`) || user.ringColor;
    if (saved && saved in RING_CONFIGS) {
      return saved as AvatarRingKey;
    }
    return 'gold'; // Default for Admin
  }

  // Non-Admin Role-Based Rules
  const position = user.position || '';
  const name = user.name || '';

  if (position.includes('หัวหน้า') || name.includes('หัวหน้า')) {
    return 'purple';
  }
  if (position.includes('แพทย์') || name.includes('นพ.') || name.includes('พญ.')) {
    return 'silver';
  }
  if (position.includes('พยาบาล')) {
    return 'blue';
  }
  return 'slate';
}

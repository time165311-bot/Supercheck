import React from 'react';
import { User } from '../types';
import { ShieldCheck, Stethoscope, User as UserIcon } from 'lucide-react';
import { getEffectiveAvatarRing, RING_CONFIGS } from '../utils/avatarRings';

export type RoleTier = 'admin_doctor' | 'nurse' | 'general';

export function getUserRoleTier(user?: User | null): RoleTier {
  if (!user) return 'general';
  if (user.role === 'admin' || user.position?.includes('แพทย์') || user.name?.includes('นพ.') || user.name?.includes('พญ.')) {
    return 'admin_doctor';
  }
  if (user.position?.includes('พยาบาล') || user.role === 'user') {
    return 'nurse';
  }
  return 'general';
}

interface UserAvatarBadgeProps {
  user?: User | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  overrideRingColor?: string;
  className?: string;
  onClick?: () => void;
}

export const UserAvatarBadge: React.FC<UserAvatarBadgeProps> = ({
  user,
  size = 'md',
  showBadge = false,
  overrideRingColor,
  className = '',
  onClick,
}) => {
  const tier = getUserRoleTier(user);
  const ringKey = getEffectiveAvatarRing(user, overrideRingColor);
  const ringConfig = RING_CONFIGS[ringKey] || RING_CONFIGS.slate;
  const ringClasses = ringConfig.ringClasses;

  const sizeClasses = {
    xs: { avatar: 'w-6 h-6 text-[10px]' },
    sm: { avatar: 'w-8 h-8 text-xs' },
    md: { avatar: 'w-10 h-10 text-sm' },
    lg: { avatar: 'w-14 h-14 text-base' },
    xl: { avatar: 'w-20 h-20 text-2xl' },
  }[size];

  let tooltip = user?.name || 'ผู้ใช้งาน';
  if (user?.role === 'admin') {
    tooltip = `${user.name} (ผู้ดูแลระบบ - Admin)`;
  } else if (tier === 'admin_doctor') {
    tooltip = `${user?.name || ''} (วิสัญญีแพทย์)`;
  } else if (tier === 'nurse') {
    tooltip = `${user?.name || ''} (พยาบาลวิสัญญี)`;
  }

  return (
    <div
      onClick={onClick}
      title={tooltip}
      className={`relative inline-flex shrink-0 ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.name || 'User'}
          className={`${sizeClasses.avatar} rounded-full object-cover transition-transform group-hover:scale-105 ${ringClasses}`}
        />
      ) : (
        <div
          className={`${sizeClasses.avatar} rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 ${ringClasses}`}
        >
          <UserIcon className="w-2/3 h-2/3 opacity-50" />
        </div>
      )}
    </div>
  );
};

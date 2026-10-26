import React, { useState } from 'react';
import { Search, Users, X, Shield, Circle, UserCheck } from 'lucide-react';
import { User } from '../types';
import { formatRelativeActiveTime } from '../utils/timeFormat';
import { getEffectiveAvatarRing, RING_CONFIGS } from '../utils/avatarRings';
import { UserAvatarBadge } from './UserAvatarBadge';

interface FriendsModalProps {
  isOpen: boolean;
  currentUser: User | null;
  users: User[];
  onClose: () => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  currentUser,
  users,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'online' | 'admin'>('all');

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const dept = (u as any).department || '';
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.position && u.position.toLowerCase().includes(searchTerm.toLowerCase()));

    const isCurrent = Boolean(currentUser && currentUser.username === u.username);
    const status = formatRelativeActiveTime(u.last, isCurrent);

    if (activeTab === 'online') {
      return matchesSearch && status.isOnline;
    }
    if (activeTab === 'admin') {
      return matchesSearch && u.role === 'admin';
    }
    return matchesSearch;
  });

  const totalOnline = users.filter(
    (u) => formatRelativeActiveTime(u.last, Boolean(currentUser && currentUser.username === u.username)).isOnline
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-white dark:bg-[#242526] rounded-2xl md:rounded-3xl w-full max-w-lg p-5 md:p-6 shadow-2xl border border-[#e4e6eb] dark:border-[#3a3b3c] animate-in fade-in slide-in-from-bottom-8 duration-300 ease-out flex flex-col max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#e4e6eb] dark:border-[#3a3b3c] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1877f2]/10 dark:bg-[#1877f2]/20 text-[#1877f2] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#050505] dark:text-[#e4e6eb]">
                  ผู้ใช้งานในระบบ (เพื่อนร่วมงาน)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {totalOnline} Online
                </span>
              </div>
              <p className="text-xs text-[#65676b] dark:text-[#b0b3b8]">
                รายชื่อบุคลากรและสถานะการใช้งานปัจจุบัน
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] flex items-center justify-center transition cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="pt-3.5 pb-2 shrink-0 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676b] dark:text-[#b0b3b8]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อ, สังกัด, หรือตำแหน่ง..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] text-xs outline-none focus:ring-2 focus:ring-[#1877f2]"
            />
          </div>

          <div className="flex gap-1.5 p-1 bg-[#f0f2f5] dark:bg-[#18191a] rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-[#242526] text-[#1877f2] shadow-xs'
                  : 'text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505]'
              }`}
            >
              ทั้งหมด ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('online')}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'online'
                  ? 'bg-white dark:bg-[#242526] text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505]'
              }`}
            >
              Online 🟢 ({totalOnline})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white dark:bg-[#242526] text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-[#65676b] dark:text-[#b0b3b8] hover:text-[#050505]'
              }`}
            >
              Admin 🟣 ({users.filter((u) => u.role === 'admin').length})
            </button>
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1">
          {filteredUsers.length === 0 ? (
            <div className="py-10 text-center text-[#65676b] dark:text-[#b0b3b8] text-xs">
              ไม่พบบุคลากรตรงตามเงื่อนไขค้นหา
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isCurrent = currentUser?.username === u.username;
              const status = formatRelativeActiveTime(u.last, isCurrent);
              const avatarKey = getEffectiveAvatarRing(u);
              const ringConfig = RING_CONFIGS[avatarKey];

              // Per-user avatar preview
              const storedAvatar = localStorage.getItem(`user_avatar_${u.username}`);

              return (
                <div
                  key={u.id || u.username}
                  className="p-3 rounded-xl bg-[#f0f2f5]/60 hover:bg-[#f0f2f5] dark:bg-[#18191a]/60 dark:hover:bg-[#18191a] border border-[#e4e6eb]/80 dark:border-[#3a3b3c]/80 flex items-center justify-between transition gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className={`w-11 h-11 rounded-full p-0.5 ${ringConfig.ringClasses} flex items-center justify-center bg-white dark:bg-[#242526]`}>
                        {storedAvatar ? (
                          <img
                            src={storedAvatar}
                            alt={u.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-[#1877f2] text-white flex items-center justify-center font-bold text-base">
                            {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                      </div>

                      {/* Online/Offline status dot */}
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#242526] ${
                          status.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                        title={status.label}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#050505] dark:text-[#e4e6eb] truncate">
                          {u.name}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded bg-[#1877f2]/10 text-[#1877f2] font-semibold text-[10px]">
                            คุณ
                          </span>
                        )}
                        {u.role === 'admin' && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-600 text-white font-bold text-[10px]">
                            Admin
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[#65676b] dark:text-[#b0b3b8] truncate mt-0.5">
                        {u.position || 'เจ้าหน้าที่'} {(u as any).department ? `• ${(u as any).department}` : ''}
                      </p>

                      <p className={`text-[10px] font-semibold mt-0.5 flex items-center gap-1 ${
                        status.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#65676b] dark:text-[#b0b3b8]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {status.label}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#e4e6eb] dark:border-[#3a3b3c] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] font-bold text-xs transition cursor-pointer"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>
  );
};

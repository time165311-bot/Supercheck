import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Key,
  Pause,
  Play,
  Trash2,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { Role, User } from '../types';
import { UserAvatarBadge } from './UserAvatarBadge';
import { logAuditEvent } from '../services/auditLogger';

interface UserManagementProps {
  currentUser: User;
  users: User[];
  onBack?: () => void;
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
  darkSurface?: boolean;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUser,
  users,
  onBack,
  onUsersChange,
  onAddUser,
  onUpdateRole,
  onToggleActive,
  onResetPassword,
  onDeleteUser,
  darkSurface = false,
}) => {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Inline temporary password reset modal state (no native window.prompt/window.alert)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [tempPwInput, setTempPwInput] = useState('');
  const [resetError, setResetError] = useState('');

  const cardBg = darkSurface
    ? 'bg-[#1E1F20] border-white/10 text-[#E3E3E3]'
    : 'bg-white dark:bg-[#242526] border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb]';
  const inputBg = darkSurface
    ? 'bg-[#131314] border-white/15 text-[#E3E3E3] placeholder:text-zinc-500'
    : 'bg-[#f0f2f5] dark:bg-[#18191a] border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb]';
  const mutedText = darkSurface ? 'text-zinc-400' : 'text-[#65676b] dark:text-[#b0b3b8]';
  const headingText = darkSurface ? 'text-[#E3E3E3]' : 'text-[#050505] dark:text-[#e4e6eb]';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !name.trim() || !password) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    if (onAddUser) {
      const res = await onAddUser(username.trim(), name.trim(), password, role);
      if (res.success) {
        setUsername('');
        setName('');
        setPassword('');
        setRole('user');
        setSuccess('เพิ่มผู้ใช้งานสำเร็จ');
        setTimeout(() => setSuccess(''), 2500);
      } else {
        setError(res.message);
      }
    } else {
      const newUser: User = {
        id: `user_${Date.now()}`,
        username: username.trim(),
        name: name.trim(),
        role,
        active: true,
        must: false,
        created: new Date().toISOString(),
        last: '',
      };
      const next = [...users, newUser];
      if (onUsersChange) onUsersChange(next);
      setUsername('');
      setName('');
      setPassword('');
      setSuccess('เพิ่มผู้ใช้งานสำเร็จ');
      setTimeout(() => setSuccess(''), 2500);
    }
  };

  const handleConfirmInlineReset = async (user: User) => {
    setResetError('');
    const pw = tempPwInput.trim();
    if (pw.length < 6) {
      setResetError('รหัสผ่านชั่วคราวต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (onResetPassword) {
      await onResetPassword(user.id, pw);
    } else {
      const next = users.map((u) => (u.id === user.id ? { ...u, must: true } : u));
      if (onUsersChange) onUsersChange(next);
    }
    setResettingUserId(null);
    setTempPwInput('');
    setSuccess(`รีเซ็ตรหัสผ่านของ ${user.name} สำเร็จแล้ว`);
    setTimeout(() => setSuccess(''), 2500);
  };

  return (
    <div className="space-y-4 leading-normal">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold text-accent transition shadow-2xs cursor-pointer active:scale-95 ${
            darkSurface
              ? 'bg-[#1E1F20] border-white/10 hover:bg-white/5'
              : 'bg-white dark:bg-[#242526] border-[#e4e6eb] dark:border-[#3a3b3c] hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c]'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับหน้าหลัก</span>
        </button>
      )}

      {/* Header Card */}
      <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs flex items-center justify-between gap-3 ${cardBg}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-sm sm:text-base font-bold ${headingText}`}>
              รายชื่อเจ้าหน้าที่ & กำหนดสิทธิ์วอร์ด
            </h2>
            <p className={`text-xs ${mutedText}`}>
              เพิ่มบัญชีเจ้าหน้าที่ กำหนดสิทธิ์ Admin/User ระงับ หรือรีเซ็ตรหัสผ่าน
            </p>
          </div>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-lg font-bold shrink-0 ${
            darkSurface ? 'bg-white/10 text-zinc-200' : 'bg-[#f0f2f5] dark:bg-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb]'
          }`}
        >
          {users.length} บัญชี
        </span>
      </div>

      {/* Global feedback banner */}
      {success && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Add User Card */}
      <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs text-xs ${cardBg}`}>
        <h3 className={`text-sm font-bold mb-3.5 flex items-center gap-2 ${headingText}`}>
          <UserPlus className="w-4 h-4 text-indigo-400" />
          <span>เพิ่มผู้ใช้งานใหม่</span>
        </h3>

        <form onSubmit={handleAdd} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${headingText}`}>
                ชื่อผู้ใช้ (Username ภาษาอังกฤษ/ตัวเลข)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="เช่น nurse_somjai"
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 ${inputBg}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${headingText}`}>
                ชื่อที่แสดง / ผู้ตรวจเช็ค
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น พย.สมใจ ใจดี"
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 ${inputBg}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${headingText}`}>
                รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัวอักษร)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ผู้ใช้จะต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบ"
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 ${inputBg}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${headingText}`}>
                ระดับสิทธิ์
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 font-semibold ${inputBg}`}
              >
                <option value="user">เจ้าหน้าที่ (Staff / Nurse)</option>
                <option value="admin">ผู้ดูแลระบบ (Admin / MD)</option>
              </select>
            </div>
          </div>

          {error && <p className="text-red-400 font-semibold">{error}</p>}

          <div className="pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              + บันทึกเพิ่มผู้ใช้
            </button>
          </div>
        </form>
      </div>

      {/* Users List */}
      <div className="space-y-2.5">
        <h3 className={`text-xs font-bold uppercase tracking-wider px-1 ${mutedText}`}>
          รายชื่อผู้ใช้งานทั้งหมด ({users.length})
        </h3>

        {users.map((u) => {
          const isMe = u.id === currentUser.id;
          const isResetting = resettingUserId === u.id;
          return (
            <div
              key={u.id}
              className={`p-4 rounded-2xl border shadow-2xs text-xs space-y-3 ${cardBg} ${
                !u.active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3.5">
                  <UserAvatarBadge user={u} size="md" showBadge={true} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-extrabold text-sm ${headingText}`}>{u.name}</span>
                      {isMe && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                          คุณ
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          u.role === 'admin'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : darkSurface
                            ? 'bg-white/10 text-zinc-300'
                            : 'bg-[#f0f2f5] text-[#050505] dark:bg-[#3a3b3c] dark:text-[#e4e6eb]'
                        }`}
                      >
                        {u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่'}
                      </span>
                      {!u.active && (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 font-bold text-[10px]">
                          ระงับการใช้งาน
                        </span>
                      )}
                      {u.must && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 font-bold text-[10px]">
                          ต้องเปลี่ยนรหัส
                        </span>
                      )}
                    </div>

                    <div className={`text-[11px] mt-0.5 ${mutedText}`}>
                      @{u.username} · เข้าใช้งานล่าสุด: {u.last || 'ยังไม่เคยเข้า'}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={u.role}
                    onChange={(e) => {
                      const newRole = e.target.value as Role;
                      void logAuditEvent({
                        action: 'ROLE_CHANGE',
                        targetCollection: 'users',
                        targetId: u.id,
                        itemName: u.name,
                        category: 'สิทธิ์ผู้ใช้',
                        oldValue: u.role,
                        newValue: newRole,
                        details: {
                          userName: u.name,
                          targetUsername: u.username,
                          oldRole: u.role,
                          newRole,
                        },
                        currentUser,
                      });
                      if (onUpdateRole) {
                        onUpdateRole(u.id, newRole);
                      } else if (onUsersChange) {
                        onUsersChange(users.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)));
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-xl border font-semibold text-xs outline-none cursor-pointer ${inputBg}`}
                  >
                    <option value="user">เจ้าหน้าที่</option>
                    <option value="admin">ผู้ดูแลระบบ</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      if (onToggleActive) {
                        onToggleActive(u.id);
                      } else if (onUsersChange) {
                        onUsersChange(users.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                      darkSurface
                        ? 'bg-white/10 hover:bg-white/15 text-zinc-200'
                        : 'bg-[#f0f2f5] dark:bg-[#3a3b3c] hover:bg-[#e4e6eb] text-[#050505] dark:text-[#e4e6eb]'
                    }`}
                  >
                    {u.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{u.active ? 'ระงับ' : 'เปิดใช้งาน'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResettingUserId(isResetting ? null : u.id);
                      setTempPwInput('');
                      setResetError('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 transition font-bold cursor-pointer active:scale-95"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>รีเซ็ตรหัส</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDeleteId === u.id) {
                        if (onDeleteUser) {
                          onDeleteUser(u.id);
                        } else if (onUsersChange) {
                          onUsersChange(users.filter((x) => x.id !== u.id));
                        }
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(u.id);
                        setTimeout(() => setConfirmDeleteId(null), 3000);
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition font-bold cursor-pointer ${
                      confirmDeleteId === u.id
                        ? 'bg-red-600 text-white'
                        : 'text-red-400 hover:bg-red-500/15'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{confirmDeleteId === u.id ? 'ยืนยันลบ?' : 'ลบ'}</span>
                  </button>
                </div>
              </div>

              {/* Inline temporary password reset row (replaces window.prompt/alert) */}
              {isResetting && (
                <div className="pt-2.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="password"
                    value={tempPwInput}
                    onChange={(e) => {
                      setTempPwInput(e.target.value);
                      setResetError('');
                    }}
                    placeholder={`ตั้งรหัสชั่วคราวใหม่ให้ ${u.name} (อย่างน้อย 6 ตัวอักษร)`}
                    className={`flex-1 px-3 py-2 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${inputBg}`}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleConfirmInlineReset(u)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>ยืนยัน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResettingUserId(null);
                        setTempPwInput('');
                        setResetError('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 font-bold text-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>ยกเลิก</span>
                    </button>
                  </div>
                  {resetError && <p className="text-red-400 text-[11px] font-semibold sm:w-full">{resetError}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

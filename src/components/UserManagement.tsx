import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Key,
  Pause,
  Play,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { Role, User } from '../types';
import { UserAvatarBadge } from './UserAvatarBadge';

interface UserManagementProps {
  currentUser: User;
  users: User[];
  onBack?: () => void;
  onUsersChange?: (updatedUsers: User[]) => void;
  onAddUser?: (username: string, name: string, password: string, role: Role) => Promise<{ success: boolean; message: string }>;
  onUpdateRole?: (userId: string, role: Role) => void;
  onToggleActive?: (userId: string) => void;
  onResetPassword?: (userId: string, newPw: string) => Promise<void>;
  onDeleteUser?: (userId: string) => void;
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
}) => {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
        setTimeout(() => setSuccess(''), 2000);
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
        salt: '',
        hash: password,
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
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  const handlePromptReset = async (user: User) => {
    const pw = prompt(`ตั้งรหัสผ่านชั่วคราวใหม่ให้คุณ ${user.name} (อย่างน้อย 6 ตัวอักษร)`);
    if (pw === null) return;
    if (pw.length < 6) {
      alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (onResetPassword) {
      await onResetPassword(user.id, pw);
    } else {
      const next = users.map((u) => (u.id === user.id ? { ...u, hash: pw, must: true } : u));
      if (onUsersChange) onUsersChange(next);
    }
    alert(`รีเซ็ตรหัสผ่านของ ${user.name} สำเร็จแล้ว`);
  };

  return (
    <div className="space-y-4 leading-normal">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#242526] border border-[#e4e6eb] dark:border-[#3a3b3c] text-xs font-bold text-accent dark:text-accent hover:bg-[#f0f2f5] dark:hover:bg-[#3a3b3c] transition shadow-2xs cursor-pointer active:scale-95"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>กลับหน้าหลัก</span>
      </button>

      {/* Header Card (Facebook Style) */}
      <div className="bg-white dark:bg-[#242526] p-5 rounded-2xl md:rounded-3xl border border-[#e4e6eb] dark:border-[#3a3b3c] shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-accent-light text-accent flex items-center justify-center">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#050505] dark:text-[#e4e6eb]">
              จัดการผู้ใช้งาน & กำหนดสิทธิ์
            </h2>
            <p className="text-xs text-[#65676b] dark:text-[#b0b3b8]">
              เพิ่มบัญชีเจ้าหน้าที่ กำหนดสิทธิ์ Admin/User ระงับ หรือรีเซ็ตรหัสผ่าน
            </p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-[#f0f2f5] dark:bg-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] font-bold">
          {users.length} บัญชี
        </span>
      </div>

      {/* Add User Card (Facebook Clean Form) */}
      <div className="bg-white dark:bg-[#242526] p-5 rounded-2xl md:rounded-3xl border border-[#e4e6eb] dark:border-[#3a3b3c] shadow-2xs text-xs">
        <h3 className="text-sm font-bold text-[#050505] dark:text-[#e4e6eb] mb-3.5 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-accent" />
          <span>+ เพิ่มผู้ใช้งานใหม่</span>
        </h3>

        <form onSubmit={handleAdd} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#050505] dark:text-[#e4e6eb] mb-1">
                ชื่อผู้ใช้ (Username ภาษาอังกฤษ/ตัวเลข)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="เช่น nurse_somjai"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] dark:text-[#e4e6eb] mb-1">
                ชื่อที่แสดง / ผู้ตรวจเช็ค
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น พย.สมใจ ใจดี"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#050505] dark:text-[#e4e6eb] mb-1">
                รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัวอักษร)
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ผู้ใช้จะต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบ"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] dark:text-[#e4e6eb] mb-1">
                ระดับสิทธิ์
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] dark:bg-[#18191a] border border-[#e4e6eb] dark:border-[#3a3b3c] text-[#050505] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-accent font-semibold"
              >
                <option value="user">เจ้าหน้าที่ (Staff / Nurse)</option>
                <option value="admin">ผู้ดูแลระบบ (Admin / MD)</option>
              </select>
            </div>
          </div>

          {error && <p className="text-red-500 font-bold">{error}</p>}
          {success && <p className="text-emerald-500 font-bold">{success}</p>}

          <div className="pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              + บันทึกเพิ่มผู้ใช้
            </button>
          </div>
        </form>
      </div>

      {/* Users List with Role Avatar Badges */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-[#65676b] dark:text-[#b0b3b8] uppercase tracking-wider px-1">
          รายชื่อผู้ใช้งานทั้งหมด ({users.length})
        </h3>

        {users.map((u) => {
          const isMe = u.id === currentUser.id;
          return (
            <div
              key={u.id}
              className={`p-4 bg-white dark:bg-[#242526] rounded-2xl md:rounded-3xl border border-[#e4e6eb] dark:border-[#3a3b3c] shadow-2xs text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                !u.active ? 'opacity-60 bg-[#f0f2f5] dark:bg-[#18191a]' : ''
              }`}
            >
              <div className="flex items-center gap-3.5">
                <UserAvatarBadge
                  user={u}
                  size="md"
                  showBadge={true}
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-[#050505] dark:text-[#e4e6eb] text-sm">
                      {u.name}
                    </span>
                    {isMe && (
                      <span className="px-2 py-0.5 rounded-full bg-accent-light text-accent font-bold text-[10px]">
                        คุณ
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        u.role === 'admin'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300'
                          : 'bg-[#f0f2f5] text-[#050505] dark:bg-[#3a3b3c] dark:text-[#e4e6eb]'
                      }`}
                    >
                      {u.role === 'admin' ? '👑 ผู้ดูแลระบบ' : '🌿 เจ้าหน้าที่'}
                    </span>
                    {!u.active && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold text-[10px]">
                        ระงับการใช้งาน
                      </span>
                    )}
                    {u.must && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-[10px]">
                        ต้องเปลี่ยนรหัส
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-[#65676b] dark:text-[#b0b3b8] mt-0.5">
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
                    if (onUpdateRole) {
                      onUpdateRole(u.id, newRole);
                    } else if (onUsersChange) {
                      onUsersChange(users.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)));
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#f0f2f5] dark:bg-[#3a3b3c] border border-[#e4e6eb] dark:border-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] font-semibold text-xs outline-none cursor-pointer"
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
                  className="px-2.5 py-1.5 rounded-xl bg-[#f0f2f5] dark:bg-[#3a3b3c] hover:bg-[#e4e6eb] text-[#050505] dark:text-[#e4e6eb] font-bold transition cursor-pointer"
                >
                  {u.active ? '⏸ ระงับ' : '▶ เปิดใช้งาน'}
                </button>

                <button
                  type="button"
                  onClick={() => handlePromptReset(u)}
                  className="px-2.5 py-1.5 rounded-xl bg-accent-light hover:bg-accent/20 text-accent transition font-bold cursor-pointer active:scale-95"
                >
                  🔑 รีเซ็ตรหัส
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
                  className={`px-2.5 py-1.5 rounded-xl transition font-bold cursor-pointer ${
                    confirmDeleteId === u.id
                      ? 'bg-red-600 text-white'
                      : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                  }`}
                >
                  {confirmDeleteId === u.id ? 'ยืนยันลบ?' : '🗑 ลบ'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

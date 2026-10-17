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

interface UserManagementProps {
  currentUser: User;
  users: User[];
  onBack: () => void;
  onAddUser: (username: string, name: string, password: string, role: Role) => Promise<{ success: boolean; message: string }>;
  onUpdateRole: (userId: string, role: Role) => void;
  onToggleActive: (userId: string) => void;
  onResetPassword: (userId: string, newPw: string) => Promise<void>;
  onDeleteUser: (userId: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUser,
  users,
  onBack,
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
  };

  const handlePromptReset = async (user: User) => {
    const pw = prompt(`ตั้งรหัสผ่านชั่วคราวใหม่ให้คุณ ${user.name} (อย่างน้อย 6 ตัวอักษร)`);
    if (pw === null) return;
    if (pw.length < 6) {
      alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    await onResetPassword(user.id, pw);
    alert(`รีเซ็ตรหัสผ่านของ ${user.name} สำเร็จแล้ว`);
  };

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>กลับหน้าหลัก</span>
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              จัดการผู้ใช้งาน & กำหนดสิทธิ์
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              เพิ่มบัญชีเจ้าหน้าที่ กำหนดสิทธิ์ Admin/User ระงับ หรือรีเซ็ตรหัสผ่าน
            </p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
          {users.length} บัญชี
        </span>
      </div>

      {/* Add User Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-sky-500" />
          + เพิ่มผู้ใช้งานใหม่
        </h3>

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                ชื่อผู้ใช้ (Username ภาษาอังกฤษ/ตัวเลข)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="เช่น nurse_somjai"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                ชื่อที่แสดง / ผู้ตรวจเช็ค
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น พย.สมใจ ใจดี"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัวอักษร)
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ผู้ใช้จะต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบ"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                ระดับสิทธิ์
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              >
                <option value="user">เจ้าหน้าที่ (User)</option>
                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
              </select>
            </div>
          </div>

          {error && <p className="text-red-500 font-medium">{error}</p>}
          {success && <p className="text-emerald-500 font-medium">{success}</p>}

          <div className="pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold transition"
            >
              + บันทึกเพิ่มผู้ใช้
            </button>
          </div>
        </form>
      </div>

      {/* Users List */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          รายชื่อผู้ใช้งานทั้งหมด ({users.length})
        </h3>

        {users.map((u) => {
          const isMe = u.id === currentUser.id;
          return (
            <div
              key={u.id}
              className={`p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                !u.active ? 'opacity-60 bg-slate-50 dark:bg-slate-950' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {u.avatar ? (
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-sky-500/30"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {u.name ? u.name.charAt(0) : 'U'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {u.name}
                    </span>
                    {isMe && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 font-bold text-[10px]">
                        คุณ
                      </span>
                    )}
                    <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                      u.role === 'admin'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่'}
                  </span>
                  {!u.active && (
                    <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold text-[10px]">
                      ระงับการใช้งาน
                    </span>
                  )}
                  {u.must && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-[10px]">
                      ต้องเปลี่ยนรหัส
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 mt-1">
                  @{u.username} · เข้าใช้งานล่าสุด: {u.last || 'ยังไม่เคยเข้า'}
                </div>
              </div>
            </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={u.role}
                  onChange={(e) => onUpdateRole(u.id, e.target.value as Role)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-xs outline-none"
                >
                  <option value="user">เจ้าหน้าที่</option>
                  <option value="admin">ผู้ดูแลระบบ</option>
                </select>

                <button
                  onClick={() => onToggleActive(u.id)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition"
                >
                  {u.active ? '⏸ ระงับ' : '▶ เปิดใช้งาน'}
                </button>

                <button
                  onClick={() => handlePromptReset(u)}
                  className="px-2.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition font-semibold"
                >
                  🔑 รีเซ็ตรหัส
                </button>

                <button
                  onClick={() => {
                    if (confirmDeleteId === u.id) {
                      onDeleteUser(u.id);
                      setConfirmDeleteId(null);
                    } else {
                      setConfirmDeleteId(u.id);
                      setTimeout(() => setConfirmDeleteId(null), 3000);
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-xl transition font-semibold ${
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

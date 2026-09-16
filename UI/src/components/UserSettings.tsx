import React, { useState, useEffect } from 'react';
import { UserAdmin, Role } from '../types';
import api, { handleApiError } from '../utils/api';
import { Plus, Search, MoreVertical, Edit2, Lock, Shield, UserX, UserCheck, Loader2, Mail } from 'lucide-react';

export const UserSettings: React.FC = () => {
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAdmin | null>(null);

  // Form states
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [resetPassword, setResetPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/roles/list')
      ]);
      // Filter out super_admin from UI just in case it's returned
      setUsers(usersRes.data.data.filter((u: UserAdmin) => u.id !== 'super_admin'));
      setRoles(rolesRes.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Akses ditolak. Anda bukan Super Admin.');
      } else {
        setError(handleApiError(err));
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/users', formData);
      setIsAddModalOpen(false);
      setFormData({ name: '', email: '' });
      fetchData(false); // Refresh list in background
    } catch (err) {
      alert(handleApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await api.put(`/users/${selectedUser.id}/reset-password`, { new_password: resetPassword });
      setIsResetModalOpen(false);
      setResetPassword('');
      alert('Password berhasil direset.');
    } catch (err) {
      alert(handleApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvite = async (user: UserAdmin) => {
    if (!confirm(`Kirim ulang email undangan (dan link reset sandi) ke ${user.email}?`)) return;
    
    try {
      await api.post('/users', { name: user.name || '', email: user.email });
      alert(`Email undangan berhasil dikirim ulang ke ${user.email}`);
    } catch (err) {
      alert(handleApiError(err));
    }
  };

  const handleToggleStatus = async (user: UserAdmin) => {
    const newStatus = user.is_active === 1 ? false : true;
    const confirmMsg = newStatus 
      ? `Aktifkan akun ${user.email}?` 
      : `Nonaktifkan akun ${user.email}? User akan langsung ter-logout dari semua perangkat.`;
      
    if (!confirm(confirmMsg)) return;

    try {
      await api.put(`/users/${user.id}/status`, { is_active: newStatus });
      setUsers(users.map(u => u.id === user.id ? { ...u, is_active: newStatus ? 1 : 0 } : u));
    } catch (err) {
      alert(handleApiError(err));
    }
  };

  const handleChangeRole = async (user: UserAdmin, roleId: string) => {
    // Optimistic Update
    const previousRole = user.role;
    const newRoleObj = roles.find(r => r.id === roleId);
    if (newRoleObj) {
      setUsers(users.map(u => u.id === user.id ? { ...u, role: newRoleObj.name } : u));
    }
    
    try {
      await api.put(`/users/${user.id}/role`, { role_id: roleId });
      // Removed fetchData(false) here to prevent D1 read replica stale data 
      // from overwriting our optimistic update instantly.
    } catch (err) {
      alert(handleApiError(err));
      // Revert on failure
      setUsers(users.map(u => u.id === user.id ? { ...u, role: previousRole } : u));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
        <p className="font-bold">Error Memuat Data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan User</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola akses, role, dan akun penulis.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Invite User Baru
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm">
                <th className="px-6 py-4 font-semibold text-slate-600">User</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Role</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold overflow-hidden shrink-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url.startsWith('http') ? user.avatar_url : `${(api.defaults.baseURL || 'http://localhost:8787/api').replace('/api', '')}${user.avatar_url}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (user.name || user.email).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{user.name || 'User Baru'}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      value={roles.find(r => r.name === user.role)?.id || ''}
                      onChange={(e) => handleChangeRole(user, e.target.value)}
                      disabled={user.id === 'super_admin'}
                    >
                      <option value="" disabled>Pilih Role...</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.id !== 'super_admin' ? (
                        <>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            title={user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            className={`p-2 rounded-lg transition-colors ${user.is_active ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                          >
                            {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => { setSelectedUser(user); setIsResetModalOpen(true); }}
                            title="Reset Password"
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResendInvite(user)}
                            title="Kirim Ulang Undangan"
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sistem</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    Belum ada user terdaftar selain Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Invite User Baru</h3>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  placeholder="john@example.com"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Penulis akan menerima email untuk membuat password mereka sendiri.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buat User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Reset Password User</h3>
              <p className="text-sm text-slate-500 mt-1">Ubah sandi untuk {selectedUser.email}</p>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Password Baru</label>
                <input
                  required
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  placeholder="Minimal 6 karakter"
                  minLength={6}
                />
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

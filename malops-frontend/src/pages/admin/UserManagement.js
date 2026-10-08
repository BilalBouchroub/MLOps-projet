import React, { useState, useEffect } from 'react';
import { apiUsers } from '../../api/axios';
import { UserPlus } from 'lucide-react';
import { logAction } from '../../utils/adminActions';

const ROLES = ['admin', 'data_scientist', 'data_engineer', 'mlops_engineer'];

const ROLE_LABELS = {
  admin: 'Admin',
  data_scientist: 'MLOps Engineer',
  data_engineer: 'Data Engineer',
  mlops_engineer: 'Client Final',
};

const emptyForm = { username: '', email: '', full_name: '', password: '', role: 'data_scientist' };

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await apiUsers.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPageError('Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await apiUsers.put(`/users/${userId}`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      setPageError('Erreur lors de la mise à jour du rôle.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setModalLoading(true);
    try {
      await apiUsers.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      setPageError('Erreur lors de la suppression.');
      setDeleteTarget(null);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);
    try {
      await apiUsers.post('/users', formData);
      logAction('utilisateur', `Utilisateur créé : ${formData.username}`);
      setShowModal(false);
      setFormData(emptyForm);
      fetchUsers();
    } catch (err) {
      setModalError(err.response?.data?.detail || err.userMessage || "Erreur lors de la création de l'utilisateur.");
    } finally {
      setModalLoading(false);
    }
  };

  const statusBadge = (isActive) => (
    <span style={{
      padding: '0.2rem 0.6rem',
      borderRadius: '20px',
      fontSize: '0.78rem',
      fontWeight: 600,
      background: isActive ? '#d1fae5' : '#fee2e2',
      color: isActive ? '#065f46' : '#991b1b',
    }}>
      {isActive ? '● Actif' : '○ Inactif'}
    </span>
  );

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>User Management</h1>
          <p>Gérez les utilisateurs et leurs rôles</p>
        </div>
        <button className="btn-add" onClick={() => { setFormData(emptyForm); setModalError(''); setShowModal(true); }}>
          <UserPlus size={16} />
          Add New User
        </button>
      </div>

      {pageError && (
        <div className="alert-error" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{pageError}</span>
          <button onClick={() => setPageError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>✕</button>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Chargement…</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {['Username', 'Email', 'Rôle', 'Statut', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun utilisateur.</td></tr>
                ) : users.map(user => (
                  <tr key={user.id}>
                    <td><strong>{user.username}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{user.email}</td>
                    <td>
                      <select
                        className="role-select-inline"
                        value={user.role}
                        onChange={e => handleRoleChange(user.id, e.target.value)}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td>{statusBadge(user.is_active)}</td>
                    <td>
                      <button className="btn-action btn-delete" onClick={() => setDeleteTarget(user)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create user modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Nouvel Utilisateur</h3>
            {modalError && <div className="alert-error">{modalError}</div>}
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Nom d'utilisateur *</label>
                <input type="text" value={formData.username} required
                  onChange={e => setFormData({ ...formData, username: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={formData.email} required
                  onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Nom complet</label>
                <input type="text" value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Mot de passe *</label>
                <input type="password" value={formData.password} required placeholder="••••••••"
                  onChange={e => setFormData({ ...formData, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Rôle</label>
                <select value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn-submit-green" disabled={modalLoading}>
                  {modalLoading ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ textAlign: 'center', width: '380px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🗑️</div>
            <h3 style={{ color: '#991b1b' }}>Confirmer la suppression</h3>
            <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>
              Supprimer <strong style={{ color: 'var(--text-main)' }}>{deleteTarget.username}</strong> ?
              <br /><span style={{ fontSize: '0.85rem' }}>Cette action est irréversible.</span>
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button className="btn-action btn-delete" style={{ marginLeft: 0 }} onClick={handleDelete} disabled={modalLoading}>
                {modalLoading ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

import React, { useState, useEffect } from 'react';
import { apiUsers } from '../../api/axios';
import { RefreshCw, Plus, Users, Trash2 } from 'lucide-react';
import { logAction } from '../../utils/adminActions';

const emptyForm = {
  name: '',
  clearml_project_name: '',
  description: '',
  client_user_id: '',
  data_engineer_id: '',
  mlops_engineer_id: '',
};

const ProjectManagement = () => {
  const [dbProjects, setDbProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearmlMode, setClearmlMode] = useState('');
  const [pageError, setPageError] = useState(null);

  // Modal création / édition
  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Suppression
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [clearmlRes, dbRes, usersRes] = await Promise.all([
        apiUsers.get('/clearml/projects'),
        apiUsers.get('/projects'),
        apiUsers.get('/users'),
      ]);
      setClearmlMode(clearmlRes.data.mode || '');
      setDbProjects(Array.isArray(dbRes.data) ? dbRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch {
      setPageError('Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setEditTarget(null);
    setModal('create');
  };

  const openEdit = (project) => {
    setEditTarget(project);
    setForm({
      name: project.name || '',
      clearml_project_name: project.clearml_project_name || '',
      description: project.description || '',
      client_user_id: project.client_user?.id || project.client_user_id || '',
      data_engineer_id: project.data_engineer?.id || project.data_engineer_id || '',
      mlops_engineer_id: project.mlops_engineer?.id || project.mlops_engineer_id || '',
    });
    setFormError('');
    setModal('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Le nom du projet est requis.'); return; }
    setFormError('');
    setFormLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        clearml_project_name: form.clearml_project_name || null,
        description: form.description || null,
        client_user_id: form.client_user_id || null,
        data_engineer_id: form.data_engineer_id || null,
        mlops_engineer_id: form.mlops_engineer_id || null,
      };
      if (modal === 'edit') {
        await apiUsers.put(`/projects/${editTarget.id}`, payload);
        setSuccessMsg(`Projet "${payload.name}" mis à jour.`);
        logAction('projet', `Projet modifié : ${payload.name}`);
      } else {
        const res = await apiUsers.post('/projects', payload);
        const clearmlName = res.data?.clearml_project_name;
        setSuccessMsg(
          clearmlName
            ? `Projet "${payload.name}" créé dans MALOPS et dans ClearML (projet : "${clearmlName}").`
            : `Projet "${payload.name}" créé dans MALOPS.`
        );
        logAction('projet', `Projet créé : ${payload.name}`);
      }
      setModal(null);
      fetchAll();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Erreur lors de la sauvegarde.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const projectName = deleteTarget.name;
    const clearmlName = deleteTarget.clearml_project_name;
    try {
      await apiUsers.delete(`/projects/${deleteTarget.id}`);
      setDeleteTarget(null);
      setSuccessMsg(
        clearmlName
          ? `Projet "${projectName}" supprimé de MALOPS et de ClearML (projet : "${clearmlName}").`
          : `Projet "${projectName}" supprimé de MALOPS.`
      );
      setTimeout(() => setSuccessMsg(''), 6000);
      fetchAll();
    } catch (err) {
      setPageError(err.response?.data?.detail || 'Erreur lors de la suppression.');
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const clientUsers    = users.filter(u => u.role === 'mlops_engineer');
  const dataEngineers  = users.filter(u => u.role === 'data_engineer');
  const mlopsEngineers = users.filter(u => u.role === 'data_scientist');
  const userName = (u) => u ? (u.full_name || u.username) : null;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Gestion des Projets</h1>
          <p>Créez des projets, associez-les à ClearML et assignez les responsables</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-add" onClick={fetchAll} disabled={loading}>
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
          </button>
          <button className="btn-add" onClick={openCreate}>
            <Plus size={16} />
            Créer un Projet
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
          padding: '0.65rem 1rem', marginBottom: '1rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '.88rem', color: '#166534', fontWeight: 500,
        }}>
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>✕</button>
        </div>
      )}

      {pageError && (
        <div className="alert-error" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{pageError}</span>
          <button onClick={() => setPageError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>✕</button>
        </div>
      )}

      {clearmlMode === 'demo' && (
        <div className="alert-info">
          Mode démo — ClearML non connecté. Les projets ClearML disponibles sont des exemples.
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            Chargement des projets…
          </p>
        ) : dbProjects.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
            <p style={{ marginBottom: '1rem' }}>Aucun projet créé pour l'instant.</p>
            <button className="btn-add" onClick={openCreate}>
              <Plus size={16} /> Créer le premier projet
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {['Projet', 'Projet ClearML', 'Client Final', 'Data Engineer', 'MLOps Engineer', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dbProjects.map(proj => (
                  <tr key={proj.id}>
                    <td>
                      <strong>{proj.name}</strong>
                      {proj.description && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {proj.description}
                        </div>
                      )}
                    </td>
                    <td>
                      {proj.clearml_project_name ? (
                        <span style={{
                          background: '#ecfdf5', color: '#065f46',
                          padding: '0.15rem 0.55rem', borderRadius: '4px',
                          fontSize: '0.75rem', fontWeight: 600,
                        }}>
                          {proj.clearml_project_name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {userName(proj.client_user) || (
                        <span style={{ color: 'var(--text-muted)' }}>Non assigné</span>
                      )}
                    </td>
                    <td>
                      {userName(proj.data_engineer) || (
                        <span style={{ color: 'var(--text-muted)' }}>Non assigné</span>
                      )}
                    </td>
                    <td>
                      {userName(proj.mlops_engineer) || (
                        <span style={{ color: 'var(--text-muted)' }}>Non assigné</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn-action btn-activate"
                          onClick={() => openEdit(proj)}
                          title="Modifier / Assigner"
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={13} />
                            Assigner
                          </span>
                        </button>
                        <button
                          className="btn-action btn-deactivate"
                          onClick={() => setDeleteTarget(proj)}
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal création / édition ── */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: '520px' }}>
            <h3>{modal === 'create' ? 'Créer un Projet' : 'Modifier le Projet'}</h3>

            {formError && <div className="alert-error">{formError}</div>}

            <form onSubmit={handleSubmit}>
              {/* Infos projet */}
              <div className="form-group">
                <label>Nom du Projet <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  value={form.name}
                  placeholder="Ex: Projet Stress Hydrique Maroc 2025"
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Nom du projet ClearML</label>
                <input
                  type="text"
                  value={form.clearml_project_name}
                  placeholder={form.name ? `Par défaut : "${form.name}"` : 'Ex: MALOPS/Stress_Hydrique_Rabat'}
                  onChange={e => setForm({ ...form, clearml_project_name: e.target.value })}
                />
                <span style={{ fontSize: '.75rem', color: '#6b7280', marginTop: 3, display: 'block' }}>
                  Ce projet sera créé automatiquement dans ClearML. Laissez vide pour utiliser le nom du projet.
                </span>
              </div>

              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  value={form.description}
                  placeholder="Description courte (optionnel)"
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Séparateur */}
              <div style={{ borderTop: '1px solid #e5e7eb', margin: '1rem 0 .9rem', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#374151' }}>
                  Assignation des responsables
                </span>
              </div>

              <div className="form-group">
                <label>Client Final concerné</label>
                <select
                  value={form.client_user_id}
                  onChange={e => setForm({ ...form, client_user_id: e.target.value })}
                >
                  <option value="">— Sélectionner un client —</option>
                  {clientUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Data Engineer responsable</label>
                <select
                  value={form.data_engineer_id}
                  onChange={e => setForm({ ...form, data_engineer_id: e.target.value })}
                >
                  <option value="">— Sélectionner un Data Engineer —</option>
                  {dataEngineers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>MLOps Engineer responsable</label>
                <select
                  value={form.mlops_engineer_id}
                  onChange={e => setForm({ ...form, mlops_engineer_id: e.target.value })}
                >
                  <option value="">— Sélectionner un MLOps Engineer —</option>
                  {mlopsEngineers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn-submit-green" disabled={formLoading}>
                  {formLoading ? 'Sauvegarde…' : modal === 'create' ? 'Créer le Projet' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal suppression ── */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: '420px' }}>
            <h3>Supprimer le projet</h3>
            <p style={{ color: '#374151', marginBottom: '1.25rem' }}>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteTarget.name}</strong> ?
              Cette action est irréversible.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setDeleteTarget(null)}>
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  padding: '0.5rem 1.1rem', borderRadius: '6px',
                  border: 'none', cursor: 'pointer', fontWeight: 700,
                  background: '#dc2626', color: 'white',
                  opacity: deleteLoading ? 0.6 : 1,
                }}
              >
                {deleteLoading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;

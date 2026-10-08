import React, { useState, useEffect, useContext } from 'react';
import { apiUsers } from '../../api/axios';
import { Users, Cpu, Clock, TrendingUp, FolderOpen } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';

const ACTIONS_KEY = 'admin_recent_actions';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_COLORS = {
  projet: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  utilisateur: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  modèle: { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' },
  pipeline: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  default: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
};

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const adminName = user?.username || localStorage.getItem('username') || 'Administrateur';

  const [stats, setStats] = useState({
    totalUsers: '—',
    activeModels: '—',
    lastPipelineRun: '—',
    bestR2: '—',
    totalProjects: '—',
  });
  const [loading, setLoading] = useState(true);
  const [recentActions, setRecentActions] = useState([]);

  const todayFr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(ACTIONS_KEY) || '[]');
    setRecentActions(stored);

    const fetchStats = async () => {
      try {
        const [usersRes, modelsRes, pipelinesRes, projectsRes] = await Promise.all([
          apiUsers.get('/users').catch(() => ({ data: [] })),
          apiUsers.get('/models/library').catch(() => ({ data: { models: [] } })),
          apiUsers.get('/pipelines/status').catch(() => ({ data: { pipelines: [] } })),
          apiUsers.get('/projects').catch(() => ({ data: [] })),
        ]);

        const users = Array.isArray(usersRes.data) ? usersRes.data : [];
        const models = modelsRes.data?.models || [];
        const pipelines = pipelinesRes.data?.pipelines || [];
        const projects = Array.isArray(projectsRes.data) ? projectsRes.data : [];

        const activeModels = models.filter(m => m.status === 'production').length;
        const bestR2 = models.length > 0 ? Math.max(...models.map(m => m.r2 || 0)) : null;

        const lastRuns = pipelines.map(p => p.last_run).filter(Boolean).sort().reverse();
        const lastRun = lastRuns[0]
          ? new Date(lastRuns[0]).toLocaleString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : '—';

        // Construire les actions récentes depuis les données (projets et utilisateurs récents)
        const derivedActions = [];
        projects
          .slice()
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
          .slice(0, 5)
          .forEach(p => {
            derivedActions.push({ type: 'projet', label: `Projet créé : ${p.name}`, at: p.created_at });
          });
        users
          .slice()
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
          .slice(0, 5)
          .forEach(u => {
            derivedActions.push({ type: 'utilisateur', label: `Utilisateur créé : ${u.username}`, at: u.created_at });
          });

        // Fusionner avec les actions stockées en localStorage, dédupliquer par label
        const storedActions = JSON.parse(localStorage.getItem(ACTIONS_KEY) || '[]');
        const merged = [...storedActions];
        derivedActions.forEach(da => {
          if (da.at && !merged.some(a => a.label === da.label)) {
            merged.push(da);
          }
        });
        merged.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
        setRecentActions(merged.slice(0, 10));

        setStats({
          totalUsers: users.length,
          activeModels,
          lastPipelineRun: lastRun,
          bestR2: bestR2 !== null ? `${(bestR2 * 100).toFixed(2)}%` : '—',
          totalProjects: projects.length,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users },
    { label: 'Projets créés', value: stats.totalProjects, icon: FolderOpen },
    { label: 'Modèles actifs', value: stats.activeModels, icon: Cpu },
    { label: 'Dernier pipeline run', value: stats.lastPipelineRun, icon: Clock },
    { label: 'R² meilleur modèle', value: stats.bestR2, icon: TrendingUp },
  ];

  return (
    <div>
      {/* Bandeau de bienvenue */}
      <div style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 24px rgba(29,78,216,0.18)',
      }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '4px', textTransform: 'capitalize' }}>
            {todayFr}
          </div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Bienvenue, Admin{' '}
            <span style={{
              background: 'rgba(255,255,255,0.18)',
              borderRadius: '8px',
              padding: '2px 12px',
              fontSize: '1.5rem',
            }}>
              {adminName}
            </span>
          </h2>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>
            Vue d'ensemble de la plateforme HydroVision MLOps
          </p>
        </div>
      </div>

      <div className="admin-page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
        </div>
      </div>

      <div className="admin-metrics-grid">
        {cards.map(({ label, value, icon: Icon }) => (
          <div className="admin-metric-card" key={label}>
            <div className="metric-icon">
              <Icon size={24} />
            </div>
            <div className="metric-info">
              <div className="metric-value">
                {loading ? <span style={{ fontSize: '1rem', color: '#aaa' }}>…</span> : value}
              </div>
              <div className="metric-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Dernières actions */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '20px 24px',
        marginTop: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700, color: '#1a1a2e' }}>
          Dernières actions
        </h2>
        {loading ? (
          <div style={{ color: '#aaa', padding: '12px 0' }}>Chargement…</div>
        ) : recentActions.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '8px 0' }}>
            Aucune action récente enregistrée.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentActions.map((action, i) => {
              const cfg = ACTION_COLORS[action.type] || ACTION_COLORS.default;
              return (
                <li key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  borderRadius: '10px', padding: '10px 16px',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      background: cfg.color, color: '#fff', borderRadius: '6px',
                      padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize',
                    }}>
                      {action.type}
                    </span>
                    <span style={{ color: '#1a1a2e', fontSize: '0.88rem', fontWeight: 500 }}>
                      {action.label}
                    </span>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem', flexShrink: 0 }}>
                    {formatDate(action.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

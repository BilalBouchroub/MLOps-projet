const ACTIONS_KEY = 'admin_recent_actions';

export function logAction(type, label) {
  const actions = JSON.parse(localStorage.getItem(ACTIONS_KEY) || '[]');
  actions.unshift({ type, label, at: new Date().toISOString() });
  localStorage.setItem(ACTIONS_KEY, JSON.stringify(actions.slice(0, 20)));
}

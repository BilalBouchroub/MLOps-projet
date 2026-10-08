import axios from 'axios';

// Pour les prédictions ML
export const apiML = axios.create({
  baseURL: process.env.REACT_APP_API_ML_URL || 'http://localhost:8000'
});

// Pour la gestion users/auth
export const apiUsers = axios.create({
  baseURL: process.env.REACT_APP_API_USERS_URL || 'http://localhost:8001'
});

// Interceptor JWT pour les deux
[apiML, apiUsers].forEach(api => {
  api.interceptors.request.use(config => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      // Détection des requêtes
      const url = error.config?.url || '';
      const baseURL = error.config?.baseURL || '';
      const fullPath = (baseURL + url).toLowerCase();

      const isAuthRequest = fullPath.includes('/auth/token');
      const isMLRequest = fullPath.includes('8000');
      const isUserRequest = fullPath.includes('8001');

      if (error.response) {
        const { status } = error.response;

        if (status === 401 && isUserRequest && !isAuthRequest) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('role');
          sessionStorage.removeItem('username');
          // Redirection désactivée pour éviter les boucles infinies
        } else if (status === 401 && isAuthRequest) {
          error.userMessage = 'Identifiants invalides';
        } else if (status === 401 && isMLRequest) {
          error.userMessage = 'Erreur authentification service ML';
        } else if (status === 403) {
          error.userMessage = 'Accès non autorisé';
        } else if (status === 404) {
          error.userMessage = 'Ressource introuvable';
        } else if (status >= 500) {
          error.userMessage = 'Erreur serveur, réessayez';
        } else {
          error.userMessage = 'Une erreur est survenue';
        }
      } else {
        error.userMessage = 'Erreur réseau, vérifiez votre connexion';
      }
      return Promise.reject(error);
    }
  );
});

const apiClients = { apiML, apiUsers };
export default apiClients;

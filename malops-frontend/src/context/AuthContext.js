import React, { createContext, useState, useEffect } from 'react';
import { apiUsers } from '../api/axios';

export const AuthContext = createContext();

const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Purge any token left in localStorage from old sessions
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');

    const storedToken = sessionStorage.getItem('token');
    const storedRole = sessionStorage.getItem('role');
    const storedUsername = sessionStorage.getItem('username');

    if (isTokenValid(storedToken)) {
      setToken(storedToken);
      setRole(storedRole);
      setUser({ username: storedUsername, role: storedRole });
      setIsAuthenticated(true);
    } else {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('role');
      sessionStorage.removeItem('username');
    }
  }, []);

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await apiUsers.post('/auth/token', formData);
    const { access_token, role: userRole } = response.data;

    sessionStorage.setItem('token', access_token);
    sessionStorage.setItem('role', userRole);
    sessionStorage.setItem('username', username);

    setToken(access_token);
    setRole(userRole);
    setUser({ username, role: userRole });
    setIsAuthenticated(true);

    return userRole;
  };

  const logout = () => {
    sessionStorage.clear();
    setToken(null);
    setRole(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ token, role, user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

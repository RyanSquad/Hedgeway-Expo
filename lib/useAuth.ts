import { useState, useEffect } from 'react';
import { get } from './api';
import { tokenStorage } from './tokenStorage';

export interface User {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if tokens exist before making API call
      const isAuthenticated = await tokenStorage.isAuthenticated();
      if (!isAuthenticated) {
        setUser(null);
        setLoading(false);
        return;
      }

      const response = await get<{ user: User }>('/api/auth/me');
      
      if (response.error) {
        // If authentication error, clear tokens
        if (response.error.includes('Authentication') || 
            response.error.includes('JWT') || 
            response.error.includes('401') ||
            response.error.includes('Token')) {
          await tokenStorage.clearTokens();
        }
        setError(response.error);
        setUser(null);
      } else if (response.data?.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isModerator = user?.role === 'moderator' || isAdmin;

  return {
    user,
    loading,
    error,
    isSuperAdmin,
    isAdmin,
    isModerator,
    refetch: fetchUser,
  };
}


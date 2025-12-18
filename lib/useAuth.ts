import { useState, useEffect } from 'react';
import { get } from './api';

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
      const response = await get<{ user: User }>('/api/auth/me');
      
      if (response.error) {
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


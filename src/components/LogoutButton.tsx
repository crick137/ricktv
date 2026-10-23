'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * 退出登录：清 HttpOnly session + 本地残留
 */
export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem('username');
      localStorage.removeItem('password');
    } catch {
      /* ignore */
    }
    router.replace('/login');
  };

  return (
    <button
      onClick={handleLogout}
      className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
      aria-label='Logout'
    >
      <LogOut className='w-full h-full' />
    </button>
  );
}

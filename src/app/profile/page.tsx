'use client';

import React from 'react';
import ProfilePage from '../components/profile/ProfilePage';
import { useAuth } from '../../firebase/AuthContext';
import { useRouter } from 'next/navigation';

export default function Profile() {
  const { currentUser, isLoading } = useAuth();
  const router = useRouter();
  
  // Redirect to home if not logged in
  React.useEffect(() => {
    if (!isLoading && !currentUser) {
      router.push('/');
    }
  }, [currentUser, isLoading, router]);
  
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-xl">Laddar...</p></div>;
  }
  
  if (!currentUser) {
    return null; // Will be redirected
  }
  
  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <ProfilePage />
    </main>
  );
} 
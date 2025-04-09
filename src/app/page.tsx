'use client';

import { useState, useEffect, Suspense } from 'react';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../firebase/AuthContext';

function HomeContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');
  const playerId = searchParams.get('playerId');
  const router = useRouter();
  const { currentUser } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Kontrollera om vi har sparade params i localStorage som behöver rensas
  useEffect(() => {
    if (isRedirecting) return; // Undvik att köra om vi redan omdirigerar
    
    try {
      const shouldRedirect = localStorage.getItem('shouldRedirectToGames');
      
      // Om användaren tidigare markerades för att gå till "Mina spel", omdirigera
      if (shouldRedirect === 'true' && currentUser && window.location.pathname !== '/active-games') {
        setIsRedirecting(true);
        // Rensa flaggan omedelbart för att undvika loopar
        localStorage.removeItem('shouldRedirectToGames');
        router.push('/active-games');
      }
    } catch (e) {
      console.error('Error checking redirect preference:', e);
    }
  }, [currentUser, router, isRedirecting]);

  if (gameId && playerId) {
    return (
      <div className="container mx-auto">
        <Game gameId={gameId} playerId={playerId} />
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <main className="min-h-screen flex items-center justify-center">
        <Lobby />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-xl">Laddar...</p></div>}>
      <HomeContent />
    </Suspense>
  );
} 
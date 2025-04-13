'use client';

import { useState, useEffect, Suspense } from 'react';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../firebase/AuthContext';
import Link from 'next/link';

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
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-6">Sänka Skepp</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Link 
              href="/single-player"
              className="p-6 bg-white border-2 border-[#8bb8a8] rounded-lg hover:bg-[#8bb8a8] hover:bg-opacity-10 transition-colors"
            >
              <h2 className="text-2xl font-semibold mb-2">Enspelarläge</h2>
              <p className="text-gray-600">
                Spela mot AI:n med olika svårighetsgrader
              </p>
            </Link>

            <Link 
              href="/active-games"
              className="p-6 bg-white border-2 border-[#8bb8a8] rounded-lg hover:bg-[#8bb8a8] hover:bg-opacity-10 transition-colors"
            >
              <h2 className="text-2xl font-semibold mb-2">Flerspelarläge</h2>
              <p className="text-gray-600">
                Spela mot en vän online
              </p>
            </Link>
          </div>

          <Lobby />
        </div>
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
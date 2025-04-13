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
  const [startingGame, setStartingGame] = useState(false);
  
  // Helper function to clear all redirect flags
  const clearAllRedirectFlags = () => {
    localStorage.removeItem('shouldRedirectToGames');
    localStorage.removeItem('redirectTimestamp');
    localStorage.removeItem('acceptedGameId');
    sessionStorage.removeItem('handlingChallenge');
  };
  
  // Force clear redirect flags on initial load
  useEffect(() => {
    // Only run this on main page with no game ID
    if (!gameId && !isRedirecting) {
      // Force cleanup of any lingering redirect flags
      clearAllRedirectFlags();
    }
  }, [gameId, isRedirecting]);

  // Kontrollera om vi har sparade params i localStorage som behöver rensas
  useEffect(() => {
    if (isRedirecting) return; // Undvik att köra om vi redan omdirigerar
    
    try {
      const shouldRedirect = localStorage.getItem('shouldRedirectToGames');
      
      // Om användaren tidigare markerades för att gå till "Mina spel", omdirigera
      if (shouldRedirect === 'true' && currentUser && window.location.pathname !== '/active-games') {
        // Check if the flag is stale (set more than 5 minutes ago)
        const redirectTimestamp = localStorage.getItem('redirectTimestamp');
        const now = Date.now();
        const isStale = redirectTimestamp && (now - parseInt(redirectTimestamp)) > 5 * 60 * 1000;
        
        if (isStale) {
          // Clear stale redirect flags
          clearAllRedirectFlags();
        } else {
          setIsRedirecting(true);
          // Rensa flaggan omedelbart för att undvika loopar
          clearAllRedirectFlags();
          router.push('/active-games');
        }
      }
    } catch (e) {
      console.error('Error checking redirect preference:', e);
      // Clean up in case of error
      clearAllRedirectFlags();
    }
  }, [currentUser, router, isRedirecting]);

  const handleStartAIGame = (difficulty: string) => {
    if (startingGame) return;
    
    setStartingGame(true);
    const gameId = `ai_${Date.now()}`;
    const playerId = `player_${Date.now()}`;
    
    router.push(`/?gameId=${gameId}&playerId=${playerId}&isSinglePlayer=true&difficulty=${difficulty}`);
  };

  if (gameId && playerId) {
    return (
      <div className="container mx-auto">
        <Game gameId={gameId} playerId={playerId} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          
          <div className="bg-white/50 backdrop-blur-sm p-6 mb-8 rounded-[5px]">
            <h2 className="text-2xl font-bold mb-4">Utmana en Ai-pirat</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-white rounded-[5px]">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 overflow-hidden">
                    <img 
                      src="/images/pirate-easy.jpg" 
                      alt="Easy Pirate" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg">Enkel</h3>
                  </div>
                </div>
                <button 
                  onClick={() => handleStartAIGame('easy')}
                  disabled={startingGame}
                  className="bg-[#8bb8a8] hover:bg-[#7aa897] text-white px-6 py-3 transition-colors disabled:opacity-50 rounded-[5px]"
                >
                  {startingGame ? 'Startar...' : 'Spela'}
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-white rounded-[5px]">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 overflow-hidden">
                    <img 
                      src="/images/pirate-medium.jpg" 
                      alt="Medium Pirate" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg">Medel</h3>
                  </div>
                </div>
                <button 
                  onClick={() => handleStartAIGame('medium')}
                  disabled={startingGame}
                  className="bg-[#8bb8a8] hover:bg-[#7aa897] text-white px-6 py-3 transition-colors disabled:opacity-50 rounded-[5px]"
                >
                  {startingGame ? 'Startar...' : 'Spela'}
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-white rounded-[5px]">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 overflow-hidden">
                    <img 
                      src="/images/pirate-hard.jpg" 
                      alt="Hard Pirate" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg">Svår</h3>
                  </div>
                </div>
                <button 
                  onClick={() => handleStartAIGame('hard')}
                  disabled={startingGame}
                  className="bg-[#8bb8a8] hover:bg-[#7aa897] text-white px-6 py-3 transition-colors disabled:opacity-50 rounded-[5px]"
                >
                  {startingGame ? 'Startar...' : 'Spela'}
                </button>
              </div>
            </div>
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
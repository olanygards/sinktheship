'use client';

import { useState, useEffect, Suspense } from 'react';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { useSearchParams } from 'next/navigation';

function HomeContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');
  const playerId = searchParams.get('playerId');

  if (gameId && playerId) {
    return (
      <main className="min-h-screen bg-gray-100">
        <Game gameId={gameId} playerId={playerId} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <Lobby />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-xl">Laddar...</p></div>}>
      <HomeContent />
    </Suspense>
  );
} 
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Difficulty } from '../../utils/ai';
import Link from 'next/link';

export default function SinglePlayerPage() {
  const router = useRouter();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');
  const [isStarting, setIsStarting] = useState(false);

  const handleStartGame = () => {
    setIsStarting(true);
    const gameId = `ai_${Date.now()}`;
    const playerId = `player_${Date.now()}`;
    
    router.push(`/?gameId=${gameId}&playerId=${playerId}&isSinglePlayer=true&difficulty=${selectedDifficulty}`);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-[var(--primary)] hover:text-[var(--primary-dark)] flex items-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Tillbaka till startsidan
          </Link>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-gray-800">Enspelarläge</h1>
          <p className="text-gray-600">Välj svårighetsgrad och börja spela mot AI:n</p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Välj svårighetsgrad</h2>
          
          <div className="space-y-4 mb-8">
            <div 
              className={`p-4 rounded-lg cursor-pointer transition-all ${
                selectedDifficulty === 'easy' 
                  ? 'bg-[var(--primary-light)] shadow' 
                  : 'bg-[var(--board-background)] hover:shadow'
              }`}
              onClick={() => setSelectedDifficulty('easy')}
            >
              <h3 className="text-xl font-semibold mb-2 text-gray-800">Lätt</h3>
              <p className="text-gray-600">
                AI:n gör slumpmässiga drag. Perfekt för nybörjare.
              </p>
            </div>

            <div 
              className={`p-4 rounded-lg cursor-pointer transition-all ${
                selectedDifficulty === 'medium' 
                  ? 'bg-[var(--primary-light)] shadow' 
                  : 'bg-[var(--board-background)] hover:shadow'
              }`}
              onClick={() => setSelectedDifficulty('medium')}
            >
              <h3 className="text-xl font-semibold mb-2 text-gray-800">Medel</h3>
              <p className="text-gray-600">
                AI:n använder grundläggande strategi och fortsätter skjuta i samma riktning efter träffar.
              </p>
            </div>

            <div 
              className={`p-4 rounded-lg cursor-pointer transition-all ${
                selectedDifficulty === 'hard' 
                  ? 'bg-[var(--primary-light)] shadow' 
                  : 'bg-[var(--board-background)] hover:shadow'
              }`}
              onClick={() => setSelectedDifficulty('hard')}
            >
              <h3 className="text-xl font-semibold mb-2 text-gray-800">Svår</h3>
              <p className="text-gray-600">
                AI:n använder avancerad strategi med sannolikhetsberäkningar och optimal skeppsplacering.
              </p>
            </div>
          </div>

          <button
            onClick={handleStartGame}
            disabled={isStarting}
            className="w-full btn-primary py-3 rounded-lg text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? 'Startar spelet...' : 'Starta spel'}
          </button>
        </div>
      </div>
    </div>
  );
} 
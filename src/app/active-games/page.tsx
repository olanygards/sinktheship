'use client';

import React from 'react';
import ActiveGames from '../components/ActiveGames';

export default function ActiveGamesPage() {
  return (
    <div className="container mx-auto">
      <main className="min-h-screen flex items-center justify-center">
        <ActiveGames />
      </main>
    </div>
  );
} 
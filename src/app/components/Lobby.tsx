'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, doc, getDoc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../../firebase/AuthContext';
import AuthForm from './AuthForm';
import Link from 'next/link';

interface Game {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Record<string, any>;
  opponentName: string;
}

const Lobby: React.FC = () => {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [playerId, setPlayerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeGames, setActiveGames] = useState<Game[]>([]);

  useEffect(() => {
    if (currentUser) {
      setPlayerId(currentUser.uid);
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchActiveGames = async () => {
      if (!playerId) return;

      try {
        const gamesRef = collection(db, 'games');
        const q = query(gamesRef, where(`players.${playerId}`, '!=', null));
        const querySnapshot = await getDocs(q);
        
        const games = await Promise.all(querySnapshot.docs.map(async (docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
          const gameData = docSnapshot.data();
          const opponent = Object.keys(gameData.players).find(id => id !== playerId);
          let opponentName = 'Unknown';
          
          if (opponent) {
            try {
              const userDocRef = doc(db, 'users', opponent);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                const userData = userDoc.data() as DocumentData;
                opponentName = userData.displayName || 'Anonymous';
              }
            } catch (error) {
              console.error('Error fetching opponent name:', error);
            }
          }
          
          return {
            id: docSnapshot.id,
            ...gameData,
            opponentName
          } as Game;
        }));
        
        setActiveGames(games);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching active games:', error);
        setLoading(false);
      }
    };

    fetchActiveGames();
  }, [playerId]);

  const handleJoinGame = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  const handleCreateGame = () => {
    router.push('/create-game');
  };

  if (!currentUser) {
    return <AuthForm onSuccess={(user) => user && setPlayerId(user.uid)} />;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Spellobby</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Active Games Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Dina aktiva spel</h2>
          {activeGames.length > 0 ? (
            <div className="space-y-4">
              {activeGames.map((game) => (
                <div
                  key={game.id}
                  className="border rounded p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleJoinGame(game.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">vs {game.opponentName}</p>
                      <p className="text-sm text-gray-500">
                        Status: {game.status === 'waiting' ? 'Väntar på spelare' :
                                game.status === 'playing' ? 'Pågående' :
                                game.status === 'finished' ? 'Avslutat' : 'Okänd'}
                      </p>
                    </div>
                    <button
                      className="bg-[#8bb8a8] text-white px-4 py-2 rounded hover:bg-[#7aa798]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinGame(game.id);
                      }}
                    >
                      Fortsätt spela
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Du har inga aktiva spel</p>
          )}
        </div>

        {/* New Game Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Starta nytt spel</h2>
          <div className="space-y-4">
            <Link
              href="/single-player"
              className="block w-full text-center bg-[#8bb8a8] text-white px-6 py-3 rounded hover:bg-[#7aa798]"
            >
              Spela mot AI
            </Link>
            <button
              onClick={handleCreateGame}
              className="w-full bg-[#8bb8a8] text-white px-6 py-3 rounded hover:bg-[#7aa798]"
            >
              Skapa nytt multiplayer-spel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby; 
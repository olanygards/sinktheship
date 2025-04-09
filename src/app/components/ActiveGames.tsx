'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../firebase/AuthContext';
import { collection, query, where, getDocs, onSnapshot, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Link from 'next/link';

const ActiveGames = () => {
  const { currentUser } = useAuth();
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usernames, setUsernames] = useState<{[key: string]: string}>({});
  const [deletingGames, setDeletingGames] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Laddade användarnamn från localStorage
    try {
      const storedUsernames = localStorage.getItem('cachedUsernames');
      if (storedUsernames) {
        setUsernames(JSON.parse(storedUsernames));
      }
    } catch (error) {
      console.error('Error loading cached usernames:', error);
    }

    let unsubscribeFunction: (() => void) | undefined;
    
    const fetchActiveGames = async () => {
      try {
        setLoading(true);
        // Skapa en query för att hitta spel där denna användare är med och som inte är avslutade
        const q = query(
          collection(db, 'games'),
          where('status', 'in', ['waiting', 'placing', 'playing'])
        );

        unsubscribeFunction = onSnapshot(q, async (snapshot) => {
          const games: any[] = [];
          const userIds = new Set<string>();
          
          snapshot.forEach((doc) => {
            const gameData = doc.data();
            const players = gameData.players || {};
            
            // Kontrollera om användaren är med i detta spel
            const playerIds = Object.keys(players);
            if (playerIds.includes(currentUser.uid)) {
              // Hämta motståndaren om det finns en
              const opponentId = playerIds.find(id => id !== currentUser.uid);
              const opponent = opponentId ? players[opponentId] : null;
              
              if (opponent?.userId) {
                userIds.add(opponent.userId);
              }
              
              games.push({
                id: doc.id,
                status: gameData.status,
                yourTurn: gameData.currentTurn === currentUser.uid,
                opponent: opponent || null,
                opponentId: opponentId || null,
                opponentUserId: opponent?.userId || null,
                createdAt: gameData.createdAt,
                lastActivity: new Date().toISOString() // Vi borde spara detta i databasen
              });
            }
          });
          
          setActiveGames(games);
          
          // Hämta användarnamn för alla användar-ID:n som inte finns i cache
          const newUsernames = { ...usernames };
          const missingUserIds = Array.from(userIds).filter(id => !newUsernames[id]);
          
          if (missingUserIds.length > 0) {
            for (const userId of missingUserIds) {
              try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  newUsernames[userId] = userData.username || 'Okänd spelare';
                }
              } catch (error) {
                console.error('Error fetching user data:', error);
              }
            }
            
            setUsernames(newUsernames);
            
            // Spara usernames i localStorage för framtida sessioner
            try {
              localStorage.setItem('cachedUsernames', JSON.stringify(newUsernames));
            } catch (error) {
              console.error('Error caching usernames:', error);
            }
          }
          
          setLoading(false);
        }, (error) => {
          console.error('Error in active games snapshot:', error);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error fetching active games:', error);
        setLoading(false);
      }
    };

    fetchActiveGames();
    
    return () => {
      if (unsubscribeFunction) {
        unsubscribeFunction();
      }
    };
  }, [currentUser]); // Remove usernames from dependencies to avoid re-fetching

  const getOpponentName = (game: any) => {
    if (game.status === 'waiting') {
      return 'Väntar på motståndare';
    }
    
    if (game.opponentUserId && usernames[game.opponentUserId]) {
      return usernames[game.opponentUserId];
    }
    
    return game.opponentUserId || 'Gäst';
  };

  const getStatusText = (status: string, yourTurn: boolean) => {
    switch(status) {
      case 'waiting':
        return 'Väntar på motståndare';
      case 'placing':
        return 'Placera skepp';
      case 'playing':
        return yourTurn ? 'Din tur' : 'Motståndarens tur';
      default:
        return 'Okänd status';
    }
  };

  const getStatusColor = (status: string, yourTurn: boolean) => {
    switch(status) {
      case 'waiting':
        return 'text-gray-500';
      case 'placing':
        return 'text-blue-500';
      case 'playing':
        return yourTurn ? 'text-green-500 font-bold' : 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  const deleteGame = async (gameId: string) => {
    if (deletingGames[gameId]) return; // Förhindra dubbelklick

    try {
      setDeletingGames(prev => ({ ...prev, [gameId]: true }));
      await deleteDoc(doc(db, 'games', gameId));
      // Uppdatering av UI sker automatiskt via onSnapshot
      
      // Återställ deletingGames-status efter en kort fördröjning
      setTimeout(() => {
        setDeletingGames(prev => {
          const newState = { ...prev };
          delete newState[gameId];
          return newState;
        });
      }, 1000);
    } catch (error) {
      console.error('Error deleting game:', error);
      setDeletingGames(prev => ({ ...prev, [gameId]: false }));
      alert('Kunde inte ta bort spelet. Försök igen.');
    }
  };

  if (!currentUser) {
    return <div className="p-4">Logga in för att se dina aktiva spel</div>;
  }

  if (loading) {
    return <div className="p-4">Laddar dina spel...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Dina pågående spel</h1>
      
      {activeGames.length === 0 ? (
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <p className="text-gray-500">Du har inga pågående spel</p>
          <Link
            href="/"
            className="mt-4 inline-block bg-[#8bb8a8] text-white px-4 py-2 rounded"
          >
            Starta ett nytt spel
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeGames.map((game) => (
            <div key={game.id} className="p-4 bg-white rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold">
                  Mot: {getOpponentName(game)}
                </h2>
                <span 
                  className={`${getStatusColor(game.status, game.yourTurn)} px-2 py-1 rounded text-sm`}
                >
                  {getStatusText(game.status, game.yourTurn)}
                </span>
              </div>
              
              <div className="text-sm text-gray-500 mb-4">
                Startat: {new Date(game.createdAt).toLocaleString()}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/?gameId=${game.id}&playerId=${currentUser.uid}`}
                  className="w-full block text-center bg-[#8bb8a8] text-white px-4 py-2 rounded"
                >
                  {game.status === 'placing' ? 'Placera skepp' : 'Återgå till spel'}
                </Link>
                
                <button
                  onClick={() => deleteGame(game.id)}
                  className={`w-full sm:w-auto block text-center ${
                    deletingGames[game.id]
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-red-500 hover:bg-red-600'
                  } text-white px-4 py-2 rounded transition-colors`}
                  disabled={deletingGames[game.id]}
                >
                  {deletingGames[game.id] ? 'Tar bort...' : 'Ta bort'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActiveGames; 
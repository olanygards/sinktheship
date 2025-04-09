'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { useAuth } from '../../firebase/AuthContext';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { getFriends, challengeFriend } from '../../firebase/auth';
import AuthForm from './auth/AuthForm';
import FriendChallenges from './FriendChallenges';
import Link from 'next/link';

const Lobby = () => {
  const { currentUser, userProfile } = useAuth();
  const [gameCode, setGameCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [showFriends, setShowFriends] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentChallenges, setSentChallenges] = useState<any[]>([]);
  const [challengingFriends, setChallengingFriends] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (currentUser) {
      setPlayerId(currentUser.uid);
      loadFriends();
      listenToSentChallenges();
    } else {
      const id = Math.random().toString(36).substring(2, 9);
      setPlayerId(id);
      setLoading(false);
    }
  }, [currentUser]);

  const loadFriends = async () => {
    if (!currentUser) return;
    
    try {
      const friendsList = await getFriends(currentUser.uid);
      setFriends(friendsList);
    } catch (error) {
      console.error("Error loading friends:", error);
      setError("Kunde inte ladda vänlistan. Försök igen senare.");
    } finally {
      setLoading(false);
    }
  };

  const listenToSentChallenges = () => {
    if (!currentUser) return;

    // Lyssna på spel där användaren är utmanare
    const q = query(
      collection(db, 'games'),
      where('challengeInfo.challengerId', '==', currentUser.uid),
      where('challengeInfo.status', '==', 'pending')
    );

    try {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const challenges: any[] = [];
        snapshot.forEach((doc) => {
          challenges.push({ id: doc.id, ...doc.data() });
        });
        setSentChallenges(challenges);

        // Kolla om någon utmaning har accepterats
        snapshot.docChanges().forEach((change) => {
          const gameData = change.doc.data();
          if (gameData.challengeInfo && 
              gameData.challengeInfo.status === 'accepted' && 
              change.type === 'modified') {
            
            // Istället för att direkt omdirigera, sätt en flagga
            localStorage.setItem('shouldRedirectToGames', 'true');
            
            // Visa ett meddelande
            setError(`Din utmaning har accepterats! Omdirigerar till "Mina spel"...`);
            
            // Omdirigera till mina spel efter en kort fördröjning
            setTimeout(() => {
              window.location.href = '/active-games';
            }, 1500);
          }
        });
      }, (error) => {
        console.error("Error listening to challenges:", error);
        setError("Ett fel uppstod vid lyssning efter utmaningar. Ladda om sidan för att försöka igen.");
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error setting up challenge listener:", error);
      setError("Ett fel uppstod vid anslutning till servern. Ladda om sidan för att försöka igen.");
      return () => {};
    }
  };

  const createNewGame = async () => {
    // Lägg till en lokalt tillstånd för att visa att spel skapas
    setLoading(true);
    setError('');
    
    try {
      const gameRef = await addDoc(collection(db, 'games'), {
        players: {
          [playerId]: {
            ready: false,
            userId: currentUser?.uid || null
          }
        },
        status: 'waiting',
        createdAt: new Date().toISOString()
      });

      window.location.href = `/?gameId=${gameRef.id}&playerId=${playerId}`;
    } catch (error) {
      console.error('Error creating game:', error);
      setError('Kunde inte skapa spel. Försök igen.');
      setLoading(false);
    }
  };

  const joinGame = async () => {
    if (!gameCode.trim()) {
      setError('Ange en giltig spelkod');
      return;
    }

    try {
      const gameRef = doc(db, 'games', gameCode);
      const unsubscribe = onSnapshot(gameRef, async (doc) => {
        unsubscribe();
        
        if (!doc.exists()) {
          setError('Spelet hittades inte');
          return;
        }

        const gameData = doc.data();
        
        if (Object.keys(gameData.players).length >= 2 && !Object.keys(gameData.players).includes(playerId)) {
          setError('Spelet är fullt');
          return;
        }

        await updateDoc(gameRef, {
          [`players.${playerId}`]: {
            ready: false,
            userId: currentUser?.uid || null
          }
        });

        window.location.href = `/?gameId=${gameCode}&playerId=${playerId}`;
      });
    } catch (error) {
      console.error('Error joining game:', error);
      setError('Kunde inte ansluta till spelet. Försök igen.');
    }
  };

  const handleChallengeFriend = async (friendId: string) => {
    if (challengingFriends[friendId]) return; // Undvik dubbelklick
    
    try {
      // Markera denna vän som 'utmanas' för att förhindra dubbelklick
      setChallengingFriends(prev => ({ ...prev, [friendId]: true }));
      setError('');
      
      const gameId = await challengeFriend(currentUser!.uid, friendId);
      setError(`Utmaning skickad! Väntar på svar...`);
      
      // Återställ 'utmanas'-status efter en kort fördröjning
      setTimeout(() => {
        setChallengingFriends(prev => ({ ...prev, [friendId]: false }));
      }, 2000);
    } catch (error) {
      console.error('Error challenging friend:', error);
      setError('Kunde inte skicka utmaning. Försök igen.');
      // Återställ 'utmanas'-status vid fel
      setChallengingFriends(prev => ({ ...prev, [friendId]: false }));
    }
  };

  if (!currentUser) {
    return <AuthForm onSuccess={() => setPlayerId(currentUser?.uid || '')} />;
  }

  if (loading) {
    return <div className="text-center p-4">Laddar...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Starta nytt spel</h2>
            
            <button 
              onClick={createNewGame}
              className="bg-[#8bb8a8] text-white w-full py-4 text-lg rounded mb-4"
            >
              Skapa nytt spel
            </button>
            
            <div className="text-center text-gray-500 flex items-center my-4">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="px-4">eller</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>
            
            <div className="space-y-3">
              <input
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                placeholder="Ange spelkod"
                className="w-full p-4 border border-gray-200 rounded"
              />
              <button 
                onClick={joinGame}
                className="bg-[#8bb8a8] text-white w-full py-4 text-lg rounded"
              >
                Anslut till spel
              </button>
            </div>
            
            {currentUser && (
              <div className="mt-4 text-center">
                <Link
                  href="/active-games"
                  className="text-blue-600 hover:text-blue-800"
                >
                  Se dina pågående spel →
                </Link>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded text-red-500">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Utmana en vän</h2>
            {friends.length > 0 ? (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span>{friend.username}</span>
                    <button
                      onClick={() => handleChallengeFriend(friend.id)}
                      className={`${
                        challengingFriends[friend.id] 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-[#8bb8a8] hover:bg-[#7aa897]'
                      } text-white px-4 py-2 rounded transition-colors`}
                      disabled={challengingFriends[friend.id]}
                    >
                      {challengingFriends[friend.id] ? 'Utmanar...' : 'Utmana'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Du har inga vänner att utmana än.</p>
            )}
          </div>

          <FriendChallenges />
        </div>
      </div>
    </div>
  );
};

export default Lobby; 
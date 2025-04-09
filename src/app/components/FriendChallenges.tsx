'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../firebase/AuthContext';
import { getActiveChallenges, getFriends } from '../../firebase/auth';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

const FriendChallenges = () => {
  const { currentUser } = useAuth();
  const [receivedChallenges, setReceivedChallenges] = useState<any[]>([]);
  const [sentChallenges, setSentChallenges] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<{[key: string]: boolean}>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    let receivedUnsubscribe: (() => void) | undefined;
    let sentUnsubscribe: (() => void) | undefined;

    const loadChallenges = () => {
      try {
        // Lyssna på mottagna utmaningar
        const receivedQuery = query(
          collection(db, 'games'),
          where('challengeInfo.friendId', '==', currentUser.uid),
          where('challengeInfo.status', '==', 'pending')
        );

        // Lyssna på skickade utmaningar
        const sentQuery = query(
          collection(db, 'games'),
          where('challengeInfo.challengerId', '==', currentUser.uid),
          where('challengeInfo.status', '==', 'pending')
        );

        receivedUnsubscribe = onSnapshot(receivedQuery, (snapshot) => {
          try {
            const challenges: any[] = [];
            snapshot.forEach((doc) => {
              challenges.push({ id: doc.id, ...doc.data() });
            });
            setReceivedChallenges(challenges);
          } catch (innerError) {
            console.error('Error processing received challenges:', innerError);
          }
        }, (error) => {
          console.error('Error in received challenges snapshot:', error);
          setError('Kunde inte hämta inkomna utmaningar. Ladda om sidan för att försöka igen.');
        });

        sentUnsubscribe = onSnapshot(sentQuery, (snapshot) => {
          try {
            const challenges: any[] = [];
            snapshot.forEach((doc) => {
              challenges.push({ id: doc.id, ...doc.data() });
            });
            setSentChallenges(challenges);
          } catch (innerError) {
            console.error('Error processing sent challenges:', innerError);
          }
        }, (error) => {
          console.error('Error in sent challenges snapshot:', error);
          setError('Kunde inte hämta skickade utmaningar. Ladda om sidan för att försöka igen.');
        });
      } catch (error) {
        console.error('Error setting up challenge listeners:', error);
        setError('Kunde inte ansluta till servern. Försök igen senare.');
      }
    };

    const loadFriendsData = async () => {
      try {
        const friendsList = await getFriends(currentUser.uid);
        setFriends(friendsList);
      } catch (error) {
        console.error('Error fetching friends:', error);
        setError('Kunde inte hämta vänlistan. Ladda om sidan för att försöka igen.');
      } finally {
        setLoading(false);
      }
    };

    loadChallenges();
    loadFriendsData();

    return () => {
      if (receivedUnsubscribe) receivedUnsubscribe();
      if (sentUnsubscribe) sentUnsubscribe();
    };
  }, [currentUser]);

  const acceptChallenge = async (gameId: string) => {
    if (processing[gameId]) return; // Undvik dubbelklick
    
    setProcessing(prev => ({ ...prev, [gameId]: true }));
    setError(null);
    
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        'challengeInfo.status': 'accepted',
        [`players.${currentUser?.uid}`]: {
          ready: false,
          userId: currentUser?.uid
        }
      });
      
      // Sätt flaggan för att gå till "Mina spel" sidan istället för att direkt omdirigera
      localStorage.setItem('shouldRedirectToGames', 'true');
      
      // Om vi är på /active-games-sidan, ladda om sidan, annars använd router
      if (window.location.pathname === '/active-games') {
        window.location.reload();
      } else {
        // Använd window.location.href eftersom vi redan använder en flagga för att undvika loopar
        window.location.href = '/active-games';
      }
    } catch (error) {
      console.error('Error accepting challenge:', error);
      setError('Kunde inte acceptera utmaning. Försök igen.');
      setProcessing(prev => ({ ...prev, [gameId]: false }));
    }
  };

  const declineChallenge = async (gameId: string) => {
    if (processing[gameId]) return; // Undvik dubbelklick
    
    setProcessing(prev => ({ ...prev, [gameId]: true }));
    setError(null);
    
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        'challengeInfo.status': 'declined'
      });
      
      // Lämna knappen i processingtillstånd, den kommer att försvinna automatiskt när listan uppdateras
    } catch (error) {
      console.error('Error declining challenge:', error);
      setError('Kunde inte avböja utmaning. Försök igen.');
      setProcessing(prev => ({ ...prev, [gameId]: false }));
    }
  };

  const getFriendName = (userId: string) => {
    const friend = friends.find(f => f.id === userId);
    return friend?.username || 'Okänd spelare';
  };

  if (loading) {
    return <div className="text-center p-4">Laddar...</div>;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {/* Mottagna utmaningar */}
      {receivedChallenges.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Mottagna utmaningar</h2>
          <div className="space-y-4">
            {receivedChallenges.map((challenge) => (
              <div key={challenge.id} className="p-4 bg-white rounded-lg shadow">
                <p className="mb-2">
                  {getFriendName(challenge.challengeInfo.challengerId)} har utmanat dig!
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptChallenge(challenge.id)}
                    className={`${
                      processing[challenge.id] ? 'bg-gray-400' : 'bg-green-500'
                    } text-white px-4 py-2 rounded`}
                    disabled={processing[challenge.id]}
                  >
                    {processing[challenge.id] ? 'Accepterar...' : 'Acceptera'}
                  </button>
                  <button
                    onClick={() => declineChallenge(challenge.id)}
                    className={`${
                      processing[challenge.id] ? 'bg-gray-400' : 'bg-red-500'
                    } text-white px-4 py-2 rounded`}
                    disabled={processing[challenge.id]}
                  >
                    {processing[challenge.id] ? 'Avböjer...' : 'Avböj'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skickade utmaningar */}
      {sentChallenges.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Skickade utmaningar</h2>
          <div className="space-y-4">
            {sentChallenges.map((challenge) => (
              <div key={challenge.id} className="p-4 bg-white rounded-lg shadow">
                <p>
                  Väntar på svar från {getFriendName(challenge.challengeInfo.friendId)}
                </p>
                <button
                  onClick={() => declineChallenge(challenge.id)}
                  className="mt-2 text-sm text-red-500 hover:text-red-700"
                >
                  Avbryt utmaning
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {receivedChallenges.length === 0 && sentChallenges.length === 0 && (
        <p className="text-gray-500">Du har inga aktiva utmaningar</p>
      )}
    </div>
  );
};

export default FriendChallenges; 
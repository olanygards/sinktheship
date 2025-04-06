'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';

const Lobby = () => {
  const [gameCode, setGameCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Generate a unique ID for this player
    const id = Math.random().toString(36).substring(2, 9);
    setPlayerId(id);
  }, []);

  const createNewGame = async () => {
    try {
      // Create a new game in Firestore
      const gameRef = await addDoc(collection(db, 'games'), {
        players: {
          [playerId]: {
            ready: false
          }
        },
        status: 'waiting',
        createdAt: new Date().toISOString()
      });

      // Navigate to the game using URL parameters
      window.location.href = `/?gameId=${gameRef.id}&playerId=${playerId}`;
    } catch (error) {
      console.error('Error creating game:', error);
      setError('Kunde inte skapa spel. Försök igen.');
    }
  };

  const joinGame = async () => {
    if (!gameCode.trim()) {
      setError('Ange en giltig spelkod');
      return;
    }

    try {
      // Check if game exists
      const gameRef = doc(db, 'games', gameCode);
      const unsubscribe = onSnapshot(gameRef, async (doc) => {
        unsubscribe(); // Only listen once
        
        if (!doc.exists()) {
          setError('Spelet hittades inte');
          return;
        }

        const gameData = doc.data();
        
        // Check if game is full
        if (Object.keys(gameData.players).length >= 2 && !Object.keys(gameData.players).includes(playerId)) {
          setError('Spelet är fullt');
          return;
        }

        // Join the game
        await updateDoc(gameRef, {
          [`players.${playerId}`]: {
            ready: false
          }
        });

        // Navigate to the game using URL parameters
        window.location.href = `/?gameId=${gameCode}&playerId=${playerId}`;
      });
    } catch (error) {
      console.error('Error joining game:', error);
      setError('Kunde inte ansluta till spelet. Försök igen.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-100 rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-8">Sänka Skepp</h1>
      
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        <button 
          onClick={createNewGame}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Skapa nytt spel
        </button>
        
        <div className="text-center text-gray-500">- eller -</div>
        
        <div className="w-full">
          <input
            type="text"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value)}
            placeholder="Ange spelkod"
            className="w-full p-3 border border-gray-300 rounded-lg mb-3"
          />
          <button 
            onClick={joinGame}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Anslut till spel
          </button>
        </div>
        
        {error && (
          <div className="text-red-500 mt-4">{error}</div>
        )}
      </div>
    </div>
  );
};

export default Lobby; 
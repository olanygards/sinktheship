'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../firebase/AuthContext';
import { getFriends, getMatchHistory } from '../../../firebase/auth';

interface FriendStats {
  id: string;
  username: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
}

const PlayerStats = () => {
  const { currentUser } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [friendStats, setFriendStats] = useState<FriendStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (currentUser) {
      loadFriendStatsData();
    }
  }, [currentUser]);
  
  const loadFriendStatsData = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Load friends
      const friendsData = await getFriends(currentUser.uid);
      setFriends(friendsData);
      
      if (friendsData.length === 0) {
        setIsLoading(false);
        return;
      }
      
      // Get stats for each friend
      const statsPromises = friendsData.map(async (friend) => {
        const matchHistory = await getMatchHistory(currentUser.uid, friend.id);
        
        let gamesPlayed = matchHistory.length;
        let gamesWon = 0;
        
        // Count wins against this friend
        matchHistory.forEach(game => {
          if (game.winner === currentUser.uid) {
            gamesWon++;
          }
        });
        
        const gamesLost = gamesPlayed - gamesWon;
        const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;
        
        return {
          id: friend.id,
          username: friend.username,
          gamesPlayed,
          gamesWon,
          gamesLost,
          winRate
        };
      });
      
      const statsResults = await Promise.all(statsPromises);
      
      // Sort by number of games played (most active first)
      statsResults.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
      
      setFriendStats(statsResults);
    } catch (error) {
      console.error('Error loading friend stats:', error);
      setError('Kunde inte ladda spelarstatistik. Försök igen senare.');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!currentUser) {
    return <div className="text-center p-4">Du måste vara inloggad för att se spelarstatistik.</div>;
  }
  
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Statistik mot andra spelare</h1>
      
      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center p-8">Laddar statistik...</div>
      ) : friendStats.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 text-left">Spelare</th>
                <th className="py-3 text-center">Spelade matcher</th>
                <th className="py-3 text-center">Vinster</th>
                <th className="py-3 text-center">Förluster</th>
                <th className="py-3 text-center">Vinstprocent</th>
              </tr>
            </thead>
            <tbody>
              {friendStats.map(stat => (
                <tr key={stat.id} className="border-b border-gray-200">
                  <td className="py-3 font-medium">{stat.username}</td>
                  <td className="py-3 text-center">{stat.gamesPlayed}</td>
                  <td className="py-3 text-center text-green-600">{stat.gamesWon}</td>
                  <td className="py-3 text-center text-red-600">{stat.gamesLost}</td>
                  <td className="py-3 text-center">{stat.winRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-500">
            {friends.length > 0 
              ? 'Du har inte spelat några matcher mot dina vänner ännu.' 
              : 'Du har inga vänner ännu. Lägg till vänner för att se statistik mot dem.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default PlayerStats; 
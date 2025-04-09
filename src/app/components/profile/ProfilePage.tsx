'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../firebase/AuthContext';
import { updateUsername, getFriends, searchUsers, addFriend, removeFriend } from '../../../firebase/auth';

const ProfilePage = () => {
  const { currentUser, userProfile } = useAuth();
  
  const [newUsername, setNewUsername] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  
  useEffect(() => {
    if (currentUser && userProfile) {
      loadFriends();
      setNewUsername(userProfile.username || currentUser.displayName || '');
    }
  }, [currentUser, userProfile]);
  
  const loadFriends = async () => {
    if (!currentUser) return;
    
    try {
      const friendsData = await getFriends(currentUser.uid);
      setFriends(friendsData);
    } catch (error) {
      console.error('Error loading friends:', error);
      showMessage('Kunde inte ladda vänlistan', 'error');
    }
  };
  
  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !newUsername.trim()) return;
    
    try {
      await updateUsername(currentUser, newUsername);
      showMessage('Användarnamn uppdaterat!', 'success');
    } catch (error) {
      console.error('Error updating username:', error);
      showMessage('Kunde inte uppdatera användarnamn', 'error');
    }
  };
  
  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    
    try {
      const results = await searchUsers(searchTerm);
      // Filter out current user and users already in friends list
      const filteredResults = results.filter(user => 
        user.id !== currentUser?.uid && 
        !friends.some(friend => friend.id === user.id)
      );
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      showMessage('Sökningen misslyckades', 'error');
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleAddFriend = async (friendId: string) => {
    if (!currentUser) return;
    
    try {
      await addFriend(currentUser.uid, friendId);
      showMessage('Vän tillagd!', 'success');
      
      // Refresh friends list
      loadFriends();
      
      // Remove the added user from search results
      setSearchResults(prev => prev.filter(user => user.id !== friendId));
    } catch (error) {
      console.error('Error adding friend:', error);
      showMessage('Kunde inte lägga till vän', 'error');
    }
  };
  
  const handleRemoveFriend = async (friendId: string) => {
    if (!currentUser) return;
    
    try {
      await removeFriend(currentUser.uid, friendId);
      showMessage('Vän borttagen', 'success');
      
      // Refresh friends list
      loadFriends();
    } catch (error) {
      console.error('Error removing friend:', error);
      showMessage('Kunde inte ta bort vän', 'error');
    }
  };
  
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
    }, 3000);
  };
  
  if (!currentUser || !userProfile) {
    return <div className="text-center p-4">Du måste vara inloggad för att se din profil.</div>;
  }
  
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Din profil</h1>
      
      {message && (
        <div className={`p-3 mb-4 rounded-md ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Profilinformation</h2>
        
        <form onSubmit={handleUpdateUsername} className="mb-6">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
              Användarnamn
            </label>
            <input
              id="username"
              type="text"
              className="w-full p-3 border border-gray-300 rounded-md"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Ditt användarnamn"
              required
            />
          </div>
          
          <button
            type="submit"
            className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Uppdatera användarnamn
          </button>
        </form>
        
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Statistik</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-md text-center">
              <p className="text-gray-500 text-sm">Spelade matcher</p>
              <p className="text-xl font-bold">{userProfile.stats.gamesPlayed}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-md text-center">
              <p className="text-gray-500 text-sm">Vinster</p>
              <p className="text-xl font-bold">{userProfile.stats.gamesWon}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-md text-center">
              <p className="text-gray-500 text-sm">Förluster</p>
              <p className="text-xl font-bold">{userProfile.stats.gamesLost}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-md text-center">
              <p className="text-gray-500 text-sm">Vinstprocent</p>
              <p className="text-xl font-bold">{userProfile.stats.winRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Dina vänner</h2>
        
        <div className="mb-6">
          <form onSubmit={handleSearchUsers} className="flex gap-2">
            <input
              type="text"
              className="flex-1 p-3 border border-gray-300 rounded-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Sök efter användarnamn"
            />
            <button
              type="submit"
              className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              disabled={isSearching}
            >
              {isSearching ? 'Söker...' : 'Sök'}
            </button>
          </form>
          
          {searchResults.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Sökresultat</h3>
              <ul className="divide-y divide-gray-200">
                {searchResults.map(user => (
                  <li key={user.id} className="py-3 flex justify-between items-center">
                    <span>{user.username}</span>
                    <button
                      onClick={() => handleAddFriend(user.id)}
                      className="py-1 px-3 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                    >
                      Lägg till
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {searchResults.length === 0 && searchTerm.trim() !== '' && !isSearching && (
            <p className="mt-2 text-gray-500">Inga användare hittades.</p>
          )}
        </div>
        
        <h3 className="text-lg font-medium mb-2">Dina vänner ({friends.length})</h3>
        {friends.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {friends.map(friend => (
              <li key={friend.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{friend.username}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRemoveFriend(friend.id)}
                    className="py-1 px-3 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                  >
                    Ta bort
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Du har inga vänner ännu. Sök efter användare för att lägga till dem som vänner.</p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage; 
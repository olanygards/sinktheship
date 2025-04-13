'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../firebase/AuthContext';
import { updateUsername, getFriends, searchUsers, addFriend, removeFriend, updateProfileImage } from '../../../firebase/auth';

const ProfilePage = () => {
  const { currentUser, userProfile } = useAuth();
  
  const [newUsername, setNewUsername] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [selectedProfileImage, setSelectedProfileImage] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  
  useEffect(() => {
    if (currentUser && userProfile) {
      loadFriends();
      setNewUsername(userProfile.username || currentUser.displayName || '');
      setSelectedProfileImage(userProfile.profileImage || 'player-icon-1.jpg');
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
      setShowNameModal(false);
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
  
  const handleProfileImageChange = async (imageIndex: number) => {
    if (!currentUser) return;
    
    try {
      await updateProfileImage(currentUser.uid, imageIndex);
      setSelectedProfileImage(`player-icon-${imageIndex}.jpg`);
      showMessage('Profilbild uppdaterad!', 'success');
    } catch (error) {
      console.error('Error updating profile image:', error);
      showMessage('Kunde inte uppdatera profilbild', 'error');
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
        <div className={`p-3 mb-4 ${messageType === 'success' ? 'bg-[var(--primary-light)] text-[var(--primary-dark)]' : 'bg-red-100 text-red-800'} rounded-[5px]`}>
          {message}
        </div>
      )}
      
      <div className="bg-white p-6 mb-8 rounded-[5px]">
        <div className="flex justify-center items-center mb-6 relative">
          <h2 className="text-2xl font-bold text-center">{userProfile.username}</h2>
          <button 
            onClick={() => setShowNameModal(true)} 
            className="ml-2 text-gray-500 hover:text-[var(--primary)]"
            aria-label="Edit username"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="md:w-1/3 flex flex-col items-center">
            <div className="w-40 h-40 mb-6 overflow-hidden rounded-lg">
              <img 
                src={`/images/${selectedProfileImage}`} 
                alt="Current profile" 
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="w-full">
              <h3 className="font-medium mb-2">Välj ny profilbild</h3>
              <div className="flex flex-wrap gap-3 mb-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((index) => (
                  <button 
                    key={index}
                    onClick={() => handleProfileImageChange(index)}
                    className={`w-12 h-12 overflow-hidden rounded-full ${selectedProfileImage === `player-icon-${index}.jpg` ? 'ring-4 ring-[#8bb8a8] ring-offset-2' : 'hover:ring-2 hover:ring-[var(--primary-light)]'}`}
                  >
                    <img 
                      src={`/images/player-icon-${index}.jpg`} 
                      alt={`Avatar ${index}`} 
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">Klicka på en bild för att välja den som din profilbild</p>
            </div>
          </div>
          
          <div className="md:w-2/3">
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Statistik</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--primary-light)]/30 p-4 text-center rounded-[5px]">
                  <p className="text-gray-600 text-sm">Spelade matcher</p>
                  <p className="text-xl font-bold">{userProfile.stats.gamesPlayed}</p>
                </div>
                <div className="bg-[var(--primary-light)]/30 p-4 text-center rounded-[5px]">
                  <p className="text-gray-600 text-sm">Vinster</p>
                  <p className="text-xl font-bold">{userProfile.stats.gamesWon}</p>
                </div>
                <div className="bg-[var(--primary-light)]/30 p-4 text-center rounded-[5px]">
                  <p className="text-gray-600 text-sm">Förluster</p>
                  <p className="text-xl font-bold">{userProfile.stats.gamesLost}</p>
                </div>
                <div className="bg-[var(--primary-light)]/30 p-4 text-center rounded-[5px]">
                  <p className="text-gray-600 text-sm">Vinstprocent</p>
                  <p className="text-xl font-bold">{userProfile.stats.winRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Username Edit Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-[5px] max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Ändra användarnamn</h3>
              <button 
                onClick={() => setShowNameModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleUpdateUsername}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
                  Nytt användarnamn
                </label>
                <input
                  id="username"
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-[5px]"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Ditt användarnamn"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNameModal(false)}
                  className="py-2 px-4 bg-gray-200 text-gray-800 rounded-[5px]"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors rounded-[5px]"
                >
                  Spara
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <div className="bg-white p-6 rounded-[5px]">
        <h2 className="text-xl font-semibold mb-4">Dina vänner</h2>
        
        <div className="mb-6">
          <form onSubmit={handleSearchUsers} className="flex gap-2">
            <input
              type="text"
              className="flex-1 p-3 border border-gray-300 rounded-[5px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Sök efter användarnamn"
            />
            <button
              type="submit"
              className="py-2 px-4 bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors rounded-[5px]"
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
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 overflow-hidden rounded-full">
                        <img 
                          src={`/images/${user.profileImage || 'player-icon-1.jpg'}`} 
                          alt={`${user.username}'s avatar`} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span>{user.username}</span>
                    </div>
                    <button
                      onClick={() => handleAddFriend(user.id)}
                      className="py-1 px-3 bg-[var(--primary)] text-white text-sm hover:bg-[var(--primary-dark)] transition-colors rounded-[5px]"
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 overflow-hidden rounded-full">
                    <img 
                      src={`/images/${friend.profileImage || 'player-icon-1.jpg'}`} 
                      alt={`${friend.username}'s avatar`} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="font-medium">{friend.username}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRemoveFriend(friend.id)}
                    className="py-1 px-3 bg-red-600 text-white text-sm hover:bg-red-700 transition-colors rounded-[5px]"
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
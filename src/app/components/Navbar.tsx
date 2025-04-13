'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../firebase/AuthContext';
import { signOut } from '../../firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

const Navbar = () => {
  const { currentUser, userProfile } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<{
    receivedChallenges: number;
    acceptedChallenges: string[];
    showAcceptedNotification: boolean;
    shownNotifications: string[];
  }>({
    receivedChallenges: 0,
    acceptedChallenges: [],
    showAcceptedNotification: false,
    shownNotifications: []
  });
  
  useEffect(() => {
    if (!currentUser) return;

    // Lyssna på mottagna utmaningar
    const receivedQuery = query(
      collection(db, 'games'),
      where('challengeInfo.friendId', '==', currentUser.uid),
      where('challengeInfo.status', '==', 'pending')
    );

    // Lyssna på accepterade utmaningar
    const sentQuery = query(
      collection(db, 'games'),
      where('challengeInfo.challengerId', '==', currentUser.uid),
      where('challengeInfo.status', '==', 'accepted')
    );

    // Hämta redan visade notifikationer från localStorage en gång vid komponentens montering
    let savedShownNotifications: string[] = [];
    try {
      const storedNotifications = localStorage.getItem('shownNotifications');
      if (storedNotifications) {
        savedShownNotifications = JSON.parse(storedNotifications);
      }
    } catch (e) {
      console.error('Error parsing stored notifications:', e);
    }

    const unsubscribeReceived = onSnapshot(receivedQuery, (snapshot) => {
      setNotifications(prev => ({
        ...prev,
        receivedChallenges: snapshot.docs.length
      }));
    });

    const unsubscribeSent = onSnapshot(sentQuery, (snapshot) => {
      const acceptedGames = snapshot.docs.map(doc => doc.id);
      
      // Kolla om vi redan är på en spelsida
      const urlParams = new URLSearchParams(window.location.search);
      const currentGameId = urlParams.get('gameId');
      
      // Filtrera bort spel som vi redan visar
      const newAcceptedGames = acceptedGames.filter(gameId => gameId !== currentGameId);
      
      // Hitta nya accepterade utmaningar som vi ännu inte visat en notifikation för
      const newlyAcceptedGames = newAcceptedGames.filter(
        gameId => !notifications.shownNotifications.includes(gameId) && 
                 !savedShownNotifications.includes(gameId)
      );
      
      if (newlyAcceptedGames.length > 0) {
        // Uppdatera visade notifikationer i localStorage
        const updatedShownNotifications = [...notifications.shownNotifications, ...newlyAcceptedGames];
        localStorage.setItem('shownNotifications', JSON.stringify(updatedShownNotifications));
        
        setNotifications(prev => ({
          ...prev,
          acceptedChallenges: newAcceptedGames,
          showAcceptedNotification: true,
          // Lägg till de nya accepterade utmaningarna i listan över visade notifikationer
          shownNotifications: updatedShownNotifications
        }));
        
        // Sätt en timeout för att automatiskt dölja notifikationen efter 10 sekunder
        setTimeout(() => {
          setNotifications(prev => ({
            ...prev,
            showAcceptedNotification: false
          }));
        }, 10000); // 10 sekunder
        
        // Sätt en flagga istället för att omdirigera
        localStorage.setItem('shouldRedirectToGames', 'true');
      } else if (newAcceptedGames.length !== notifications.acceptedChallenges.length) {
        // Uppdatera bara acceptedChallenges om antalet har ändrats
        setNotifications(prev => ({
          ...prev,
          acceptedChallenges: newAcceptedGames
        }));
      }
    });

    return () => {
      unsubscribeReceived();
      unsubscribeSent();
    };
  }, [currentUser]);
  
  const closeNotification = () => {
    setNotifications(prev => ({
      ...prev,
      showAcceptedNotification: false
    }));
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <nav className="bg-[var(--primary)] text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold">
              <span className="text-white">Sänka</span>{' '}
              <span className="text-[var(--primary-light)]">Skepp</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {currentUser && notifications.receivedChallenges > 0 && (
              <Link
                href="/"
                className="relative p-2"
              >
                <span className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs">
                  {notifications.receivedChallenges}
                </span>
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
              </Link>
            )}

            {/* Hamburger button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-white hover:text-[var(--primary-light)] focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`${
          isMenuOpen ? 'block' : 'hidden'
        } absolute top-16 left-0 right-0 bg-[var(--primary-dark)] text-white z-50`}
      >
        <div className="px-4 py-2 space-y-1">
          {currentUser ? (
            <>
              <div className="px-3 py-2 text-[var(--primary-light)] border-b border-[var(--primary-light)] border-opacity-30">
                {userProfile?.username || currentUser.displayName}
              </div>
              <Link
                href="/active-games"
                className="block px-3 py-2 text-white hover:text-[var(--primary-light)] hover:bg-[var(--primary)] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Mina spel
              </Link>
              <Link
                href="/profile"
                className="block px-3 py-2 text-white hover:text-[var(--primary-light)] hover:bg-[var(--primary)] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Min profil
              </Link>
              <Link
                href="/"
                className="block px-3 py-2 text-white hover:text-[var(--primary-light)] hover:bg-[var(--primary)] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Lobby
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-3 py-2 text-white hover:text-[var(--primary-light)] hover:bg-[var(--primary)] transition-colors"
              >
                Logga ut
              </button>
            </>
          ) : (
            <Link
              href="/"
              className="block px-3 py-2 text-white hover:text-[var(--primary-light)] hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Logga in
            </Link>
          )}
        </div>
      </div>

      {/* Notifikation för accepterad utmaning */}
      {notifications.showAcceptedNotification && notifications.acceptedChallenges.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-[var(--primary-dark)] text-white px-6 py-3 flex items-center">
          <span>Din utmaning har accepterats! Omdirigerar till dina spel...</span>
          <button 
            onClick={closeNotification}
            className="ml-3 text-white hover:text-[var(--primary-light)] focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 
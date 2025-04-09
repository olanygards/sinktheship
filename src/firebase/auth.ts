import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  UserCredential,
  sendEmailVerification,
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  increment,
  collection,
  query,
  where,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { auth, db } from './config';

// User registration with bot protection
export const registerUser = async (email: string, password: string, username: string): Promise<UserCredential> => {
  // Create the user account
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Update the user profile with the username
  await updateProfile(userCredential.user, { displayName: username });
  
  // Send verification email (bot protection)
  await sendEmailVerification(userCredential.user);
  
  // Create a user record in Firestore
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    username,
    createdAt: new Date().toISOString(),
    friends: [],
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      winRate: 0
    }
  });
  
  return userCredential;
};

// User login
export const loginUser = async (email: string, password: string): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email, password);
};

// Sign out
export const signOut = async (): Promise<void> => {
  return await firebaseSignOut(auth);
};

// Update username
export const updateUsername = async (user: User, newUsername: string): Promise<void> => {
  // Update Auth profile
  await updateProfile(user, { displayName: newUsername });
  
  // Update Firestore document
  await updateDoc(doc(db, 'users', user.uid), {
    username: newUsername
  });
};

// Friend management
export const addFriend = async (userId: string, friendId: string): Promise<void> => {
  // Add friendId to user's friends list
  await updateDoc(doc(db, 'users', userId), {
    friends: arrayUnion(friendId)
  });
};

export const removeFriend = async (userId: string, friendId: string): Promise<void> => {
  // Remove friendId from user's friends list
  await updateDoc(doc(db, 'users', userId), {
    friends: arrayRemove(friendId)
  });
};

export const getFriends = async (userId: string): Promise<any[]> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  const userData = userDoc.data();
  
  if (!userData || !userData.friends || userData.friends.length === 0) {
    return [];
  }
  
  const friendsData = [];
  for (const friendId of userData.friends) {
    const friendDoc = await getDoc(doc(db, 'users', friendId));
    if (friendDoc.exists()) {
      friendsData.push({ id: friendId, ...friendDoc.data() });
    }
  }
  
  return friendsData;
};

// Search users to add as friends
export const searchUsers = async (searchTerm: string): Promise<any[]> => {
  const usersRef = collection(db, 'users');
  // Note: This is a simple implementation that searches for usernames that start with the search term
  // In a production app, you might want to use a more sophisticated search solution
  const q = query(usersRef, where('username', '>=', searchTerm), where('username', '<=', searchTerm + '\uf8ff'));
  const querySnapshot = await getDocs(q);
  
  const results = [];
  querySnapshot.forEach((doc) => {
    results.push({ id: doc.id, ...doc.data() });
  });
  
  return results;
};

// Game statistics
export const updateGameStats = async (userId: string, won: boolean): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  
  await updateDoc(userRef, {
    'stats.gamesPlayed': increment(1),
    'stats.gamesWon': won ? increment(1) : increment(0),
    'stats.gamesLost': won ? increment(0) : increment(1)
  });
  
  // Update win rate
  const userDoc = await getDoc(userRef);
  const userData = userDoc.data();
  if (userData) {
    const { gamesPlayed, gamesWon } = userData.stats;
    const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;
    
    await updateDoc(userRef, {
      'stats.winRate': winRate
    });
  }
};

// Get match history between two players
export const getMatchHistory = async (userId: string, opponentId: string): Promise<any[]> => {
  const gamesRef = collection(db, 'games');
  // Vi söker efter spel där båda spelarna var med och spelet är avslutat
  const q = query(gamesRef, 
    where('status', '==', 'finished')
  );
  
  const querySnapshot = await getDocs(q);
  const games = [];
  
  querySnapshot.forEach((doc) => {
    const gameData = doc.data();
    // Kontrollera att båda spelarna var med i spelet
    const players = gameData.players || {};
    if (players[userId] && players[opponentId]) {
      games.push({ id: doc.id, ...gameData });
    }
  });
  
  return games;
};

// Funktion för att skicka en spelutmaning
export const challengeFriend = async (challengerId: string, friendId: string): Promise<string> => {
  // Skapa ett nytt spel
  const gameRef = await addDoc(collection(db, 'games'), {
    players: {
      [challengerId]: {
        ready: false,
        userId: challengerId
      }
    },
    status: 'waiting',
    createdAt: new Date().toISOString(),
    challengeInfo: {
      challengerId,
      friendId,
      status: 'pending'
    }
  });
  
  return gameRef.id;
};

// Funktion för att hämta aktiva utmaningar
export const getActiveChallenges = async (userId: string): Promise<any[]> => {
  const gamesRef = collection(db, 'games');
  const q = query(gamesRef,
    where('challengeInfo.friendId', '==', userId),
    where('challengeInfo.status', '==', 'pending')
  );
  
  const querySnapshot = await getDocs(q);
  const challenges = [];
  
  querySnapshot.forEach((doc) => {
    challenges.push({ id: doc.id, ...doc.data() });
  });
  
  return challenges;
}; 
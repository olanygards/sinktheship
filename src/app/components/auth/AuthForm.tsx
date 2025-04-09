'use client';

import React, { useState } from 'react';
import { registerUser, loginUser } from '../../../firebase/auth';

interface AuthFormProps {
  onSuccess: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        // Login
        await loginUser(email, password);
        onSuccess();
      } else {
        // Register
        if (!username.trim()) {
          throw new Error('Användarnamn krävs');
        }
        
        await registerUser(email, password, username);
        setSuccessMessage('Konto skapat! Kontrollera din e-post för att verifiera ditt konto.');
        
        // Switch to login form after registration
        setIsLogin(true);
      }
    } catch (error: any) {
      // Handle Firebase error messages
      let errorMessage = 'Ett fel uppstod. Försök igen.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'E-postadressen används redan av ett annat konto.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Lösenordet är för svagt. Använd minst 6 tecken.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Ogiltig e-postadress.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Fel e-postadress eller lösenord.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md flat-card p-8">
      <h2 className="text-2xl font-bold mb-6 text-center text-blue-800">
        {isLogin ? 'Logga in' : 'Skapa konto'}
      </h2>
      
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 text-green-800 border border-green-200">
          {successMessage}
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
              Användarnamn
            </label>
            <input
              id="username"
              type="text"
              className="flat-input w-full p-3"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ditt användarnamn"
              required
            />
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
            E-post
          </label>
          <input
            id="email"
            type="email"
            className="flat-input w-full p-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din.email@exempel.se"
            required
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
            Lösenord
          </label>
          <input
            id="password"
            type="password"
            className="flat-input w-full p-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required
          />
        </div>
        
        <button
          type="submit"
          className="flat-button w-full py-3 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Laddar...' : isLogin ? 'Logga in' : 'Skapa konto'}
        </button>
      </form>
      
      <div className="mt-4 text-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-blue-600 hover:text-blue-800 transition-colors"
          disabled={loading}
        >
          {isLogin ? 'Behöver du ett konto? Registrera dig' : 'Har du redan ett konto? Logga in'}
        </button>
      </div>
    </div>
  );
};

export default AuthForm; 
import React, { useState } from 'react';
import { useAuth } from '../../firebase/AuthContext';
import { User } from 'firebase/auth';

interface AuthFormProps {
  onSuccess: (user: User | null) => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent, isSignUp: boolean) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const authFunction = isSignUp ? signUp : signIn;
      const userCredential = await authFunction(email, password);
      onSuccess(userCredential.user);
    } catch (error: any) {
      setError(error.message || 'Ett fel uppstod vid inloggning');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Logga in för att spela
          </h2>
        </div>
        <form className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                E-postadress
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-[#8bb8a8] focus:border-[#8bb8a8] focus:z-10 sm:text-sm"
                placeholder="E-postadress"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Lösenord
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-[#8bb8a8] focus:border-[#8bb8a8] focus:z-10 sm:text-sm"
                placeholder="Lösenord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isLoading}
              onClick={(e) => handleSubmit(e, false)}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#8bb8a8] hover:bg-[#7aa798] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8bb8a8]"
            >
              {isLoading ? 'Loggar in...' : 'Logga in'}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              onClick={(e) => handleSubmit(e, true)}
              className="group relative w-full flex justify-center py-2 px-4 border border-[#8bb8a8] text-sm font-medium rounded-md text-[#8bb8a8] bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8bb8a8]"
            >
              {isLoading ? 'Skapar konto...' : 'Skapa nytt konto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthForm; 
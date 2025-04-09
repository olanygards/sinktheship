import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../firebase/AuthContext';
import Navbar from './components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Sänka skepp',
  description: 'Ett klassiskt strategispel online',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen bg-gray-50 py-4">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

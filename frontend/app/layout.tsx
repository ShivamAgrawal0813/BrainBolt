/**
 * Root Layout
 */

import '@/styles/tokens.css';
import styles from './layout.module.css';
import Providers from './providers';
import { Navbar } from '@/components/ui/Navbar';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'BrainBolt — Adaptive Infinite Quiz',
  description:
    'Challenge yourself with BrainBolt, an adaptive infinite quiz that adjusts difficulty in real-time. Compete on leaderboards and track your performance.',
  keywords: ['quiz', 'adaptive', 'brain', 'leaderboard', 'math', 'challenge'],
  authors: [{ name: 'BrainBolt Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Navbar />
          <main className={styles.main}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

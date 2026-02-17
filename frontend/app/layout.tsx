/**
 * Root Layout
 */

import '@/styles/tokens.css';
import styles from './layout.module.css';
import Providers from './providers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BrainBolt — Adaptive Infinite Quiz',
  description:
    'Challenge yourself with BrainBolt, an adaptive infinite quiz that adjusts difficulty in real-time. Compete on leaderboards and track your performance.',
  keywords: ['quiz', 'adaptive', 'brain', 'leaderboard', 'math', 'challenge'],
  authors: [{ name: 'BrainBolt Team' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className={styles.container}>
            <header className={styles.header}>
              <h1 className={styles.logo}>⚡ BrainBolt</h1>
            </header>
            <main className={styles.main}>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

/**
 * Navbar Component
 * Responsive nav with links, user info, theme toggle, and logout
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import styles from './Navbar.module.css';

export const Navbar: React.FC = () => {
    const { state, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navLinks = state.isAuthenticated
        ? [
            { href: '/quiz', label: '🎯 Quiz', id: 'nav-quiz' },
            { href: '/leaderboard', label: '🏆 Leaderboard', id: 'nav-leaderboard' },
            { href: '/metrics', label: '📊 Metrics', id: 'nav-metrics' },
        ]
        : [];

    const handleLogout = () => {
        logout();
        setMobileOpen(false);
        window.location.href = '/login';
    };

    return (
        <header className={styles.header}>
            <div className={styles.inner}>
                <Link href="/" className={styles.logo} id="nav-logo">
                    <span className={styles.logoIcon}>⚡</span>
                    <span className={styles.logoText}>BrainBolt</span>
                </Link>

                {/* Desktop Nav */}
                <nav className={styles.desktopNav}>
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            id={link.id}
                            className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <div className={styles.actions}>
                    <button
                        onClick={toggleTheme}
                        className={styles.themeToggle}
                        aria-label="Toggle theme"
                        id="theme-toggle"
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    {state.isAuthenticated && (
                        <>
                            <span className={styles.username}>
                                {state.user?.username}
                            </span>
                            <button onClick={handleLogout} className={styles.logoutBtn} id="logout-btn">
                                Logout
                            </button>
                        </>
                    )}

                    {/* Mobile hamburger */}
                    <button
                        className={styles.hamburger}
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                    >
                        <span className={`${styles.bar} ${mobileOpen ? styles.barOpen : ''}`} />
                        <span className={`${styles.bar} ${mobileOpen ? styles.barOpen : ''}`} />
                        <span className={`${styles.bar} ${mobileOpen ? styles.barOpen : ''}`} />
                    </button>
                </div>
            </div>

            {/* Mobile Nav */}
            {mobileOpen && (
                <nav className={styles.mobileNav}>
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`${styles.mobileLink} ${pathname === link.href ? styles.active : ''}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            {link.label}
                        </Link>
                    ))}
                    {state.isAuthenticated && (
                        <button onClick={handleLogout} className={styles.mobileLogout}>
                            🚪 Logout
                        </button>
                    )}
                </nav>
            )}
        </header>
    );
};

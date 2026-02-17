/**
 * 404 Page — shown when no route matches
 */

import Link from 'next/link';
import { Card } from '@/components/ui/Card';

export default function NotFoundPage() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <Card>
                <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)', color: 'var(--color-text)' }}>
                    404 — Page Not Found
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                    The page you are looking for does not exist.
                </p>
                <Link
                    href="/"
                    style={{
                        display: 'inline-block',
                        padding: 'var(--spacing-sm) var(--spacing-lg)',
                        backgroundColor: 'var(--color-primary)',
                        color: '#fff',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 'var(--font-weight-medium)',
                        textDecoration: 'none',
                    }}
                >
                    Go Home
                </Link>
            </Card>
        </div>
    );
}

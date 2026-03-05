import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Customer Journey Intelligence Platform',
  description: 'Measure, automate, and optimize every stage of the customer lifecycle',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: '#0c1018',
          colorInputBackground: '#111827',
          colorInputText: '#f3f4f6',
          fontFamily: "'Outfit', sans-serif",
        },
      }}
    >
      <html lang="en">
        <body>
          <div
            className="fixed inset-0 pointer-events-none z-0"
            style={{
              background:
                'radial-gradient(ellipse at 10% 0%,rgba(244,114,182,.04),transparent 50%),radial-gradient(ellipse at 90% 100%,rgba(52,211,153,.03),transparent 50%)',
            }}
          />
          <div className="relative z-10">{children}</div>
        </body>
      </html>
    </ClerkProvider>
  );
}

'use client';

import { ReactNode } from 'react';
import CommandBar from '@/components/CommandBar';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  const handleNavigate = (page: string) => {
    if (page === 'dashboard') router.push('/dashboard');
    else if (page === 'sign-in') router.push('/sign-in');
    else router.push(`/dashboard`);
  };

  const handleCommand = async (cmd: string, args: string[]) => {
    if (cmd === 'list' && args[0] === 'stages') {
      return { type: 'info' as const, message: 'Awareness \u2192 Education \u2192 Acquisition \u2192 Onboarding \u2192 Product \u2192 Support \u2192 Retention' };
    }
    if (cmd === 'suggest') {
      return { type: 'info' as const, message: '**Suggestions:**\n1. Activate inactive stages\n2. Run pending ETL workflows\n3. Train untrained ML models\n4. Ask the AI expert for analysis' };
    }
    if (cmd === 'metrics') {
      return { type: 'info' as const, message: '**Platform Metrics:**\nUptime: 99.9%\nAPI Latency: 45ms\nDB Queries: 1.2k/min\nActive Sessions: 1' };
    }
    if (cmd === 'ai') {
      const query = args.join(' ');
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query, systemPrompt: 'You are a helpful data platform assistant. Be concise.' }),
        });
        const data = await res.json();
        return { type: 'success' as const, message: data.response || data.error };
      } catch (e: any) {
        return { type: 'error' as const, message: e.message };
      }
    }
    return { type: 'error' as const, message: `Unknown command: ${cmd} ${args.join(' ')}. Type "help" for available commands.` };
  };

  return (
    <div>
      {children}
      <CommandBar
        onNavigate={handleNavigate}
        onCommand={handleCommand}
        context={{ currentView: 'dashboard' }}
      />
    </div>
  );
}

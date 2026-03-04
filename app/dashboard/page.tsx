import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

export default function DashboardPage() {
  const { userId } = auth();
  if (!userId) redirect('/sign-in');

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-3xl font-bold text-gray-900">Customer Journey Intelligence Platform</h1>
      <p className="mt-2 text-gray-600">Welcome to your dashboard</p>
    </main>
  );
}

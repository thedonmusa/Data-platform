import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center" style={{ padding: 40 }}>
      <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 12 }}>
        Customer Journey Intelligence
      </div>
      <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-.04em', textAlign: 'center', lineHeight: 1.1, marginBottom: 8, color: '#f3f4f6' }}>
        Measure. Automate.
      </h1>
      <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-.04em', textAlign: 'center', lineHeight: 1.1, marginBottom: 32 }}>
        <span style={{ background: 'linear-gradient(135deg,#f472b6,#60a5fa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Every Stage.
        </span>
      </h1>
      <SignIn afterSignInUrl="/dashboard" signUpUrl="/sign-up" />
    </main>
  );
}

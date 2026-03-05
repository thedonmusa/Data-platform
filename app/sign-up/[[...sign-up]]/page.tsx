import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center" style={{ padding: 40 }}>
      <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 12 }}>
        Customer Journey Intelligence
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.04em', textAlign: 'center', lineHeight: 1.1, marginBottom: 32, color: '#f3f4f6' }}>
        Create Account
      </h1>
      <SignUp afterSignUpUrl="/dashboard" signInUrl="/sign-in" />
    </main>
  );
}

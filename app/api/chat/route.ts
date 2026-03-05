import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, systemPrompt, conversationHistory } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback to local response if no API key
      return NextResponse.json({ response: `I received your message: "${message}". To enable AI-powered responses, add your ANTHROPIC_API_KEY to Vercel environment variables.`, model: 'fallback' });
    }

    const messages = [
      ...(conversationHistory || []).slice(-20).map((m: any) => ({
        role: m.role === 'u' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt || 'You are a helpful data platform assistant.',
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Anthropic API error:', err);
      return NextResponse.json({ error: 'AI service error', details: err }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || 'No response generated.';

    return NextResponse.json({ response: text, model: data.model, usage: data.usage });
  } catch (e: any) {
    console.error('Chat API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

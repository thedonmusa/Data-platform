import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// Try models in order of preference
const MODELS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-haiku-20240307',
];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, systemPrompt, conversationHistory } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
    if (!apiKey) {
      return NextResponse.json({
        response: `No API key found. Add ANTHROPIC_API_KEY to Vercel env vars.`,
        model: 'fallback',
      });
    }

    const messages = [
      ...(conversationHistory || []).slice(-20).map((m: any) => ({
        role: m.role === 'u' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Try each model until one works
    for (const model of MODELS) {
      try {
        const res = await fetch(ANTHROPIC_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: systemPrompt || 'You are a helpful data platform assistant.',
            messages,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.content?.[0]?.text || 'No response generated.';
          return NextResponse.json({ response: text, model: data.model, usage: data.usage });
        }

        const errText = await res.text();
        console.error(`Model ${model} failed (${res.status}):`, errText);

        // If it's an auth error, don't try other models
        if (res.status === 401 || res.status === 403) {
          let parsed;
          try { parsed = JSON.parse(errText); } catch (_) {}
          const detail = parsed?.error?.message || errText;
          return NextResponse.json({
            response: `API key error: ${detail}\n\nCheck your ANTHROPIC_KEY in Vercel env vars. Make sure it starts with "sk-ant-".`,
            model: 'error',
          });
        }

        // If model not found, try next
        if (res.status === 404 || res.status === 400) continue;

        // Other errors — return detail
        let parsed;
        try { parsed = JSON.parse(errText); } catch (_) {}
        const detail = parsed?.error?.message || errText;
        return NextResponse.json({
          response: `Anthropic API error (${res.status}): ${detail}`,
          model: 'error',
        });
      } catch (fetchErr: any) {
        console.error(`Fetch error for model ${model}:`, fetchErr.message);
        continue;
      }
    }

    return NextResponse.json({
      response: 'All models failed. Check your API key and billing at console.anthropic.com.',
      model: 'error',
    });
  } catch (e: any) {
    console.error('Chat API error:', e);
    return NextResponse.json({ response: `Server error: ${e.message}`, model: 'error' });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Multi-provider AI Chat Route
 * Priority: Google Gemini (free) → Groq (free) → Anthropic (paid)
 * 
 * Env vars needed (add whichever you have):
 *   GEMINI_API_KEY    - Free at aistudio.google.com (recommended)
 *   GROQ_API_KEY      - Free at console.groq.com
 *   ANTHROPIC_KEY     - Paid at console.anthropic.com
 */

interface Provider {
  name: string;
  url: string;
  key: string | undefined;
  buildRequest: (messages: any[], system: string) => any;
  buildHeaders: (key: string) => Record<string, string>;
  extractResponse: (data: any) => string;
}

function getProviders(): Provider[] {
  return [
    // 1. Google Gemini — FREE, no credit card, generous limits
    {
      name: 'gemini',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY || ''}`,
      key: process.env.GEMINI_API_KEY,
      buildHeaders: () => ({ 'Content-Type': 'application/json' }),
      buildRequest: (messages, system) => ({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
      extractResponse: (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.',
    },
    // 2. Groq — FREE, extremely fast, 14,400 req/day
    {
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: process.env.GROQ_API_KEY,
      buildHeaders: (key) => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      }),
      buildRequest: (messages, system) => ({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: 1024,
        temperature: 0.7,
      }),
      extractResponse: (data) => data?.choices?.[0]?.message?.content || 'No response.',
    },
    // 3. Anthropic — Paid, highest quality
    {
      name: 'anthropic',
      url: 'https://api.anthropic.com/v1/messages',
      key: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY,
      buildHeaders: (key) => ({
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      }),
      buildRequest: (messages, system) => ({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system,
        messages,
      }),
      extractResponse: (data) => data?.content?.[0]?.text || 'No response.',
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, systemPrompt, conversationHistory } = await req.json();
    const system = systemPrompt || 'You are a helpful data platform assistant. Be concise.';

    const messages = [
      ...(conversationHistory || []).slice(-20).map((m: any) => ({
        role: m.role === 'u' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const providers = getProviders().filter(p => p.key);

    if (providers.length === 0) {
      return NextResponse.json({
        response: 'No AI provider configured. Add one of these env vars in Vercel:\n\n' +
          '  GEMINI_API_KEY  → Free at aistudio.google.com\n' +
          '  GROQ_API_KEY    → Free at console.groq.com\n' +
          '  ANTHROPIC_KEY   → Paid at console.anthropic.com',
        model: 'none',
      });
    }

    // Try each provider in priority order
    const errors: string[] = [];
    for (const provider of providers) {
      try {
        const url = provider.name === 'gemini' ? provider.url : provider.url;
        const res = await fetch(provider.url, {
          method: 'POST',
          headers: provider.buildHeaders(provider.key!),
          body: JSON.stringify(provider.buildRequest(messages, system)),
        });

        if (res.ok) {
          const data = await res.json();
          const text = provider.extractResponse(data);
          return NextResponse.json({ response: text, model: provider.name });
        }

        const errText = await res.text();
        const shortErr = errText.slice(0, 200);
        console.error(`[${provider.name}] ${res.status}: ${shortErr}`);
        errors.push(`${provider.name}: ${res.status}`);
      } catch (e: any) {
        console.error(`[${provider.name}] fetch error:`, e.message);
        errors.push(`${provider.name}: ${e.message}`);
      }
    }

    return NextResponse.json({
      response: `All AI providers failed:\n${errors.join('\n')}\n\nCheck your API keys in Vercel env vars.`,
      model: 'error',
    });
  } catch (e: any) {
    console.error('Chat API error:', e);
    return NextResponse.json({ response: `Server error: ${e.message}`, model: 'error' });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * AI Chat Route — uses Supabase Edge Function as primary provider.
 * The Gemini API key lives in Supabase secrets (set via dashboard),
 * bypassing Vercel env var copy-paste issues entirely.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rotcfnovswofzjbwxlma.supabase.co';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, systemPrompt, conversationHistory } = await req.json();
    const system = systemPrompt || 'You are a helpful data platform assistant. Be concise.';

    // Primary: Supabase Edge Function (Gemini key stored in Supabase secrets)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, systemPrompt: system }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          return NextResponse.json({ response: data.response, model: data.model || 'gemini' });
        }
      }

      // If edge function failed, log and try fallbacks
      const errText = await res.text();
      console.error('[supabase-edge]', res.status, errText.slice(0, 300));

      // Return the detailed error so we can debug
      let parsed;
      try { parsed = JSON.parse(errText); } catch (_) {}
      const detail = parsed?.error || parsed?.details || errText.slice(0, 200);

      // Try Vercel-side fallbacks
      const errors: string[] = [`supabase-edge: ${res.status} - ${detail}`];

      // Fallback: Gemini via Vercel env var
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const gRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: { text: system } },
                contents: [{ role: 'user', parts: [{ text: message }] }],
                generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
              }),
            }
          );
          if (gRes.ok) {
            const gData = await gRes.json();
            const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
            return NextResponse.json({ response: text, model: 'gemini-vercel' });
          }
          errors.push(`gemini-vercel: ${gRes.status}`);
        } catch (e: any) {
          errors.push(`gemini-vercel: ${e.message}`);
        }
      }

      // Fallback: Groq
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey) {
        try {
          const qRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'system', content: system }, { role: 'user', content: message }],
              max_tokens: 1024,
            }),
          });
          if (qRes.ok) {
            const qData = await qRes.json();
            return NextResponse.json({ response: qData?.choices?.[0]?.message?.content || 'No response.', model: 'groq' });
          }
          errors.push(`groq: ${qRes.status}`);
        } catch (e: any) {
          errors.push(`groq: ${e.message}`);
        }
      }

      return NextResponse.json({
        response: `AI providers failed:\n${errors.join('\n')}`,
        model: 'error',
      });
    } catch (e: any) {
      return NextResponse.json({
        response: `Edge function error: ${e.message}`,
        model: 'error',
      });
    }
  } catch (e: any) {
    return NextResponse.json({ response: `Server error: ${e.message}`, model: 'error' });
  }
}

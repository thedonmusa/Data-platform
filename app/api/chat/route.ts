import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, systemPrompt, conversationHistory } = await req.json();
    const system = systemPrompt || 'You are a helpful data platform assistant. Be concise.';

    // Build OpenAI-style messages
    const chatMessages = [
      ...(conversationHistory || []).slice(-20).map((m: any) => ({
        role: m.role === 'u' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;

    if (!geminiKey && !groqKey && !anthropicKey) {
      return NextResponse.json({
        response: 'No AI provider configured. Add GEMINI_API_KEY (free) to Vercel env vars.',
        model: 'none',
      });
    }

    const errors: string[] = [];

    // 1. Try Google Gemini (FREE)
    if (geminiKey) {
      try {
        // Build Gemini-format contents - must alternate user/model
        const geminiContents: any[] = [];
        for (const m of chatMessages) {
          const role = m.role === 'user' ? 'user' : 'model';
          // Gemini requires alternating roles - merge consecutive same-role messages
          if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
            geminiContents[geminiContents.length - 1].parts[0].text += '\n' + m.content;
          } else {
            geminiContents.push({ role, parts: [{ text: m.content }] });
          }
        }
        // Gemini requires first message to be from user
        if (geminiContents.length > 0 && geminiContents[0].role !== 'user') {
          geminiContents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: { text: system } },
              contents: geminiContents,
              generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
          return NextResponse.json({ response: text, model: 'gemini' });
        }
        const err = await res.text();
        console.error('[gemini]', res.status, err.slice(0, 300));
        errors.push(`gemini: ${res.status} - ${err.slice(0, 100)}`);
      } catch (e: any) {
        errors.push(`gemini: ${e.message}`);
      }
    }

    // 2. Try Groq (FREE)
    if (groqKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: system }, ...chatMessages],
            max_tokens: 1024,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({ response: data?.choices?.[0]?.message?.content || 'No response.', model: 'groq' });
        }
        const err = await res.text();
        errors.push(`groq: ${res.status}`);
      } catch (e: any) {
        errors.push(`groq: ${e.message}`);
      }
    }

    // 3. Try Anthropic (PAID)
    if (anthropicKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1024, system, messages: chatMessages }),
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({ response: data?.content?.[0]?.text || 'No response.', model: 'anthropic' });
        }
        const err = await res.text();
        errors.push(`anthropic: ${res.status}`);
      } catch (e: any) {
        errors.push(`anthropic: ${e.message}`);
      }
    }

    return NextResponse.json({
      response: `All AI providers failed:\n${errors.join('\n')}`,
      model: 'error',
    });
  } catch (e: any) {
    return NextResponse.json({ response: `Server error: ${e.message}`, model: 'error' });
  }
}

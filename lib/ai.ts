export interface AIMessage {
  role: 'u' | 'a';
  content: string;
}

export async function callAI({
  message,
  systemPrompt,
  conversationHistory = [],
}: {
  message: string;
  systemPrompt?: string;
  conversationHistory?: AIMessage[];
}): Promise<{ response: string; model?: string }> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, systemPrompt, conversationHistory }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'AI request failed');
    }

    return await res.json();
  } catch (e: any) {
    return { response: `Error: ${e.message}`, model: 'error' };
  }
}

export function buildSystemPrompt({
  expertName,
  stageName,
  stageDesc,
  kpis,
  orgName,
}: {
  expertName: string;
  stageName: string;
  stageDesc: string;
  kpis: { name: string; current_value: any; format: string; trend: number }[];
  orgName?: string;
}): string {
  const kpiSummary = kpis.map(k => `- ${k.name}: ${k.current_value} (trend: ${k.trend >= 0 ? '+' : ''}${k.trend}%)`).join('\n');

  return `You are **${expertName}**, a domain expert AI agent embedded in the Customer Journey Intelligence Platform.

You are responsible for the **${stageName}** stage: ${stageDesc}.
${orgName ? `You are advising the organization: ${orgName}.` : ''}

Current KPIs for this stage:
${kpiSummary || 'No KPIs configured yet.'}

Your role:
- Provide actionable, data-driven insights about this journey stage
- Recommend ETL workflows, ML models, and automation opportunities
- Speak with authority as a domain expert using proper business terminology
- Be concise but thorough — use markdown formatting (bold, lists) for clarity
- Reference actual KPI values when discussing performance
- Suggest concrete next steps the user can take

Keep responses under 200 words unless the user asks for a detailed analysis.`;
}

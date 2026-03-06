/**
 * Mode Classifier for the Data Platform
 * Adapted from Kiro's intent classification system.
 * 
 * Classifies user input into three modes:
 * - DO: Execute an action (create, build, run, deploy)
 * - SPEC: Work with specifications (create spec, approve, review)
 * - QUERY: Ask a question (what is, how does, explain)
 */

export interface ClassificationResult {
  do: number;
  spec: number;
  query: number;
  recommended: 'do' | 'spec' | 'query';
}

export function classifyUserIntent(message: string, conversationContext?: string[]): ClassificationResult {
  const m = message.toLowerCase().trim();
  
  let doScore = 0.3; // Default slight bias toward do
  let specScore = 0.1;
  let queryScore = 0.1;
  
  // === SPEC indicators ===
  if (/\b(spec|specification)\b/.test(m)) specScore += 0.4;
  if (/\b(requirements?|acceptance criteria|user stor)/.test(m)) specScore += 0.3;
  if (/\b(design document|architecture|implementation plan)\b/.test(m)) specScore += 0.25;
  if (/\b(start task|next task|execute task)\b/.test(m)) specScore += 0.35;
  if (/\b(approve|looks good|move on|proceed)\b/.test(m)) specScore += 0.2;
  if (/\b(rollback|version|iteration|history)\b/.test(m) && /\bspec\b/.test(m)) specScore += 0.3;
  
  // === QUERY indicators ===
  if (/^(what|how|why|when|where|who|which|can you explain)\b/.test(m)) queryScore += 0.4;
  if (/\?$/.test(m)) queryScore += 0.2;
  if (/\b(explain|describe|tell me|show me|list|compare)\b/.test(m)) queryScore += 0.3;
  if (/\b(status|overview|summary|report)\b/.test(m)) queryScore += 0.2;
  
  // === DO indicators ===
  if (/^(create|build|fix|update|delete|run|deploy|activate|train|configure|set up|add|remove|install)\b/.test(m)) doScore += 0.4;
  if (/\b(file|code|function|component|api|database|table|column)\b/.test(m)) doScore += 0.15;
  if (/\b(pipeline|workflow|model|etl|ml)\b/.test(m) && !/\bspec\b/.test(m)) doScore += 0.2;
  
  // Context from conversation history
  if (conversationContext?.length) {
    const lastMsg = conversationContext[conversationContext.length - 1]?.toLowerCase() || '';
    if (lastMsg.includes('requirements look good') || lastMsg.includes('move on to design')) specScore += 0.3;
    if (lastMsg.includes('design look good') || lastMsg.includes('implementation plan')) specScore += 0.3;
    if (lastMsg.includes('tasks look good')) specScore += 0.3;
  }
  
  // Normalize to sum to 1
  const total = doScore + specScore + queryScore;
  const result: ClassificationResult = {
    do: doScore / total,
    spec: specScore / total,
    query: queryScore / total,
    recommended: 'do',
  };
  
  if (result.spec > result.do && result.spec > result.query) result.recommended = 'spec';
  else if (result.query > result.do) result.recommended = 'query';
  
  return result;
}

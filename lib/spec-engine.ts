/**
 * Spec-Driven Development Engine
 * Adapted from Kiro's spec workflow for the Data Platform.
 * 
 * Workflow: Requirements → Design → Tasks
 * Each phase requires explicit user approval before proceeding.
 */

export type SpecPhase = 'requirements' | 'design' | 'tasks' | 'executing' | 'complete';
export type SpecStatus = 'draft' | 'approved' | 'in_progress' | 'complete';

export interface SpecRequirement {
  id: string;
  userStory: string; // As a [role], I want [feature], so that [benefit]
  acceptanceCriteria: string[]; // EARS format: WHEN [event] THEN [system] SHALL [response]
  priority: 'must' | 'should' | 'could';
}

export interface SpecDesign {
  overview: string;
  architecture: string;
  components: { name: string; description: string; interfaces: string[] }[];
  dataModels: { name: string; fields: { name: string; type: string; description: string }[] }[];
  errorHandling: string;
  testingStrategy: string;
}

export interface SpecTask {
  id: string;
  title: string;
  description: string;
  subtasks: { id: string; title: string; done: boolean }[];
  requirementRefs: string[]; // References to requirement IDs
  done: boolean;
}

export interface ProjectSpec {
  id: string;
  name: string;
  phase: SpecPhase;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  
  // Phase documents
  requirements: {
    status: SpecStatus;
    introduction: string;
    items: SpecRequirement[];
    approvedAt?: string;
  };
  design: {
    status: SpecStatus;
    document?: SpecDesign;
    approvedAt?: string;
  };
  tasks: {
    status: SpecStatus;
    items: SpecTask[];
    approvedAt?: string;
  };
  
  // Metadata
  domain?: string; // auto-detected or user-specified
  iterations: SpecIteration[];
  conversations: SpecConversation[];
}

export interface SpecIteration {
  version: number;
  timestamp: string;
  author: string;
  phase: SpecPhase;
  changeType: 'creation' | 'modification' | 'approval' | 'rollback';
  summary: string;
}

export interface SpecConversation {
  timestamp: string;
  role: 'user' | 'assistant';
  content: string;
  phase: SpecPhase;
}

// Mode classifier - determines if user input is a "do" action or "spec" action
export function classifyIntent(message: string): { mode: 'do' | 'spec' | 'query'; confidence: number } {
  const m = message.toLowerCase().trim();
  
  // Spec mode triggers
  const specTriggers = [
    'create a spec', 'create spec', 'new spec', 'generate spec',
    'specification', 'requirements', 'start task', 'next task',
    'execute task', 'approve', 'show spec', 'spec history',
    'rollback spec', 'design document', 'implementation plan',
  ];
  
  // Query mode triggers  
  const queryTriggers = [
    'what is', 'how does', 'explain', 'tell me', 'show me',
    'list', 'status', 'help', 'describe', 'compare',
  ];
  
  // Do mode triggers
  const doTriggers = [
    'create', 'build', 'fix', 'update', 'delete', 'run',
    'deploy', 'activate', 'train', 'configure', 'set up',
  ];
  
  const specScore = specTriggers.filter(t => m.includes(t)).length;
  const queryScore = queryTriggers.filter(t => m.startsWith(t) || m.includes(t)).length;
  const doScore = doTriggers.filter(t => m.startsWith(t)).length;
  
  if (specScore > 0 && specScore >= doScore) return { mode: 'spec', confidence: Math.min(0.9, 0.5 + specScore * 0.15) };
  if (queryScore > doScore) return { mode: 'query', confidence: Math.min(0.9, 0.5 + queryScore * 0.15) };
  return { mode: 'do', confidence: 0.8 };
}

// Build system prompt for spec-driven AI interactions
export function buildSpecSystemPrompt(spec: ProjectSpec | null, phase: SpecPhase): string {
  if (!spec) {
    return `You are a Spec-Driven Development assistant for the Data Platform.

You help users create structured specifications for data projects following this workflow:
1. **Requirements** - Gather and formalize requirements in EARS format (user stories + acceptance criteria)
2. **Design** - Create architecture, data models, components, and testing strategy
3. **Tasks** - Break design into actionable implementation tasks with checkboxes

Each phase requires user approval before proceeding to the next.

When the user wants to create a new spec, start by understanding their feature idea, then generate initial requirements.
Format requirements as user stories with EARS acceptance criteria.
Be concise but thorough. Use markdown formatting.`;
  }

  const phaseInstructions: Record<SpecPhase, string> = {
    requirements: `You are in the REQUIREMENTS phase for spec "${spec.name}".

Current requirements:
${spec.requirements.items.map(r => `- ${r.id}: ${r.userStory}\n  Criteria: ${r.acceptanceCriteria.join('; ')}`).join('\n')}

Help the user refine these requirements. After changes, ask: "Do the requirements look good? If so, we can move to design."
Only proceed to design after explicit approval.`,
    
    design: `You are in the DESIGN phase for spec "${spec.name}".

Requirements (approved):
${spec.requirements.items.map(r => `- ${r.id}: ${r.userStory}`).join('\n')}

${spec.design.document ? `Current design overview: ${spec.design.document.overview}` : 'No design document yet.'}

Create or refine the design document covering: Overview, Architecture, Components, Data Models, Error Handling, Testing Strategy.
After changes, ask: "Does the design look good? If so, we can create the implementation plan."`,
    
    tasks: `You are in the TASKS phase for spec "${spec.name}".

Create actionable implementation tasks based on the design. Each task should:
- Have a clear coding objective
- Reference specific requirements
- Be executable incrementally
- Follow test-driven development where appropriate

After changes, ask: "Do the tasks look good?"`,
    
    executing: `You are EXECUTING tasks for spec "${spec.name}".

Task list:
${spec.tasks.items.map(t => `- [${t.done ? 'x' : ' '}] ${t.id}: ${t.title}`).join('\n')}

Focus on ONE task at a time. After completing a task, stop and let the user review.
Do NOT automatically proceed to the next task.`,
    
    complete: `Spec "${spec.name}" is complete. All tasks have been implemented.
You can help with questions about the spec, or suggest improvements.`,
  };

  return `You are a Spec-Driven Development assistant for the Data Platform.

${phaseInstructions[phase]}

Rules:
- Be concise and actionable
- Use markdown formatting
- Reference specific requirements when discussing design or tasks
- One task at a time during execution
- Always ask for explicit approval before phase transitions`;
}

// Create a new empty spec
export function createEmptySpec(name: string, userId: string): ProjectSpec {
  const id = `spec_${Date.now()}`;
  return {
    id,
    name,
    phase: 'requirements',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
    requirements: { status: 'draft', introduction: '', items: [] },
    design: { status: 'draft' },
    tasks: { status: 'draft', items: [] },
    iterations: [{ version: 1, timestamp: new Date().toISOString(), author: userId, phase: 'requirements', changeType: 'creation', summary: 'Spec created' }],
    conversations: [],
  };
}

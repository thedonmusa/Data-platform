'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface CommandResult {
  type: 'success' | 'error' | 'info' | 'warning' | 'nav';
  message: string;
  data?: any;
}

interface CommandBarProps {
  onNavigate?: (page: string) => void;
  onCommand?: (cmd: string, args: string[]) => CommandResult | Promise<CommandResult>;
  context?: {
    currentView: string;
    orgName?: string;
    activeStages?: number;
    totalKPIs?: number;
  };
}

const COMMANDS: { cmd: string; desc: string; category: string }[] = [
  // Navigation
  { cmd: 'go dashboard', desc: 'Navigate to dashboard', category: 'Navigation' },
  { cmd: 'go stages', desc: 'View all journey stages', category: 'Navigation' },
  // Data
  { cmd: 'status', desc: 'Show system status', category: 'System' },
  { cmd: 'list stages', desc: 'List all journey stages', category: 'Data' },
  { cmd: 'list kpis', desc: 'List all KPIs', category: 'Data' },
  { cmd: 'list models', desc: 'List all ML models', category: 'Data' },
  { cmd: 'list workflows', desc: 'List all ETL workflows', category: 'Data' },
  // Spec
  { cmd: 'show spec', desc: 'Display current project spec', category: 'Spec' },
  { cmd: 'show history', desc: 'Show iteration history', category: 'Spec' },
  { cmd: 'export spec', desc: 'Export spec as JSON', category: 'Spec' },
  // AI
  { cmd: 'ai', desc: 'Ask the AI assistant anything', category: 'AI' },
  { cmd: 'suggest', desc: 'Get contextual suggestions', category: 'AI' },
  // Operations
  { cmd: 'run pipeline', desc: 'Execute data pipeline', category: 'Operations' },
  { cmd: 'metrics', desc: 'Show performance metrics', category: 'Operations' },
  // System
  { cmd: 'help', desc: 'Show all commands', category: 'System' },
  { cmd: 'clear', desc: 'Clear terminal', category: 'System' },
  { cmd: 'version', desc: 'Show version info', category: 'System' },
];

export default function CommandBar({ onNavigate, onCommand, context }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{ input: string; result: CommandResult }[]>([]);
  const [suggestions, setSuggestions] = useState<typeof COMMANDS>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [mode, setMode] = useState<'command' | 'terminal'>('command');
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalEnd = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setInput('');
        setSuggestions(COMMANDS);
        setSelectedSuggestion(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    terminalEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Filter suggestions
  useEffect(() => {
    if (!input.trim()) { setSuggestions(COMMANDS); setSelectedSuggestion(0); return; }
    const q = input.toLowerCase();
    const filtered = COMMANDS.filter(c => c.cmd.includes(q) || c.desc.toLowerCase().includes(q));
    setSuggestions(filtered);
    setSelectedSuggestion(0);
  }, [input]);

  const executeCommand = useCallback(async (cmdStr: string) => {
    const trimmed = cmdStr.trim().toLowerCase();
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    let result: CommandResult;

    // Built-in commands
    if (trimmed === 'help') {
      const grouped: Record<string, typeof COMMANDS> = {};
      COMMANDS.forEach(c => { if (!grouped[c.category]) grouped[c.category] = []; grouped[c.category].push(c); });
      const helpText = Object.entries(grouped).map(([cat, cmds]) => `**${cat}**\n${cmds.map(c => `  ${c.cmd} — ${c.desc}`).join('\n')}`).join('\n\n');
      result = { type: 'info', message: helpText };
    } else if (trimmed === 'clear') {
      setHistory([]); return;
    } else if (trimmed === 'version') {
      result = { type: 'info', message: 'Data Platform v0.2.0 — Next.js 14 + Clerk + Supabase + Claude AI' };
    } else if (trimmed === 'status') {
      result = { type: 'info', message: `**System Status**\nView: ${context?.currentView || 'unknown'}\nOrg: ${context?.orgName || 'none'}\nActive Stages: ${context?.activeStages || 0}/7\nKPIs: ${context?.totalKPIs || 0}` };
    } else if (cmd === 'go' && args[0]) {
      onNavigate?.(args[0]);
      result = { type: 'nav', message: `Navigating to ${args[0]}...` };
    } else if (trimmed.startsWith('ai ')) {
      const query = cmdStr.trim().slice(3);
      result = { type: 'info', message: `Asking AI: "${query}"...` };
      // Will be handled by parent via onCommand
      if (onCommand) {
        const aiResult = await onCommand('ai', [query]);
        result = aiResult;
      }
    } else if (onCommand) {
      result = await onCommand(cmd, args);
    } else {
      result = { type: 'error', message: `Unknown command: ${trimmed}. Type "help" for available commands.` };
    }

    setHistory(prev => [...prev, { input: cmdStr.trim(), result }]);
  }, [onCommand, onNavigate, context]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    if (mode === 'command' && suggestions.length > 0 && !input.includes(' ')) {
      // Auto-complete from suggestion
      setInput(suggestions[selectedSuggestion].cmd + ' ');
      return;
    }
    executeCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestion(prev => Math.max(prev - 1, 0)); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions[selectedSuggestion]) setInput(suggestions[selectedSuggestion].cmd + ' ');
    }
    else if (e.key === 'Enter') handleSubmit();
  };

  const renderMarkdown = (text: string) => text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--br)">$1</strong>').replace(/\n/g, '<br/>');

  if (!open) return (
    <button onClick={() => { setOpen(true); setInput(''); setSuggestions(COMMANDS); }} className="flex items-center gap-2" style={{ position: 'fixed', bottom: 20, right: 20, padding: '8px 14px', background: 'rgba(15,20,30,.9)', border: '1px solid var(--bd)', borderRadius: 10, color: 'var(--dim)', fontSize: 11, cursor: 'pointer', backdropFilter: 'blur(12px)', zIndex: 999 }}>
      <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>⌘K</span>
      <span>Command</span>
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }}>
      {/* Backdrop */}
      <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} />
      {/* Modal */}
      <div className="fi" style={{ position: 'relative', width: '100%', maxWidth: 640, background: '#0c1018', border: '1px solid var(--bd)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,.5)' }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--bd)', gap: 10 }}>
          <span style={{ color: '#3b82f6', fontSize: 14 }}>{'>'}</span>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type a command or search..." autoFocus style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--br)', fontSize: 14, fontFamily: "'IBM Plex Mono',monospace" }} />
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--bd)', color: 'var(--dim)' }}>ESC</span>
        </div>

        {/* Terminal history */}
        {history.length > 0 && (
          <div className="st" style={{ maxHeight: 200, overflow: 'auto', padding: '8px 18px', borderBottom: '1px solid var(--bd)' }}>
            {history.map((h, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#3b82f6', fontFamily: "'IBM Plex Mono',monospace" }}>{'>'} {h.input}</div>
                <div style={{ fontSize: 11, color: h.result.type === 'error' ? '#f87171' : h.result.type === 'warning' ? '#fbbf24' : h.result.type === 'success' ? '#34d399' : 'var(--tx)', fontFamily: "'IBM Plex Mono',monospace", marginTop: 2, paddingLeft: 12 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(h.result.message) }} />
              </div>
            ))}
            <div ref={terminalEnd} />
          </div>
        )}

        {/* Suggestions */}
        <div style={{ maxHeight: 280, overflow: 'auto' }}>
          {suggestions.length === 0 && input.trim() && (
            <div style={{ padding: '14px 18px', fontSize: 12, color: 'var(--dim)' }}>No matching commands. Type "help" for all commands.</div>
          )}
          {suggestions.map((s, i) => (
            <button key={s.cmd} onClick={() => { setInput(s.cmd + ' '); inputRef.current?.focus(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 18px', border: 'none', background: i === selectedSuggestion ? 'rgba(59,130,246,.08)' : 'transparent', cursor: 'pointer', textAlign: 'left', borderLeft: i === selectedSuggestion ? '2px solid #3b82f6' : '2px solid transparent' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--br)', fontFamily: "'IBM Plex Mono',monospace" }}>{s.cmd}</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>{s.desc}</div>
              </div>
              <span style={{ fontSize: 8, color: 'var(--dim)', padding: '2px 6px', borderRadius: 3, background: 'var(--sf)' }}>{s.category}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 18px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 12, justifyContent: 'center' }}>
          {[{ k: '↑↓', l: 'Navigate' }, { k: 'Tab', l: 'Complete' }, { k: '↵', l: 'Execute' }, { k: 'Esc', l: 'Close' }].map(x => (
            <div key={x.k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--bd)', color: 'var(--dim)', fontFamily: "'IBM Plex Mono',monospace" }}>{x.k}</span>
              <span style={{ fontSize: 9, color: '#374151' }}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useAuth, UserButton } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { STAGES, generateKPIValue, formatValue, getAgentReply, StageConfig, StageData } from '@/lib/stages';
import { callAI, buildSystemPrompt } from '@/lib/ai';

interface TermLine {
  id: string;
  type: 'input' | 'output' | 'system' | 'error' | 'success' | 'ai' | 'divider' | 'kpi' | 'welcome';
  content: string;
  time?: Date;
  color?: string;
}

export default function DashboardPage() {
  const { user } = useUser();
  const { userId } = useAuth();
  const [org, setOrg] = useState<any>(null);
  const [sd, setSd] = useState<Record<string, StageData>>({});
  const [activeSid, setActiveSid] = useState<string | null>(null);
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stageConfig = useMemo(() => STAGES.find(s => s.id === activeSid) || null, [activeSid]);
  const activeCount = useMemo(() => Object.values(sd).filter(d => d.db?.status === 'active').length, [sd]);
  const journeyScore = Math.round((activeCount / 7) * 100);
  const totalKPIs = Object.values(sd).reduce((n, d) => n + (d.kpis?.length || 0), 0);

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const push = useCallback((...newLines: Omit<TermLine, 'id'>[]) => {
    setLines(prev => [...prev, ...newLines.map(l => ({ ...l, id: uid() }))]);
  }, []);

  useEffect(() => { termRef.current?.scrollTo({ top: termRef.current.scrollHeight, behavior: 'smooth' }); }, [lines]);
  useEffect(() => { inputRef.current?.focus(); }, [lines, ready]);

  const loadAll = useCallback(async (orgId: string) => {
    const [{ data: stages }, { data: kpis }, { data: etls }, { data: mls }, { data: sources }] = await Promise.all([
      supabase.from('journey_stages').select('*').eq('org_id', orgId),
      supabase.from('kpis').select('*').eq('org_id', orgId),
      supabase.from('etl_workflows').select('*').eq('org_id', orgId),
      supabase.from('ml_workflows').select('*').eq('org_id', orgId),
      supabase.from('data_sources').select('*').eq('org_id', orgId),
    ]);
    const result: Record<string, StageData> = {};
    for (const s of STAGES) {
      const db = (stages || []).find((x: any) => x.stage === s.id);
      result[s.id] = {
        db,
        kpis: (kpis || []).filter((k: any) => db && k.stage_id === db.id),
        etl_workflows: (etls || []).filter((w: any) => db && w.stage_id === db.id),
        ml_workflows: (mls || []).filter((w: any) => db && w.stage_id === db.id),
        data_sources: (sources || []).filter((d: any) => db && d.stage_id === db.id),
      };
    }
    setSd(result);
    return result;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: orgs } = await supabase.from('organizations').select('*').limit(1);
        if (orgs?.length) { setOrg(orgs[0]); await loadAll(orgs[0].id); }
      } catch (e: any) { console.error(e); }
      setReady(true);
    })();
  }, [loadAll]);

  useEffect(() => {
    if (!ready) return;
    const name = user?.firstName || 'operator';
    push(
      { type: 'welcome', content: `\n  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n  \u2551   CUSTOMER JOURNEY INTELLIGENCE ENGINE  v0.2.0     \u2551\n  \u2551   Spec-Driven \u00b7 AI-Powered \u00b7 Supabase Backend      \u2551\n  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n` },
      { type: 'system', content: `  Welcome, ${name}. ${org ? `Org: ${org.name} \u00b7 ${activeCount}/7 stages active \u00b7 ${totalKPIs} KPIs` : 'No organization found.'}` },
      { type: 'system', content: org ? '  Type "help" for commands, or "ai <question>" to talk to Claude.' : '  Type "init" to initialize your journey.' },
      { type: 'divider', content: '' },
    );
  }, [ready]);

  const createOrg = async () => {
    const name = user?.fullName ? `${user.fullName}'s Org` : 'My Organization';
    push({ type: 'system', content: `Creating organization "${name}"...` });
    const { data: orgs, error: err } = await supabase.from('organizations').insert({ name, owner_id: userId }).select();
    if (err) { push({ type: 'error', content: `Error: ${err.message}` }); return; }
    const newOrg = orgs![0]; setOrg(newOrg);
    await supabase.from('journey_stages').insert(STAGES.map(s => ({ org_id: newOrg.id, stage: s.id, status: 'not_configured', expert_name: s.expert, config: { desc: s.desc } })));
    await loadAll(newOrg.id);
    push({ type: 'success', content: `\u2713 Organization created: ${newOrg.name}` }, { type: 'system', content: '  7 journey stages initialized. Type "stages" to view, or "activate <stage>" to activate one.' });
  };

  const activateStage = async (stageId: string) => {
    if (!org) { push({ type: 'error', content: 'No organization. Type "init" first.' }); return; }
    const s = STAGES.find(x => x.id === stageId);
    if (!s) { push({ type: 'error', content: `Unknown stage: ${stageId}. Type "stages" to see available stages.` }); return; }
    const d = sd[stageId];
    if (!d?.db) { push({ type: 'error', content: `Stage ${stageId} not found in database.` }); return; }
    if (d.db.status === 'active') { push({ type: 'system', content: `${s.label} is already active.` }); return; }
    push({ type: 'system', content: `Activating ${s.icon} ${s.label}...` });
    const rowCount = Math.round(2000 + Math.random() * 15000);
    await supabase.from('journey_stages').update({ status: 'active' }).eq('id', d.db.id);
    await supabase.from('data_sources').insert({ org_id: org.id, stage_id: d.db.id, name: `${s.label} Data`, source_type: 'csv', row_count: rowCount, column_count: Math.round(8 + Math.random() * 12) });
    const { data: createdKPIs } = await supabase.from('kpis').insert(s.kpis.map(k => ({ org_id: org.id, stage_id: d.db.id, name: k.name, formula: k.formula, format: k.format, current_value: generateKPIValue(k.format), trend: Math.round(-15 + Math.random() * 30) }))).select();
    const history: any[] = [];
    for (const k of (createdKPIs || [])) { for (let i = 13; i >= 0; i--) { const start = new Date(); start.setDate(start.getDate() - i); const end = new Date(start); end.setDate(end.getDate() + 1); history.push({ kpi_id: k.id, value: generateKPIValue(k.format), period_start: start.toISOString(), period_end: end.toISOString() }); } }
    if (history.length) await supabase.from('kpi_history').insert(history);
    await supabase.from('etl_workflows').insert(s.etls.map(name => ({ org_id: org.id, stage_id: d.db.id, name, status: 'ready', total_runs: 0 })));
    await supabase.from('ml_workflows').insert(s.mls.map(name => ({ org_id: org.id, stage_id: d.db.id, name, status: 'untrained', total_predictions: 0 })));
    await loadAll(org.id);
    push({ type: 'success', content: `\u2713 ${s.icon} ${s.label} activated` }, { type: 'kpi', content: `  ${s.kpis.length} KPIs \u00b7 ${s.etls.length} ETL workflows \u00b7 ${s.mls.length} ML models \u00b7 ${rowCount.toLocaleString()} records` });
  };

  const handleCommand = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setCmdHistory(prev => [trimmed, ...prev].slice(0, 50));
    setHistIdx(-1);
    push({ type: 'input', content: trimmed, time: new Date() });
    setLoading(true);
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');
    try {
      if (cmd === 'help') {
        push({ type: 'system', content: '\n  \u250c\u2500 NAVIGATION \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510' }, { type: 'system', content: '  \u2502  stages          List all 7 journey stages       \u2502' }, { type: 'system', content: '  \u2502  activate <id>   Activate a stage                 \u2502' }, { type: 'system', content: '  \u2502  open <id>       Set active stage for AI chat      \u2502' }, { type: 'system', content: '  \u251c\u2500 DATA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524' }, { type: 'system', content: '  \u2502  kpis            Show all KPIs                    \u2502' }, { type: 'system', content: '  \u2502  workflows       List ETL workflows               \u2502' }, { type: 'system', content: '  \u2502  models          List ML models                   \u2502' }, { type: 'system', content: '  \u2502  run <name>      Run an ETL workflow               \u2502' }, { type: 'system', content: '  \u2502  train <name>    Train an ML model                 \u2502' }, { type: 'system', content: '  \u251c\u2500 AI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524' }, { type: 'system', content: '  \u2502  ai <query>      Ask Claude AI anything            \u2502' }, { type: 'system', content: '  \u2502  ask <query>     Chat with active stage expert     \u2502' }, { type: 'system', content: '  \u251c\u2500 SYSTEM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524' }, { type: 'system', content: '  \u2502  init            Initialize journey                \u2502' }, { type: 'system', content: '  \u2502  status          System status                     \u2502' }, { type: 'system', content: '  \u2502  clear           Clear terminal                    \u2502' }, { type: 'system', content: '  \u2502  version         Platform version                  \u2502' }, { type: 'system', content: '  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n' });
      } else if (cmd === 'init') { await createOrg(); }
      else if (cmd === 'clear') { setLines([]); }
      else if (cmd === 'version') { push({ type: 'system', content: '  Data Platform v0.2.0 \u00b7 Next.js 14 \u00b7 Clerk \u00b7 Supabase \u00b7 Claude AI' }); }
      else if (cmd === 'status') { push({ type: 'system', content: `  Org: ${org?.name || 'none'}` }, { type: 'system', content: `  Active Stages: ${activeCount}/7 \u00b7 Journey Score: ${journeyScore}%` }, { type: 'system', content: `  KPIs: ${totalKPIs} \u00b7 Active Stage: ${stageConfig?.label || 'none'}` }); }
      else if (cmd === 'stages') {
        push({ type: 'divider', content: '' });
        for (const s of STAGES) { const d = sd[s.id]; const active = d?.db?.status === 'active'; push({ type: 'system', content: `  ${s.icon}  ${s.id.padEnd(14)} ${s.label.padEnd(16)} ${active ? '\u25cf LIVE' : '\u25cb SETUP'}  ${active && d.kpis[0] ? `${d.kpis[0].name}: ${formatValue(d.kpis[0].current_value, d.kpis[0].format)}` : ''}`, color: active ? '#34d399' : '#4b5563' }); }
        push({ type: 'divider', content: '' });
      } else if (cmd === 'activate') {
        if (!args) { push({ type: 'error', content: 'Usage: activate <stage_id>  (e.g. "activate awareness")' }); } else { await activateStage(args.toLowerCase()); }
      } else if (cmd === 'open') {
        if (!args) { push({ type: 'error', content: 'Usage: open <stage_id>' }); } else { const stage = STAGES.find(s => s.id === args.toLowerCase()); if (!stage) { push({ type: 'error', content: `Unknown stage: ${args}` }); } else { setActiveSid(stage.id); push({ type: 'success', content: `Active stage: ${stage.icon} ${stage.label} \u00b7 Expert: ${stage.expert}` }, { type: 'system', content: `  Type "ask <question>" to chat with ${stage.expert}` }); } }
      } else if (cmd === 'kpis') {
        const allKpis = Object.entries(sd).flatMap(([sid, d]) => d.kpis.map(k => ({ ...k, stage: STAGES.find(s => s.id === sid)?.label || sid })));
        if (!allKpis.length) { push({ type: 'system', content: '  No KPIs. Activate a stage first.' }); } else { push({ type: 'divider', content: '' }); for (const k of allKpis) { const trend = (k.trend || 0) >= 0 ? `\u2191${Math.abs(k.trend||0)}%` : `\u2193${Math.abs(k.trend||0)}%`; push({ type: 'kpi', content: `  ${k.stage.padEnd(14)} ${k.name.padEnd(24)} ${formatValue(k.current_value, k.format).padEnd(12)} ${trend}`, color: (k.trend||0) >= 0 ? '#34d399' : '#f87171' }); } push({ type: 'divider', content: '' }); }
      } else if (cmd === 'workflows') {
        const allWf = Object.entries(sd).flatMap(([sid, d]) => d.etl_workflows.map(w => ({ ...w, stage: STAGES.find(s => s.id === sid)?.label || sid })));
        if (!allWf.length) { push({ type: 'system', content: '  No workflows. Activate a stage first.' }); } else { for (const w of allWf) { push({ type: 'system', content: `  \u26a1 ${w.name.padEnd(30)} ${w.status.padEnd(12)} runs: ${w.total_runs || 0}`, color: w.status === 'completed' ? '#34d399' : undefined }); } }
      } else if (cmd === 'models') {
        const allMl = Object.entries(sd).flatMap(([sid, d]) => d.ml_workflows.map(m => ({ ...m, stage: STAGES.find(s => s.id === sid)?.label || sid })));
        if (!allMl.length) { push({ type: 'system', content: '  No models. Activate a stage first.' }); } else { for (const m of allMl) { push({ type: 'system', content: `  \ud83e\udde0 ${m.name.padEnd(30)} ${m.status.padEnd(12)} ${m.accuracy ? `acc: ${m.accuracy}%` : ''}`, color: m.status === 'trained' ? '#34d399' : undefined }); } }
      } else if (cmd === 'run') {
        if (!args) { push({ type: 'error', content: 'Usage: run <workflow_name>' }); } else if (org) { const allWf = Object.values(sd).flatMap(d => d.etl_workflows); const wf = allWf.find(w => w.name.toLowerCase().includes(args.toLowerCase())); if (!wf) { push({ type: 'error', content: `Workflow not found: "${args}"` }); } else { push({ type: 'system', content: `Running \u26a1 ${wf.name}...` }); await supabase.from('etl_workflows').update({ status: 'completed', total_runs: (wf.total_runs||0)+1, last_run_at: new Date().toISOString() }).eq('id', wf.id); const rows = Math.round(500+Math.random()*5000); await supabase.from('etl_runs').insert({ workflow_id: wf.id, status: 'completed', rows_processed: rows, rows_output: Math.round(rows*0.85) }); await loadAll(org.id); push({ type: 'success', content: `\u2713 ${wf.name} complete \u00b7 ${rows.toLocaleString()} rows processed` }); } }
      } else if (cmd === 'train') {
        if (!args) { push({ type: 'error', content: 'Usage: train <model_name>' }); } else if (org) { const allMl = Object.values(sd).flatMap(d => d.ml_workflows); const ml = allMl.find(m => m.name.toLowerCase().includes(args.toLowerCase())); if (!ml) { push({ type: 'error', content: `Model not found: "${args}"` }); } else { push({ type: 'system', content: `Training \ud83e\udde0 ${ml.name}...` }); const accuracy = +(78+Math.random()*18).toFixed(1); await supabase.from('ml_workflows').update({ status: 'trained', accuracy, last_trained_at: new Date().toISOString(), total_predictions: (ml.total_predictions||0)+Math.round(50+Math.random()*200) }).eq('id', ml.id); await supabase.from('ml_training_runs').insert({ workflow_id: ml.id, status: 'trained', training_rows: Math.round(1000+Math.random()*5000), test_rows: Math.round(200+Math.random()*1000), metrics: { accuracy }, model_version: `v${Date.now()%100}` }); await loadAll(org.id); push({ type: 'success', content: `\u2713 ${ml.name} trained \u00b7 Accuracy: ${accuracy}%` }); } }
      } else if (cmd === 'ai') {
        if (!args) { push({ type: 'error', content: 'Usage: ai <your question>' }); } else { push({ type: 'system', content: '  Thinking...' }); const { response } = await callAI({ message: args, systemPrompt: 'You are a helpful data platform assistant. Be concise. Use plain text, no markdown headers.' }); push({ type: 'ai', content: response }); }
      } else if (cmd === 'ask') {
        if (!args) { push({ type: 'error', content: 'Usage: ask <question>  (set active stage with "open <stage>" first)' }); } else if (!stageConfig || !activeSid) { push({ type: 'error', content: 'No active stage. Type "open <stage_id>" first.' }); } else { const d = sd[activeSid]; push({ type: 'system', content: `  ${stageConfig.expert} is thinking...` }); const sysPrompt = buildSystemPrompt({ expertName: stageConfig.expert, stageName: stageConfig.label, stageDesc: stageConfig.desc, kpis: d?.kpis?.map((k: any) => ({ name: k.name, current_value: k.current_value, format: k.format, trend: k.trend || 0 })) || [], orgName: org?.name }); const { response: aiResp } = await callAI({ message: args, systemPrompt: sysPrompt }); push({ type: 'ai', content: `  [${stageConfig.expert}]\n${aiResp}` }); }
      } else {
        push({ type: 'system', content: '  Processing...' }); const { response: fallback } = await callAI({ message: trimmed, systemPrompt: 'You are a helpful data platform assistant. If the user gives a command you dont recognize, suggest valid commands. Be concise.' }); push({ type: 'ai', content: fallback });
      }
    } catch (e: any) { push({ type: 'error', content: `Error: ${e.message || String(e)}` }); }
    setLoading(false);
  }, [org, sd, activeSid, stageConfig, activeCount, journeyScore, totalKPIs, push]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleCommand(input); setInput(''); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const next = Math.min(histIdx + 1, cmdHistory.length - 1); setHistIdx(next); if (cmdHistory[next]) setInput(cmdHistory[next]); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const next = Math.max(histIdx - 1, -1); setHistIdx(next); setInput(next >= 0 ? cmdHistory[next] : ''); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  const getLineColor = (line: TermLine) => {
    if (line.color) return line.color;
    switch (line.type) { case 'input': return '#60a5fa'; case 'error': return '#f87171'; case 'success': return '#34d399'; case 'ai': return '#c4b5fd'; case 'kpi': return '#fbbf24'; case 'welcome': return '#38bdf8'; case 'system': return '#94a3b8'; default: return '#e2e8f0'; }
  };

  const prompt = activeSid ? `${stageConfig?.icon || '>'} ${activeSid}` : '~';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0e17', fontFamily: "'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', monospace" }} onClick={() => inputRef.current?.focus()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#0f1320', borderBottom: '1px solid #1a1f35' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} /><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} /><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} /></div>
          <span style={{ fontSize: 12, color: '#475569', marginLeft: 8 }}>data-platform \u2014 {org?.name || 'terminal'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {org && <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#475569' }}><span>{activeCount}/7 stages</span><span>{totalKPIs} KPIs</span><span style={{ color: '#34d399' }}>{journeyScore}%</span></div>}
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
      {org && <div style={{ display: 'flex', gap: 1, padding: '4px 16px', background: '#0c1018', borderBottom: '1px solid #1a1f35', overflowX: 'auto' }}>{STAGES.map(s => { const d = sd[s.id]; const active = d?.db?.status === 'active'; const isCurrent = activeSid === s.id; return (<button key={s.id} onClick={(e) => { e.stopPropagation(); if (active) { setActiveSid(s.id); push({ type: 'success', content: `Active: ${s.icon} ${s.label} \u00b7 ${s.expert}` }); }}} style={{ padding: '4px 10px', background: isCurrent ? '#1a1f35' : 'transparent', border: 'none', borderBottom: isCurrent ? `2px solid ${s.color}` : '2px solid transparent', color: active ? (isCurrent ? s.color : '#64748b') : '#2d3348', fontSize: 11, cursor: active ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap', borderRadius: '4px 4px 0 0' }}>{s.icon} {s.label}</button>); })}</div>}
      <div ref={termRef} style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {lines.map(line => line.type === 'divider' ? <div key={line.id} style={{ borderBottom: '1px solid #1a1f35', margin: '6px 0' }} /> : <div key={line.id} style={{ display: 'flex', gap: 8, marginBottom: 2, lineHeight: 1.7 }}>{line.type === 'input' && <span style={{ color: '#3b82f6', userSelect: 'none' }}>\u276f</span>}<pre style={{ margin: 0, fontSize: 13, color: getLineColor(line), whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{line.content}</pre></div>)}
        {loading && <div style={{ display: 'flex', gap: 4, padding: '4px 0', color: '#475569', fontSize: 13 }}><span className="blink">\u25cf</span> processing...</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderTop: '1px solid #1a1f35', background: '#0c1018' }}>
        <span style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600, userSelect: 'none' }}>{prompt} \u276f</span>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={loading} placeholder={loading ? 'processing...' : 'type a command...'} autoFocus spellCheck={false} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', caretColor: '#3b82f6' }} />
        <span style={{ fontSize: 10, color: '#334155', padding: '2px 6px', border: '1px solid #1a1f35', borderRadius: 4 }}>\u2318K help</span>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');.blink{animation:blink 1s infinite}@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:.3}}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a0e17}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px}::selection{background:#3b82f640}`}</style>
    </div>
  );
}

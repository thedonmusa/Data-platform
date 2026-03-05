'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useAuth, UserButton } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { STAGES, generateKPIValue, formatValue, getAgentReply, StageConfig, StageData } from '@/lib/stages';

function Ring({ score, size = 58 }: { score: number; size?: number }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, offset = c - (score / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#rg)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset .8s' }} />
      <defs><linearGradient id="rg"><stop offset="0%" stopColor="#f472b6"/><stop offset="50%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#34d399"/></linearGradient></defs>
    </svg>
  );
}

interface ChatMessage {
  role: 'u' | 'a';
  content: string;
  time: Date;
}

export default function DashboardPage() {
  const { user } = useUser();
  const { userId } = useAuth();
  const [view, setView] = useState<'loading' | 'journey' | 'stage'>('loading');
  const [org, setOrg] = useState<any>(null);
  const [sd, setSd] = useState<Record<string, StageData>>({});
  const [sid, setSid] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);

  const stageConfig = useMemo(() => STAGES.find(s => s.id === sid) || null, [sid]);
  const activeStageData = useMemo(() => (sid ? sd[sid] : null) || { db: null, kpis: [], etl_workflows: [], ml_workflows: [], data_sources: [] }, [sd, sid]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

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
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: orgs } = await supabase.from('organizations').select('*').limit(1);
        if (orgs?.length) { setOrg(orgs[0]); await loadAll(orgs[0].id); }
        setView('journey');
      } catch (e: any) { console.error(e); setView('journey'); }
    })();
  }, [loadAll]);

  const createOrg = async () => {
    setLoading(true); setError('');
    try {
      const name = user?.fullName ? `${user.fullName}'s Org` : 'My Organization';
      const { data: orgs, error: err } = await supabase.from('organizations').insert({ name, owner_id: userId }).select();
      if (err) throw err;
      const newOrg = orgs![0]; setOrg(newOrg);
      await supabase.from('journey_stages').insert(STAGES.map(s => ({
        org_id: newOrg.id, stage: s.id, status: 'not_configured', expert_name: s.expert, config: { desc: s.desc },
      })));
      await loadAll(newOrg.id);
    } catch (e: any) { setError(e.message || String(e)); }
    setLoading(false);
  };

  const activateStage = async (stageId: string) => {
    if (!org) return; setLoading(true); setError('');
    try {
      const s = STAGES.find(x => x.id === stageId)!;
      const db = sd[stageId]?.db;
      if (!db) return;
      await supabase.from('journey_stages').update({ status: 'active' }).eq('id', db.id);
      const rowCount = Math.round(2000 + Math.random() * 15000);
      await supabase.from('data_sources').insert({ org_id: org.id, stage_id: db.id, name: `${s.label} Data`, source_type: 'csv', row_count: rowCount, column_count: Math.round(8 + Math.random() * 12) });
      const { data: createdKPIs } = await supabase.from('kpis').insert(s.kpis.map(k => ({
        org_id: org.id, stage_id: db.id, name: k.name, formula: k.formula, format: k.format,
        current_value: generateKPIValue(k.format), trend: Math.round(-15 + Math.random() * 30),
      }))).select();
      const history: any[] = [];
      for (const k of (createdKPIs || [])) {
        for (let i = 13; i >= 0; i--) {
          const start = new Date(); start.setDate(start.getDate() - i);
          const end = new Date(start); end.setDate(end.getDate() + 1);
          history.push({ kpi_id: k.id, value: generateKPIValue(k.format), period_start: start.toISOString(), period_end: end.toISOString() });
        }
      }
      if (history.length) await supabase.from('kpi_history').insert(history);
      await supabase.from('etl_workflows').insert(s.etls.map(name => ({ org_id: org.id, stage_id: db.id, name, status: 'ready', total_runs: 0 })));
      await supabase.from('ml_workflows').insert(s.mls.map(name => ({ org_id: org.id, stage_id: db.id, name, status: 'untrained', total_predictions: 0 })));
      await loadAll(org.id);
      setChat(prev => [...prev, { role: 'a', content: `✓ **${s.label} activated!**\n→ ${s.kpis.length} KPIs · ${s.etls.length} automations · ${s.mls.length} ML models\n→ ${rowCount.toLocaleString()} records · Saved to Supabase`, time: new Date() }]);
    } catch (e: any) { setError(e.message || String(e)); }
    setLoading(false);
  };

  const runETL = async (workflow: any) => {
    await supabase.from('etl_workflows').update({ status: 'completed', total_runs: (workflow.total_runs || 0) + 1, last_run_at: new Date().toISOString() }).eq('id', workflow.id);
    await supabase.from('etl_runs').insert({ workflow_id: workflow.id, status: 'completed', rows_processed: Math.round(500 + Math.random() * 5000), rows_output: Math.round(400 + Math.random() * 4000) });
    if (org) await loadAll(org.id);
  };

  const trainML = async (workflow: any) => {
    const accuracy = +(78 + Math.random() * 18).toFixed(1);
    await supabase.from('ml_workflows').update({ status: 'trained', accuracy, last_trained_at: new Date().toISOString(), total_predictions: (workflow.total_predictions || 0) + Math.round(50 + Math.random() * 200) }).eq('id', workflow.id);
    await supabase.from('ml_training_runs').insert({ workflow_id: workflow.id, status: 'trained', training_rows: Math.round(1000 + Math.random() * 5000), test_rows: Math.round(200 + Math.random() * 1000), metrics: { accuracy }, model_version: `v${Date.now() % 100}` });
    if (org) await loadAll(org.id);
  };

  const openStage = useCallback(async (id: string) => {
    setSid(id); setTab('overview'); setView('stage');
    const s = STAGES.find(x => x.id === id)!;
    const d = sd[id];
    const welcome: ChatMessage = { role: 'a', content: d?.db?.status === 'active' ? `Welcome back, ${user?.firstName || 'there'}! I'm your **${s.expert}** for ${s.label}. ${d.kpis.length} KPIs, ${d.etl_workflows.length} automations, ${d.ml_workflows.length} models. What shall we explore?` : `Hey ${user?.firstName || 'there'}! I'm your **${s.expert}**. Click **Activate** or type **"activate"** to set up ${s.label}.`, time: new Date() };
    setChat([welcome]);
  }, [sd, user]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !stageConfig || !sid) return;
    const msg = chatInput.trim();
    setChat(prev => [...prev, { role: 'u', content: msg, time: new Date() }]);
    setChatInput(''); setTyping(true);
    if (msg.toLowerCase() === 'activate' && activeStageData?.db?.status !== 'active') { await activateStage(sid); setTyping(false); return; }
    try { if (org && activeStageData?.db) await supabase.from('conversations').insert({ org_id: org.id, stage_id: activeStageData.db.id, role: 'user', content: msg, agent_name: stageConfig.expert }); } catch (_) {}
    setTimeout(async () => {
      const response = getAgentReply(stageConfig, activeStageData, msg);
      setChat(prev => [...prev, { role: 'a', content: response, time: new Date() }]);
      try { if (org && activeStageData?.db) await supabase.from('conversations').insert({ org_id: org.id, stage_id: activeStageData.db.id, role: 'assistant', content: response, agent_name: stageConfig.expert }); } catch (_) {}
      setTyping(false);
    }, 600 + Math.random() * 800);
  }, [chatInput, stageConfig, activeStageData, org, sid]);

  const activeCount = useMemo(() => Object.values(sd).filter(d => d.db?.status === 'active').length, [sd]);
  const journeyScore = Math.round((activeCount / 7) * 100);
  const totalKPIs = Object.values(sd).reduce((n, d) => n + (d.kpis?.length || 0), 0);
  const totalETLs = Object.values(sd).reduce((n, d) => n + (d.etl_workflows?.length || 0), 0);
  const totalMLs = Object.values(sd).reduce((n, d) => n + (d.ml_workflows?.length || 0), 0);
  const totalSources = Object.values(sd).reduce((n, d) => n + (d.data_sources?.length || 0), 0);
  const renderMarkdown = (text: string) => text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  if (view === 'loading') return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading platform...</div>;

  if (view === 'journey') return (
    <div className="fi">
      <div style={{ padding: '20px 36px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--dim)' }}>Customer Journey Intelligence</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--br)' }}>{org?.name || 'Get Started'}</h1>
        </div>
        <div className="flex items-center gap-4">
          {org && <><div className="relative"><Ring score={journeyScore} /><div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: 'var(--br)' }}>{journeyScore}%</div></div><div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.6 }}><div>{activeCount}/7 stages</div><div>{totalKPIs} KPIs · {totalMLs} models</div></div></>}
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
      {!org ? (
        <div className="text-center" style={{ padding: '80px 40px' }}>
          <div className="flex gap-1 justify-center mb-9 opacity-40">{STAGES.map((s, i) => <div key={s.id} className="flex items-center gap-1"><div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, opacity: .6 }} />{i < 6 && <div style={{ width: 20, height: 1, background: `linear-gradient(to right,${s.color},${STAGES[i+1].color})`, opacity: .3 }} />}</div>)}</div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 12 }}>Welcome, {user?.firstName || 'there'}</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1.1, marginBottom: 8, color: 'var(--br)' }}>Measure. Automate.</h1>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1.1, marginBottom: 28 }}><span style={{ background: 'linear-gradient(135deg,#f472b6,#60a5fa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Every Stage.</span></h1>
          <p style={{ color: 'var(--dim)', fontSize: 14, maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.6 }}>7 customer journey stages. Actionable data. ML models. Automated systems.</p>
          <button disabled={loading} onClick={createOrg} className="px-6 py-3 rounded-lg text-white font-semibold text-sm" style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', cursor: 'pointer', opacity: loading ? .5 : 1 }}>{loading ? 'Creating...' : 'Initialize Journey →'}</button>
          {error && <div className="mt-3 text-xs text-red-400 p-2 rounded-lg mx-auto max-w-md" style={{ background: 'rgba(248,113,113,.08)' }}>{error}</div>}
        </div>
      ) : (
        <div style={{ padding: '24px 36px' }}>
          <div className="flex gap-[3px] mb-7 overflow-x-auto pb-2">{STAGES.map((s, i) => { const d = sd[s.id] || {} as StageData, active = d.db?.status === 'active'; return (<div key={s.id} className="flex items-stretch"><button className="sc" onClick={() => openStage(s.id)} style={{ width: 145, padding: '14px 11px', background: active ? `${s.color}0a` : 'var(--sf)', border: `1px solid ${active ? s.color + '33' : 'var(--bd)'}`, borderRadius: 11, cursor: 'pointer', color: 'var(--tx)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 5, position: 'relative', overflow: 'hidden' }}>{active && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(to right,transparent,${s.color},transparent)` }} />}<div className="flex justify-between items-center"><span style={{ fontSize: 15, color: active ? s.color : '#4b5563' }}>{s.icon}</span><span style={{ fontSize: 7, padding: '2px 5px', borderRadius: 3, background: active ? `${s.color}20` : 'rgba(255,255,255,.03)', color: active ? s.color : '#4b5563', fontWeight: 600, textTransform: 'uppercase' }}>{active ? 'LIVE' : 'SETUP'}</span></div><div style={{ fontSize: 11, fontWeight: 600, color: active ? 'var(--br)' : 'var(--dim)' }}>{s.label}</div><div style={{ fontSize: 8, color: '#4b5563', lineHeight: 1.4 }}>{s.desc}</div>{active && d.kpis?.[0] && <div style={{ marginTop: 'auto', paddingTop: 5, borderTop: `1px solid ${s.color}15` }}><div style={{ fontSize: 8, color: 'var(--dim)' }}>{d.kpis[0].name}</div><div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{formatValue(d.kpis[0].current_value, d.kpis[0].format)}</div></div>}</button>{i < 6 && <div className="w-3.5 flex items-center justify-center text-gray-800" style={{ fontSize: 9 }}>→</div>}</div>); })}</div>
          <div className="grid grid-cols-4 gap-2.5 mb-6">{[{ l: 'Sources', v: totalSources }, { l: 'ETL Workflows', v: totalETLs }, { l: 'ML Models', v: totalMLs }, { l: 'Journey Score', v: `${journeyScore}%` }].map((x, i) => (<div key={i} style={{ padding: '14px 16px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 9 }}><div style={{ fontSize: 8, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>{x.l}</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--br)' }}>{x.v}</div></div>))}</div>
          {activeCount > 0 && <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>{STAGES.filter(s => sd[s.id]?.db?.status === 'active').map(s => { const d = sd[s.id]; return (<button key={s.id} onClick={() => openStage(s.id)} className="sc" style={{ padding: 14, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--tx)' }}><div className="flex items-center gap-2 mb-2.5"><div style={{ width: 20, height: 20, borderRadius: 5, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: s.color }}>{s.icon}</div><span style={{ fontSize: 11, fontWeight: 600 }}>{s.label}</span><span className="ml-auto" style={{ fontSize: 8, color: 'var(--dim)' }}>{s.expert}</span></div><div className="grid grid-cols-2 gap-1">{d.kpis.slice(0, 4).map((k: any) => <div key={k.id}><div style={{ fontSize: 7, color: 'var(--dim)' }}>{k.name}</div><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--br)' }}>{formatValue(k.current_value, k.format)} <span style={{ fontSize: 8, color: (k.trend||0) >= 0 ? '#34d399' : '#f87171' }}>{(k.trend||0) >= 0 ? '↑' : '↓'}{Math.abs(k.trend||0)}%</span></div></div>)}</div></button>); })}</div>}
        </div>
      )}
    </div>
  );

  if (view === 'stage' && stageConfig) return (
    <div className="fi flex" style={{ height: '100vh' }}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2.5" style={{ padding: '11px 22px', borderBottom: '1px solid var(--bd)' }}><button onClick={() => { setView('journey'); if (org) loadAll(org.id); }} className="bg-transparent border-none cursor-pointer text-sm" style={{ color: 'var(--dim)' }}>←</button><div style={{ width: 24, height: 24, borderRadius: 6, background: `${stageConfig.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: stageConfig.color }}>{stageConfig.icon}</div><div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--br)' }}>{stageConfig.label}</div><div style={{ fontSize: 9, color: 'var(--dim)' }}>{stageConfig.expert}</div></div><div className="ml-auto">{activeStageData?.db?.status !== 'active' ? <button disabled={loading} onClick={() => sid && activateStage(sid)} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', cursor: 'pointer' }}>{loading ? '...' : 'Activate'}</button> : <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 5, background: `${stageConfig.color}15`, color: stageConfig.color, fontWeight: 600 }}>● Live</span>}</div></div>
        <div className="flex" style={{ padding: '0 22px', borderBottom: '1px solid var(--bd)' }}>{['overview', 'automations', 'models', 'data'].map(t => (<button key={t} onClick={() => setTab(t)} style={{ padding: '9px 12px', border: 'none', borderBottom: `2px solid ${tab === t ? stageConfig.color : 'transparent'}`, background: 'transparent', color: tab === t ? 'var(--br)' : 'var(--dim)', fontSize: 10, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>))}</div>
        <div className="st flex-1 overflow-auto" style={{ padding: '16px 22px' }}>
          {activeStageData?.db?.status !== 'active' ? (<div className="text-center" style={{ padding: '50px 30px' }}><div style={{ fontSize: 32, opacity: .4, marginBottom: 10 }}>{stageConfig.icon}</div><h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--br)', marginBottom: 6 }}>Activate {stageConfig.label}</h3><p style={{ fontSize: 11, color: 'var(--dim)', maxWidth: 300, margin: '0 auto 16px', lineHeight: 1.5 }}>Connect data to measure {stageConfig.desc.toLowerCase()}</p><button disabled={loading} onClick={() => sid && activateStage(sid)} className="px-5 py-2.5 rounded-lg text-white text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', cursor: 'pointer' }}>{loading ? '...' : 'Activate →'}</button></div>) : <>
            {tab === 'overview' && <div><div className="grid gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))' }}>{activeStageData.kpis.map((k: any) => <div key={k.id} style={{ padding: 13, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 9 }}><div style={{ fontSize: 8, color: 'var(--dim)', marginBottom: 3 }}>{k.name}</div><div className="flex items-baseline gap-1"><span style={{ fontSize: 18, fontWeight: 700, color: 'var(--br)' }}>{formatValue(k.current_value, k.format)}</span>{k.trend != null && <span style={{ fontSize: 8, color: k.trend >= 0 ? '#34d399' : '#f87171' }}>{k.trend >= 0 ? '↑' : '↓'}{Math.abs(k.trend)}%</span>}</div><div style={{ fontSize: 7, color: '#4b5563', fontFamily: "'IBM Plex Mono',monospace", marginTop: 3 }}>{k.formula}</div></div>)}</div><div className="grid grid-cols-2 gap-2"><div style={{ padding: 14, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 9 }}><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--br)', marginBottom: 8 }}>Automations</div>{activeStageData.etl_workflows.map((w: any) => <div key={w.id} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--bd)', fontSize: 10 }}><span style={{ color: w.status === 'completed' ? '#34d399' : 'var(--dim)' }}>{w.status === 'completed' ? '✓' : '○'} {w.name}</span><span style={{ fontSize: 8, color: '#4b5563' }}>{w.total_runs || 0}</span></div>)}</div><div style={{ padding: 14, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 9 }}><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--br)', marginBottom: 8 }}>ML Models</div>{activeStageData.ml_workflows.map((m: any) => <div key={m.id} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--bd)', fontSize: 10 }}><span style={{ color: m.status === 'trained' ? '#34d399' : 'var(--dim)' }}>{m.status === 'trained' ? '✓' : '○'} {m.name}</span><span style={{ fontSize: 8, color: '#4b5563' }}>{m.accuracy ? `${m.accuracy}%` : '—'}</span></div>)}</div></div></div>}
            {tab === 'automations' && <div className="flex flex-col gap-2"><p style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 4 }}>Workflows create <strong style={{ color: 'var(--br)' }}>actionable data</strong> → feed ML → <strong style={{ color: 'var(--br)' }}>automated systems</strong>.</p>{activeStageData.etl_workflows.map((w: any) => <div key={w.id} className="flex justify-between items-center" style={{ padding: 14, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 9 }}><div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--br)' }}>⚡ {w.name}</div><div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{w.status} · {w.total_runs || 0} runs</div></div><button onClick={() => runETL(w)} style={{ padding: '5px 12px', background: 'none', border: `1px solid ${stageConfig.color}33`, borderRadius: 5, color: stageConfig.color, fontSize: 10, cursor: 'pointer' }}>▶ Run</button></div>)}</div>}
            {tab === 'models' && <div className="flex flex-col gap-2"><p style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 4 }}>Models learn from data → <strong style={{ color: 'var(--br)' }}>continuous predictions</strong>.</p>{activeStageData.ml_workflows.map((m: any) => <div key={m.id} style={{ padding: 14, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 9 }}><div className="flex justify-between items-center"><div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--br)' }}>◇ {m.name}</div><div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{m.status === 'trained' ? `${m.accuracy}% · ${m.total_predictions || 0} predictions` : 'Untrained'}</div></div><button onClick={() => trainML(m)} style={{ padding: '5px 12px', background: 'none', border: '1px solid rgba(52,211,153,.3)', borderRadius: 5, color: '#34d399', fontSize: 10, cursor: 'pointer' }}>🧠 Train</button></div>{m.accuracy && <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(52,211,153,.05)', borderRadius: 5, fontSize: 10, color: '#34d399' }}>Accuracy: {m.accuracy}%</div>}</div>)}</div>}
            {tab === 'data' && <div>{activeStageData.data_sources.map((d: any) => <div key={d.id} style={{ padding: 14, background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 9, marginBottom: 8 }}><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--br)' }}>◈ {d.name}</div><div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>{d.row_count?.toLocaleString()} records · {d.column_count} cols</div></div>)}<div style={{ padding: 14, border: '2px dashed var(--bd)', borderRadius: 9, textAlign: 'center', color: '#4b5563', fontSize: 11 }}>+ Connect data source</div></div>}
          </>}
        </div>
      </div>
      <div className="flex flex-col" style={{ width: 320, borderLeft: '1px solid var(--bd)', background: 'rgba(6,10,16,.6)' }}>
        <div className="flex items-center gap-2" style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: activeStageData?.db?.status === 'active' ? '#34d399' : 'var(--dim)' }} /><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--br)' }}>{stageConfig.expert}</span></div>
        <div className="st flex-1 overflow-auto flex flex-col gap-2" style={{ padding: '10px 12px' }}>{chat.map((m, i) => (<div key={i} className="flex flex-col" style={{ alignItems: m.role === 'u' ? 'flex-end' : 'flex-start' }}><div className="cb" style={{ maxWidth: '90%', padding: '8px 11px', borderRadius: m.role === 'u' ? '9px 9px 2px 9px' : '9px 9px 9px 2px', background: m.role === 'u' ? `${stageConfig.color}18` : 'var(--sf)', border: `1px solid ${m.role === 'u' ? stageConfig.color + '30' : 'var(--bd)'}`, fontSize: 11 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} /><div style={{ fontSize: 7, color: '#374151', marginTop: 2 }}>{m.time?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div>))}{typing && <div className="flex gap-1" style={{ padding: '7px 11px', background: 'var(--sf)', borderRadius: 9, width: 'fit-content', fontSize: 14, color: '#4b5563' }}><span style={{ animation: 'pl 1.4s ease infinite' }}>·</span><span style={{ animation: 'pl 1.4s ease .2s infinite' }}>·</span><span style={{ animation: 'pl 1.4s ease .4s infinite' }}>·</span></div>}<div ref={chatEnd} /></div>
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--bd)' }}><div className="flex gap-1"><input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }} placeholder={activeStageData?.db?.status === 'active' ? `Ask ${stageConfig.expert}...` : "Type 'activate'..."} className="flex-1" style={{ padding: '8px 10px', background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--tx)', fontSize: 11, fontFamily: "'Outfit',sans-serif", outline: 'none' }} /><button onClick={sendChat} disabled={!chatInput.trim()} style={{ padding: '8px 11px', background: chatInput.trim() ? `${stageConfig.color}20` : 'var(--sf)', border: `1px solid ${chatInput.trim() ? stageConfig.color + '40' : 'var(--bd)'}`, borderRadius: 7, color: chatInput.trim() ? stageConfig.color : '#4b5563', cursor: chatInput.trim() ? 'pointer' : 'default', fontSize: 11 }}>→</button></div><div className="flex gap-1 mt-1">{['status', 'recommendations', 'help'].map(q => <button key={q} onClick={() => setChatInput(q)} style={{ padding: '2px 6px', background: 'none', border: '1px solid var(--bd)', borderRadius: 3, color: '#4b5563', fontSize: 7, cursor: 'pointer' }}>{q}</button>)}</div></div>
      </div>
    </div>
  );

  return null;
}

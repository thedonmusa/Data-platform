'use client';
import { useUser, UserButton } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const JOURNEY_STAGES = [
  { id: 'awareness', name: 'Awareness', icon: '📡', color: 'from-purple-600 to-purple-800', description: 'Brand visibility & reach', kpis: ['Impressions', 'Brand Recall', 'CPM', 'Share of Voice'], agent: 'Marketing Strategist' },
  { id: 'education', name: 'Education', icon: '🎓', color: 'from-blue-600 to-blue-800', description: 'Content engagement & learning', kpis: ['Watch Time', 'Completion Rate', 'Subscribers', 'Engagement Rate'], agent: 'Content Strategist' },
  { id: 'acquisition', name: 'Acquisition', icon: '🎯', color: 'from-green-600 to-green-800', description: 'Lead generation & conversion', kpis: ['CAC', 'Conversion Rate', 'MQLs', 'Pipeline Value'], agent: 'Growth Analyst' },
  { id: 'onboarding', name: 'Onboarding', icon: '🚀', color: 'from-yellow-600 to-yellow-800', description: 'User activation & setup', kpis: ['Time to Value', 'Activation Rate', 'Setup Completion', 'Day 7 Retention'], agent: 'Onboarding Specialist' },
  { id: 'product', name: 'Product', icon: '⚡', color: 'from-orange-600 to-orange-800', description: 'Feature adoption & engagement', kpis: ['DAU/MAU', 'Feature Adoption', 'Session Length', 'NPS'], agent: 'Product Analyst' },
  { id: 'support', name: 'Support', icon: '🛡️', color: 'from-red-600 to-red-800', description: 'Customer success & resolution', kpis: ['CSAT', 'First Response Time', 'Resolution Rate', 'Ticket Volume'], agent: 'Customer Success Manager' },
  { id: 'retention', name: 'Retention', icon: '♻️', color: 'from-teal-600 to-teal-800', description: 'Loyalty & revenue expansion', kpis: ['Churn Rate', 'LTV', 'Expansion MRR', 'Net Revenue Retention'], agent: 'Retention Strategist' },
];

export default function Dashboard() {
  const { user } = useUser();
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: orgs } = await supabase.from('organizations').select('*').limit(1);
    if (orgs && orgs.length > 0) {
      setOrg(orgs[0]);
      const { data: stagesData } = await supabase.from('journey_stages').select('*').eq('org_id', orgs[0].id);
      setStages(stagesData || []);
    }
    setLoading(false);
  }

  async function initializeJourney() {
    const { data: newOrg } = await supabase.from('organizations').insert({ name: user?.fullName + "'s Organization", domain: 'customer-journey' }).select().single();
    if (newOrg) {
      for (const stage of JOURNEY_STAGES) {
        await supabase.from('journey_stages').insert({ org_id: newOrg.id, stage_type: stage.id, name: stage.name, status: 'inactive' });
      }
      setOrg(newOrg);
      await loadData();
    }
  }

  async function activateStage(stageId: string) {
    const stage = stages.find(s => s.stage_type === stageId);
    if (!stage) return;
    await supabase.from('journey_stages').update({ status: 'active' }).eq('id', stage.id);
    await loadData();
    setActiveStage(stageId);
  }

  const activeStageData = JOURNEY_STAGES.find(s => s.id === activeStage);
  const activeDbStage = stages.find(s => s.stage_type === activeStage);

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <h1 className="text-xl font-bold">Customer Journey Intelligence</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">Welcome, {user?.firstName}</span>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </nav>

      <main className="p-6">
        {!org ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <h2 className="text-3xl font-bold">Initialize Your Journey Map</h2>
            <p className="text-gray-400 text-center max-w-lg">Set up your 7-stage customer journey intelligence platform to start measuring, automating, and optimizing every touchpoint.</p>
            <button onClick={initializeJourney} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-lg transition">Initialize Journey →</button>
          </div>
        ) : (
          <div className="flex gap-6">
            <div className="w-72 shrink-0">
              <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Journey Stages</h2>
              <div className="space-y-2">
                {JOURNEY_STAGES.map(stage => {
                  const dbStage = stages.find(s => s.stage_type === stage.id);
                  const isActive = dbStage?.status === 'active';
                  return (
                    <button key={stage.id} onClick={() => setActiveStage(stage.id)}
                      className={`w-full text-left p-3 rounded-lg border transition ${
                        activeStage === stage.id ? 'border-purple-500 bg-purple-900/20' : 'border-gray-800 hover:border-gray-600'
                      }`}>
                      <div className="flex items-center gap-2">
                        <span>{stage.icon}</span>
                        <span className="font-medium">{stage.name}</span>
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-500'
                        }`}>{isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-6">{stage.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1">
              {!activeStage ? (
                <div className="text-center text-gray-500 mt-20">
                  <p className="text-lg">Select a stage to view details and activate it</p>
                </div>
              ) : (
                <div>
                  <div className={`bg-gradient-to-r ${activeStageData?.color} rounded-xl p-6 mb-6`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-3xl">{activeStageData?.icon}</span>
                          <h2 className="text-2xl font-bold">{activeStageData?.name}</h2>
                        </div>
                        <p className="text-white/70">{activeStageData?.description}</p>
                        <p className="text-sm text-white/60 mt-1">Domain Expert: {activeStageData?.agent}</p>
                      </div>
                      {activeDbStage?.status !== 'active' && (
                        <button onClick={() => activateStage(activeStage)} className="px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition">Activate Stage</button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {activeStageData?.kpis.map(kpi => (
                      <div key={kpi} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">{kpi}</p>
                        <p className="text-2xl font-bold mt-1">{activeDbStage?.status === 'active' ? '—' : 'Not Active'}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h3 className="font-semibold mb-3">Chat with {activeStageData?.agent}</h3>
                    <div className="h-48 overflow-y-auto mb-3 space-y-2">
                      {chat.filter(c => c.stage === activeStage).map((c, i) => (
                        <div key={i} className={`p-2 rounded ${ c.role === 'user' ? 'bg-purple-900/30 text-right' : 'bg-gray-800' }`}>
                          <p className="text-sm">{c.content}</p>
                        </div>
                      ))}
                      {chat.filter(c => c.stage === activeStage).length === 0 && (
                        <p className="text-gray-500 text-sm text-center mt-8">Ask {activeStageData?.agent} anything about your {activeStageData?.name} stage...</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input value={message} onChange={e => setMessage(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && message) { setChat([...chat, { role: 'user', content: message, stage: activeStage }, { role: 'agent', content: `As your ${activeStageData?.agent}, I recommend focusing on improving ${activeStageData?.kpis[0]} first. This is typically the highest-leverage metric for the ${activeStageData?.name} stage.`, stage: activeStage }]); setMessage(''); }}}
                        placeholder={`Ask ${activeStageData?.agent}...`}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                      <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition">Send</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
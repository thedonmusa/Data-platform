export interface KPIDefinition {
  name: string;
  formula: string;
  format: string;
}

export interface StageConfig {
  id: string;
  label: string;
  icon: string;
  color: string;
  expert: string;
  desc: string;
  kpis: KPIDefinition[];
  etls: string[];
  mls: string[];
}

export const STAGES: StageConfig[] = [
  { id: "awareness", label: "Awareness", icon: "◉", color: "#f472b6", expert: "Marketing Strategist", desc: "Marketing, brand reach, first impressions",
    kpis: [{ name: "Impressions", formula: "SUM(impressions)", format: "number" }, { name: "Unique Reach", formula: "COUNT(DISTINCT reached)", format: "number" }, { name: "CPM", formula: "spend/impr*1000", format: "currency" }, { name: "Brand Recall", formula: "recall/surveys", format: "percent" }, { name: "Share of Voice", formula: "mentions/total", format: "percent" }],
    etls: ["Lead scoring from engagement", "Channel budget reallocation", "Audience segment discovery"],
    mls: ["Attribution Model", "Audience Lookalike", "Ad Spend Optimizer"] },
  { id: "education", label: "Education", icon: "◎", color: "#a78bfa", expert: "Content Strategist", desc: "YouTube, webinars, content, thought leadership",
    kpis: [{ name: "Content Views", formula: "SUM(views)", format: "number" }, { name: "Avg Watch Time", formula: "AVG(watch)", format: "duration" }, { name: "Completion Rate", formula: "done/started", format: "percent" }, { name: "Engagement", formula: "(likes+comments)/views", format: "percent" }, { name: "Content to Lead", formula: "leads/viewers", format: "percent" }],
    etls: ["Content performance tagging", "Topic gap analysis", "Webinar follow-ups"],
    mls: ["Content Recommender", "Topic Predictor", "Engagement Forecaster"] },
  { id: "acquisition", label: "Acquisition", icon: "◈", color: "#60a5fa", expert: "Growth Analyst", desc: "Conversion, signup, first purchase",
    kpis: [{ name: "New Signups", formula: "COUNT(signups)", format: "number" }, { name: "CAC", formula: "spend/customers", format: "currency" }, { name: "Conversion Rate", formula: "conv/visitors", format: "percent" }, { name: "Trial Starts", formula: "COUNT(trials)", format: "number" }, { name: "Payback", formula: "cac/monthly_rev", format: "months" }],
    etls: ["Lead qualification scoring", "A/B test deployment", "Signup friction detection"],
    mls: ["Conversion Prediction", "Lead Scoring", "Channel Attribution"] },
  { id: "onboarding", label: "Onboarding", icon: "◐", color: "#34d399", expert: "Onboarding Specialist", desc: "Activation, time-to-value, setup",
    kpis: [{ name: "Activation Rate", formula: "activated/signups", format: "percent" }, { name: "Time to Value", formula: "AVG(ttv)", format: "duration" }, { name: "Onboarding Done", formula: "done/started", format: "percent" }, { name: "Setup Score", formula: "steps/total", format: "percent" }, { name: "Day 7 Retention", formula: "d7/signups", format: "percent" }],
    etls: ["Stalled onboarding nudges", "Personalized guides", "Milestone triggers"],
    mls: ["Activation Prediction", "Path Optimizer", "Drop-off Scoring"] },
  { id: "product", label: "Product", icon: "◆", color: "#fbbf24", expert: "Product Analyst", desc: "Usage, adoption, feature engagement",
    kpis: [{ name: "DAU/MAU", formula: "dau/mau", format: "ratio" }, { name: "Feature Adoption", formula: "using/total", format: "percent" }, { name: "Session Depth", formula: "AVG(actions)", format: "number" }, { name: "NPS", formula: "prom-detr", format: "score" }, { name: "Power Users", formula: "power/total", format: "percent" }],
    etls: ["Feature adoption campaigns", "Usage clustering", "In-app guidance"],
    mls: ["Feature Recommender", "Usage Forecaster", "User Segmenter"] },
  { id: "support", label: "Support", icon: "◑", color: "#fb923c", expert: "CX Ops Lead", desc: "Tickets, satisfaction, success",
    kpis: [{ name: "CSAT", formula: "AVG(satisfaction)", format: "score" }, { name: "Resolution Time", formula: "AVG(res_time)", format: "duration" }, { name: "FCR", formula: "first_res/total", format: "percent" }, { name: "Ticket Volume", formula: "COUNT(tickets)", format: "number" }, { name: "Escalation Rate", formula: "esc/total", format: "percent" }],
    etls: ["Ticket auto-routing", "Sentiment alerts", "KB gap detection"],
    mls: ["Priority Prediction", "Resolution Estimator", "Sentiment Classifier"] },
  { id: "retention", label: "Retention", icon: "◉", color: "#f87171", expert: "Retention Strategist", desc: "Churn prevention, expansion, LTV",
    kpis: [{ name: "Churn Rate", formula: "churned/start", format: "percent" }, { name: "LTV", formula: "rev*lifespan", format: "currency" }, { name: "Net Rev Ret.", formula: "(s+e-c)/s", format: "percent" }, { name: "Expansion Rev", formula: "SUM(upsell)", format: "currency" }, { name: "Health Score", formula: "composite", format: "score" }],
    etls: ["Churn risk alerts", "Win-back campaigns", "Expansion detection"],
    mls: ["Churn Prediction", "LTV Forecasting", "Health Score Model"] },
];

export function generateKPIValue(format: string): number {
  switch (format) {
    case "currency": return Math.round(5000 + Math.random() * 200000);
    case "percent": return +(5 + Math.random() * 60).toFixed(1);
    case "number": return Math.round(100 + Math.random() * 50000);
    case "ratio": return +(0.1 + Math.random() * 0.6).toFixed(2);
    case "duration": return +(1 + Math.random() * 30).toFixed(1);
    case "score": return Math.round(20 + Math.random() * 60);
    case "months": return +(2 + Math.random() * 18).toFixed(1);
    default: return Math.round(Math.random() * 1000);
  }
}

export function formatValue(value: number | null | undefined, format: string): string {
  if (value == null) return "—";
  switch (format) {
    case "currency": return `$${Number(value).toLocaleString()}`;
    case "percent": return `${value}%`;
    case "number": return Number(value).toLocaleString();
    case "ratio": return `${value}x`;
    case "duration": return `${value}m`;
    case "score": return `${value}/100`;
    case "months": return `${value}mo`;
    default: return String(value);
  }
}

export interface StageData {
  db?: any;
  kpis: any[];
  etl_workflows: any[];
  ml_workflows: any[];
  data_sources: any[];
}

export function getAgentReply(stageConfig: StageConfig, stageData: StageData, message: string): string {
  const m = message.toLowerCase();
  const kpis = stageData?.kpis || [];
  const etls = stageData?.etl_workflows || [];
  const mls = stageData?.ml_workflows || [];
  const ds = stageData?.data_sources?.[0];

  if (m.includes("help")) {
    return `I'm your **${stageConfig.expert}** for ${stageConfig.label}.\n\n→ ${kpis.length} KPIs · ${etls.length} automations · ${mls.length} ML models\n\nAsk about status, recommendations, or models.`;
  }
  if (m.includes("status") || m.includes("overview")) {
    const top = kpis.slice(0, 3).map((k: any) => `  ${k.name}: **${formatValue(k.current_value, k.format)}** (${(k.trend || 0) >= 0 ? "↑" : "↓"}${Math.abs(k.trend || 0)}%)`).join("\n");
    return `**${stageConfig.label} Status**\n\n${top || "  No data"}\n\nData: ${ds?.row_count?.toLocaleString() || 0} records\nETL: ${etls.filter((w: any) => w.status === "completed").length}/${etls.length}\nML: ${mls.filter((w: any) => w.status === "trained").length}/${mls.length}`;
  }
  if (m.includes("recommend")) {
    return `**Recommendations**\n\n1. Run ${etls.filter((w: any) => w.status !== "completed").length} pending ETLs\n2. Train ${mls.filter((w: any) => w.status !== "trained").length} models\n3. Add data sources\n\nWorkflows → actionable data → ML → automated systems.`;
  }
  return `Your ${stageConfig.label.toLowerCase()} data shows ${kpis[0] ? `${kpis[0].name} at ${formatValue(kpis[0].current_value, kpis[0].format)}.` : "potential."} Want a specific analysis?`;
}

import React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: (plan: 'trial' | 'paid') => void;
  onSignIn: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onSignIn }) => (
  <main className="min-h-screen bg-[#f3f7f1] text-[#172820]">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <a href="#top" className="flex items-center gap-2.5" aria-label="Insight360 home">
        <img
          src="/insight360-logo.jpg"
          alt="Insight360 Logo"
          className="h-10 w-10 object-contain rounded-xl bg-white p-0.5 shadow-sm border border-[#dce6de]"
        />
        <span className="text-lg font-bold tracking-tight">Insight<span className="text-[#ed7653]">360</span></span>
      </a>
      <nav className="hidden items-center gap-8 text-sm font-medium text-[#54645b] md:flex">
        <a href="#intelligence" className="hover:text-[#174d3b]">Intelligence</a>
        <a href="#retention" className="hover:text-[#174d3b]">Retention</a>
        <a href="#pricing" className="hover:text-[#174d3b]">Pricing</a>
      </nav>
      <div className="flex items-center gap-2 sm:gap-4">
        <button onClick={onSignIn} className="px-2 py-2 text-sm font-semibold text-[#315446] hover:text-[#102f23]">Sign in</button>
        <button onClick={() => onGetStarted('trial')} className="inline-flex items-center gap-2 rounded-lg bg-[#174d3b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#103c2d]">
          Get started <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </header>

    <section id="top" className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pb-24 lg:pt-16">
      <div className="landing-reveal">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#cddbd0] bg-white/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#35634d]">
          <Sparkles className="h-3.5 w-3.5 text-[#ed7653]" /> Customer intelligence, in focus
        </p>
        <h1 className="max-w-xl font-serif text-5xl leading-[1.04] text-[#17382b] sm:text-6xl">
          Every customer.<br /><span className="text-[#ed7653]">Seen clearly.</span>
        </h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-[#56655c]">
          Insight360 brings sales activity, customer history, sentiment, and churn signals into one practical view, so every next step is grounded in the relationship.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button onClick={() => onGetStarted('trial')} className="inline-flex items-center gap-2 rounded-lg bg-[#ed7653] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d85f40]">
            Start your 7-day free tier <ArrowRight className="h-4 w-4" />
          </button>
          <a href="#intelligence" className="inline-flex items-center gap-1.5 px-3 py-3 text-sm font-semibold text-[#315446] hover:text-[#102f23]">
            Explore the platform <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-4 text-xs text-[#748078]">No payment required to start. Choose a plan during registration.</p>
      </div>

      <div className="landing-reveal landing-reveal-delayed relative">
        <div className="absolute -right-3 -top-5 z-10 flex items-center gap-2 rounded-lg border border-[#d7e5db] bg-white px-3 py-2 text-xs font-semibold text-[#315446] shadow-lg sm:-right-5">
          <span className="h-2 w-2 rounded-full bg-[#4caa76]" /> Live customer signals
        </div>
        <div className="overflow-hidden rounded-2xl bg-[#153d30] text-white shadow-[0_24px_70px_-32px_rgba(18,58,43,0.65)]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-[#a8c8b4]">PORTFOLIO OVERVIEW</p>
              <p className="mt-1 text-sm font-semibold">Customer sentiment</p>
            </div>
            <span className="rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-medium text-[#c7ddd0]">Illustrative view</span>
          </div>
          <div className="space-y-4 px-5 py-5">
            {[
              { label: 'Positive', value: 62, color: 'bg-[#77c99a]' },
              { label: 'Neutral', value: 25, color: 'bg-[#efb969]' },
              { label: 'Negative', value: 13, color: 'bg-[#ed8067]' },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex justify-between text-xs"><span className="text-[#d0e0d5]">{item.label}</span><span className="font-bold">{item.value}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mx-5 mb-5 rounded-xl border border-[#e38b6d]/30 bg-[#563e34]/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#f1b39d]">Attention needed</p>
                <h2 className="mt-1 text-sm font-bold">ABC Technologies</h2>
              </div>
              <CircleAlert className="h-4 w-4 shrink-0 text-[#f1a084]" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
              <p className="text-[#d5d6cb]">Purchase frequency <span className="block font-semibold text-white">down 35%</span></p>
              <p className="text-[#d5d6cb]">Churn probability <span className="block font-semibold text-[#f3b47f]">Elevated</span></p>
              <p className="text-[#d5d6cb]">Customer value <span className="block font-semibold text-white">₹4.8L</span></p>
              <p className="text-[#d5d6cb]">Recent sentiment <span className="block font-semibold text-white">Neutral</span></p>
            </div>
            <div className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-5 text-[#e7ddd2]">
              <span className="font-bold text-white">Recommended action</span><br />Schedule a follow-up within 2 days and offer a renewal discussion.
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-white/10 bg-[#103327] px-4 py-3 text-center">
            <div><p className="text-base font-bold">360°</p><p className="text-[9px] text-[#a8c8b4]">account view</p></div>
            <div className="border-x border-white/10"><p className="text-base font-bold">AI</p><p className="text-[9px] text-[#a8c8b4]">risk signals</p></div>
            <div><p className="text-base font-bold">Next</p><p className="text-[9px] text-[#a8c8b4]">best action</p></div>
          </div>
        </div>
      </div>
    </section>

    <section id="intelligence" className="border-y border-[#dce6de] bg-white/65">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-3 md:py-14">
        <div className="flex gap-3"><HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-[#ed7653]" /><div><h2 className="text-sm font-bold">Customer 360 profiles</h2><p className="mt-1 text-sm leading-6 text-[#647168]">Bring contacts, orders, pipeline, interactions, feedback, and account health together.</p></div></div>
        <div className="flex gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#d99145]" /><div><h2 className="text-sm font-bold">Catch risk earlier</h2><p className="mt-1 text-sm leading-6 text-[#647168]">Spot drops in purchase activity, overdue follow-ups, and negative feedback before renewal.</p></div></div>
        <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#398660]" /><div><h2 className="text-sm font-bold">A focused sales workflow</h2><p className="mt-1 text-sm leading-6 text-[#647168]">Give managers and sales teams clear ownership, useful analytics, and recommended actions.</p></div></div>
      </div>
    </section>

    <section id="retention" className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:py-20">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ba5e43]">Retention planning</p>
        <h2 className="mt-3 max-w-md font-serif text-3xl leading-tight text-[#17382b] sm:text-4xl">Turn a risk signal into a retention plan.</h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-[#647168]">Model a retention offer against a portfolio-level risk estimate, then use account profiles to coordinate the follow-up.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#dce6de] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#78867c]">Current situation · example</p>
          <div className="mt-5 space-y-4">
            <div><p className="text-2xl font-bold text-[#17382b]">1,284</p><p className="text-xs text-[#6b786f]">At-risk customers</p></div>
            <div><p className="text-2xl font-bold text-[#bd5942]">₹18.4L</p><p className="text-xs text-[#6b786f]">Potential revenue at risk</p></div>
          </div>
        </div>
        <div className="rounded-xl bg-[#174d3b] p-5 text-white">
          <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-[#b5d3bf]">Simulation</p><span className="rounded bg-white/10 px-2 py-1 text-[10px]">10% retention offer</span></div>
          <div className="mt-5 space-y-3 text-sm">
            <p className="flex justify-between gap-3 text-[#d8e7dc]">Estimated retained <strong className="text-white">+210 customers</strong></p>
            <p className="flex justify-between gap-3 text-[#d8e7dc]">Revenue recovered <strong className="text-white">₹4.2L</strong></p>
            <p className="flex justify-between gap-3 text-[#d8e7dc]">Campaign cost <strong className="text-[#f2b296]">₹1.1L</strong></p>
          </div>
          <p className="mt-4 border-t border-white/15 pt-3 text-[10px] leading-4 text-[#b5d3bf]">Illustrative planning scenario. Forecasts are not live account totals.</p>
        </div>
      </div>
    </section>

    <section id="pricing" className="border-t border-[#dce6de] bg-[#e9f1e9]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ba5e43]">Straightforward plans</p><h2 className="mt-2 font-serif text-3xl text-[#17382b]">Start small. Grow with clarity.</h2></div>
          <p className="max-w-sm text-sm leading-6 text-[#647168]">A one-week free tier to explore, or a paid subscription with introductory pricing.</p>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <article className="flex flex-col rounded-xl border border-[#cbd9ce] bg-white p-6 sm:p-7">
            <div className="flex items-center justify-between"><h3 className="font-bold text-[#17382b]">Free tier</h3><span className="rounded-full bg-[#e9f4ec] px-2.5 py-1 text-[10px] font-bold text-[#34724f]">7 days</span></div>
            <p className="mt-2 text-sm text-[#647168]">Explore Insight360 with a full week to evaluate your workflow.</p>
            <p className="mt-5 font-serif text-4xl text-[#17382b]">$0 <span className="font-sans text-sm text-[#78867c]">for 1 week</span></p>
            <ul className="mt-5 space-y-2 text-sm text-[#53645a]"><li className="flex gap-2"><Check className="h-4 w-4 text-[#398660]" /> Customer profiles and sales workspace</li><li className="flex gap-2"><Check className="h-4 w-4 text-[#398660]" /> Sentiment and retention insights</li></ul>
            <button onClick={() => onGetStarted('trial')} className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg bg-[#174d3b] px-4 py-3 text-sm font-bold text-white hover:bg-[#103c2d]">Start free week <ArrowRight className="h-4 w-4" /></button>
          </article>
          <article className="flex flex-col rounded-xl border border-[#174d3b] bg-[#174d3b] p-6 text-white sm:p-7">
            <div className="flex items-center justify-between"><h3 className="font-bold">Insight360 Plus</h3><span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-[#d6e9dc]">Most flexible</span></div>
            <p className="mt-2 text-sm text-[#c1d8c8]">Continue using the complete customer intelligence workspace.</p>
            <p className="mt-5 font-serif text-4xl">$20 <span className="font-sans text-sm text-[#c1d8c8]">/ month for first 3 months</span></p>
            <p className="mt-1 text-xs text-[#c1d8c8]">Then $26 / month for the rest of the subscription.</p>
            <ul className="mt-5 space-y-2 text-sm text-[#e2eee5]"><li className="flex gap-2"><Check className="h-4 w-4 text-[#9ed1ad]" /> Everything in the free tier</li><li className="flex gap-2"><Check className="h-4 w-4 text-[#9ed1ad]" /> Ongoing access after the trial period</li></ul>
            <button onClick={() => onGetStarted('paid')} className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg bg-[#ed7653] px-4 py-3 text-sm font-bold text-white hover:bg-[#d85f40]">Choose paid plan <ArrowRight className="h-4 w-4" /></button>
          </article>
        </div>
        <p className="mt-4 text-center text-[11px] leading-5 text-[#718077]">Paid checkout is not connected yet. Selecting a paid plan will require a payment provider before subscriptions can be charged.</p>
      </div>
    </section>

    <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-[#738078] sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <span>© {new Date().getFullYear()} Insight360 Customer Intelligence</span>
      <button onClick={onSignIn} className="self-start font-semibold text-[#315446] hover:text-[#102f23]">Already have an account? Sign in</button>
    </footer>
  </main>
);

import React from 'react';
import { ArrowLeft, ArrowRight, CreditCard, ShieldCheck, Workflow } from 'lucide-react';

interface PlusCheckoutPageProps {
  onBack: () => void;
  onStartTrial: () => void;
}

const checkoutUrl = import.meta.env.VITE_INSIGHT360_PLUS_CHECKOUT_URL;

export const PlusCheckoutPage: React.FC<PlusCheckoutPageProps> = ({ onBack, onStartTrial }) => (
  <main className="min-h-screen bg-[#f3f7f1] px-5 py-6 text-[#172820] sm:px-8 sm:py-10">
    <header className="mx-auto flex max-w-5xl items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#174d3b] text-white"><Workflow className="h-5 w-5" /></span>
        <span className="text-lg font-bold">Insight<span className="text-[#ed7653]">360</span></span>
      </div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-[#52675a] hover:text-[#17382b]"><ArrowLeft className="h-4 w-4" /> Back</button>
    </header>

    <div className="mx-auto grid max-w-5xl gap-10 py-10 sm:py-16 lg:grid-cols-[1fr_0.85fr] lg:items-start">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ba5e43]">Insight360 Plus</p>
        <h1 className="mt-3 max-w-lg font-serif text-4xl leading-tight text-[#17382b]">Keep your customer intelligence moving.</h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-[#647168]">A paid Insight360 subscription is for the business or team operating this workspace. Your company’s customers are never charged to view their own customer profiles.</p>
        <div className="mt-8 flex items-start gap-3 border-t border-[#d7e2d8] pt-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#398660]" />
          <p className="text-sm leading-6 text-[#56655c]">Payments are handled only by the configured secure checkout provider. Insight360 does not collect or store card details on this page.</p>
        </div>
      </section>

      <section className="rounded-lg border border-[#d4dfd5] bg-white p-5 shadow-[0_16px_46px_-32px_rgba(23,56,43,0.45)] sm:p-7">
        <div className="flex items-center justify-between border-b border-[#e1e8e1] pb-4">
          <div><h2 className="text-sm font-bold text-[#17382b]">Plus subscription</h2><p className="mt-1 text-xs text-[#748078]">Billed to your workspace owner</p></div>
          <CreditCard className="h-5 w-5 text-[#398660]" />
        </div>
        <div className="py-5">
          <p className="font-serif text-4xl text-[#17382b]">$20 <span className="font-sans text-sm text-[#748078]">/ month</span></p>
          <p className="mt-1 text-sm text-[#56655c]">for your first 3 months</p>
          <p className="mt-4 border-t border-[#e1e8e1] pt-4 text-sm text-[#56655c]">Then <strong className="text-[#17382b]">$26 / month</strong> for the rest of the subscription.</p>
          <p className="mt-3 text-xs leading-5 text-[#748078]">The payment provider will show the final billing terms before you confirm payment.</p>
        </div>

        {checkoutUrl ? (
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-[#e1e8e1] bg-[#f8faf8] p-4 text-center">
             <img src={checkoutUrl} alt="Insight360 Plus Subscription QR code" className="h-44 w-44 object-contain" />
             <p className="mt-2 text-xs font-bold text-[#315446]">Scan &amp; Pay to Subscribe</p>
             <p className="text-[10px] text-[#718077]">Use your UPI or payment application.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#e9c6b8] bg-[#fff5f0] p-4">
            <p className="text-sm font-bold text-[#9f4f3a]">Secure checkout is not connected yet</p>
            <p className="mt-1 text-xs leading-5 text-[#765e55]">No payment will be taken. Configure the Insight360 Plus hosted checkout URL to enable subscriptions.</p>
          </div>
        )}

        <button onClick={onStartTrial} className="mt-4 w-full rounded-lg border border-[#ccd9ce] px-4 py-3 text-sm font-semibold text-[#315446] hover:bg-[#f3f7f1]">Start with the free 7-day tier</button>
        <p className="mt-4 text-center text-[10px] leading-4 text-[#879087]">Customer accounts remain free. Only the Insight360 workspace owner subscribes to Plus.</p>
      </section>
    </div>
  </main>
);

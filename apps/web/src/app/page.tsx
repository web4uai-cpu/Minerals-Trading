export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <div className="mb-6">
          <span className="text-6xl">⬡</span>
        </div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-accent-light to-accent bg-clip-text text-transparent">
          Khanij Nexus
        </h1>
        <p className="text-lg text-base-500 mb-8">
          India&apos;s AI-Powered Mines &amp; Minerals Trade, Verification &amp;
          Arbitration Platform
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <span className="px-3 py-1 rounded-full text-sm bg-base-200 text-base-500 border border-base-300">
            Pre-Alpha
          </span>
          <span className="px-3 py-1 rounded-full text-sm bg-base-200 text-sage border border-sage/30">
            API: localhost:4000
          </span>
          <span className="px-3 py-1 rounded-full text-sm bg-base-200 text-accent border border-accent/30">
            TypeScript · NestJS · Next.js
          </span>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 text-left">
          <div className="p-4 rounded-lg bg-base-50 border border-base-300">
            <h2 className="font-semibold text-accent mb-1">Verification Engine</h2>
            <p className="text-sm text-base-500">Mining lease, EC, IBM returns, royalty checks → TrustScore</p>
          </div>
          <div className="p-4 rounded-lg bg-base-50 border border-base-300">
            <h2 className="font-semibold text-accent mb-1">AI Discovery</h2>
            <p className="text-sm text-base-500">Natural-language search → ranked, verified sellers</p>
          </div>
          <div className="p-4 rounded-lg bg-base-50 border border-base-300">
            <h2 className="font-semibold text-accent mb-1">Deal Rooms</h2>
            <p className="text-sm text-base-500">Quotes, contracts, milestones, AI co-pilot chat</p>
          </div>
          <div className="p-4 rounded-lg bg-base-50 border border-base-300">
            <h2 className="font-semibold text-accent mb-1">Arbitration</h2>
            <p className="text-sm text-base-500">Structured disputes, evidence vault, enforceable awards</p>
          </div>
        </div>
      </div>
    </main>
  );
}

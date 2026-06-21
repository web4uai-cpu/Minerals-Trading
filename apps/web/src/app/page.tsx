import Link from 'next/link';

const FEATURES = [
  {
    title: 'Verified Sellers',
    description: 'Mining lease, environmental clearance, IBM returns — 12-point compliance verification with TrustScore.',
    icon: '🛡️',
  },
  {
    title: 'AI-Powered Discovery',
    description: 'Natural language search finds verified sellers with fair pricing. No middlemen, no guesswork.',
    icon: '🔍',
  },
  {
    title: 'Secure Deal Rooms',
    description: 'Escrow-protected transactions, AI-drafted contracts, milestone tracking, real-time chat.',
    icon: '🤝',
  },
  {
    title: 'Structured Arbitration',
    description: 'Evidence vault, blockchain-anchored audit trail, enforceable arbitration awards.',
    icon: '⚖️',
  },
];

const STATS = [
  { label: 'Avg Deal Size', value: '250+ MT' },
  { label: 'Minerals', value: '5 Categories' },
  { label: 'Verification', value: '12-Point Check' },
  { label: 'Settlement', value: '8 Currencies' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-hero-pattern relative overflow-hidden">
      {/* Hero Section */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <span className="text-3xl">⬡</span>
          <span className="text-xl font-bold text-gradient-gold">Khanij Nexus</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-base-500 hover:text-white transition-colors no-underline"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="glass glass-hover px-5 py-2.5 text-sm font-semibold text-accent-light no-underline transition-all hover:no-underline"
          >
            Start Trading
          </Link>
        </div>
      </header>

      {/* Main Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-16 pb-24">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-block glass px-4 py-1.5 text-xs font-medium text-accent-light mb-6 rounded-full">
            India&apos;s First AI-Powered B2B Mineral Marketplace
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
            <span className="text-white">Trade Minerals</span>
            <br />
            <span className="text-gradient-gold">With Confidence</span>
          </h1>

          <p className="text-lg md:text-xl text-base-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Verified compliance, AI-matched discovery, escrow-protected deals, and
            structured arbitration — for India&apos;s mines &amp; minerals industry.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="bg-accent hover:bg-accent-dark text-white font-semibold px-8 py-3.5 rounded-xl transition-all no-underline hover:no-underline shadow-lg shadow-accent/20 hover:shadow-accent/30"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="glass glass-hover px-8 py-3.5 font-semibold text-white no-underline hover:no-underline"
            >
              Sign In →
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="glass-strong px-8 py-5 mb-20 w-full max-w-3xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <div className="font-mono-nums text-xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-base-500 mt-1 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl w-full">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="glass glass-hover p-6 transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-base-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-base-500">⬡ Khanij Nexus</span>
            <span className="text-xs text-base-400">Pre-Alpha · Sandbox Mode</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-base-500">
            <span>Pilot: Odisha · Iron Ore</span>
            <span>NestJS · Next.js · PostgreSQL</span>
            <span>Strict TypeScript</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

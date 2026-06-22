import Link from 'next/link';

const PILLARS = [
  {
    icon: '⚖️',
    title: 'The Small Lot is a Priority',
    description:
      'We welcome traders with limited capital and small lot sizes, giving them direct access to the same verified buyers and sellers as industry giants. Your budget does not determine your access.',
  },
  {
    icon: '🔒',
    title: 'Zero-Risk Environment',
    description:
      "Every rupee of your hard-earned capital is treated with the highest level of respect. Our 'Money Secured' escrow protocol ensures your funds are fully protected until the deal is successfully closed.",
  },
  {
    icon: '✅',
    title: 'A Culture of Accountability',
    description:
      'By eliminating the cheating culture through mandatory background checks and KYC verification, we are fostering a community where genuine parties can grow their businesses without fear.',
  },
  {
    icon: '🤝',
    title: 'End-to-End Support',
    description:
      'We are more than a digital platform — we are your partners in growth. We provide the support needed to navigate the complexities of mining and trading so every transaction is a step toward your success.',
  },
];

const VALUES = [
  { icon: '⭐', label: 'Integrity', desc: 'Non-negotiable in every transaction' },
  { icon: '🌍', label: 'Inclusion', desc: 'Equal access regardless of budget' },
  { icon: '🛡️', label: 'Security', desc: 'Escrow-backed, verified deals only' },
  { icon: '🔍', label: 'Transparency', desc: 'No hidden middlemen, no surprises' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-hero-pattern relative overflow-hidden">
      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span className="text-3xl">⬡</span>
          <span className="text-xl font-bold text-gradient-gold">Mineral Trade</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/about" className="px-4 py-2 text-sm font-medium text-accent-light no-underline">About</Link>
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-base-500 hover:text-white transition-colors no-underline">Sign In</Link>
          <Link href="/register" className="glass glass-hover px-5 py-2.5 text-sm font-semibold text-accent-light no-underline transition-all hover:no-underline">
            Start Trading
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 pt-16 pb-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block glass px-4 py-1.5 text-[10px] tracking-[0.3em] uppercase font-semibold text-accent-light mb-6 rounded-full">
            Our Story
          </span>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
            <span className="text-white">Rooted in Odisha.</span>
            <br />
            <span className="text-gradient-gold">Built for Everyone.</span>
          </h1>
          <p className="text-lg text-base-500 max-w-2xl mx-auto leading-relaxed">
            We are a firm founded on a single, non-negotiable principle — integrity
            should not depend on the size of your budget.
          </p>
        </div>
      </section>

      {/* Mission Quote */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="glass-strong p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">❤️</span>
                <span className="text-[10px] tracking-[0.25em] uppercase font-semibold text-accent-light">
                  The Heart of Our Mission
                </span>
              </div>
              <blockquote className="text-2xl md:text-3xl font-bold leading-snug mb-6 text-white">
                &ldquo;In the fast-paced world of mineral trading and mining logistics,{' '}
                <span className="text-gradient-gold">trust has often become a luxury.</span>{' '}
                We are here to change that.&rdquo;
              </blockquote>
              <p className="text-base-500 leading-relaxed text-sm md:text-base">
                For too long, the industry has been dominated by a &ldquo;big player&rdquo; mentality,
                where small-scale businessmen and independent traders are left to navigate a landscape
                filled with uncertainty, hidden middlemen, and the constant fear of being cheated.
                Mineral Trade was founded to end that.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] tracking-[0.3em] uppercase font-semibold text-accent-light">
              Our Purpose
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold mt-2 mb-4 text-white">
              Empowering the Small-Scale Entrepreneur
            </h2>
            <p className="text-base-500 max-w-2xl mx-auto leading-relaxed">
              We recognized a significant gap — hardworking individuals with limited capital were
              being excluded from genuine opportunities or, worse, falling victim to fraud.
              Mineral Trade was built to level the playing field.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="glass glass-hover p-6 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-4 text-xl">
                  {pillar.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{pillar.title}</h3>
                <p className="text-sm text-base-500 leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] tracking-[0.3em] uppercase font-semibold text-accent-light">
              What We Stand For
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold mt-2 text-white">
              Our Core Values
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {VALUES.map((v) => (
              <div key={v.label} className="glass p-5 text-center transition-all duration-200 hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3 text-lg">
                  {v.icon}
                </div>
                <h4 className="text-lg font-bold text-white mb-1">{v.label}</h4>
                <p className="text-xs text-base-500 leading-snug">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Odisha Roots */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="glass-strong p-8 md:p-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🏭</span>
              <span className="text-[10px] tracking-[0.25em] uppercase font-semibold text-accent-light">
                Our Commitment to You
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight text-white mb-5">
              From the Industrial Heart of Odisha
            </h2>
            <p className="text-base-500 leading-relaxed text-sm mb-4">
              As a firm rooted in Odisha — a state that produces some of India&apos;s richest
              mineral wealth — we understand the ground realities of this industry better than
              anyone. From the sidings of Paradip Port to the mines of Keonjhar and Sundargarh,
              we have seen firsthand how the small trader struggles for fair access.
            </p>
            <p className="text-base-500 leading-relaxed text-sm mb-6">
              Mineral Trade is our answer to that struggle. We aren&apos;t just facilitating
              trades — we are building a{' '}
              <span className="text-white font-semibold">legacy of trust</span> where{' '}
              <span className="text-gradient-gold font-semibold">access is for all.</span>
            </p>
            <div className="flex items-center gap-3 pt-2 border-t border-white/5">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20 text-lg">
                🛡️
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Mineral Trade Founding Team</p>
                <p className="text-xs text-base-500">Odisha, India</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 pb-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="glass-strong p-10 md:p-14 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent" />
            <div className="relative z-10">
              <div className="text-4xl mb-5">🤝</div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                Join Our Verified Community
              </h2>
              <p className="text-base-500 mb-8 leading-relaxed">
                Whether you&apos;re moving ten tonnes of ore or managing a single excavator —
                you deserve institutional-grade security. Register today and trade with confidence.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-white font-semibold px-8 py-3.5 rounded-xl transition-all no-underline hover:no-underline shadow-lg shadow-accent/20 hover:shadow-accent/30"
              >
                Register Now — It&apos;s Free
                <span>→</span>
              </Link>
              <p className="text-xs text-base-500 mt-4">
                KYC verification takes 24–48 hours. No fees to register.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-base-500">⬡ Mineral Trade</span>
            <span className="text-xs text-base-400">Pilot: Odisha</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-base-500">
            <Link href="/" className="hover:text-white transition-colors no-underline">Home</Link>
            <Link href="/about" className="hover:text-white transition-colors no-underline text-accent-light">About</Link>
            <Link href="/login" className="hover:text-white transition-colors no-underline">Sign In</Link>
            <Link href="/register" className="hover:text-white transition-colors no-underline">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

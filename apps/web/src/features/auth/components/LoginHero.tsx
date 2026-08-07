import { ArcSynLogo } from '@/features/auth/components/ArcSynLogo';

export function LoginHero() {
  return (
    <section className="login-hero" aria-labelledby="login-hero-title">
      <ArcSynLogo />
      <div className="login-hero__copy">
        <p className="login-hero__eyebrow">Workforce orchestration</p>
        <h2 id="login-hero-title">Every shift, aligned.</h2>
        <p>
          One focused workspace to coordinate people, schedules, and the work that keeps teams
          moving.
        </p>
      </div>
      <div className="login-hero__visual" aria-hidden="true">
        <svg viewBox="0 0 720 430" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="shift-flow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#90dddf" stopOpacity="0.92" />
              <stop offset="1" stopColor="#4e6d87" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          <path className="login-hero__orbit" d="M79 281C180 80 524 34 662 191" />
          <path
            className="login-hero__orbit login-hero__orbit--inner"
            d="M93 339C236 148 490 122 626 254"
          />
          <path className="login-hero__signal" d="M84 306 205 215l103 45 131-133 190 92" />
          <circle cx="205" cy="215" r="8" />
          <circle cx="308" cy="260" r="8" />
          <circle cx="439" cy="127" r="8" />
          <rect x="86" y="285" width="106" height="42" rx="8" />
          <rect x="500" y="199" width="126" height="42" rx="8" />
          <path className="login-hero__accent" d="m97 306 18 8 31-18 35 10" />
          <path className="login-hero__accent" d="m511 220 20-6 29 8 54-17" />
          <path className="login-hero__glow" d="M1 429 267 164 408 282 688 0h32v430Z" />
        </svg>
      </div>
      <p className="login-hero__footer">Designed for calm operations at any scale.</p>
    </section>
  );
}

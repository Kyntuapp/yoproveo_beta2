import { useEffect } from 'react';
import LandingHeader from './LandingHeader';
import LandingHero from './LandingHero';
import LandingProblema from './LandingProblema';
import LandingFlujo from './LandingFlujo';
import LandingPorQue from './LandingPorQue';
import LandingCta from './LandingCta';
import LandingFooter from './LandingFooter';

export default function LandingPage() {
  useEffect(() => {
    document.body.classList.add('landing-page');
    return () => {
      document.body.classList.remove('landing-page');
    };
  }, []);

  return (
    <div className="landing">
      <div className="landing__glow landing__glow--1" aria-hidden="true" />
      <div className="landing__glow landing__glow--2" aria-hidden="true" />

      <LandingHeader />
      <main>
        <LandingHero />
        <LandingProblema />
        <LandingFlujo />
        <LandingPorQue />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}

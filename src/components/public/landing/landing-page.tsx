import styles from "./landing.module.css";
import { EventInfoSection } from "./event-info-section";
import { Footer } from "./footer";
import { Header } from "./header";
import { HeroSection } from "./hero-section";
import { ImportantInfoSection } from "./important-info-section";
import { RegistrationCTA } from "./registration-cta";
import { RegistrationFlow } from "./registration-flow";

export function LandingPage() {
  return (
    <div className={`${styles.root} min-h-screen`}>
      <Header />
      <main className="pt-[76px]">
        <HeroSection />
        <EventInfoSection />
        <RegistrationFlow />
        <ImportantInfoSection />
        <RegistrationCTA />
      </main>
      <Footer />
    </div>
  );
}

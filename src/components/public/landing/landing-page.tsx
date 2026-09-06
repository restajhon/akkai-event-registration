import styles from "./landing.module.css";
import { EventInfoSection } from "./event-info-section";
import { Footer } from "./footer";
import { GeneralEventRundown } from "./general-event-rundown";
import { Header } from "./header";
import { HeroSection } from "./hero-section";
import { ImportantInfoSection } from "./important-info-section";
import { PackageSection } from "./package-section";
import { RegistrationCTA } from "./registration-cta";
import { RegistrationFlow } from "./registration-flow";

export function LandingPage() {
  return (
    <div className={`${styles.root} min-h-screen`}>
      <Header />
      <main>
        <HeroSection />
        <EventInfoSection />
        <GeneralEventRundown />
        <RegistrationFlow />
        <PackageSection />
        <ImportantInfoSection />
        <RegistrationCTA />
      </main>
      <Footer />
    </div>
  );
}

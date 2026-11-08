/** Landing page: header, hero, services, flow, financing, area, reviews, estimate form. */

import { useState } from "react";
import {
  EstimateForm,
  Financing,
  Footer,
  Header,
  Hero,
  HowItWorks,
  Reviews,
  ServiceArea,
  Services,
} from "../components/Sections.tsx";
import { siteConfig } from "../config.ts";

export default function Home() {
  const [selectedService, setSelectedService] = useState<string>(
    siteConfig.estimateForm.services[0] ?? "Roof Repair",
  );

  function handleEstimate(serviceName: string) {
    // Map the service card name onto the estimate form's options.
    const match = siteConfig.estimateForm.services.find((s) => s === serviceName);
    setSelectedService(match ?? siteConfig.estimateForm.services[0] ?? "Roof Repair");
    document.getElementById("estimate")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services onEstimate={handleEstimate} />
        <HowItWorks />
        <Financing />
        <ServiceArea />
        <Reviews />
        <EstimateForm selectedService={selectedService} onServiceChange={setSelectedService} />
      </main>
      <Footer />
    </>
  );
}

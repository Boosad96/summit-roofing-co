/**
 * Summit Roofing Co. — hash-routed single-page app.
 *
 * Routes:
 *   #/          landing page
 *   #/deposit   pay the deposit / save a card on file
 *   #/invoice   owner demo: bill the final balance
 *
 * Hash routing is deliberate: it works on plain static hosting with no
 * server rewrites, and Whop's returnUrl params (`?payment=&status=`) are
 * read from the fragment as well as the query string (see Deposit page).
 */

import { useEffect, useState } from "react";
import { WhopElements } from "@whop/elements-react";
import { loadWhop } from "@whop/elements";
import Home from "./pages/Home.tsx";
import Deposit from "./pages/Deposit.tsx";
import InvoiceDemo from "./pages/InvoiceDemo.tsx";

const whopElements = loadWhop();

function routeFromHash(): string {
  const hash = window.location.hash.replace(/^#/, "");
  const path = hash.split("?")[0] ?? "";
  return path === "/deposit" || path === "/invoice" ? path : "/";
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <WhopElements elements={whopElements}>
      {route === "/deposit" ? <Deposit /> : route === "/invoice" ? <InvoiceDemo /> : <Home />}
    </WhopElements>
  );
}

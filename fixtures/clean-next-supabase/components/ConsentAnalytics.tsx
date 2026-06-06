"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";

function subscribeToConsent(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getConsentSnapshot() {
  return window.localStorage.getItem("analytics-consent") === "yes";
}

function getServerConsentSnapshot() {
  return false;
}

export default function ConsentAnalytics() {
  const analyticsConsent = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getServerConsentSnapshot
  );

  if (!analyticsConsent) {
    return null;
  }

  return (
    <>
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-CLEAN1" />
      <Script id="gtag-clean">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-CLEAN1');
        `}
      </Script>
    </>
  );
}

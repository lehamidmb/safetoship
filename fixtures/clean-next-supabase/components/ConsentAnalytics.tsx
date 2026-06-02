"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

export default function ConsentAnalytics() {
  const [analyticsConsent, setAnalyticsConsent] = useState(false);

  useEffect(() => {
    setAnalyticsConsent(window.localStorage.getItem("analytics-consent") === "yes");
  }, []);

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

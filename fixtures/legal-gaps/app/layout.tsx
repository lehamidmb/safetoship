import Script from "next/script";

export const metadata = {
  title: "Legal Gaps"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-LEGAL1" />
        <Script id="gtag-legal">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-LEGAL1');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}

import Script from "next/script";

export const metadata = {
  title: "Demo Launch App"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-DEMO123" />
        <Script id="gtag">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-DEMO123');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}

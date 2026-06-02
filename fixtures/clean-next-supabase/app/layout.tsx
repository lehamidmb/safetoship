import ConsentAnalytics from "../components/ConsentAnalytics";

export const metadata = {
  title: "Clean Next Supabase"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ConsentAnalytics />
      </body>
    </html>
  );
}

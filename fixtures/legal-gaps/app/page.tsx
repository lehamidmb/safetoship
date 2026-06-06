import type { Metadata } from "next";
import LegalGapsClient from "../components/LegalGapsClient";

export const metadata: Metadata = {
  title: "Legal Gaps",
  description: "An intentionally incomplete compliance fixture for SafeToShip."
};

export default function Page() {
  return <LegalGapsClient />;
}

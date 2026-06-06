import type { Metadata } from "next";
import CostAbuseClient from "../components/CostAbuseClient";

export const metadata: Metadata = {
  title: "Cost Abuse",
  description: "An intentionally vulnerable cost-abuse fixture for SafeToShip."
};

export default function Page() {
  return <CostAbuseClient />;
}

import type { Metadata } from "next";
import DemoLaunchClient from "../components/DemoLaunchClient";

export const metadata: Metadata = {
  title: "Demo Launch App",
  description: "An intentionally insecure app used to demonstrate SafeToShip findings."
};

export default function Page() {
  return <DemoLaunchClient />;
}

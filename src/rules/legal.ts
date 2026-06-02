import type { Finding, ProjectFile } from "../types.js";
import { fixPrompt } from "../fixPrompt.js";
import { lineForIndex } from "../project.js";

const PLACEHOLDER_POLICY = /(\[your company\]|\[company name\]|lorem ipsum|TODO:?\s+privacy|coming soon|placeholder)/i;
const PRIVACY_PATH = /(^|\/)(privacy|privacy-policy)(\/|\.|$)|PRIVACY\.md$/i;
const TERMS_PATH = /(^|\/)(terms|terms-of-use|terms-and-conditions)(\/|\.|$)|TERMS\.md$/i;

const VENDORS = [
  { name: "Google Analytics", regex: /(gtag\(|google-analytics|googletagmanager|G-[A-Z0-9]{6,})/i },
  { name: "Mixpanel", regex: /mixpanel/i },
  { name: "PostHog", regex: /posthog/i },
  { name: "Amplitude", regex: /amplitude/i },
  { name: "Segment", regex: /segment\.com|analytics\.track/i },
  { name: "Stripe", regex: /stripe/i },
  { name: "Supabase", regex: /supabase/i },
  { name: "OpenAI", regex: /openai/i },
  { name: "Anthropic", regex: /anthropic/i },
  { name: "Resend", regex: /resend/i },
  { name: "Twilio", regex: /twilio/i }
];

export function runLegalRules(files: ProjectFile[]): Finding[] {
  return [
    ...findMissingPrivacyPolicy(files),
    ...findMissingTerms(files),
    ...findPolicyUnderDeclaration(files),
    ...findPreConsentTracking(files),
    ...findTrademarkAttestation(files),
    ...findMissingSecurityContact(files)
  ];
}

export function findMissingPrivacyPolicy(files: ProjectFile[]): Finding[] {
  const collecting = findDataCollectionSignal(files);
  if (!collecting) {
    return [];
  }

  const privacyFiles = files.filter((file) => PRIVACY_PATH.test(file.relativePath) || /privacy policy/i.test(file.content));
  const hasUsablePolicy = privacyFiles.some((file) => !PLACEHOLDER_POLICY.test(file.content) && /privacy/i.test(file.content));

  if (hasUsablePolicy) {
    return [];
  }

  return [
    {
      id: "STS-LEGAL-001",
      title: "Data collection signals exist, but no usable privacy policy was found",
      severity: "BLOCKER",
      family: "legal-compliance",
      file: collecting.file.relativePath,
      line: collecting.line,
      why: "The app appears to collect user data through email, auth, cookies, analytics, or payments, but SafeToShip could not find a real privacy policy. Placeholder policies count as missing.",
      fixPrompt: fixPrompt(
        "This app appears to collect user data but does not have a usable privacy policy.",
        "Create a plain-language privacy policy route and/or PRIVACY.md that names what data is collected, why, where it is processed, third-party providers, retention, user rights, and a contact email. Add a visible link in the app."
      )
    }
  ];
}

export function findMissingTerms(files: ProjectFile[]): Finding[] {
  const signal = findTermsNeedSignal(files);
  if (!signal) {
    return [];
  }

  const termsFiles = files.filter((file) => TERMS_PATH.test(file.relativePath) || /terms of (use|service)|limitation of liability|governing law/i.test(file.content));
  const hasUsableTerms = termsFiles.some((file) => !PLACEHOLDER_POLICY.test(file.content));

  if (hasUsableTerms) {
    return [];
  }

  const payments = /stripe|checkout|payment|subscription|billing/i.test(signal.file.content);
  return [
    {
      id: "STS-LEGAL-002",
      title: "Terms of Use are missing for an account, payment, or user-content app",
      severity: payments ? "BLOCKER" : "HIGH",
      family: "legal-compliance",
      file: signal.file.relativePath,
      line: signal.line,
      why: payments
        ? "The app appears to handle payments but has no usable Terms of Use. That is a launch blocker because pricing, refunds, liability, and acceptable use are not defined."
        : "The app appears to have accounts or user-generated content but no usable Terms of Use. That creates avoidable legal and moderation risk.",
      fixPrompt: fixPrompt(
        "This app appears to need Terms of Use but does not have a usable terms page or TERMS.md.",
        "Draft a Terms of Use page covering account rules, acceptable use, refunds if relevant, disclaimers, limitation of liability, termination, governing law, and a contact email. Mark it for legal review."
      )
    }
  ];
}

export function findPolicyUnderDeclaration(files: ProjectFile[]): Finding[] {
  const privacyFiles = files.filter((file) => PRIVACY_PATH.test(file.relativePath) || /privacy policy/i.test(file.content));
  if (privacyFiles.length === 0) {
    return [];
  }

  const policyText = privacyFiles.map((file) => file.content).join("\n").toLowerCase();
  const detectedVendors = VENDORS.filter((vendor) => files.some((file) => vendor.regex.test(file.content)));
  const undeclared = detectedVendors.filter((vendor) => !policyText.includes(vendor.name.toLowerCase().split(" ")[0]));

  if (undeclared.length === 0) {
    return [];
  }

  const firstVendor = undeclared[0];
  const source = files.find((file) => firstVendor.regex.test(file.content));

  return [
    {
      id: "STS-LEGAL-003",
      title: "Privacy policy may under-declare third-party data sharing",
      severity: "BLOCKER",
      family: "legal-compliance",
      file: source?.relativePath,
      line: source ? lineForIndex(source.content, firstVendor.regex.exec(source.content)?.index ?? 0) : 1,
      why: `Code references ${undeclared.map((vendor) => vendor.name).join(", ")}, but the privacy policy does not appear to name those provider(s). Users should be told which third parties process their data.`,
      fixPrompt: fixPrompt(
        "The code uses third-party providers that the privacy policy does not appear to name.",
        `Update the privacy policy to disclose these providers if they process user data: ${undeclared.map((vendor) => vendor.name).join(", ")}. Include what data is shared, why, retention, and opt-out or rights language where relevant.`
      )
    }
  ];
}

export function findPreConsentTracking(files: ProjectFile[]): Finding[] {
  const layoutFiles = files.filter((file) => /(^|\/)(layout|_document|head)\.(tsx|jsx|ts|js)$/.test(file.relativePath));

  for (const file of layoutFiles) {
    const vendor = VENDORS.find((candidate) => candidate.regex.test(file.content) && /analytics|gtag|mixpanel|posthog|amplitude|segment/i.test(candidate.name + file.content));
    const consentSignal = /consent|cookie banner|opt-in|gdpr|ccpa/i.test(file.content);

    if (vendor && !consentSignal) {
      return [
        {
          id: "STS-LEGAL-004",
          title: "Analytics appears loaded before consent",
          severity: "BLOCKER",
          family: "legal-compliance",
          file: file.relativePath,
          line: lineForIndex(file.content, vendor.regex.exec(file.content)?.index ?? 0),
          why: "Analytics appears to load in a global layout/head file without an obvious consent gate. If the app has EU/UK users, pre-consent tracking can create compliance risk.",
          fixPrompt: fixPrompt(
            "Analytics appears to load before the user has consented.",
            "Gate analytics behind consent where legally required, avoid setting non-essential cookies before opt-in, and document the provider in the privacy policy."
          )
        }
      ];
    }
  }

  return [];
}

export function findTrademarkAttestation(files: ProjectFile[]): Finding[] {
  const productName = extractProductName(files);
  if (!productName) {
    return [];
  }

  if (hasTrademarkAttestation(files, productName.name)) {
    return [];
  }

  return [
    {
      id: "STS-LEGAL-005",
      title: "Product name needs trademark/IP attestation",
      severity: "HIGH",
      family: "legal-compliance",
      file: productName.file.relativePath,
      line: productName.line,
      why: `SafeToShip found the product name "${productName.name}". A static scanner cannot know whether the name creates trademark or IP risk, so this needs a human attestation before launch.`,
      fixPrompt: fixPrompt(
        `The product appears to be named "${productName.name}".`,
        "Do a USPTO/TESS search, a general web search, and a domain/social handle search for confusingly similar names in the same category. Record the result in a launch checklist and ask a lawyer if there is any close match."
      )
    }
  ];
}

export function findMissingSecurityContact(files: ProjectFile[]): Finding[] {
  const collecting = findDataCollectionSignal(files);
  if (!collecting) {
    return [];
  }

  const hasSecurityPolicy = files.some((file) =>
    /(^|\/)(SECURITY\.md|security\.txt)$/i.test(file.relativePath) ||
    /security contact|report a vulnerability|responsible disclosure|security@/i.test(file.content)
  );

  if (hasSecurityPolicy) {
    return [];
  }

  return [
    {
      id: "STS-LEGAL-006",
      title: "No security contact or disclosure policy was found",
      severity: "MEDIUM",
      family: "legal-compliance",
      file: collecting.file.relativePath,
      line: collecting.line,
      why: "The app appears to collect user data, but there is no obvious way for someone to report a vulnerability privately. A security contact is basic launch hygiene for user-facing apps.",
      fixPrompt: fixPrompt(
        "This app appears to collect user data but has no security contact or disclosure policy.",
        "Add a SECURITY.md or security.txt with a private vulnerability reporting path, expected response timeline, and a request not to include exploit details in public issues."
      )
    }
  ];
}

function findDataCollectionSignal(files: ProjectFile[]): { file: ProjectFile; line: number } | undefined {
  const pattern = /(type=["']email["']|name=["']email["']|next-auth|supabase\.auth|signIn\(|document\.cookie|cookies\(|gtag\(|mixpanel|posthog|amplitude|stripe|checkout|analytics)/i;
  return firstSignal(files, pattern);
}

function findTermsNeedSignal(files: ProjectFile[]): { file: ProjectFile; line: number } | undefined {
  const paymentPattern = /(stripe|checkout|subscription|billing|payment)/i;
  const accountOrContentPattern = /(next-auth|supabase\.auth|signIn\(|textarea|contenteditable|upload|comment|user generated|ugc)/i;
  return firstSignal(files, paymentPattern) ?? firstSignal(files, accountOrContentPattern);
}

function firstSignal(files: ProjectFile[], pattern: RegExp): { file: ProjectFile; line: number } | undefined {
  for (const file of files) {
    const match = pattern.exec(file.content);
    if (match) {
      return { file, line: lineForIndex(file.content, match.index) };
    }
  }

  return undefined;
}

function hasTrademarkAttestation(files: ProjectFile[], productName: string): boolean {
  const normalizedName = productName.toLowerCase();
  return files.some((file) => {
    const content = file.content.toLowerCase();
    return (
      /trademark|ip attestation|launch checklist|uspto|tess/.test(content) &&
      content.includes(normalizedName) &&
      /(checked|searched|reviewed|attested|confirmed|clear|no confusingly similar)/.test(content)
    );
  });
}

function extractProductName(files: ProjectFile[]): { name: string; file: ProjectFile; line: number } | undefined {
  const packageFile = files.find((file) => file.relativePath === "package.json");
  if (packageFile) {
    try {
      const parsed = JSON.parse(packageFile.content) as { name?: string };
      if (parsed.name && !parsed.name.startsWith("@")) {
        return { name: parsed.name, file: packageFile, line: 2 };
      }
    } catch {
      // Ignore invalid package.json; other rules may catch it later.
    }
  }

  const readme = files.find((file) => /^readme\.md$/i.test(file.relativePath));
  const heading = readme?.content.match(/^#\s+(.+)$/m);
  if (readme && heading?.[1]) {
    return { name: heading[1].trim(), file: readme, line: lineForIndex(readme.content, heading.index ?? 0) };
  }

  const titleFile = files.find((file) => /(^|\/)(layout|page|_document)\.(tsx|jsx|ts|js)$/.test(file.relativePath) && /title\s*[:=]/i.test(file.content));
  const titleMatch = titleFile?.content.match(/title\s*[:=]\s*["'`]([^"'`]+)["'`]/i);
  if (titleFile && titleMatch?.[1]) {
    return { name: titleMatch[1].trim(), file: titleFile, line: lineForIndex(titleFile.content, titleMatch.index ?? 0) };
  }

  return undefined;
}

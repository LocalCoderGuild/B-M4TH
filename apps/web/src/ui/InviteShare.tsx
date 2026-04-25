import { useState } from "react";

export function InviteShare({ label, link }: { label: string; link: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable; fall back to selection
    }
  };

  return (
    <div className="invite-share">
      <div className="invite-share-label">{label}</div>
      <div className="invite-share-row">
        <input
          className="pixel-input"
          value={link}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="pixel-btn pixel-btn-copy"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy link"}
        >
          {copied ? "[OK]" : "[Copy]"}
        </button>
      </div>
    </div>
  );
}

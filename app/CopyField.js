"use client";

import { useState } from "react";

// Shows a value (like a forwarding address or invite link) with a Copy button.
export default function CopyField({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is still selectable.
    }
  }

  return (
    <div className="copy-field">
      <span className="forward-address">{value}</span>
      <button type="button" className="copy-btn" onClick={copy}>
        {copied ? "Copied!" : label}
      </button>
    </div>
  );
}

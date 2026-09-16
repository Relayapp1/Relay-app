import React, { useId } from "react";

export default function RelayWordmark({ width = 280, dark = false }) {
  const gradId = useId();
  const ink = dark ? "#f2f3f6" : "#161922";
  const road = dark ? "#6e7ce0" : "#4453c4";
  const roadDash = dark ? "#2a2e38" : "#c7cdf5";
  const carAccent = dark ? "#8b96e8" : "#4453c4";
  const wheel = dark ? "#12141a" : "#161922";
  const doorFill = dark ? "#1f2333" : "#e8eafb";
  const fadeStart = dark ? "#f2f3f6" : "#161922";
  const fadeEnd = dark ? "#6e7ce0" : "#4453c4";

  return (
    <svg width={width} height={(width / 560) * 170} viewBox="0 0 560 170" role="img" aria-label="Relay">
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="54" y1="71" x2="170" y2="112">
          <stop offset="0" stopColor={fadeStart} />
          <stop offset="1" stopColor={fadeEnd} />
        </linearGradient>
      </defs>
      <path d="M26 30 V108 M26 30 H52 Q70 30 70 50 Q70 68 52 68 H26" stroke={ink} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M54 71 Q80 92 110 102" stroke={`url(#${gradId})`} strokeWidth="8.5" fill="none" strokeLinecap="round" />
      <path d="M104 100 Q130 108 160 113" stroke={`url(#${gradId})`} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M154 112 Q210 120 270 120" stroke={`url(#${gradId})`} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M154 112 Q210 120 270 120" stroke={roadDash} strokeWidth="1.3" strokeDasharray="4 4.4" fill="none" />
      <path d="M270 120 Q288 128 300 136" stroke={road} strokeWidth="3" fill="none" strokeLinecap="round" />
      <text x="84" y="108" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="112" fill={ink}>elay</text>
      <g transform="translate(285,123)">
        <path d="M0 26 L0 14 L15 1 L30 14 L30 26 Z" fill={road} />
        <rect x="12" y="17" width="6" height="9" rx="1" fill={doorFill} />
      </g>
      <g transform="translate(195,107) rotate(4 16 11)">
        <line x1="-14" y1="6" x2="-3" y2="6" stroke={carAccent} strokeWidth="2" strokeLinecap="round" opacity=".35" />
        <line x1="-18" y1="10" x2="-4" y2="10" stroke={carAccent} strokeWidth="2" strokeLinecap="round" opacity=".5" />
        <line x1="-14" y1="14" x2="-3" y2="14" stroke={carAccent} strokeWidth="2" strokeLinecap="round" opacity=".35" />
        <path d="M2 14 L2 9 L10 9 L10 2 L22 2 L28 9 L33 9 L33 14 Z" fill={carAccent} />
        <circle cx="8" cy="17" r="4.2" fill={wheel} />
        <circle cx="27" cy="17" r="4.2" fill={wheel} />
      </g>
    </svg>
  );
}

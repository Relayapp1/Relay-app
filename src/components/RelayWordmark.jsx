import React from "react";

export default function RelayWordmark({ width = 260, dark = false }) {
  const ink = dark ? "#f2f3f6" : "#111113";
  const road = dark ? "#e8e9ed" : "#111113";
  const roadDash = dark ? "#111113" : "#ffffff";
  const carFill = dark ? "#111113" : "#ffffff";

  return (
    <svg width={width} height={(width / 330) * 175} viewBox="0 0 330 175" role="img" aria-label="Relay">
      <path d="M58 122 Q120 145 190 140 Q230 138 255 142" stroke={road} strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M58 122 Q120 145 190 140 Q230 138 255 142" stroke={roadDash} strokeWidth="2" strokeDasharray="7 7" fill="none" strokeLinecap="round" />
      <g transform="translate(150,141) rotate(3)">
        <path d="M-16 -1 L-16 -6 L-8 -6 L-8 -13 L4 -13 L10 -6 L16 -6 L16 -1 Z" fill={carFill} />
        <circle cx="-9" cy="1" r="4" fill={ink} />
        <circle cx="9" cy="1" r="4" fill={ink} />
      </g>
      <text x="10" y="120" fontFamily="Poppins, sans-serif" fontWeight="800" fontSize="100" fill={ink}>Relay</text>
      <g transform="translate(258,145)">
        <path d="M0 0 C-9 -14 -16 -22 -16 -32 C-16 -41 -9 -48 0 -48 C9 -48 16 -41 16 -32 C16 -22 9 -14 0 0 Z" fill="#e0342a" />
        <circle cx="0" cy="-32" r="6" fill="#111113" />
      </g>
    </svg>
  );
}

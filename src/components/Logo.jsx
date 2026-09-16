import React from "react";

export default function Logo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#7B93F0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 19V5" />
      <path d="M8 5H13.5C15.7 5 17 6.5 17 8.5C17 10.5 15.7 12 13.5 12H8" />
      <path d="M12 12L18.5 19" />
      <path d="M15.3 19H18.5V15.8" />
    </svg>
  );
}

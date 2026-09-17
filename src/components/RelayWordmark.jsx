import React from "react";
import wordmarkBlack from "@/assets/relay-wordmark.png";
import wordmarkWhite from "@/assets/relay-wordmark-white.png";

export default function RelayWordmark({ width = 260, dark = false }) {
  const src = dark ? wordmarkWhite : wordmarkBlack;
  return <img src={src} alt="Relay" style={{ width, height: "auto", display: "block" }} />;
}

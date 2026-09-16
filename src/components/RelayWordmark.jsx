import React from "react";
import wordmark from "@/assets/relay-wordmark.png";

export default function RelayWordmark({ width = 260 }) {
  return <img src={wordmark} alt="Relay" style={{ width, height: "auto", display: "block" }} />;
}

import React from "react";
import icon from "@/assets/relay-icon.png";

export default function Logo({ size = 20 }) {
  return <img src={icon} alt="" width={size} height={size} style={{ display: "block", width: size, height: size }} />;
}

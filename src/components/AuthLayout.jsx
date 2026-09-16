import React from "react";
import "@/drivebid.css";
import RelayWordmark from "@/components/RelayWordmark";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="db-shell auth-light min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <RelayWordmark width={220} />
          </div>
          <p className="text-[#6b7280] text-sm font-semibold tracking-wide mb-5">Your car, delivered</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#161922]">{title}</h1>
          {subtitle && <p className="text-[#6b7280] mt-2">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-[18px] shadow-[0_16px_36px_rgba(15,17,23,.08)] border border-[#e4e6eb] p-8">
          {children}
        </div>
        {footer && <p className="text-center text-sm text-[#6b7280] mt-6">{footer}</p>}
      </div>
    </div>
  );
}
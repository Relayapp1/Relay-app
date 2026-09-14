import React from "react";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="db-shell auth-light min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="db-brand justify-center mb-5">
            <div className="db-brandmark text-white">R</div>
            <span className="text-[#10233f]">Relay</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#17243a]">{title}</h1>
          {subtitle && <p className="text-[#6b778c] mt-2">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-[18px] shadow-[0_16px_36px_rgba(17,36,66,.09)] border border-[#dbe3ee] p-8">
          {children}
        </div>
        {footer && <p className="text-center text-sm text-[#6b778c] mt-6">{footer}</p>}
      </div>
    </div>
  );
}
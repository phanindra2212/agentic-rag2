"use client";

import React, { useEffect } from "react";

export default function BannerAd() {
  useEffect(() => {
    try {
      const adsbygoogle = (window as any).adsbygoogle || [];
      adsbygoogle.push({});
    } catch (err) {
      console.warn("Google AdSense loading failed. Ad blocker might be active.", err);
    }
  }, []);

  return (
    <div className="w-full flex justify-center items-center my-4 overflow-hidden min-h-[90px] bg-slate-100/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50 p-2">
      <div className="text-center w-full">
        <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">Advertisement</span>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // Replace with active Google AdSense client ID
          data-ad-slot="1234567890"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}

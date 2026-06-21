"use client";

import React, { useEffect } from "react";

export default function ContentAd() {
  useEffect(() => {
    try {
      const adsbygoogle = (window as any).adsbygoogle || [];
      adsbygoogle.push({});
    } catch (err) {
      console.warn("Google AdSense loading failed for Content unit. Ad blocker active.", err);
    }
  }, []);

  return (
    <div className="w-full flex justify-center items-center my-4 overflow-hidden min-h-[120px] bg-slate-100/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50 p-2">
      <div className="text-center w-full">
        <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">Recommended Link</span>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
          data-ad-slot="1122334455"
          data-ad-format="fluid"
          data-ad-layout-key="-gw-3+1f-3d+2z"
        />
      </div>
    </div>
  );
}

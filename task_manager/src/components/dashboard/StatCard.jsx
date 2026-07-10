import React from "react";

export default function StatCard({
    title = "Stat",
    value = 0,
    icon: Icon,
    colorClass = "text-zinc-900 dark:text-zinc-100",
    iconBg = "bg-zinc-100 dark:bg-zinc-800/80",
    loading = false
    }) {

    const displayValue =
        typeof value === "number" ? value.toLocaleString() : value;

    return (
        <div className="bg-white/80 dark:bg-zinc-900/50 backdrop-blur-md p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-none hover:shadow-[0_20px_40px_rgba(255,127,80,0.05)] dark:hover:border-zinc-700/50 flex items-center justify-between transition-all duration-300">

        {/* Text */}
        <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-bold mb-2">
            {title}
            </p>

            <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            {loading ? "..." : displayValue}
            </h3>
        </div>

        {/* Icon */}
        <div className={`p-4 rounded-2xl ${iconBg} transition-colors border border-transparent dark:border-zinc-700/40`}>

            {Icon ? (
            <Icon className={`w-6 h-6 ${colorClass}`} />
            ) : (
            <span className="text-zinc-300 dark:text-zinc-600 text-xl font-bold">?</span>
            )}

        </div>

        </div>
    );
}

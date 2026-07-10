import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Toast({
    message,
    type = "info",
    onClose,
    duration = 3000
    }) {

    useEffect(() => {
        if (!onClose) return;

        const timer = setTimeout(() => {
        onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);

    if (!message) return null;

    const bgColors = {
        success: "bg-black text-white shadow-[#FF7F50]/20",
        error: "bg-black text-white shadow-red-500/20",
        info: "bg-black text-white shadow-gray-500/20",
        warning: "bg-black text-white shadow-orange-500/20",
    };

    return (
        <div
        role="alert"
        className={`fixed bottom-6 right-6 ${
            bgColors[type] || bgColors.info
        } px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-slide-up transform transition-all hover:-translate-y-1`}
        >

        <span className="font-medium tracking-wide text-sm">
            {message}
        </span>

        {onClose && (
            <button
            onClick={onClose}
            className="opacity-70 hover:opacity-100 transition"
            >
            <X className="w-4 h-4" />
            </button>
        )}

        </div>
    );
}

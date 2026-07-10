import React from "react";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import GoogleIcon from "./GoogleIcon";

export default function LandingPage({ onGetStarted, onGoogleLogin }) {
    // Use Vite env variable (create .env with VITE_API_URL if you haven't)
    const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

    // default handlers if parent doesn't provide them
    const handleGetStarted = (e) => {
        if (onGetStarted) return onGetStarted(e);
        // fallback: navigate to a login route (SPA)
        window.location.href = "/login";
    };

    const handleGoogleLogin = (e) => {
        if (onGoogleLogin) return onGoogleLogin(e);
        // fallback: start OAuth flow on your backend which should redirect to Google
        // backend should implement: GET /auth/google -> redirect to google
        window.location.href = `${API_URL}/auth/google`;
    };

    return (
        <div className="min-h-screen bg-white font-sans text-black selection:bg-[#FF7F50] selection:text-white overflow-x-hidden">
        <nav
            className="flex items-center justify-between px-6 lg:px-12 py-6 max-w-7xl mx-auto w-full"
            aria-label="Main navigation"
        >
            <div className="flex items-center gap-3">
            <div
                className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#FF7F50]/20"
                aria-hidden
            >
                <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="font-black text-xl tracking-tighter uppercase">
                Task Crusader
            </span>
            </div>

            <button
            type="button"
            onClick={handleGetStarted}
            className="font-bold text-sm hover:text-[#FF7F50] transition-colors uppercase tracking-widest hidden sm:block"
            aria-label="Log in"
            >
            Log In
            </button>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-12 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in-up z-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-[0.9]">
                CRUSH <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF7F50] to-pink-500">
                CHAOS.
                </span>{" "}
                <br />
                WIN BIG.
            </h1>
            <p className="text-lg text-gray-500 font-medium max-w-md leading-relaxed">
                The soft-modern project management tool for teams who want to get things
                done without the boxy clutter.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                type="button"
                onClick={handleGetStarted}
                className="bg-black text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest hover:bg-[#FF7F50] transition-all shadow-xl shadow-black/20 hover:shadow-[#FF7F50]/40 hover:-translate-y-1 flex items-center justify-center gap-2"
                aria-label="Start Crusade"
                >
                Start Crusade <ArrowRight className="w-4 h-4" />
                </button>

                <button
                type="button"
                onClick={handleGoogleLogin}
                className="bg-white text-black border border-gray-200 px-8 py-4 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all hover:-translate-y-1 flex items-center justify-center gap-2 shadow-sm"
                aria-label="Continue with Google"
                >
                <GoogleIcon />
                <span>Continue with Google</span>
                </button>
            </div>
            </div>

            <div className="relative animate-fade-in delay-200 hidden lg:block" aria-hidden>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-[#FF7F50]/20 to-purple-500/10 rounded-full blur-3xl" />

            <div className="relative z-10 perspective-1000">
                <div className="relative bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rotate-y-12 rotate-x-6 hover:rotate-0 transition-all duration-700 w-96 mx-auto">
                <div className="flex justify-between items-start mb-8">
                    <span className="bg-[#FF7F50] text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#FF7F50]/30">
                    Urgent
                    </span>
                    <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>

                <h3 className="text-2xl font-black mb-2">Launch Marketing Campaign</h3>
                <p className="text-gray-400 font-medium text-sm mb-8 leading-relaxed">
                    Finalize assets and schedule social media posts for the Q4 product release.
                </p>

                <div className="flex justify-between items-center border-t border-gray-50 pt-6">
                    <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white" />
                    <div className="w-8 h-8 rounded-full bg-black border-2 border-white" />
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                    <Clock className="w-4 h-4" />
                    <span>2 days left</span>
                    </div>
                </div>
                </div>
            </div>
            </div>
        </main>
        </div>
    );
}

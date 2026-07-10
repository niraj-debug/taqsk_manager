import React, { useState } from "react";
import { Layout, LayoutDashboard, Users, CheckCircle2, X, Menu } from "lucide-react";

export default function Sidebar({
    view = "board",
    setView,
    displayName = "User",
    userPhoto,
    handleLogout
    }) {

    const [mobileOpen, setMobileOpen] = useState(false);

    const menuItems = [
        { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { key: "board",     label: "Tasks",     icon: Layout },
        { key: "members",   label: "Members",   icon: Users }
    ];

    const logout = () => {
        setMobileOpen(false);
        if (handleLogout) handleLogout();
    };

    const handleNav = (key) => {
        setView(key);
        setMobileOpen(false);
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo row */}
            <div className="h-20 flex items-center justify-between px-5 lg:px-8 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#FF7F50] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#FF7F50]/30 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <span className="font-black text-zinc-900 dark:text-white text-lg tracking-tighter lg:block hidden">
                        Task Crusader
                    </span>
                    {/* Always show on mobile drawer */}
                    <span className="font-black text-zinc-900 dark:text-white text-lg tracking-tighter lg:hidden">
                        Task Crusader
                    </span>
                </div>
                {/* Close button — mobile only */}
                <button
                    onClick={() => setMobileOpen(false)}
                    className="lg:hidden p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                    aria-label="Close menu"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="px-3 lg:px-4 space-y-1 mt-2 flex-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const active = view === item.key;
                    return (
                        <button
                            key={item.key}
                            onClick={() => handleNav(item.key)}
                            title={item.label}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 transition-all text-xs font-bold tracking-widest uppercase rounded-2xl ${
                                active
                                    ? "bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg"
                                    : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10"
                            }`}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            {/* Always show label on mobile drawer; hide on collapsed desktop */}
                            <span className="lg:hidden xl:block">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* User / Logout */}
            <div className="p-3 lg:p-4 shrink-0">
                <div
                    className="flex items-center gap-3 p-3 bg-zinc-100/60 dark:bg-white/5 rounded-2xl border border-zinc-200/50 dark:border-white/5 cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-all duration-200"
                    onClick={logout}
                    title="Log Out"
                >
                    {userPhoto ? (
                        <img
                            src={userPhoto}
                            alt={displayName}
                            className="w-9 h-9 rounded-full border-2 border-[#FF7F50] shadow-md shrink-0 object-cover"
                        />
                    ) : (
                        <div className="w-9 h-9 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center text-xs font-black text-white dark:text-black shadow-md shrink-0">
                            {displayName?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                    )}
                    <div className="overflow-hidden lg:hidden xl:block">
                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate leading-none mb-1">
                            {displayName}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Online</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* ── Hamburger trigger (mobile only) ── */}
            <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden fixed top-3.5 left-3.5 z-[70] w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-md text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* ── Mobile overlay backdrop ── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[65] lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Mobile drawer ── */}
            <div
                className={`
                    fixed inset-y-0 left-0 z-[80] w-72
                    bg-white dark:bg-zinc-900
                    border-r border-zinc-100 dark:border-zinc-800/60
                    shadow-2xl
                    transition-transform duration-300 ease-in-out
                    ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
                    lg:hidden
                `}
            >
                <SidebarContent />
            </div>

            {/* ── Desktop sidebar (always visible) ── */}
            <div className="
                hidden lg:flex flex-col
                w-20 xl:w-64
                bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md
                text-zinc-800 dark:text-zinc-100
                shrink-0 z-20
                transition-all duration-300
                m-3 rounded-[2rem]
                shadow-xl shadow-zinc-200/50 dark:shadow-none
                border border-white/60 dark:border-zinc-800/30
            ">
                <SidebarContent />
            </div>
        </>
    );
}
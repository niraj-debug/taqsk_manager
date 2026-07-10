import React from "react";
import { Bell, AlertCircle, Plus } from "lucide-react";

export default function Header({
    view = "board",
    notifications = [],
    overdueTasksCount = 0,
    openNotifications,
    toggleNotifications,
    openNewTask,
    }) {

    const title =
        view === "board"
        ? "Task Board"
        : view.charAt(0).toUpperCase() + view.slice(1);

    const today = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
    });

    return (
        <header className="h-24 flex items-center justify-between px-8 bg-gray-50/60 dark:bg-white/[0.03] dark:backdrop-blur-md border border-transparent dark:border-white/[0.05] rounded-[2.5rem] mb-4 mx-2 transition-colors duration-300">

        {/* Title */}
        <div>
            <h1 className="text-3xl font-black capitalize text-gray-900 dark:text-white">{title}</h1>
            <p className="text-xs text-gray-400 dark:text-white/30 uppercase mt-1 font-semibold tracking-wide">{today}</p>
        </div>

        <div className="flex items-center gap-4">

            {/* Notifications */}
            <button
            onClick={toggleNotifications}
            className="relative w-12 h-12 flex items-center justify-center bg-white dark:bg-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-100 dark:border-white/[0.07] rounded-full shadow-sm transition-all"
            >
            <Bell className="w-5 h-5 text-gray-400 dark:text-white/40" />

            {notifications?.length > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#FF7F50] rounded-full ring-2 ring-white dark:ring-[#111318]"></span>
            )}
            </button>

            {/* Overdue indicator */}
            {overdueTasksCount > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-white bg-gray-900 dark:bg-[#FF7F50]/20 dark:text-[#FF9070] dark:border dark:border-[#FF7F50]/30 px-5 py-3 rounded-full text-xs font-black uppercase">
                <AlertCircle className="w-4 h-4 text-[#FF7F50]" />
                <span>{overdueTasksCount} Overdue</span>
            </div>
            )}

            {/* New Task */}
            <button
            onClick={openNewTask}
            className="bg-[#FF7F50] hover:bg-gray-900 dark:hover:bg-[#e06c43] text-white px-7 py-3 rounded-full text-xs font-black uppercase flex items-center gap-2 transition-all shadow-lg shadow-[#FF7F50]/20 hover:shadow-none"
            >
            <Plus className="w-4 h-4" />
            New Task
            </button>

        </div>

        </header>
    );
}
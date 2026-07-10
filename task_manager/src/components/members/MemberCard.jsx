import React from "react";
import { Mail, Plus, Crown, Trash2 } from "lucide-react";

export default function MemberCard({
    member,
    isCurrentUser = false,
    userPhoto,
    isAdmin = false,
    onPromote,
    onRemove,
    onMessage,
    onLeave
    }) {

    const name = member?.name || "Unknown";
    const role = member?.role || "member";
    const tasksCount = member?.tasksCount ?? 0;
    const lastActive = member?.lastActive || "Now";

    const roleLabel = role === "admin" ? "ADMIN" : "MEMBER";

    return (
        <div className="bg-white dark:bg-white/[0.04] dark:backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/[0.07] flex flex-col items-center text-center hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)] transition-all hover:-translate-y-2 group">

        {/* Avatar */}
        {isCurrentUser && userPhoto ? (
            <img
            src={userPhoto}
            alt={name}
            className="w-24 h-24 rounded-3xl border-4 border-gray-50 object-cover shadow-lg mb-6"
            />
        ) : (
            <div className="w-24 h-24 bg-gray-50 dark:bg-white/[0.06] flex items-center justify-center text-3xl font-black text-gray-300 dark:text-white/20 mb-6 rounded-3xl group-hover:bg-gray-900 dark:group-hover:bg-[#FF7F50] group-hover:text-white transition-colors duration-300 shadow-inner">
            {name.charAt(0).toUpperCase()}
            </div>
        )}

        {/* Name */}
        <h3 className="font-black text-2xl text-gray-900 dark:text-white tracking-tight">
            {name}
        </h3>

        {/* Role */}
        <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 mt-3 mb-8 rounded-full ${
            role === "admin"
            ? "bg-gray-900 dark:bg-white/10 text-white"
            : "bg-[#FF7F50]/10 dark:bg-[#FF7F50]/20 text-[#FF7F50]"
        }`}>
            {roleLabel}
        </span>

        {/* Stats */}
        <div className="w-full grid grid-cols-2 gap-4 text-sm border-t border-gray-50 dark:border-white/[0.05] pt-6">

            <div>
            <p className="text-gray-400 dark:text-white/30 text-[10px] uppercase tracking-wider mb-1 font-bold">
                Tasks
            </p>

            <p className="font-black text-gray-900 dark:text-white text-xl">
                {tasksCount}
            </p>
            </div>

            <div>
            <p className="text-gray-400 dark:text-white/30 text-[10px] uppercase tracking-wider mb-1 font-bold">
                Active
            </p>

            <p className="font-black text-gray-900 dark:text-white text-sm mt-1">
                {lastActive === "Now"
                ? "NOW"
                : new Date(lastActive).toLocaleDateString()}
            </p>
            </div>

        </div>

        {/* Message Button (not for current user) */}
        {!isCurrentUser && (
            <button
                onClick={() => onMessage?.(member)}
                className="mt-6 w-full py-3 bg-gray-50 dark:bg-white/[0.06] hover:bg-[#FF7F50] hover:text-white text-gray-500 dark:text-white/50 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-2xl border border-gray-100 dark:border-white/[0.07]"
            >
                <Mail className="w-4 h-4" />
                Message
            </button>
        )}

        {/* Leave Workspace Button (only for self if they are not the admin) */}
        {isCurrentUser && role !== "admin" && (
            <button
                onClick={() => onLeave?.()}
                className="mt-6 w-full py-3 bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-2xl shadow-lg shadow-red-500/20"
            >
                Leave Workspace
            </button>
        )}

        {/* Admin Controls */}
        {isAdmin && !isCurrentUser && (
            <div className="flex gap-3 mt-4 w-full">

            {role !== "admin" && (
                <button
                onClick={() => onPromote?.(member)}
                className="flex-1 py-2 text-xs font-bold bg-black text-white rounded-xl flex items-center justify-center gap-1 hover:bg-[#FF7F50]"
                >
                <Crown className="w-3 h-3" />
                Make Admin
                </button>
            )}

            <button
                onClick={() => onRemove?.(member)}
                className="flex-1 py-2 text-xs font-bold bg-red-500 text-white rounded-xl flex items-center justify-center gap-1 hover:bg-red-600"
            >
                <Trash2 className="w-3 h-3" />
                Remove
            </button>

            </div>
        )}

        </div>
    );
    }



    export function InviteMemberCard({ onInvite }) {

    return (

        <div
        onClick={onInvite}
        className="bg-gray-50/50 dark:bg-white/[0.03] border-2 border-gray-100 dark:border-white/[0.07] border-dashed p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-gray-400 dark:text-white/30 hover:bg-white dark:hover:bg-white/[0.06] hover:border-[#FF7F50] hover:text-[#FF7F50] transition-all cursor-pointer group min-h-[280px] sm:min-h-[380px]"
        >

        <div className="w-20 h-20 bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] group-hover:border-[#FF7F50] flex items-center justify-center mb-6 transition-all rounded-3xl shadow-sm">
            <Plus className="w-8 h-8 text-gray-300 group-hover:text-[#FF7F50]" />
        </div>

        <p className="font-black uppercase tracking-widest text-sm">
            Invite Member
        </p>

        <p className="text-xs mt-2 text-gray-400 font-bold opacity-50">
            VIA EMAIL
        </p>

        </div>

    );

}
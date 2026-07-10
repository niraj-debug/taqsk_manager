import React from "react";
import {
    Calendar,
    MessageSquare,
    Paperclip,
    Settings,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Zap,
} from "lucide-react";

export default function TaskCard({ task, onEdit, onDelete, onStatusChange, userId, userRole }) {

    const priorityConfig = {
        Urgent: {
            badge: "bg-gradient-to-r from-[#FF7F50] to-[#FF4500] text-white shadow-lg shadow-[#FF7F50]/30",
            glow: "hover:shadow-[0_20px_50px_rgba(255,127,80,0.25)]",
            bar: "bg-gradient-to-b from-[#FF7F50] to-[#FF4500]",
            icon: <Zap className="w-2.5 h-2.5" />,
        },
        High: {
            badge: "bg-gradient-to-r from-gray-800 to-gray-900 text-white dark:from-gray-600 dark:to-gray-700 shadow-md",
            glow: "hover:shadow-[0_20px_50px_rgba(0,0,0,0.18)]",
            bar: "bg-gradient-to-b from-gray-700 to-gray-900",
            icon: null,
        },
        Medium: {
            badge: "bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/40",
            glow: "hover:shadow-[0_20px_50px_rgba(251,191,36,0.15)]",
            bar: "bg-amber-300",
            icon: null,
        },
        Low: {
            badge: "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500",
            glow: "hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)]",
            bar: "bg-gray-200 dark:bg-gray-700",
            icon: null,
        },
    };

    const config = priorityConfig[task.priority] || priorityConfig.Low;

    const dueDate = task.due_date;

    const isOverdue =
        dueDate &&
        dueDate < new Date().toISOString().split("T")[0] &&
        task.status !== "completed";

    const canModify = userRole === "admin" || task.assigned_to == userId;

    const handleStatusChange = (newStatus) => {
        if (!canModify) {
            alert("Only the admin or assigned member can update this task");
            return;
        }
        onStatusChange(task.id, newStatus);
    };

    return (
        <div
            className={`
                relative bg-white dark:bg-white/[0.04] dark:backdrop-blur-md
                border border-gray-100/80 dark:border-white/[0.07]
                p-5 rounded-2xl overflow-hidden group
                shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)]
                ${config.glow}
                hover:-translate-y-1 transition-all duration-300 ease-out
            `}
        >
            {/* Priority accent bar */}
            <div className={`absolute left-0 top-0 w-1 h-full rounded-l-2xl ${isOverdue ? "bg-red-500" : config.bar}`} />

            {/* Top row: priority badge + action buttons */}
            <div className="flex justify-between items-start mb-3 pl-3">
                <div className="flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${config.badge}`}>
                        {config.icon}
                        {task.priority}
                    </span>

                    {isOverdue && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-800/40 rounded-full">
                            Overdue
                        </span>
                    )}

                    {task.status === "completed" && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40 rounded-full">
                            Done
                        </span>
                    )}
                </div>

                {/* Action buttons — appear on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1.5 shrink-0">
                    <button
                        disabled={!canModify}
                        onClick={() => onEdit(task)}
                        title={!canModify ? "Only admins or assigned members can edit" : "Edit task"}
                        className="p-1.5 rounded-xl bg-gray-50 dark:bg-white/[0.06] hover:bg-gray-900 dark:hover:bg-white/20 text-gray-400 hover:text-white transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                        disabled={userRole !== "admin"}
                        onClick={() => onDelete(task.id)}
                        title={userRole !== "admin" ? "Only admins can delete tasks" : "Delete task"}
                        className="p-1.5 rounded-xl bg-gray-50 dark:bg-white/[0.06] hover:bg-[#FF7F50] text-gray-400 hover:text-white transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Title */}
            <h4
                className={`
                    font-bold text-gray-900 dark:text-white/90 text-[15px] mb-1.5 leading-snug pl-3
                    ${task.status === "completed" ? "line-through text-gray-300 dark:text-white/25" : ""}
                `}
            >
                {task.title}
            </h4>

            {/* Description */}
            {task.description && (
                <p className="text-xs text-gray-400 dark:text-white/40 line-clamp-2 mb-4 leading-relaxed pl-3">
                    {task.description}
                </p>
            )}

            {/* Due date + Assigned user */}
            <div className="flex items-center gap-3 text-[11px] mb-4 border-b border-gray-50 dark:border-white/[0.05] pb-3 pl-3">
                {dueDate && (
                    <div className={`flex items-center gap-1.5 font-semibold ${isOverdue ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-white/40"}`}>
                        <Calendar className="w-3 h-3" />
                        <span>{dueDate}</span>
                    </div>
                )}

                {task.assigned_user && (
                    <div className="flex items-center gap-1.5 ml-auto">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FF7F50] to-[#e06c43] text-white flex items-center justify-center text-[9px] font-black shadow-sm">
                            {task.assigned_user.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-600 dark:text-white/60 max-w-[80px] truncate">
                            {task.assigned_user}
                        </span>
                    </div>
                )}
            </div>

            {/* Bottom row: activity info + status controls */}
            <div className="flex justify-between items-center pl-3">

                {/* Activity / comment indicators */}
                <div className="flex gap-3 min-w-0 flex-1">
                    {task.comments?.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-white/35 group-hover:text-[#FF7F50] transition-colors">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {task.comments.length}
                        </span>
                    )}
                    {task.attachments?.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-white/35 group-hover:text-[#FF7F50] transition-colors">
                            <Paperclip className="w-3.5 h-3.5" />
                            {task.attachments.length}
                        </span>
                    )}

                    {/* Latest shared progress */}
                    {(task.latest_activity_content || task.latest_activity_type === "work_upload") && (
                        <span
                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#FF7F50] dark:text-[#FF9070] max-w-[130px] truncate"
                            title={task.latest_activity_content || "Uploaded work"}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF7F50] animate-pulse shrink-0" />
                            <span className="truncate">{task.latest_activity_content || "Uploaded work"}</span>
                        </span>
                    )}

                    {/* No activity fallback */}
                    {!task.comments?.length && !task.attachments?.length &&
                        !task.latest_activity_content && task.latest_activity_type !== "work_upload" && (
                        <span className="text-[11px] text-gray-300 dark:text-white/20 italic">No activity</span>
                    )}
                </div>

                {/* Status chevrons */}
                <div className="flex gap-1 shrink-0">
                    {task.status !== "todo" && (
                        <button
                            disabled={!canModify}
                            onClick={() => handleStatusChange(task.status === "completed" ? "in_progress" : "todo")}
                            title={!canModify ? "Only admins or assigned members can change status" : "Previous status"}
                            className={`p-1.5 rounded-xl transition-colors ${
                                canModify
                                    ? "text-[#FF7F50] hover:bg-[#FF7F50] hover:text-white dark:hover:bg-[#FF7F50]/20"
                                    : "text-gray-200 dark:text-white/10 cursor-not-allowed"
                            }`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    )}
                    {task.status !== "completed" && (
                        <button
                            disabled={!canModify}
                            onClick={() => handleStatusChange(task.status === "todo" ? "in_progress" : "completed")}
                            title={!canModify ? "Only admins or assigned members can change status" : "Next status"}
                            className={`p-1.5 rounded-xl transition-colors ${
                                canModify
                                    ? "text-[#FF7F50] hover:bg-[#FF7F50] hover:text-white dark:hover:bg-[#FF7F50]/20"
                                    : "text-gray-200 dark:text-white/10 cursor-not-allowed"
                            }`}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
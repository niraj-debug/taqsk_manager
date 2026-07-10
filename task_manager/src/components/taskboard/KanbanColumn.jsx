import React from "react";
import TaskCard from "./TaskCard";

export default function KanbanColumn({
    title,
    status,
    tasks,
    onEdit,
    onDelete,
    onStatusChange,
    userId,
    userRole,
    className = "",
}) {

    const dotColors = {
        todo: "bg-black",
        in_progress: "bg-[#FF7F50]",
        completed: "bg-green-400",
    };

    // filter tasks for this column
    const filteredTasks = Array.isArray(tasks)
    ? tasks.filter((task) => task.status === status)
    : [];

    return (
        <div
        className={`flex flex-col w-full md:min-w-[300px] md:max-w-[380px] md:flex-1 md:shrink-0 bg-zinc-100/50 dark:bg-zinc-900/30 backdrop-blur-sm rounded-[2rem] border border-zinc-200/50 dark:border-zinc-800/40 p-2 transition-all duration-300 ${className}`}
        >
        
        {/* Column Header */}
        <div className="px-6 py-5 flex justify-between items-center sticky top-0 z-10">
            <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${dotColors[status]}`} />

            <h3 className="font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-widest text-xs">
                {title}
            </h3>
            </div>

            <span className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-100 dark:border-zinc-700/50 px-3 py-1 text-[10px] font-bold rounded-full shadow-sm">
            {filteredTasks.length}
            </span>
        </div>

        {/* Task List */}
        <div className="px-2 pb-2 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            {filteredTasks.map((task) => (
            <TaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                userId={userId}
                userRole={userRole}
            />
            ))}

            {filteredTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 border-2 border-gray-200 dark:border-white/[0.06] border-dashed rounded-[2rem] m-2 bg-white/30 dark:bg-white/[0.02]">
                <p className="text-xs uppercase tracking-widest font-bold text-gray-300 dark:text-white/20">
                No Tasks
                </p>
            </div>
            )}
        </div>

        </div>
    );
}
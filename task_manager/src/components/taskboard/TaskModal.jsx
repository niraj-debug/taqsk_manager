import React, { useState, useEffect } from "react";
import { Plus, Paperclip, X, Eye, CheckCircle2, MessageSquare, Upload, Download, FileText } from "lucide-react";

const fieldClass =
    "w-full px-4 py-3 bg-gray-50 dark:bg-white/[0.05] border border-transparent dark:border-white/[0.06] rounded-xl " +
    "focus:outline-none focus:border-[#FF7F50] focus:bg-white dark:focus:bg-white/[0.09] " +
    "transition-all text-sm font-semibold text-gray-800 dark:text-white/90 " +
    "placeholder:text-gray-300 dark:placeholder:text-white/20";

const labelClass =
    "text-[10px] font-black text-gray-400 dark:text-white/35 uppercase tracking-widest block mb-2";

export default function TaskModal({
    isOpen,
    onClose,
    onSave,
    onActivityAdded,
    task = null,
    members = [],
    projectId,
    apiUrl = "http://localhost:5000"
}) {
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        priority: "Medium",
        category: "Work",
        dueDate: "",
        assignedTo: "",
        status: "todo",
        attachments: []
    });

    const [newLink, setNewLink] = useState({ name: "", url: "" });
    const [showLinkInput, setShowLinkInput] = useState(false);

    const [activities, setActivities] = useState([]);
    const [activityText, setActivityText] = useState("");
    const [activityFile, setActivityFile] = useState(null);
    const [isLogging, setIsLogging] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const formatDate = (dateStr) => {
                if (!dateStr) return new Date().toISOString().split("T")[0];
                if (dateStr.includes("T")) return dateStr.split("T")[0];
                if (dateStr.includes(" ")) {
                    try {
                        const d = new Date(dateStr);
                        if (!isNaN(d.getTime())) {
                            const year = d.getUTCFullYear();
                            const month = String(d.getUTCMonth() + 1).padStart(2, "0");
                            const day = String(d.getUTCDate()).padStart(2, "0");
                            return `${year}-${month}-${day}`;
                        }
                    } catch (e) {
                        console.error("Error parsing date", e);
                    }
                }
                return dateStr;
            };

            setFormData({
                title: task?.title || "",
                description: task?.description || "",
                priority: task?.priority || "Medium",
                category: task?.category || "Work",
                dueDate: formatDate(task?.due_date),
                assignedTo: task?.assigned_to || "",
                status: task?.status || "todo",
                attachments: task?.attachments || []
            });

            setActivityText("");
            setActivityFile(null);
            setActivities([]);

            if (task && task.id) {
                logViewedActivity();
                fetchActivities();
            }
        }
    }, [isOpen, task]);

    const logViewedActivity = async () => {
        try {
            const token = localStorage.getItem("token");
            await fetch(`${apiUrl}/tasks/${task.id}/activities`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Bearer ${token}`
                },
                body: new URLSearchParams({
                    activity_type: "viewed",
                    content: "Viewed the task"
                })
            });
        } catch (err) {
            console.error("Failed to log viewed activity", err);
        }
    };

    const fetchActivities = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${apiUrl}/tasks/${task.id}/activities`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && Array.isArray(data)) setActivities(data);
        } catch (err) {
            console.error("Failed to fetch task activities", err);
        }
    };

    const handleShareProgress = async (e) => {
        e.preventDefault();
        if (!activityText.trim() && !activityFile) return;
        setIsLogging(true);
        try {
            const token = localStorage.getItem("token");
            const bodyFormData = new FormData();
            bodyFormData.append("content", activityText.trim());
            bodyFormData.append("activity_type", activityFile ? "work_upload" : "progress_share");
            if (activityFile) bodyFormData.append("file", activityFile);

            const res = await fetch(`${apiUrl}/tasks/${task.id}/activities`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: bodyFormData
            });

            if (res.ok) {
                setActivityText("");
                setActivityFile(null);
                fetchActivities();
                if (onActivityAdded) onActivityAdded();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to post update");
            }
        } catch (err) {
            console.error("Error sharing progress", err);
        } finally {
            setIsLogging(false);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            category: formData.category,
            due_date: formData.dueDate,
            assigned_to: formData.assignedTo,
            status: formData.status,
            project_id: projectId,
            attachments: formData.attachments,
        });
    };

    const handleAddLink = () => {
        if (!newLink.name || !newLink.url) return;
        setFormData(prev => ({ ...prev, attachments: [...prev.attachments, newLink] }));
        setNewLink({ name: "", url: "" });
        setShowLinkInput(false);
    };

    const removeAttachment = (index) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, i) => i !== index),
        }));
    };

    const getActivityIcon = (type) => {
        switch (type) {
            case "viewed":        return <Eye className="w-3.5 h-3.5 text-blue-400" />;
            case "status_change": return <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />;
            case "work_upload":   return <Upload className="w-3.5 h-3.5 text-emerald-400" />;
            default:              return <MessageSquare className="w-3.5 h-3.5 text-[#FF7F50]" />;
        }
    };

    const getActivityLabel = (type) => {
        switch (type) {
            case "viewed":        return "Viewed";
            case "status_change": return "Status Update";
            case "work_upload":   return "Uploaded Work";
            default:              return "Shared Progress";
        }
    };

    const getActivityBg = (type) => {
        switch (type) {
            case "viewed":        return "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30";
            case "status_change": return "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30";
            case "work_upload":   return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30";
            default:              return "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30";
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
            <div
                className={`
                    bg-white dark:bg-[#111318]
                    border border-gray-100 dark:border-white/[0.07]
                    w-full ${task ? "max-w-5xl" : "max-w-2xl"}
                    rounded-t-3xl sm:rounded-3xl
                    shadow-2xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.6)]
                    overflow-hidden flex flex-col
                    max-h-[95vh] sm:max-h-[90vh]
                    transition-all duration-300
                `}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 sm:px-8 py-4 sm:py-5 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50/70 dark:bg-white/[0.03]">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                            {task ? "Task Details & Progress" : "Create New Task"}
                        </h2>
                        <p className="text-[10px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest mt-0.5">
                            {task ? `Task #${task.id}` : "Workspace Objective"}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.07] text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto">
                    {task ? (
                        /* Edit View: 2-column layout */
                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-white/[0.06]">

                            {/* Left: Form */}
                            <form onSubmit={handleSubmit} className="p-7 space-y-5">

                                {/* Title */}
                                <div>
                                    <label className={labelClass}>Title</label>
                                    <input
                                        required
                                        type="text"
                                        className={fieldClass}
                                        value={formData.title}
                                        placeholder="Task title..."
                                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className={labelClass}>Description</label>
                                    <textarea
                                        placeholder="Detailed instructions for this objective..."
                                        className={`${fieldClass} h-24 resize-none`}
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Priority */}
                                    <div>
                                        <label className={labelClass}>Priority</label>
                                        <select
                                            className={fieldClass}
                                            value={formData.priority}
                                            onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                                        >
                                            <option>Low</option>
                                            <option>Medium</option>
                                            <option>High</option>
                                            <option>Urgent</option>
                                        </select>
                                    </div>

                                    {/* Due Date */}
                                    <div>
                                        <label className={labelClass}>Due Date</label>
                                        <input
                                            type="date"
                                            className={fieldClass}
                                            value={formData.dueDate}
                                            onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Assigned Member */}
                                    <div>
                                        <label className={labelClass}>Assigned Member</label>
                                        <select
                                            className={fieldClass}
                                            value={formData.assignedTo}
                                            onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                                        >
                                            <option value="">Unassigned</option>
                                            {members.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Status */}
                                    <div>
                                        <label className={labelClass}>Status</label>
                                        <select
                                            className={fieldClass}
                                            value={formData.status}
                                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                        >
                                            <option value="todo">To Do</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Resource Links */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={labelClass}>Resource Links</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowLinkInput(!showLinkInput)}
                                            className="text-[10px] font-black text-[#FF7F50] hover:text-[#e06c43] uppercase tracking-widest transition-colors"
                                        >
                                            {showLinkInput ? "Cancel" : "+ Add Link"}
                                        </button>
                                    </div>

                                    {showLinkInput && (
                                        <div className="flex gap-2 mb-3 bg-gray-50 dark:bg-white/[0.04] p-3 rounded-xl border border-gray-100 dark:border-white/[0.06]">
                                            <input
                                                placeholder="Label"
                                                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-white/[0.06] border border-gray-100 dark:border-white/[0.06] rounded-lg focus:outline-none text-gray-800 dark:text-white/80"
                                                value={newLink.name}
                                                onChange={(e) => setNewLink(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                            <input
                                                placeholder="URL"
                                                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-white/[0.06] border border-gray-100 dark:border-white/[0.06] rounded-lg focus:outline-none text-gray-800 dark:text-white/80"
                                                value={newLink.url}
                                                onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddLink}
                                                className="bg-gray-900 dark:bg-[#FF7F50] text-white text-xs px-4 py-2 font-bold rounded-lg hover:bg-[#FF7F50] dark:hover:bg-[#e06c43] transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {formData.attachments.map((att, i) => (
                                            <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] px-4 py-2.5 rounded-xl text-xs font-bold">
                                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-gray-700 dark:text-white/70 hover:text-[#FF7F50] transition-colors flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5 text-[#FF7F50]" />
                                                    {att.name}
                                                </a>
                                                <button type="button" onClick={() => removeAttachment(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Form Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-6 py-2.5 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-white/50 font-bold rounded-full text-xs uppercase tracking-widest transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-8 py-2.5 bg-gray-900 dark:bg-[#FF7F50] hover:bg-[#FF7F50] dark:hover:bg-[#e06c43] text-white font-black rounded-full text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-[#FF7F50]/25"
                                    >
                                        Save Details
                                    </button>
                                </div>
                            </form>

                            {/* Right: Activity Log */}
                            <div className="p-7 flex flex-col" style={{ minHeight: "600px" }}>
                                <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight mb-4">
                                    Activity Log
                                </h3>

                                {/* Share Progress Form */}
                                <form
                                    onSubmit={handleShareProgress}
                                    className="bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] p-4 rounded-2xl space-y-3 mb-5"
                                >
                                    <div className="text-[10px] font-black text-gray-400 dark:text-white/30 uppercase tracking-widest">
                                        Share Progress / Upload Work
                                    </div>
                                    <textarea
                                        placeholder="Detail what progress was accomplished..."
                                        rows={3}
                                        value={activityText}
                                        onChange={(e) => setActivityText(e.target.value)}
                                        className="w-full bg-white dark:bg-white/[0.06] border border-gray-100 dark:border-white/[0.06] rounded-xl p-3 text-xs focus:outline-none focus:border-[#FF7F50] font-medium resize-none text-gray-800 dark:text-white/80 placeholder:text-gray-300 dark:placeholder:text-white/20"
                                    />
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-white/[0.06] border border-gray-100 dark:border-white/[0.06] rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-white/40 hover:border-[#FF7F50] hover:text-[#FF7F50] transition-all cursor-pointer">
                                                <Paperclip className="w-3.5 h-3.5" />
                                                <span>{activityFile ? "Change File" : "Attach Work"}</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => setActivityFile(e.target.files?.[0] || null)}
                                                />
                                            </label>
                                            {activityFile && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-700 dark:text-white/60 bg-white dark:bg-white/[0.06] border border-gray-100 dark:border-white/[0.06] px-2.5 py-2 rounded-xl">
                                                    <span className="max-w-[80px] truncate">{activityFile.name}</span>
                                                    <button type="button" onClick={() => setActivityFile(null)} className="text-red-400 hover:text-red-600 ml-1">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isLogging || (!activityText.trim() && !activityFile)}
                                            className="px-4 py-2 bg-[#FF7F50] hover:bg-[#e06c43] disabled:bg-gray-200 dark:disabled:bg-white/[0.06] disabled:text-gray-400 dark:disabled:text-white/25 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#FF7F50]/20 disabled:shadow-none"
                                        >
                                            {isLogging ? "Posting…" : activityFile ? "Upload Work" : "Post Progress"}
                                        </button>
                                    </div>
                                </form>

                                {/* Activity Feed */}
                                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                                    {activities.length === 0 ? (
                                        <div className="text-center py-10 text-gray-300 dark:text-white/20 font-semibold text-xs">
                                            No activity logged yet.
                                        </div>
                                    ) : (
                                        activities.map((act) => (
                                            <div key={act.id} className={`flex items-start gap-3 border p-3.5 rounded-2xl transition-all duration-200 hover:shadow-sm ${getActivityBg(act.activity_type)}`}>
                                                {act.user_avatar ? (
                                                    <img src={act.user_avatar} alt={act.user_name} className="w-8 h-8 rounded-xl object-cover border border-gray-100 dark:border-white/[0.08] shadow-sm shrink-0" />
                                                ) : (
                                                    <div className="w-8 h-8 bg-gradient-to-br from-[#FF7F50] to-[#e06c43] flex items-center justify-center text-[10px] font-black text-white rounded-xl shrink-0 shadow-sm">
                                                        {act.user_name ? act.user_name.charAt(0).toUpperCase() : "?"}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <span className="text-xs font-black text-gray-900 dark:text-white/90">{act.user_name}</span>
                                                        <span className="text-[9px] text-gray-400 dark:text-white/30 font-semibold uppercase shrink-0">
                                                            {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        {getActivityIcon(act.activity_type)}
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 dark:text-white/30">
                                                            {getActivityLabel(act.activity_type)}
                                                        </span>
                                                    </div>
                                                    {act.content && (
                                                        <p className="text-xs text-gray-600 dark:text-white/60 font-medium leading-relaxed whitespace-pre-wrap">
                                                            {act.content}
                                                        </p>
                                                    )}
                                                    {act.file_path && (
                                                        <div className="mt-2">
                                                            <a
                                                                href={`${apiUrl}${act.file_path}`}
                                                                download={act.file_name}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-2 bg-white/70 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-400 font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl hover:bg-white dark:hover:bg-emerald-900/50 transition-all"
                                                            >
                                                                <Download className="w-3 h-3" />
                                                                <span>{act.file_name || "Download Attachment"}</span>
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Create View: single column */
                        <form onSubmit={handleSubmit} className="p-8 space-y-5">

                            {/* Title */}
                            <div>
                                <label className={labelClass}>Title</label>
                                <input
                                    required
                                    type="text"
                                    className={fieldClass}
                                    value={formData.title}
                                    placeholder="Task title..."
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className={labelClass}>Description</label>
                                <textarea
                                    placeholder="Detailed instructions for this objective..."
                                    className={`${fieldClass} h-32 resize-none`}
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Priority */}
                                <div>
                                    <label className={labelClass}>Priority</label>
                                    <select
                                        className={fieldClass}
                                        value={formData.priority}
                                        onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                        <option>Urgent</option>
                                    </select>
                                </div>

                                {/* Due Date */}
                                <div>
                                    <label className={labelClass}>Due Date</label>
                                    <input
                                        type="date"
                                        className={fieldClass}
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Assigned Member */}
                                <div>
                                    <label className={labelClass}>Assigned Member</label>
                                    <select
                                        className={fieldClass}
                                        value={formData.assignedTo}
                                        onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                                    >
                                        <option value="">Unassigned</option>
                                        {members.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Status */}
                                <div>
                                    <label className={labelClass}>Status</label>
                                    <select
                                        className={fieldClass}
                                        value={formData.status}
                                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                    >
                                        <option value="todo">To Do</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-2.5 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-white/50 font-bold rounded-full text-xs uppercase tracking-widest transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-gray-900 dark:bg-[#FF7F50] hover:bg-[#FF7F50] dark:hover:bg-[#e06c43] text-white font-black rounded-full text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-[#FF7F50]/25"
                                >
                                    Create Task
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
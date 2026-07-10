import React, { useState } from "react";
import { X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

const fieldClass =
    "w-full px-4 py-3 bg-gray-50 dark:bg-white/[0.05] border border-transparent dark:border-white/[0.06] rounded-xl " +
    "focus:outline-none focus:border-[#FF7F50] focus:bg-white dark:focus:bg-white/[0.09] " +
    "transition-all text-sm font-semibold text-gray-800 dark:text-white/90 " +
    "placeholder:text-gray-300 dark:placeholder:text-white/20";

const labelClass =
    "text-[10px] font-black text-gray-400 dark:text-white/35 uppercase tracking-widest block mb-2";

export default function CreateProjectModal({ isOpen, onClose, onCreated, userId }) {

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        priority: "Medium",
        start_date: "",
        due_date: "",
        category: "General"
    });

    if (!isOpen) return null;

    const createProject = async (e) => {
        if (e) e.preventDefault();
        console.log("Create Project clicked");

        if (!formData.name.trim()) {
            alert("Project name required");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/projects`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    created_by: userId
                })
            });

            const data = await res.json();
            console.log("PROJECT RESPONSE:", data);

            if (!res.ok) {
                throw new Error(data.error || "Project creation failed");
            }

            alert("Project created successfully");
            setFormData({
                name: "",
                description: "",
                priority: "Medium",
                start_date: "",
                due_date: "",
                category: "General"
            });
            onCreated();
            onClose();

        } catch (err) {
            console.error("Create project error:", err);
            alert(err.message || "Failed to create project");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
            <div
                className={`
                    bg-white dark:bg-[#111318]
                    border border-gray-100 dark:border-white/[0.07]
                    w-full max-w-lg
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
                            Create Project
                        </h2>
                        <p className="text-[10px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest mt-0.5">
                            New Project Workspace
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.07] text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={createProject} className="p-6 sm:p-8 space-y-5 overflow-y-auto">
                    {/* Project Name */}
                    <div>
                        <label className={labelClass}>Project Name</label>
                        <input
                            required
                            placeholder="Project name..."
                            className={fieldClass}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className={labelClass}>Description</label>
                        <textarea
                            placeholder="Project description and goals..."
                            className={`${fieldClass} h-24 resize-none`}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Priority */}
                        <div>
                            <label className={labelClass}>Priority</label>
                            <select
                                className={fieldClass}
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            >
                                <option>Low</option>
                                <option>Medium</option>
                                <option>High</option>
                                <option>Urgent</option>
                            </select>
                        </div>

                        {/* Category */}
                        <div>
                            <label className={labelClass}>Category</label>
                            <input
                                placeholder="General"
                                className={fieldClass}
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Start Date</label>
                            <input
                                type="date"
                                className={fieldClass}
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>End Date</label>
                            <input
                                type="date"
                                className={fieldClass}
                                value={formData.due_date}
                                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                            />
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
                            className="px-8 py-2.5 bg-[#FF7F50] hover:bg-[#e06c43] text-white font-black rounded-full text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-[#FF7F50]/25"
                        >
                            Create Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
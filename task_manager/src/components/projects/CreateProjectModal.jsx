import React, { useState } from "react";
import { X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

export default function CreateProjectModal({ isOpen, onClose, onCreated, userId }) {

    const [formData,setFormData] = useState({
        name:"",
        description:"",
        priority:"Medium",
        start_date:"",
        due_date:"",
        category:"General"
    });

    if (!isOpen) return null;

    const createProject = async () => {

    console.log("Create Project clicked");

    if (!formData.name) {
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

        onCreated();
        onClose();

    } catch (err) {

        console.error("Create project error:", err);
        alert(err.message || "Failed to create project");

    }

};

    return (

    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

        <div className="bg-white w-full max-w-lg rounded-2xl p-6 space-y-5">

        {/* Header */}
        <div className="flex justify-between items-center">

            <h2 className="text-xl font-bold">
            Create Project
            </h2>

            <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100"
            >
            <X size={18}/>
            </button>

        </div>

        {/* Project Name */}
        <div className="flex flex-col">
        <label className=" text-xs mb-1 ">Project Name</label>
        <input
        placeholder="Project Name"
        className="w-full border p-3 rounded-lg"
        value={formData.name}
        onChange={(e)=>setFormData({...formData,name:e.target.value})}
        />
        </div>

        {/* Description */}
        <div className="flex flex-col">
        <label className=" text-xs mb-1 ">Description</label>
        <textarea
        placeholder="Project Description"
        className="w-full border p-3 rounded-lg"
        value={formData.description}
        onChange={(e)=>setFormData({...formData,description:e.target.value})}
        />
        </div>

        {/* Priority */}
        <div className="flex flex-col">
        <label className=" text-xs mb-1 ">Priority</label>
        <select
        className="w-full border p-3 rounded-lg"
        value={formData.priority}
        onChange={(e)=>setFormData({...formData,priority:e.target.value})}
        >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Urgent</option>
        </select>
        </div>

        {/* Category */}
        <div className="flex flex-col">
        <label className=" text-xs mb-1 ">Category</label>
        <input
        placeholder="Category"
        className="w-full border p-3 rounded-lg"
        value={formData.category}
        onChange={(e)=>setFormData({...formData,category:e.target.value})}
        />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">

            <div className="flex flex-col">
                <label className="text-xs mb-1">Start Date</label>
                <input
                type="date"
                className="border p-3 rounded-lg w-full"
                value={formData.start_date}
                onChange={(e)=>setFormData({...formData,start_date:e.target.value})}
                />
            </div>

            <div className="flex flex-col">
                <label className="text-xs mb-1">End Date</label>
                <input
                type="date"
                className="border p-3 rounded-lg w-full"
                value={formData.due_date}
                onChange={(e)=>setFormData({...formData,due_date:e.target.value})}
                />
            </div>

        </div>

        {/* Footer */}
        <button
        onClick={createProject}
        className="w-full bg-[#FF7F50] text-white py-3 rounded-lg font-bold"
        >
        Create Project
        </button>

        </div>

    </div>

    );
}
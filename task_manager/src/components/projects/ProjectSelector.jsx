import React, { useState, useEffect, useRef } from "react";
import { Folder, ChevronDown, Check, Trash2, Plus } from "lucide-react";

export default function ProjectSelector({
  projects = [],
  currentProject,
  setCurrentProject,
  onDeleteProject,
  userRole,
  onCreateProjectClick
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeProject = projects.find(p => String(p.id) === String(currentProject));

  const handleSelect = (id) => {
    setCurrentProject(id);
    setIsOpen(false);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation(); // prevent selecting the project when deleting
    onDeleteProject(id);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Mobile: icon-only pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex sm:hidden items-center justify-center w-9 h-9 bg-gray-50 dark:bg-white/[0.06] border border-gray-100 dark:border-white/[0.08] hover:border-[#FF7F50] rounded-xl shadow-sm transition-all cursor-pointer relative"
        type="button"
        title={activeProject ? activeProject.name : "Select Project"}
      >
        <Folder className="w-4 h-4 text-[#FF7F50]" />
        {activeProject && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#FF7F50] rounded-full" />
        )}
      </button>

      {/* sm+: full label button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-white/[0.06] border border-gray-100 dark:border-white/[0.08] hover:border-gray-200 dark:hover:border-white/20 text-gray-800 dark:text-white/80 text-sm font-bold rounded-2xl shadow-sm hover:shadow transition-all duration-200 min-w-[140px] max-w-[240px] justify-between cursor-pointer"
        type="button"
      >
        <div className="flex items-center gap-2 truncate">
          <Folder className="w-4 h-4 text-[#FF7F50] flex-shrink-0" />
          <span className="truncate">
            {activeProject ? activeProject.name : "Select Project"}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1d24] border border-gray-100 dark:border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-2xl py-2 z-[9999] animate-slide-up origin-top-right">
          <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 dark:text-white/30 uppercase tracking-widest border-b border-gray-50 dark:border-white/[0.05] mb-1">
            Projects
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {projects.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-3 italic">No projects created</p>
            ) : (
              projects.map((project) => {
                const isSelected = String(project.id) === String(currentProject);
                return (
                  <div
                    key={project.id}
                    onClick={() => handleSelect(project.id)}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-gray-50 dark:bg-white/[0.07] text-black dark:text-white font-bold"
                        : "text-gray-600 dark:text-white/50 hover:bg-gray-50/80 dark:hover:bg-white/[0.05] hover:text-black dark:hover:text-white"
                    }`}
                  >
                    <span className="truncate pr-2">{project.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isSelected && <Check className="w-4 h-4 text-[#FF7F50]" />}
                      {userRole === "admin" && (
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                          title="Delete Project"
                          type="button"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Admin Actions */}
          {userRole === "admin" && (
            <div className="border-t border-gray-50 dark:border-white/[0.05] mt-1 pt-1 px-2">
              <button
                onClick={() => {
                  onCreateProjectClick();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 hover:bg-[#FF7F50]/5 text-[#FF7F50] hover:text-[#e06c43] text-xs font-bold uppercase tracking-widest rounded-xl transition-all"
                type="button"
              >
                <Plus className="w-3.5 h-3.5" />
                New Project
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
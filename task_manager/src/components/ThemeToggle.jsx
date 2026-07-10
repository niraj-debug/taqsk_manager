import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("theme") || "light";
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
    };

    return (
        <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-100 rounded-full transition-all duration-300 relative overflow-hidden group shadow-sm border border-transparent dark:border-zinc-700/50"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
            <div className="relative w-5 h-5 flex items-center justify-center">
                {/* Sun Icon */}
                <Sun 
                    className={`w-5 h-5 transition-all duration-500 absolute ${
                        theme === "dark" 
                            ? "rotate-90 scale-0 opacity-0" 
                            : "rotate-0 scale-100 opacity-100"
                    } text-orange-500`} 
                />
                {/* Moon Icon */}
                <Moon 
                    className={`w-5 h-5 transition-all duration-500 absolute ${
                        theme === "light" 
                            ? "-rotate-90 scale-0 opacity-0" 
                            : "rotate-0 scale-100 opacity-100"
                    } text-indigo-400`} 
                />
            </div>
        </button>
    );
}

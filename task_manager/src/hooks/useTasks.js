import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function useTasks() {

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // --------------------
    // LOAD TASKS
    // --------------------
    const fetchTasks = async () => {
    try {

    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}/tasks`, {
        headers: {
        Authorization: `Bearer ${token}`
        }
        });

        const data = await res.json();

        console.log("TASKS RESPONSE:", data);

        setTasks(Array.isArray(data) ? data : []);
        setLoading(false);

        } catch (err) {

        console.error("Error fetching tasks:", err);

        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    // --------------------
    // ADD TASK
    // --------------------
    const addTask = async (taskData) => {

    try {

    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
    });

    fetchTasks();

    } catch (error) {

    console.error("Error adding task:", error);

    }

    };

    // --------------------
    // DELETE TASK
    // --------------------
    const deleteTask = async (id) => {

    try {

        const token = localStorage.getItem("token");

        await fetch(`${API_URL}/tasks/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        setTasks(prev => prev.filter(task => task.id !== id));

    } catch (error) {

        console.error("Error deleting task:", error);

    }

    };

    // --------------------
    // UPDATE TASK
    // --------------------
    const updateTask = async (id, updates) => {

    try {

        const token = localStorage.getItem("token");

        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });

        const updatedTask = await res.json();

        setTasks(prev =>
            prev.map(task =>
                task.id === id ? updatedTask : task
            )
        );

    } catch (error) {

        console.error("Error updating task:", error);

    }

};

    return {
        tasks,
        loading,
        addTask,
        deleteTask,
        updateTask,
        fetchTasks
    };

}
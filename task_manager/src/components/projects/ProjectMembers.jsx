import React, { useEffect, useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

export default function ProjectMembers({ projectId, userRole }) {

    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [loading, setLoading] = useState(false);

    // Fetch project members
    const fetchMembers = async () => {

    if (!projectId) return;

    try {

        const token = localStorage.getItem("token");

        const res = await fetch(
            `${API_URL}/projects/${projectId}/members`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await res.json();

        setMembers(Array.isArray(data) ? data : []);

    } catch (err) {

        console.error("Failed to fetch members", err);

    }

};

    // Fetch all users

    useEffect(() => {

    const loadData = async () => {

    if (!projectId) return;

    try {

        setLoading(true);

        const token = localStorage.getItem("token");

        const membersRes = await fetch(
            `${API_URL}/projects/${projectId}/members`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const membersData = await membersRes.json();

        const usersRes = await fetch(
            `${API_URL}/users`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const usersData = await usersRes.json();

        setMembers(Array.isArray(membersData) ? membersData : []);
        setAllUsers(Array.isArray(usersData) ? usersData : []);

    } catch (err) {

        console.error("Failed loading members", err);

    } finally {

        setLoading(false);

    }

};

    loadData();

    }, [projectId]);
    // Add member
    const addMember = async () => {
        if (!projectId) {
            alert("Please select a project first");
            return;
        }
        if (!selectedUser) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `${API_URL}/projects/${projectId}/members`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        user_id: selectedUser
                    })
                }
            );

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Failed to add member to project");
                return;
            }

            setSelectedUser("");
            fetchMembers();
        } catch (err) {
            console.error("Failed to add member", err);
            alert("An error occurred while adding the member");
        }
    };

    // Remove member
    const removeMember = async (userId) => {
        if (!window.confirm("Remove this member from project?")) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `${API_URL}/projects/${projectId}/members/${userId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Failed to remove member from project");
                return;
            }

            fetchMembers();
        } catch (err) {
            console.error("Failed to remove member", err);
            alert("An error occurred while removing the member");
        }
    };

    if (loading) {
    return <p className="text-sm text-gray-400">Loading members...</p>;
    }

    return (

        <div className="bg-white p-5 rounded-xl shadow">

        <h3 className="font-bold text-lg mb-4">
            Project Members
        </h3>

        {/* Members list */}

        <div className="space-y-3 mb-4">

            {members.length === 0 && (
            <p className="text-sm text-gray-400">
                No members added
            </p>
            )}

            {Array.isArray(members) &&
                members.map((m) => (

            <div
                key={m.id}
                className="flex items-center justify-between bg-gray-50 p-2 rounded-lg"
            >

                <div className="flex items-center gap-3">

                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {m.name?.charAt(0)}
                </div>

                <div>

                    <p className="text-sm font-medium">
                    {m.name}
                    </p>

                    <p className="text-xs text-gray-400">
                    {m.email}
                    </p>

                </div>

                </div>

                {userRole === "admin" && (

                <button
                    onClick={() => removeMember(m.id)}
                    className="text-red-400 hover:text-red-600"
                >
                    <Trash2 size={16} />
                </button>

                )}

            </div>

            ))}

        </div>

        {/* Add member */}

        {userRole === "admin" && (

            <div className="flex gap-2">

            <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
            >

                <option value="">
                Select user
                </option>

                {Array.isArray(allUsers) &&
                    allUsers.map((u) => (

                <option key={u.id} value={u.id}>
                    {u.name}
                </option>

                ))}

            </select>

            <button
                onClick={addMember}
                disabled={loading}
                className="bg-[#FF7F50] text-white px-3 py-2 rounded-lg flex items-center gap-1"
            >

                <UserPlus size={16} />
                Add

            </button>

            </div>

        )}

        </div>

    );

}
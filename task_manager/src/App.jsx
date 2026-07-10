import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  LayoutDashboard,
  Bell,
  Trash2,
  Mail
} from "lucide-react";

import LandingPage from "./components/LandingPage";
import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";
import GoogleIcon from "./components/GoogleIcon";
import StatCard from "./components/dashboard/StatCard";
import KanbanColumn from "./components/taskboard/KanbanColumn";
import TaskModal from "./components/taskboard/TaskModal";
import MemberCard, { InviteMemberCard } from "./components/members/MemberCard";
import useTasks from "./hooks/useTasks";
import CreateProjectModal from "./components/projects/CreateProjectModal";
import ProjectMembers from "./components/projects/ProjectMembers";
import ProjectSelector from "./components/projects/ProjectSelector";
import ThemeToggle from "./components/ThemeToggle";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

export default function App() {

  const [appState, setAppState] = useState("landing");
  const [view, setView] = useState("dashboard");
  const [userId,setUserId] = useState(null);
  const [projects,setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null);
  const [projectModalOpen,setProjectModalOpen] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [userPhoto, setUserPhoto] = useState("");
  const [userRole, setUserRole] = useState("member");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [nameInput, setNameInput] = useState("");
  
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [showVerifyPending, setShowVerifyPending] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [toast, setToast] = useState(null);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);

  const { tasks, addTask, deleteTask, updateTask, fetchTasks } = useTasks();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    name:"",
    email:""
  });
  const [members, setMembers] = useState([]);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [messageForm, setMessageForm] = useState({ subject: "", body: "" });

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {

    const handleClickOutside = (event) => {

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setIsNotificationsOpen(false);
      }

    };

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);

  }, []);

  useEffect(() => {
    // 1. Theme setup
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const query = new URLSearchParams(window.location.search);
    const googleToken = query.get("token");
    const verifyTokenParam = query.get("verify_token");
    const resetTokenParam = query.get("reset_token");
    const inviteGroupParam = query.get("invite_group");
    const signupParam = query.get("signup");

    // 2. Handle Google Login callback redirect
    if (googleToken) {
      const id = query.get("id");
      const name = query.get("name");
      const role = query.get("role");
      const avatar = query.get("avatar");

      localStorage.setItem("token", googleToken);
      localStorage.setItem("userId", id);
      localStorage.setItem("displayName", name);
      localStorage.setItem("userRole", role || "member");
      localStorage.setItem("userPhoto", avatar || "");

      setUserId(Number(id));
      setDisplayName(name);
      setUserPhoto(avatar || "");
      setUserRole(role || "member");
      setAppState("app");
      showToast("Signed in with Google", "success");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // 3. Handle Verify Email link
    if (verifyTokenParam) {
      fetch(`${API_URL}/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyTokenParam })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          showToast(data.error, "error");
        } else {
          showToast(data.message || "Email verified successfully!", "success");
        }
      })
      .catch(err => {
        console.error("Email verification failed", err);
        showToast("Email verification failed", "error");
      });
      setAppState("onboarding");
      setIsSignUp(false);
      setShowVerifyPending(false);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // 4. Handle Reset Password link (prevent auto-login / clear session)
    if (resetTokenParam) {
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      localStorage.removeItem("displayName");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userPhoto");
      setUserId(null);
      setDisplayName("");
      setUserPhoto("");
      setUserRole("member");

      setResetToken(resetTokenParam);
      setAppState("onboarding");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // 5. Handle Invite link
    if (inviteGroupParam) {
      localStorage.setItem("invite_group", inviteGroupParam);
      const existingToken = localStorage.getItem("token");
      if (existingToken) {
        joinGroup(inviteGroupParam);
      }
    }

    // 6. Handle signup routing from invite
    if (signupParam === "true") {
      setIsSignUp(true);
      setAppState("onboarding");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // 7. Regular Session Auto-Login
    const token = localStorage.getItem("token");
    const storedUserId = localStorage.getItem("userId");
    const storedDisplayName = localStorage.getItem("displayName");
    const storedUserRole = localStorage.getItem("userRole");
    const storedUserPhoto = localStorage.getItem("userPhoto");

    if (token && storedUserId && storedDisplayName) {
      setUserId(Number(storedUserId));
      setDisplayName(storedDisplayName);
      setUserRole(storedUserRole || "member");
      setUserPhoto(storedUserPhoto || "");
      setAppState("app");
    }
  }, []);

  const joinGroup = async (groupId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/join-group`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ group_id: groupId })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("userRole", data.role || "member");
          setUserRole(data.role || "member");
        }
        showToast(data.message || "Joined workspace successfully", "success");
        // Clear invite_group on success
        localStorage.removeItem("invite_group");
        // Refresh local projects/members list
        fetchProjects();
        fetchMembers();
      } else {
        showToast(data.error || "Failed to join group", "error");
      }
    } catch (err) {
      console.error("Failed to join group", err);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMembers(data);
    } catch(err) {
      console.error("Failed to fetch members", err);
    }
  };

  useEffect(() => {
    // do not fetch members for guest login
    if (displayName === "Guest User") return;
    fetchMembers();
  }, [displayName]);


const fetchProjects = async () => {

  try {

    const token = localStorage.getItem("token");

      const res = await fetch(`${API_URL}/projects`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    const data = await res.json();

    setProjects(data);
    if (Array.isArray(data) && data.length > 0) {
      setCurrentProject(prev => {
        const exists = data.some(p => String(p.id) === String(prev));
        return exists ? prev : data[0].id;
      });
    } else {
      setCurrentProject(null);
    }

  } catch (err) {

    console.error("Failed to fetch projects", err);

  }

};

useEffect(() => {
  if (appState === "app") {
    fetchProjects();
  }
}, [appState]);

const deleteProject = async (id) => {

  if (!id) {
    alert("Select a project first");
    return;
  }

  if (!window.confirm("Delete this project?")) return;

  try {

    const token = localStorage.getItem("token");

      await fetch(`${API_URL}/projects/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

    fetchProjects();
    setCurrentProject(null);

  } catch (err) {

    console.error("Failed to delete project", err);

  }

};

  const handleGetStarted = () => setAppState("onboarding");

  const handleGoogleLogin = () => {
    const inviteGroup = localStorage.getItem("invite_group");
    if (inviteGroup) {
      window.location.href = `${API_URL}/auth/google?invite_group=${inviteGroup}`;
    } else {
      window.location.href = `${API_URL}/auth/google`;
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();

    try {
      const url = isSignUp
        ? `${API_URL}/register`
        : `${API_URL}/login`;

      const inviteGroup = localStorage.getItem("invite_group");

      const body = isSignUp
        ? {
            name: nameInput,
            email,
            password,
            ...(inviteGroup ? { invite_group: inviteGroup } : {})
          }
        : {
            email,
            password,
            ...(inviteGroup ? { invite_group: inviteGroup } : {})
          };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      console.log("AUTH RESPONSE:", data);

      if (data.error) {
        showToast(data.error, "error");
        if (!isSignUp && data.error.toLowerCase().includes("verify")) {
          setShowVerifyPending(true);
        }
        return;
      }

      if (isSignUp) {
        showToast(data.message || "Registration successful! Please verify your email.", "success");
        setShowVerifyPending(true);
        setNameInput("");
        setPassword("");
        return;
      }

      // ensure display name always exists
      let userName = data.name || email.split("@")[0];

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.id);
        localStorage.setItem("displayName", userName);
        localStorage.setItem("userRole", data.role || "member");
        localStorage.setItem("userPhoto", data.avatar || "");
        console.log("TOKEN AND SESSION SAVED");
      }

      // Clear the invite group since they have now successfully registered/logged in
      localStorage.removeItem("invite_group");

      setUserId(data.id);
      setDisplayName(userName);
      setUserRole(data.role || "member");
      setAppState("app");

      showToast("Welcome back!", "success");

    } catch (error) {
      console.error("Auth error:", error);
      showToast("Authentication failed", "error");
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
      } else {
        showToast(data.message || "Password reset link sent!", "success");
        setShowForgotPassword(false);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to request password reset link", "error");
    }
  };

  const handleResendVerification = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
      } else {
        showToast(data.message || "Verification email sent!", "success");
        setShowResendVerification(false);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to request verification email resend", "error");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetPassword !== confirmResetPassword) {
      showToast("Passwords do not match", "error");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: resetPassword })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
      } else {
        showToast(data.message || "Password reset successfully!", "success");
        setResetToken(null);
        setResetPassword("");
        setConfirmResetPassword("");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to reset password", "error");
    }
  };


  const handleCreateOrUpdate = (formData) => {

    if (editingTask) {

      updateTask(editingTask.id, formData);
      showToast("Task updated successfully", "success");

    } else {

      addTask({
        ...formData,
        created_by: userId,
        project_id: currentProject
      });

      showToast("Task created successfully", "success");

    }

    setIsModalOpen(false);
    setEditingTask(null);

  };

  const handleDelete = (taskId) => {

    if (!window.confirm("Delete this task permanently?")) return;

    deleteTask(taskId);
    showToast("Task deleted", "info");

  };

  const handleStatusChange = (taskId, newStatus) => {

    updateTask(taskId, { status: newStatus });

  };

  const filteredTasks = useMemo(() => {
    return Array.isArray(tasks)
      ? tasks.filter(
        (t) => t.project_id === Number(currentProject)
      )
    : [];
  }, [tasks, currentProject]);



  const stats = useMemo(() => {

  const total = filteredTasks.length;

  const completed = filteredTasks.filter(
    (t) => t.status === "completed"
  ).length;

  const inProgress = filteredTasks.filter(
    (t) => t.status === "in_progress"
  ).length;

  const todo = filteredTasks.filter(
    (t) => t.status === "todo"
  ).length;

  const highPriority = filteredTasks.filter(
    (t) => t.priority === "Urgent" || t.priority === "High"
  ).length;

  return { total, completed, inProgress, todo, highPriority };

}, [filteredTasks]);

  const overdueTasksCount = useMemo(() => {

    const today = new Date().toISOString().split("T")[0];

  return Array.isArray(tasks)
    ? tasks.filter(
        (t) => t.due_date < today && t.status !== "completed"
      ).length
    : 0;

  }, [tasks]);

  const teamMembers = useMemo(() => {

    const membersMap = new Map();

    if (displayName) {

      membersMap.set(displayName, {
        name: displayName,
        role: "You",
        tasksCount: 0
      });

    }

    if (Array.isArray(tasks)) {

  tasks.forEach((task) => {

    if (task.creatorName && !membersMap.has(task.creatorName)) {

      membersMap.set(task.creatorName, {
        name: task.creatorName,
        role: "Member",
        tasksCount: 0
      });

    }

    if (membersMap.has(task.creatorName)) {

      const m = membersMap.get(task.creatorName);
      m.tasksCount += 1;

    }

  });

}

    return Array.from(membersMap.values());

  }, [tasks, displayName]);

  const promoteUser = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: "admin" })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to promote user", "error");
        return;
      }
      showToast("User promoted to admin", "success");
      fetchMembers();
    } catch (error) {
      console.error(error);
      showToast("Failed to promote user", "error");
    }
  };

  const removeUser = async (userId) => {
    if (!window.confirm("Remove this member from the workspace?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to remove user", "error");
        return;
      }
      showToast("User removed from workspace", "info");
      fetchMembers();
    } catch (error) {
      console.error(error);
      showToast("Failed to remove user", "error");
    }
  };

  const leaveWorkspace = async () => {
    if (!window.confirm("Are you sure you want to leave this workspace group? You will be returned to your own individual workspace.")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/leave-group`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to leave workspace", "error");
        return;
      }
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userRole", data.role || "admin");
        setUserRole(data.role || "admin");
      }
      showToast(data.message || "Left workspace successfully", "success");
      window.location.reload();
    } catch (error) {
      console.error(error);
      showToast("Failed to leave workspace", "error");
    }
  };

  const sendMessage = async () => {
    if (!messageForm.subject.trim()) {
      showToast("Subject is required", "error");
      return;
    }
    if (!messageForm.body.trim()) {
      showToast("Message body is required", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/users/${messageRecipient.id}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: messageForm.subject,
          message: messageForm.body
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to send message", "error");
        return;
      }

      showToast(data.message || "Message sent successfully!", "success");
      setMessageForm({ subject: "", body: "" });
      setMessageRecipient(null);
      setMessageOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Failed to send message", "error");
    }
  };

const openInviteModal = () => {
  setNewMember({ name: "", email: "" });
  setInviteOpen(true);
};

  const notifications = useMemo(() => {

  return Array.isArray(tasks)
    ? [...tasks]
        .sort(
          (a, b) =>
            new Date(b.created_at || 0) -
            new Date(a.created_at || 0)
        )
        .slice(0, 8)
    : [];

}, [tasks]);

const sendInvite = async () => {
  if (!newMember.email) {
    showToast("Email is required", "error");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ email: newMember.email, name: newMember.name })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Failed to send invitation", "error");
      return;
    }

    showToast(data.message || "Invitation sent!", "success");
    setNewMember({ name: "", email: "" });
    setInviteOpen(false);
  } catch (err) {
    console.error(err);
    showToast("Failed to send invitation", "error");
  }
};

  const projectTasks = useMemo(() => {
  return Array.isArray(tasks)
    ? tasks.filter(
        (t) => t.project_id === Number(currentProject)
      )
    : [];
  }, [tasks, currentProject]);

  const completedProjectTasks = projectTasks.filter(
    (t) => t.status === "completed"
  );

  const progress =
    projectTasks.length === 0
      ? 0
      : Math.round((completedProjectTasks.length / projectTasks.length) * 100);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("displayName");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userPhoto");
    setUserId(null);
    setAppState("landing");
    setDisplayName("");
    setUserPhoto("");
    setUserRole("member");
    setCurrentProject(null);
    setEmail("");
    setPassword("");
  };

  if (appState === "landing") {

    return (
      <LandingPage
        onGetStarted={handleGetStarted}
        onGoogleLogin={handleGoogleLogin}
      />
    );

  }

  if (appState === "onboarding") {

    return (

      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 transition-colors duration-300">

        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 p-10 rounded-3xl max-w-md w-full text-center shadow-lg transition-colors duration-300">

          <User className="w-10 h-10 mx-auto mb-4 text-[#FF7F50]" />

          <h1 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">
            Task Crusader
          </h1>

          {resetToken ? (
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                Enter your new password below.
              </p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <input
                  type="password"
                  placeholder="New Password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full p-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-[#FF7F50]"
                  required
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  className="w-full p-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-[#FF7F50]"
                  required
                />
                <button className="w-full bg-[#FF7F50] hover:bg-[#e06c43] text-white py-3 rounded-xl font-bold transition-colors">
                  Reset Password
                </button>
              </form>
              <button
                className="mt-6 text-sm text-[#FF7F50] hover:underline block mx-auto bg-transparent border-0 cursor-pointer"
                onClick={() => setResetToken(null)}
              >
                Back to Login
              </button>
            </div>
          ) : showForgotPassword ? (
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-[#FF7F50]"
                  required
                />
                <button className="w-full bg-[#FF7F50] hover:bg-[#e06c43] text-white py-3 rounded-xl font-bold transition-colors">
                  Send Reset Link
                </button>
              </form>
              <button
                className="mt-6 text-sm text-[#FF7F50] hover:underline block mx-auto bg-transparent border-0 cursor-pointer"
                onClick={() => setShowForgotPassword(false)}
              >
                Back to Login
              </button>
            </div>
          ) : showResendVerification ? (
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                Enter your email address to resend the activation link.
              </p>
              <form onSubmit={handleResendVerification} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-[#FF7F50]"
                  required
                />
                <button className="w-full bg-[#FF7F50] hover:bg-[#e06c43] text-white py-3 rounded-xl font-bold transition-colors">
                  Resend Verification Link
                </button>
              </form>
              <button
                className="mt-6 text-sm text-[#FF7F50] hover:underline block mx-auto bg-transparent border-0 cursor-pointer"
                onClick={() => setShowResendVerification(false)}
              >
                Back to Login
              </button>
            </div>
          ) : showVerifyPending ? (
            <div>
              <div className="w-16 h-16 bg-[#FF7F50]/10 text-[#FF7F50] rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Mail className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white">
                Verify your email
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 max-w-sm mx-auto leading-relaxed">
                We've sent an activation link to <span className="font-semibold text-zinc-900 dark:text-white">{email}</span>. Please check your inbox and verify your email to continue.
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleResendVerification}
                  className="w-full bg-[#FF7F50] hover:bg-[#e06c43] text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-[#FF7F50]/20 hover:shadow-[#FF7F50]/30 hover:-translate-y-0.5"
                >
                  Resend Verification Email
                </button>
                <button
                  className="w-full text-sm text-zinc-500 dark:text-zinc-400 hover:text-[#FF7F50] dark:hover:text-[#FF7F50] transition-colors py-2 block mx-auto bg-transparent border-0 cursor-pointer"
                  onClick={() => {
                    setShowVerifyPending(false);
                    setIsSignUp(false);
                  }}
                >
                  Back to Login
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 mb-4 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 transition-colors"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <form onSubmit={handleEmailAuth} className="space-y-4">

                {isSignUp && (
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full p-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-[#FF7F50]"
                  />
                )}

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-[#FF7F50]"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-[#FF7F50]"
                />

                <button className="w-full bg-[#FF7F50] hover:bg-[#e06c43] text-white py-3 rounded-xl font-bold transition-colors">
                  {isSignUp ? "Sign Up" : "Login"}
                </button>

              </form>

              <div className="mt-6 flex flex-col items-center gap-2">
                <button
                  className="text-sm text-[#FF7F50] hover:underline bg-transparent border-0 cursor-pointer"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? "Switch to Login" : "Create Account"}
                </button>
                {!isSignUp && (
                  <>
                    <button
                      className="text-xs text-zinc-500 dark:text-zinc-400 hover:underline bg-transparent border-0 cursor-pointer"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot Password?
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    );

  }

  return (

    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300 overflow-hidden">

      <Sidebar
        view={view}
        setView={setView}
        displayName={displayName}
        userPhoto={userPhoto}
        handleLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300 min-w-0">

        <header className="relative flex items-center justify-between pl-14 lg:pl-4 pr-4 md:pr-6 border-b border-zinc-100 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md gap-2 py-3 min-h-[64px] transition-all duration-300 shrink-0 z-[60]">

          <h1 className="text-base sm:text-lg md:text-xl font-bold capitalize truncate text-zinc-900 dark:text-white">
            {view === "board" ? "Task Board" : view}
          </h1>

          <div className="flex items-center gap-2 shrink-0">

            <ThemeToggle />

            {/* Bell notification */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative w-9 h-9 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-full border border-transparent dark:border-zinc-700/50 transition-all shadow-sm"
              >
                <Bell size={16} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF7F50] rounded-full ring-2 ring-white dark:ring-zinc-950" />
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1rem)] bg-white dark:bg-zinc-900 shadow-2xl rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 z-[9999]">
                  <p className="font-bold mb-3 text-zinc-900 dark:text-white text-sm">Notifications</p>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-zinc-400">No notifications yet</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="text-sm py-2 border-b border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 last:border-0">
                        {n.title}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Project selector — always visible, compact on mobile */}
            <div className="flex items-center">
              <ProjectSelector
                projects={projects}
                currentProject={currentProject}
                setCurrentProject={setCurrentProject}
                onDeleteProject={deleteProject}
                userRole={userRole}
                onCreateProjectClick={() => setProjectModalOpen(true)}
              />
            </div>

            {/* New Task button */}
            <button
              onClick={() => {
                if (!currentProject) {
                  alert("Please select a project first");
                  return;
                }
                setEditingTask(null);
                setIsModalOpen(true);
              }}
              className="bg-[#FF7F50] hover:bg-[#e06c43] text-white px-3 sm:px-5 py-2 rounded-full flex items-center gap-1.5 text-xs font-black uppercase tracking-wide transition-all shadow-md shadow-[#FF7F50]/20"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Task</span>
            </button>

          </div>

        </header>

        <main className="flex-1 overflow-auto min-w-0">

          {view === "members" && (
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 animate-fade-in">
              {members.map((member, i) => (
                <MemberCard
                  key={i}
                  member={{
                    ...member,
                    role: member.name === displayName ? userRole : member.role
                  }}
                  isCurrentUser={member.name === displayName}
                  userPhoto={userPhoto}
                  isAdmin={userRole === "admin"}
                  onPromote={(user) => promoteUser(user.id)}
                  onRemove={(user) => removeUser(user.id)}
                  onMessage={(user) => {
                    setMessageRecipient(user);
                    setMessageForm({ subject: "", body: "" });
                    setMessageOpen(true);
                  }}
                  onLeave={leaveWorkspace}
                />
              ))}
              {userRole === "admin" && (
                <InviteMemberCard onInvite={() => openInviteModal()} />
              )}
            </div>
          )}

          {view !== "members" && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center animate-fade-in">
              <div className="w-full max-w-sm bg-white dark:bg-white/[0.04] p-8 rounded-3xl border border-gray-100 dark:border-white/[0.07] shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-none flex flex-col items-center">
                <div className="w-14 h-14 bg-[#FF7F50]/10 rounded-2xl flex items-center justify-center text-[#FF7F50] mb-5 shadow-sm">
                  <LayoutDashboard className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Create your first project</h2>
                <p className="text-sm text-gray-400 dark:text-white/40 font-medium mb-6 leading-relaxed">
                  Projects contain tasks, boards, and members. Start by setting up your first workspace.
                </p>
                {userRole === "admin" ? (
                  <button
                    onClick={() => setProjectModalOpen(true)}
                    className="bg-gray-900 dark:bg-[#FF7F50] hover:bg-[#FF7F50] dark:hover:bg-[#e06c43] text-white px-7 py-3 rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-[#FF7F50]/30"
                  >
                    Create Project
                  </button>
                ) : (
                  <div className="text-xs font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest bg-gray-50 dark:bg-white/[0.05] px-4 py-2.5 rounded-xl">
                    Waiting for admin invitation
                  </div>
                )}
              </div>
            </div>
          )}

          {view !== "members" && projects.length > 0 && (
            <>
              {view === "dashboard" && (
                <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 animate-fade-in">
                  <StatCard title="Total Tasks" value={stats.total} icon={LayoutDashboard} />
                  <StatCard title="In Progress" value={stats.inProgress} icon={Clock} />
                  <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} />
                  <StatCard title="High Priority" value={stats.highPriority} icon={AlertCircle} />
                  <StatCard title="Overdue Tasks" value={overdueTasksCount} icon={AlertCircle} />

                  {/* Project Progress Card */}
                  <div className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.07] p-5 rounded-2xl shadow-sm dark:shadow-none">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Project Progress</h3>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mb-3">{progress}%</p>
                    <div className="w-full bg-gray-100 dark:bg-white/[0.08] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#FF7F50] to-[#e06c43] h-2.5 rounded-full transition-all duration-700"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-white/30 mt-2 font-semibold">completed</p>
                  </div>

                  {currentProject && (
                    <ProjectMembers projectId={currentProject} userRole={userRole} />
                  )}
                </div>
              )}

              {view === "board" && (
                <div className="h-full flex flex-col md:flex-row gap-4 p-4 sm:p-5 overflow-x-auto animate-fade-in">
                  <KanbanColumn title="To Do" status="todo" tasks={filteredTasks} onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }} onDelete={handleDelete} onStatusChange={handleStatusChange} userId={userId} userRole={userRole} />
                  <KanbanColumn title="In Progress" status="in_progress" tasks={filteredTasks} onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }} onDelete={handleDelete} onStatusChange={handleStatusChange} userId={userId} userRole={userRole} />
                  <KanbanColumn title="Completed" status="completed" tasks={filteredTasks} onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }} onDelete={handleDelete} onStatusChange={handleStatusChange} userId={userId} userRole={userRole} />
                </div>
              )}
            </>
          )}

        </main>

      </div>

      <TaskModal
        key={editingTask?.id || "new"}
        isOpen={isModalOpen}
        onClose={()=>setIsModalOpen(false)}
        onSave={handleCreateOrUpdate}
        onActivityAdded={fetchTasks}
        task={editingTask}
        members={members}
        projectId={currentProject}
        apiUrl={API_URL}
      />

      {inviteOpen && (

      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">

      <div className="bg-white p-8 rounded-[2rem] w-[420px] space-y-5 shadow-2xl">

      <div className="text-center">
        <h2 className="font-black text-2xl tracking-tight">Invite Member</h2>
        <p className="text-sm text-gray-400 mt-1">Send an email invitation to join your workspace</p>
      </div>

      <input
      placeholder="Name (optional)"
      value={newMember.name}
      className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:border-[#FF7F50] transition-colors"
      onChange={(e)=>setNewMember({...newMember,name:e.target.value})}
      />

      <input
      placeholder="Email address *"
      type="email"
      value={newMember.email}
      className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:border-[#FF7F50] transition-colors"
      onChange={(e)=>setNewMember({...newMember,email:e.target.value})}
      />

      <button
      onClick={sendInvite}
      className="w-full bg-[#FF7F50] hover:bg-[#e06c43] text-white py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:-translate-y-0.5 shadow-lg shadow-[#FF7F50]/20"
      >
      Send Invitation
      </button>

      <button
      onClick={()=>{
        setNewMember({ name: "", email: "" });
        setInviteOpen(false);
      }}
      className="w-full bg-gray-100 hover:bg-gray-200 py-3 rounded-xl font-bold text-sm text-gray-500 transition-colors"
      >
      Cancel
      </button>

      </div>
      </div>

      )}

      {messageOpen && messageRecipient && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-8 rounded-[2rem] w-[460px] space-y-5 shadow-2xl">
            <div className="text-center">
              <h2 className="font-black text-2xl tracking-tight text-gray-900">Message {messageRecipient.name}</h2>
              <p className="text-sm text-gray-400 mt-1">Send a direct message via email to your teammate</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Subject *</label>
                <input
                  placeholder="Subject of the message"
                  value={messageForm.subject}
                  className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:border-[#FF7F50] transition-colors font-medium text-sm"
                  onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Message Body *</label>
                <textarea
                  placeholder="Write your message here..."
                  rows={5}
                  value={messageForm.body}
                  className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:border-[#FF7F50] transition-colors font-medium text-sm resize-none"
                  onChange={(e) => setMessageForm({ ...messageForm, body: e.target.value })}
                />
              </div>
            </div>

            <button
              onClick={sendMessage}
              className="w-full bg-[#FF7F50] hover:bg-[#e06c43] text-white py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:-translate-y-0.5 shadow-lg shadow-[#FF7F50]/20"
            >
              Send Message
            </button>

            <button
              onClick={() => {
                setMessageForm({ subject: "", body: "" });
                setMessageRecipient(null);
                setMessageOpen(false);
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 py-3 rounded-xl font-bold text-sm text-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={()=>setToast(null)}
        />
      )}
      <CreateProjectModal
        isOpen={projectModalOpen}
        onClose={()=>setProjectModalOpen(false)}
        onCreated={fetchProjects}
        userId={userId}
      />

    </div>

  );

}


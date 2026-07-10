"""Basic smoke tests for the Task Crusader API.

Run with:  python test.py
Requires the Flask server to be running on http://localhost:5000.
"""
import requests
import sys

BASE = "http://localhost:5000"


def ok(label, resp, expected_status=200):
    passed = resp.status_code == expected_status
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {label} -> HTTP {resp.status_code}")
    if not passed:
        print("       ", resp.text)
    return passed


def run_tests():
    results = []

    # Health check
    r = requests.get(f"{BASE}/")
    results.append(ok("Health check", r))

    # Register a new user
    import time
    email = f"test_{int(time.time())}@example.com"
    r = requests.post(f"{BASE}/register", json={"name": "Test User", "email": email, "password": "securepass123"})
    results.append(ok("Register user", r, 201))
    token = r.json().get("token", "")
    headers = {"Authorization": f"Bearer {token}"}

    # Login
    r = requests.post(f"{BASE}/login", json={"email": email, "password": "securepass123"})
    results.append(ok("Login", r))

    # Login with wrong password
    r = requests.post(f"{BASE}/login", json={"email": email, "password": "wrongpassword"})
    results.append(ok("Login wrong password", r, 401))

    # Get users (authenticated)
    r = requests.get(f"{BASE}/users", headers=headers)
    results.append(ok("Get users (auth)", r))

    # Get users (unauthenticated)
    r = requests.get(f"{BASE}/users")
    results.append(ok("Get users (no auth)", r, 401))

    # Create task
    r = requests.post(f"{BASE}/tasks", json={"title": "Test Task", "priority": "High"}, headers=headers)
    results.append(ok("Create task", r, 201))
    task_id = r.json().get("id")

    # Update task status
    if task_id:
        r = requests.put(f"{BASE}/tasks/{task_id}", json={"status": "in_progress"}, headers=headers)
        results.append(ok("Update task status", r))

        # Delete task
        r = requests.delete(f"{BASE}/tasks/{task_id}", headers=headers)
        results.append(ok("Delete task", r))

    # Dashboard
    r = requests.get(f"{BASE}/dashboard", headers=headers)
    results.append(ok("Dashboard stats", r))

    passed = sum(results)
    total = len(results)
    print(f"\n{passed}/{total} tests passed.")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(run_tests())

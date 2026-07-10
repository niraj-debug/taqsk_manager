import requests
import time
import sys

BASE = "http://localhost:5000"

def verify_user_in_db(email):
    from db import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_verified = 1 WHERE email = %s", (email,))
    conn.commit()
    cursor.close()
    conn.close()

def run_tests():
    # 1. Register Admin User
    admin_email = f"admin_{int(time.time())}@example.com"
    r = requests.post(f"{BASE}/register", json={
        "name": "Admin User",
        "email": admin_email,
        "password": "securepassword1"
    })
    if r.status_code != 201:
        print("[FAIL] Admin registration failed:", r.text)
        return False
    
    # Verify in DB and Log in
    verify_user_in_db(admin_email)
    r_login = requests.post(f"{BASE}/login", json={"email": admin_email, "password": "securepassword1"})
    if r_login.status_code != 200:
        print("[FAIL] Admin login failed:", r_login.text)
        return False
    
    admin_token = r_login.json().get("token")
    admin_id = r_login.json().get("id")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_group = r_login.json().get("group_id")

    # 2. Register Member User (joining admin group)
    member_email = f"member_{int(time.time())}@example.com"
    r = requests.post(f"{BASE}/register", json={
        "name": "Member User",
        "email": member_email,
        "password": "securepassword2",
        "invite_group": admin_group
    })
    if r.status_code != 201:
        print("[FAIL] Member registration failed:", r.text)
        return False
        
    # Verify in DB and Log in
    verify_user_in_db(member_email)
    r_login = requests.post(f"{BASE}/login", json={"email": member_email, "password": "securepassword2", "invite_group": admin_group})
    if r_login.status_code != 200:
        print("[FAIL] Member login failed:", r_login.text)
        return False
        
    member_token = r_login.json().get("token")
    member_id = r_login.json().get("id")
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 3. Register Unrelated User
    other_email = f"other_{int(time.time())}@example.com"
    r = requests.post(f"{BASE}/register", json={
        "name": "Other User",
        "email": other_email,
        "password": "securepassword3"
    })
    if r.status_code != 201:
        print("[FAIL] Other user registration failed:", r.text)
        return False
        
    # Verify in DB and Log in
    verify_user_in_db(other_email)
    r_login = requests.post(f"{BASE}/login", json={"email": other_email, "password": "securepassword3"})
    if r_login.status_code != 200:
        print("[FAIL] Other user login failed:", r_login.text)
        return False
        
    other_token = r_login.json().get("token")
    other_headers = {"Authorization": f"Bearer {other_token}"}

    print("[PASS] User registrations and logins succeeded.")

    # 4. Create Task (Assigned to Member, created by Admin)
    r = requests.post(f"{BASE}/tasks", json={
        "title": "Permissions Test Task",
        "priority": "High",
        "due_date": "2026-07-01",
        "assigned_to": member_id
    }, headers=admin_headers)
    if r.status_code != 201:
        print("[FAIL] Task creation failed:", r.text)
        return False
    
    task = r.json()
    task_id = task.get("id")
    
    # Verify date format is returned as ISO YYYY-MM-DD
    due_date_returned = task.get("due_date")
    if due_date_returned != "2026-07-01":
        print(f"[FAIL] Expected ISO format date '2026-07-01', got: '{due_date_returned}'")
        return False
    print("[PASS] Date serialization correct (ISO format).")

    # 5. Member updates their assigned task (Should succeed)
    r = requests.put(f"{BASE}/tasks/{task_id}", json={
        "title": "Updated by Member",
        "status": "in_progress",
        "assigned_to": member_id
    }, headers=member_headers)
    if r.status_code != 200:
        print("[FAIL] Assigned member could not update task:", r.text)
        return False
    print("[PASS] Assigned member successfully updated task.")

    # 6. Admin updates task (Should succeed)
    r = requests.put(f"{BASE}/tasks/{task_id}", json={
        "title": "Updated by Admin",
        "status": "todo",
        "assigned_to": member_id
    }, headers=admin_headers)
    if r.status_code != 200:
        print("[FAIL] Admin could not update task:", r.text)
        return False
    print("[PASS] Admin successfully updated task.")

    # 7. Unrelated user updates task (Should fail with 403 or 404)
    r = requests.put(f"{BASE}/tasks/{task_id}", json={
        "title": "Hack Attempt",
        "status": "completed",
        "assigned_to": member_id
    }, headers=other_headers)
    if r.status_code not in (403, 404):
        print("[FAIL] Unauthorized user updated task without 403/404 status code:", r.status_code, r.text)
        return False
    print("[PASS] Unauthorized user update correctly rejected (403/404).")

    # 8. Post progress update (activity) by Member
    r = requests.post(f"{BASE}/tasks/{task_id}/activities", data={
        "activity_type": "progress_share",
        "content": "Worked on design mockup today"
    }, headers=member_headers)
    if r.status_code != 201:
        print("[FAIL] Failed to post activity:", r.text)
        return False
    print("[PASS] Progress update successfully posted.")

    # 9. Verify task list includes the latest shared progress
    r = requests.get(f"{BASE}/tasks", headers=admin_headers)
    if r.status_code != 200:
        print("[FAIL] Failed to fetch tasks:", r.text)
        return False
    
    tasks = r.json()
    my_task = next((t for t in tasks if t["id"] == task_id), None)
    if not my_task:
        print("[FAIL] Created task not found in list.")
        return False
    
    if my_task.get("latest_activity_content") != "Worked on design mockup today":
        print("[FAIL] latest_activity_content not matching shared progress, got:", my_task.get("latest_activity_content"))
        return False
    
    if my_task.get("latest_activity_user_name") != "Member User":
        print("[FAIL] latest_activity_user_name not matching, got:", my_task.get("latest_activity_user_name"))
        return False
    
    print("[PASS] Task card retrieval includes latest shared progress detail.")

    # 10. Member tries to delete task (Should fail with 403)
    r = requests.delete(f"{BASE}/tasks/{task_id}", headers=member_headers)
    if r.status_code != 403:
        print("[FAIL] Member deleted task without 403 status code:", r.status_code, r.text)
        return False
    print("[PASS] Member task deletion correctly rejected (403).")

    # 11. Admin deletes task (Should succeed)
    r = requests.delete(f"{BASE}/tasks/{task_id}", headers=admin_headers)
    if r.status_code != 200:
        print("[FAIL] Admin failed to delete task:", r.text)
        return False
    print("[PASS] Admin successfully deleted task.")

    print("\n[ALL PASS] Automated permission and activities verification successful.")
    return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

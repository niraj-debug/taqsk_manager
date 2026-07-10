-- Migration 001: database-level integrity constraints
--
-- Adds the safeguards tracked in issue #1. Run against the existing
-- `task_manager` database:
--
--   mysql -u <user> -p task_manager < migrations/001_integrity_constraints.sql
--
-- Each section first removes any pre-existing duplicate rows so the
-- UNIQUE constraints can be applied to a dirty database without error.
-- Review the DELETE statements before running in production.

START TRANSACTION;

-- ---------------------------------------------------------------------
-- 1) users.email must be unique
--    (keep the lowest id per duplicate email)
-- ---------------------------------------------------------------------
DELETE u1 FROM users u1
INNER JOIN users u2
  ON u1.email = u2.email
 AND u1.id > u2.id;

ALTER TABLE users
  ADD CONSTRAINT uq_users_email UNIQUE (email);

-- ---------------------------------------------------------------------
-- 2) project_members: one row per (project_id, user_id)
-- ---------------------------------------------------------------------
DELETE pm1 FROM project_members pm1
INNER JOIN project_members pm2
  ON pm1.project_id = pm2.project_id
 AND pm1.user_id    = pm2.user_id
 AND pm1.id > pm2.id;

ALTER TABLE project_members
  ADD CONSTRAINT uq_project_members UNIQUE (project_id, user_id);

ALTER TABLE project_members
  ADD CONSTRAINT fk_project_members_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_project_members_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- 3) task_assignments: one row per (task_id, user_id)
-- ---------------------------------------------------------------------
DELETE ta1 FROM task_assignments ta1
INNER JOIN task_assignments ta2
  ON ta1.task_id = ta2.task_id
 AND ta1.user_id = ta2.user_id
 AND ta1.id > ta2.id;

ALTER TABLE task_assignments
  ADD CONSTRAINT uq_task_assignments UNIQUE (task_id, user_id);

ALTER TABLE task_assignments
  ADD CONSTRAINT fk_task_assignments_task
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_task_assignments_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

COMMIT;

-- Fix departments table and setup
-- Run this in Supabase SQL Editor

-- 1. Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- 2. Insert default departments
INSERT INTO departments (name, display_name) VALUES 
('haslestad', 'Haslestad'),
('justeverkt', 'Justeverkt')
ON CONFLICT (name) DO NOTHING;

-- 3. Add department columns to existing tables
ALTER TABLE user_passwords 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id),
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'operator',
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);

ALTER TABLE downtimes 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);

-- 4. Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
DROP POLICY IF EXISTS "Allow all operations on departments" ON departments;
CREATE POLICY "Allow all operations on departments" ON departments
  FOR ALL USING (true);

-- 6. Update existing data
UPDATE user_passwords 
SET department_id = (SELECT id FROM departments WHERE name = 'haslestad' LIMIT 1),
    role = CASE 
      WHEN user_id = 'admin' THEN 'admin'
      WHEN user_id = 'sjef' THEN 'manager'
      WHEN user_id = 'tv' THEN 'viewer'
      ELSE 'operator'
    END,
    display_name = CASE 
      WHEN user_id = 'operatør' THEN 'Operatør'
      WHEN user_id = 'operator' THEN 'Operator'
      WHEN user_id = 'Dag' THEN 'Dag'
      WHEN user_id = 'dag' THEN 'Dag'
      WHEN user_id = 'Kveld' THEN 'Kveld'
      WHEN user_id = 'kveld' THEN 'Kveld'
      WHEN user_id = 'sjef' THEN 'Sjef'
      WHEN user_id = 'admin' THEN 'Admin'
      WHEN user_id = 'tv' THEN 'TV Monitor'
      ELSE INITCAP(user_id)
    END
WHERE department_id IS NULL;

-- 7. Create super admin
INSERT INTO user_passwords (user_id, password_hash, role, display_name) VALUES 
('superadmin', '123456', 'superadmin', 'Super Administrator')
ON CONFLICT (user_id) DO UPDATE SET 
  role = 'superadmin',
  display_name = 'Super Administrator';

-- 8. Update machines
UPDATE machines 
SET department_id = (SELECT id FROM departments WHERE name = 'haslestad' LIMIT 1)
WHERE department_id IS NULL;

-- 9. Update downtimes
UPDATE downtimes 
SET department_id = (SELECT id FROM departments WHERE name = 'haslestad' LIMIT 1)
WHERE department_id IS NULL;
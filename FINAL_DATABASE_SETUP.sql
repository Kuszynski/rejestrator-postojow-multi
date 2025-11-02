-- FINAL DATABASE SETUP FOR MULTI-DEPARTMENT SYSTEM
-- Run this in Supabase SQL Editor

-- 1. Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- 2. Add department_id to existing tables
ALTER TABLE user_passwords ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);
ALTER TABLE user_passwords ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'operator';
ALTER TABLE user_passwords ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

ALTER TABLE machines ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);
ALTER TABLE downtimes ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);

-- 3. Insert default departments
INSERT INTO departments (name, display_name) VALUES 
('haslestad', 'Haslestad'),
('justeverkt', 'Justeverkt')
ON CONFLICT (name) DO NOTHING;

-- 4. Update existing data - assign to Haslestad (department_id = 1)
UPDATE user_passwords SET 
  department_id = 1,
  role = CASE 
    WHEN user_id = 'superadmin' THEN 'superadmin'
    WHEN user_id = 'admin' THEN 'admin'
    WHEN user_id = 'sjef' THEN 'manager'
    WHEN user_id = 'tv' THEN 'viewer'
    ELSE 'operator'
  END,
  display_name = CASE 
    WHEN user_id = 'operatør' THEN 'Operatør'
    WHEN user_id = 'operator' THEN 'Operator'
    WHEN user_id = 'Dag' THEN 'Dag'
    WHEN user_id = 'Kveld' THEN 'Kveld'
    WHEN user_id = 'sjef' THEN 'Sjef'
    WHEN user_id = 'admin' THEN 'Admin'
    WHEN user_id = 'tv' THEN 'TV Monitor'
    WHEN user_id = 'superadmin' THEN 'Super Administrator'
    ELSE INITCAP(user_id)
  END
WHERE department_id IS NULL;

UPDATE machines SET department_id = 1 WHERE department_id IS NULL;
UPDATE downtimes SET department_id = 1 WHERE department_id IS NULL;

-- 5. Create super admin if not exists
INSERT INTO user_passwords (user_id, password_hash, department_id, role, display_name) VALUES 
('superadmin', '123456', 1, 'superadmin', 'Super Administrator')
ON CONFLICT (user_id) DO UPDATE SET 
  role = 'superadmin',
  display_name = 'Super Administrator';

-- 6. Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on departments" ON departments FOR ALL USING (true);

-- 7. Create function to auto-assign department to new downtimes
CREATE OR REPLACE FUNCTION assign_department_to_downtime()
RETURNS TRIGGER AS $$
BEGIN
  -- Get department from operator
  SELECT department_id INTO NEW.department_id
  FROM user_passwords 
  WHERE user_id = NEW.operator_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger
DROP TRIGGER IF EXISTS trigger_assign_department ON downtimes;
CREATE TRIGGER trigger_assign_department
  BEFORE INSERT ON downtimes
  FOR EACH ROW
  EXECUTE FUNCTION assign_department_to_downtime();
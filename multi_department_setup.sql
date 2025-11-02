-- MULTI-DEPARTMENT SYSTEM SETUP
-- Complete database structure for multi-department downtime tracker

-- 1. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- 2. UPDATE USER_PASSWORDS TABLE - Add department and role
ALTER TABLE user_passwords 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id),
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'operator',
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- 3. UPDATE MACHINES TABLE - Add department
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);

-- 4. UPDATE DOWNTIMES TABLE - Add department for easier querying
ALTER TABLE downtimes 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);

-- 5. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_user_passwords_department ON user_passwords(department_id);
CREATE INDEX IF NOT EXISTS idx_machines_department ON machines(department_id);
CREATE INDEX IF NOT EXISTS idx_downtimes_department ON downtimes(department_id);

-- 6. UPDATE RLS POLICIES
DROP POLICY IF EXISTS "Allow all operations on user_passwords" ON user_passwords;
DROP POLICY IF EXISTS "Allow all operations on downtimes" ON downtimes;
DROP POLICY IF EXISTS "Allow all operations on machines" ON machines;

-- New RLS policies for multi-department
CREATE POLICY "Department access for user_passwords" ON user_passwords
  FOR ALL USING (true); -- For now, allow all - can be restricted later

CREATE POLICY "Department access for downtimes" ON downtimes
  FOR ALL USING (true); -- For now, allow all - can be restricted later

CREATE POLICY "Department access for machines" ON machines
  FOR ALL USING (true); -- For now, allow all - can be restricted later

-- Enable RLS on new tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on departments" ON departments
  FOR ALL USING (true);

-- 7. INSERT DEFAULT DEPARTMENTS
INSERT INTO departments (name, display_name) VALUES 
('haslestad', 'Haslestad'),
('justeverkt', 'Justeverkt')
ON CONFLICT (name) DO NOTHING;

-- 8. CREATE SUPER ADMIN USER
INSERT INTO user_passwords (user_id, password_hash, role, display_name) VALUES 
('superadmin', '123456', 'superadmin', 'Super Administrator')
ON CONFLICT (user_id) DO UPDATE SET 
  role = 'superadmin',
  display_name = 'Super Administrator';

-- 9. UPDATE EXISTING USERS - Assign to Haslestad department
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
WHERE department_id IS NULL AND user_id != 'superadmin';

-- 10. UPDATE EXISTING MACHINES - Assign to Haslestad department
UPDATE machines 
SET department_id = (SELECT id FROM departments WHERE name = 'haslestad' LIMIT 1)
WHERE department_id IS NULL;

-- 11. UPDATE EXISTING DOWNTIMES - Assign to Haslestad department
UPDATE downtimes 
SET department_id = (SELECT id FROM departments WHERE name = 'haslestad' LIMIT 1)
WHERE department_id IS NULL;

-- 12. CREATE FUNCTION TO AUTO-ASSIGN DEPARTMENT TO NEW DOWNTIMES
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

-- 13. CREATE TRIGGER FOR AUTO-ASSIGNMENT
DROP TRIGGER IF EXISTS trigger_assign_department ON downtimes;
CREATE TRIGGER trigger_assign_department
  BEFORE INSERT ON downtimes
  FOR EACH ROW
  EXECUTE FUNCTION assign_department_to_downtime();

-- 14. SAMPLE DATA FOR JUSTEVERKT DEPARTMENT
-- Add sample machines for Justeverkt
INSERT INTO machines (id, name, color, department_id) VALUES 
('jv_m1', 'Justeverkt Maskin 1', 'bg-blue-500', (SELECT id FROM departments WHERE name = 'justeverkt')),
('jv_m2', 'Justeverkt Maskin 2', 'bg-green-500', (SELECT id FROM departments WHERE name = 'justeverkt')),
('jv_m3', 'Justeverkt Maskin 3', 'bg-red-500', (SELECT id FROM departments WHERE name = 'justeverkt'))
ON CONFLICT (id) DO NOTHING;

-- Add sample users for Justeverkt
INSERT INTO user_passwords (user_id, password_hash, department_id, role, display_name) VALUES 
('jv_operator1', '123456', (SELECT id FROM departments WHERE name = 'justeverkt'), 'operator', 'Justeverkt Operator 1'),
('jv_operator2', '123456', (SELECT id FROM departments WHERE name = 'justeverkt'), 'operator', 'Justeverkt Operator 2'),
('jv_manager', '123456', (SELECT id FROM departments WHERE name = 'justeverkt'), 'manager', 'Justeverkt Manager')
ON CONFLICT (user_id) DO NOTHING;

-- 15. CREATE VIEW FOR EASY DEPARTMENT QUERIES
CREATE OR REPLACE VIEW department_summary AS
SELECT 
  d.id,
  d.name,
  d.display_name,
  d.is_active,
  COUNT(DISTINCT u.user_id) as user_count,
  COUNT(DISTINCT m.id) as machine_count,
  COUNT(DISTINCT dt.id) as downtime_count,
  COALESCE(SUM(dt.duration), 0) as total_downtime_minutes
FROM departments d
LEFT JOIN user_passwords u ON d.id = u.department_id
LEFT JOIN machines m ON d.id = m.department_id
LEFT JOIN downtimes dt ON d.id = dt.department_id
GROUP BY d.id, d.name, d.display_name, d.is_active
ORDER BY d.name;

-- 16. GRANT PERMISSIONS
GRANT ALL ON departments TO anon, authenticated;
GRANT ALL ON department_summary TO anon, authenticated;
GRANT USAGE ON SEQUENCE departments_id_seq TO anon, authenticated;

COMMIT;
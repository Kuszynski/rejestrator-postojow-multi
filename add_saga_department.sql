-- Add Saga department to the system
-- Run this in Supabase SQL Editor

-- Insert Saga department
INSERT INTO departments (name, display_name) VALUES 
('saga', 'Saga')
ON CONFLICT (name) DO NOTHING;

-- Get the department ID for saga
DO $$
DECLARE
    saga_dept_id INTEGER;
BEGIN
    SELECT id INTO saga_dept_id FROM departments WHERE name = 'saga';
    
    -- Create some test users for saga department if they don't exist
    INSERT INTO user_passwords (user_id, password_hash, department_id, role, display_name) VALUES 
    ('saga_operator', '123456', saga_dept_id, 'operator', 'Saga Operatør'),
    ('saga_manager', '123456', saga_dept_id, 'manager', 'Saga Sjef')
    ON CONFLICT (user_id) DO UPDATE SET 
      department_id = saga_dept_id,
      role = EXCLUDED.role,
      display_name = EXCLUDED.display_name;
      
    -- Create some default machines for saga department
    INSERT INTO machines (id, name, color, department_id) VALUES 
    ('saga_m1', 'Saga Maskin 1', 'bg-blue-500', saga_dept_id),
    ('saga_m2', 'Saga Maskin 2', 'bg-green-500', saga_dept_id),
    ('saga_m3', 'Omposting/Korigering', 'bg-purple-500', saga_dept_id)
    ON CONFLICT (id) DO UPDATE SET 
      department_id = saga_dept_id;
END $$;
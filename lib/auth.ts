import { supabase } from './supabase';

// User interface for multi-department system
export interface User {
  id: string;
  username: string;
  role: 'super' | 'admin' | 'manager' | 'operator' | 'viewer';
  name: string;
  departmentId?: number;
  departmentName?: string;
}

// Department interface
export interface Department {
  id: number;
  name: string;
  displayName: string;
  isActive: boolean;
}

// Prosta funkcja hashowania (w produkcji użyj bcrypt)
export const hashPassword = (password: string): string => {
  // Dla uproszczenia używamy prostego hashowania
  // W produkcji użyj bcrypt lub podobnej biblioteki
  return btoa(password); // Base64 encoding
};

export const verifyPassword = (password: string, hash: string): boolean => {
  return btoa(password) === hash;
};

// Funkcja do sprawdzania użytkownika w Supabase z obsługą departamentów
export const authenticateUser = async (username: string, password: string) => {
  try {
    const { data, error } = await supabase
      .from('user_passwords')
      .select(`
        user_id, 
        password_hash, 
        role, 
        display_name,
        department_id,
        departments(name, display_name)
      `)
      .eq('user_id', username)
      .single();

    if (error || !data) {
      return { success: false, error: 'Użytkownik nie znaleziony' };
    }

    // Sprawdź hasło - najpierw spróbuj z hashowaniem, potem bez
    const isValidHashed = verifyPassword(password, data.password_hash);
    const isValidPlain = password === data.password_hash;

    if (isValidHashed || isValidPlain) {
      const user: User = {
        id: data.user_id,
        username: data.user_id,
        role: data.role || 'operator',
        name: data.display_name || data.user_id,
        departmentId: data.department_id,
        departmentName: data.departments?.display_name
      };
      return { success: true, user };
    } else {
      return { success: false, error: 'Nieprawidłowe hasło' };
    }
  } catch (err) {
    console.error('Authentication error:', err);
    return { success: false, error: 'Błąd serwera' };
  }
};

// Funkcja do pobierania wszystkich departamentów
export const getDepartments = async (): Promise<Department[]> => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    if (error) {
      console.error('Error fetching departments:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      name: d.name,
      displayName: d.display_name,
      isActive: d.is_active
    }));
  } catch (err) {
    console.error('Get departments error:', err);
    return [];
  }
};

// Funkcja do tworzenia nowego departamentu (tylko dla superadmin)
export const createDepartment = async (name: string, displayName: string) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .insert([
        { name: name.toLowerCase(), display_name: displayName }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating department:', error);
      return { success: false, error: error.message };
    }

    return { success: true, department: data };
  } catch (err) {
    console.error('Create department error:', err);
    return { success: false, error: 'Błąd serwera - sprawdź czy tabela departments istnieje' };
  }
};

// Funkcja do dodawania użytkownika z departamentem
export const addUser = async (userId: string, password: string, departmentId: number, role: string = 'operator', displayName?: string) => {
  try {
    const { data, error } = await supabase
      .from('user_passwords')
      .insert([
        { 
          user_id: userId, 
          password_hash: password,
          department_id: departmentId,
          role: role,
          display_name: displayName || userId
        }
      ]);

    if (error) {
      console.error('Error adding user:', error);
      if (error.code === '23505') {
        return { success: false, error: `Brukernavn "${userId}" eksisterer allerede. Velg et annet navn.` };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Add user error:', err);
    return { success: false, error: 'Błąd serwera' };
  }
};

// Funkcja do pobierania użytkowników departamentu
export const getDepartmentUsers = async (departmentId: number) => {
  try {
    const { data, error } = await supabase
      .from('user_passwords')
      .select(`
        user_id,
        role,
        display_name,
        department_id,
        departments!inner(name, display_name)
      `)
      .eq('department_id', departmentId)
      .order('role', { ascending: false })
      .order('display_name');

    if (error) {
      console.error('Error fetching department users:', error);
      return [];
    }

    if (!data) return [];

    return data.map(u => ({
      id: u.user_id,
      username: u.user_id,
      role: u.role || 'operator',
      name: u.display_name || u.user_id,
      departmentId: u.department_id,
      departmentName: u.departments?.display_name || 'Unknown Department'
    }));
  } catch (err) {
    console.error('Get department users error:', err);
    return [];
  }
};

// Funkcja do sprawdzania uprawnień
export const hasPermission = (user: User, action: string, targetDepartmentId?: number): boolean => {
  switch (user.role) {
    case 'super':
      return true; // Super admin ma dostęp do wszystkiego
    
    case 'admin':
      // Admin ma dostęp do swojego departamentu
      return !targetDepartmentId || user.departmentId === targetDepartmentId;
    
    case 'manager':
      // Manager ma dostęp do swojego departamentu
      return !targetDepartmentId || user.departmentId === targetDepartmentId;
    
    case 'operator':
    case 'viewer':
      // Operator i viewer mają dostęp tylko do swojego departamentu
      return !targetDepartmentId || user.departmentId === targetDepartmentId;
    
    default:
      return false;
  }
};
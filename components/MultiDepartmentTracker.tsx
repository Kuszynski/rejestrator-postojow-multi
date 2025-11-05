'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Department, authenticateUser, hasPermission } from '@/lib/auth';
import DepartmentSelector from './DepartmentSelector';
import SuperAdminPanel from './SuperAdminPanel';
import DepartmentDowntimeTracker from './DepartmentDowntimeTracker';
import { Clock, Building2 } from 'lucide-react';

export default function MultiDepartmentTracker() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const handleDepartmentSelect = (department: Department) => {
    setSelectedDepartment(department);
    setShowLogin(true);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!selectedDepartment) {
      alert('Vennligst velg en avdeling først');
      return;
    }

    if (!loginForm.username || !loginForm.password) {
      alert('Vennligst fyll ut brukernavn og passord');
      return;
    }

    setLoading(true);

    try {
      const result = await authenticateUser(loginForm.username, loginForm.password);
      
      if (result.success && result.user) {
        // Check if user has access to selected department
        if (selectedDepartment.name === 'superadmin') {
          // Super admin access
          if (result.user.role === 'super') {
            setUser(result.user);
            setLoginForm({ username: '', password: '' });
          } else {
            alert('Du har ikke tilgang til Super Administrator panelet');
          }
        } else {
          // Department access - allow if user belongs to this department OR is superadmin
          if (result.user.role === 'super' || 
              result.user.departmentName === selectedDepartment.displayName ||
              (selectedDepartment.name === 'haslestad' && result.user.departmentId === 1) ||
              (selectedDepartment.name === 'justeverkt' && result.user.departmentId === 2) ||
              (selectedDepartment.name === 'saga' && (result.user.departmentId === 3 || result.user.departmentName?.toLowerCase() === 'saga'))) {
            setUser(result.user);
            setLoginForm({ username: '', password: '' });
          } else {
            alert(`Du har ikke tilgang til avdeling "${selectedDepartment.displayName}". Ditt departament: ${result.user.departmentName}`);
          }
        }
      } else {
        alert(result.error || 'Innlogging feilet');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Nettverksfeil ved innlogging');
    }

    setLoading(false);
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedDepartment(null);
    setShowLogin(false);
    setLoginForm({ username: '', password: '' });
  };

  const handleBackToDepartments = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Back to departments clicked');
    console.log('Current state:', { showLogin, selectedDepartment, user });
    setLoading(false);
    setLoginForm({ username: '', password: '' });
    setSelectedDepartment(null);
    setShowLogin(false);
    console.log('After reset - should show department selector');
  };

  // If user is logged in
  if (user) {
    // Super admin gets special panel
    if (user.role === 'super') {
      return <SuperAdminPanel user={user} onLogout={handleLogout} />;
    }
    
    // Regular users get department-specific tracker
    return <DepartmentDowntimeTracker user={user} department={selectedDepartment} onLogout={handleLogout} />;
  }

  // Show login form if department is selected
  if (showLogin && selectedDepartment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto">
          {/* Main Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-16 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-3xl"></div>
            
            {/* Content */}
            <div className="relative z-10">
              {/* Header */}
              <div className="text-center mb-16">
                <div className="relative mb-12">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                    {selectedDepartment.name === 'superadmin' ? (
                      <Clock className="w-16 h-16 text-white" />
                    ) : (
                      <Building2 className="w-16 h-16 text-white" />
                    )}
                  </div>
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-green-400 rounded-full border-4 border-white shadow-sm"></div>
                </div>
                
                <h1 className="text-6xl font-bold text-gray-900 mb-6">Velkommen</h1>
                <p className="text-2xl text-gray-600 mb-8">Logg inn for å fortsette</p>
                
                {/* Department Info */}
                <div className="inline-flex items-center gap-4 px-8 py-4 bg-blue-50 rounded-full border border-blue-100 mb-8">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span className="text-xl font-medium text-blue-700">
                    {selectedDepartment.displayName}
                  </span>
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-12">
                <div className="space-y-12">
                  <div className="relative">
                    <input
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      className="w-full px-12 py-8 bg-white/70 border-4 border-gray-200 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-transparent transition-all text-2xl text-gray-900 placeholder-gray-500 backdrop-blur-sm font-medium text-center min-h-[100px]"
                      placeholder="Brukernavn"
                      required
                      autoFocus
                      disabled={loading}
                    />
                  </div>

                  <div className="relative">
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full px-12 py-8 bg-white/70 border-4 border-gray-200 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-transparent transition-all text-2xl text-gray-900 placeholder-gray-500 backdrop-blur-sm font-medium text-center min-h-[100px]"
                      placeholder="Passord"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="pt-6 space-y-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold py-8 px-12 rounded-3xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] text-2xl min-h-[100px]"
                  >
                    {loading ? 'Logger inn...' : 'Logg inn'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleBackToDepartments}
                    disabled={loading}
                    className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 font-medium py-4 px-8 rounded-2xl transition-all duration-200 text-lg"
                  >
                    ← Tilbake til avdelingsvalg
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-[10px] text-gray-400">
            © 2025 Stanslogg - {selectedDepartment.displayName}
          </p>
        </div>
      </div>
    );
  }

  // Show department selector by default
  console.log('Rendering department selector', { showLogin, selectedDepartment, user });
  return <DepartmentSelector onDepartmentSelect={handleDepartmentSelect} selectedDepartment={selectedDepartment} />;
}
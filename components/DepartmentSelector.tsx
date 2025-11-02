'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Clock, Shield } from 'lucide-react';
import { Department, getDepartments } from '@/lib/auth';



interface DepartmentSelectorProps {
  onDepartmentSelect: (department: Department) => void;
  selectedDepartment: Department | null;
}

export default function DepartmentSelector({ onDepartmentSelect, selectedDepartment }: DepartmentSelectorProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('DepartmentSelector mounted/updated');
    loadDepartments();
  }, []);

  useEffect(() => {
    console.log('selectedDepartment changed:', selectedDepartment);
  }, [selectedDepartment]);

  const loadDepartments = async () => {
    setLoading(true);
    const deps = await getDepartments();
    setDepartments(deps);
    
    // Don't auto-select - let user choose
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-xl">Laster avdelinger...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto">
        {/* Main Card */}
        <div className="bg-white rounded-2xl p-12 relative overflow-hidden shadow-lg border border-gray-200">
          {/* Background Pattern */}

          
          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-16">
              <div className="mb-8">
                <div className="w-20 h-20 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
              </div>
              
              <h1 className="text-4xl font-light text-gray-900 mb-3">Stanslogg</h1>
              <p className="text-lg text-gray-500 mb-12">Profesjonelt system for registrering av produksjonsstans</p>
            </div>

            {/* Super Admin Access */}
            <div className="mb-8 pb-6 border-b border-gray-300">
              <button
                onClick={() => onDepartmentSelect({ 
                  id: 0, 
                  name: 'superadmin', 
                  displayName: 'Superadministrator', 
                  isActive: true 
                })}
                className={`w-full p-8 min-h-[80px] rounded-xl border transition-all duration-200 flex items-center justify-center touch-manipulation ${
                  selectedDepartment?.name === 'superadmin'
                    ? 'border-red-500 bg-red-50 shadow-sm'
                    : 'border-gray-300 bg-gray-50 active:bg-gray-100 hover:bg-gray-100 hover:shadow-sm'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-xl font-medium text-gray-900">
                    Superadministrator
                  </h3>
                </div>
              </button>
            </div>

            {/* Department Selection */}
            <div className="space-y-4">
              {departments.map((department) => (
                <button
                  key={department.id}
                  onClick={() => onDepartmentSelect(department)}
                  className={`w-full p-8 min-h-[80px] rounded-xl border transition-all duration-200 flex items-center justify-center touch-manipulation ${
                    selectedDepartment?.id === department.id
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white active:bg-gray-50 hover:bg-gray-50 hover:shadow-sm'
                  }`}
                >
                  <div className="text-center">
                    <h3 className="text-xl font-medium text-gray-900">
                      {department.displayName}
                    </h3>
                  </div>
                </button>
              ))}
            </div>

            {/* Continue Button */}
            {selectedDepartment && (
              <div className="mt-8">
                <div className="text-center">
                  <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-500 text-white rounded-lg">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span className="text-sm font-medium">
                      {selectedDepartment.displayName} valgt
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            © 2025 Stanslogg
          </p>
        </div>
      </div>
    </div>
  );
}
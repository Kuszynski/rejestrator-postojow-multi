'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Department, getDepartments, createDepartment, addUser, getDepartmentUsers } from '@/lib/auth';
import { Building2, Users, Plus, Settings, BarChart3, Shield, Trash2, Edit2 } from 'lucide-react';

interface SuperAdminPanelProps {
  user: User;
  onLogout: () => void;
}

// Live Department Overview Component
function LiveDepartmentOverview({ department }: { department: Department }) {
  const [todayDowntimes, setTodayDowntimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodayDowntimes();
    const interval = setInterval(loadTodayDowntimes, 5000); // Refresh every 5 seconds for real-time updates
    return () => clearInterval(interval);
  }, []);

  const loadTodayDowntimes = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('downtimes')
        .select('*')
        .eq('department_id', department.id)
        .eq('date', today)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error loading today downtimes:', error);
        return;
      }

      const machineList = await supabase.from('machines').select('*').eq('department_id', department.id);
      const machines = machineList.data || [];

      const enrichedData = (data || []).map(d => ({
        ...d,
        machineName: machines.find(m => m.id === d.machine_id)?.name || d.machine_id
      }));

      setTodayDowntimes(enrichedData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading today downtimes:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">{department.displayName}</h3>
        <p className="text-gray-500">Laster...</p>
      </div>
    );
  }

  const machineStats = {};
  todayDowntimes.forEach(d => {
    if (!machineStats[d.machineName]) {
      machineStats[d.machineName] = { count: 0, duration: 0 };
    }
    machineStats[d.machineName].count++;
    machineStats[d.machineName].duration += d.duration;
  });

  const totalDowntime = todayDowntimes.reduce((sum, d) => sum + d.duration, 0);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">{department.displayName}</h3>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{todayDowntimes.length}</div>
              <div className="text-xs text-gray-600">Stanser i dag</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{totalDowntime}</div>
              <div className="text-xs text-gray-600">Min total</div>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live data - oppdateres hvert 5. sekund"></div>
              <span className="text-xs text-gray-500">Live</span>
            </div>
          </div>
        </div>
      </div>
      
      {todayDowntimes.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p>Ingen stanser registrert i dag</p>
        </div>
      ) : (
        <div className="p-6">
          <h4 className="text-lg font-semibold mb-4">Maskinsammendrag</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left font-semibold">Maskin</th>
                  <th className="p-3 text-center font-semibold">Antal stanser</th>
                  <th className="p-3 text-center font-semibold">Total tid (min)</th>
                  <th className="p-3 text-center font-semibold">Gjennomsnitt (min)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(machineStats)
                  .sort(([,a], [,b]) => b.duration - a.duration)
                  .map(([machine, stats]: [string, any]) => (
                  <tr key={machine} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{machine}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                        {stats.count}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-sm font-bold ${
                        stats.duration > 30 ? 'bg-red-100 text-red-800' :
                        stats.duration > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {stats.duration}
                      </span>
                    </td>
                    <td className="p-3 text-center font-medium">
                      {Math.round(stats.duration / stats.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminPanel({ user, onLogout }: SuperAdminPanelProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [departmentUsers, setDepartmentUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [view, setView] = useState<'live' | 'departments' | 'users' | 'analytics'>('live');
  const [loading, setLoading] = useState(true);

  // Forms
  const [newDepartmentForm, setNewDepartmentForm] = useState({ name: '', displayName: '' });
  const [newUserForm, setNewUserForm] = useState({ 
    username: '', 
    password: '', 
    role: 'operator', 
    displayName: '',
    departmentId: 0
  });

  useEffect(() => {
    loadDepartments();
    loadAllUsers();
    
    // Auto-refresh departments and users every 10 seconds
    const interval = setInterval(() => {
      loadDepartments();
      loadAllUsers();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      loadDepartmentUsers(selectedDepartment.id);
    }
  }, [selectedDepartment]);

  const loadDepartments = async () => {
    setLoading(true);
    const deps = await getDepartments();
    setDepartments(deps);
    if (deps.length > 0 && !selectedDepartment) {
      setSelectedDepartment(deps[0]);
    }
    setLoading(false);
  };

  const loadDepartmentUsers = async (departmentId: number) => {
    const users = await getDepartmentUsers(departmentId);
    setDepartmentUsers(users);
  };

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_passwords')
        .select(`
          user_id,
          display_name,
          role,
          department_id,
          password_hash,
          departments(display_name)
        `);

      if (error) {
        console.error('Error loading all users:', error);
        return;
      }

      console.log('Raw user data:', data); // Debug log

      const users = data?.map(user => ({
        id: user.user_id,
        username: user.user_id,
        name: user.display_name || user.user_id,
        role: user.role,
        departmentId: user.department_id,
        departmentName: user.departments?.display_name || (user.department_id ? 'Ukjent' : 'Ingen avdeling'),
        passwordHash: user.password_hash || 'Brak hasła'
      })) || [];

      console.log('Processed users:', users); // Debug log
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading all users:', error);
    }
  };

  const handleCreateDepartment = async () => {
    if (!newDepartmentForm.name || !newDepartmentForm.displayName) {
      alert('Vennligst fyll ut alle felt');
      return;
    }

    const result = await createDepartment(newDepartmentForm.name, newDepartmentForm.displayName);
    if (result.success) {
      alert(`Avdeling "${newDepartmentForm.displayName}" opprettet!`);
      setNewDepartmentForm({ name: '', displayName: '' });
      loadDepartments();
    } else {
      alert('Feil ved opprettelse: ' + result.error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.username || !newUserForm.password || !newUserForm.departmentId) {
      alert('Vennligst fyll ut alle felt');
      return;
    }

    const result = await addUser(
      newUserForm.username,
      newUserForm.password,
      newUserForm.departmentId,
      newUserForm.role,
      newUserForm.displayName || newUserForm.username
    );

    if (result.success) {
      alert(`Bruker "${newUserForm.username}" opprettet!`);
      setNewUserForm({ username: '', password: '', role: 'operator', displayName: '', departmentId: 0 });
      loadAllUsers();
      if (selectedDepartment) {
        loadDepartmentUsers(selectedDepartment.id);
      }
    } else {
      alert('Feil ved opprettelse: ' + result.error);
    }
  };

  const getDepartmentStats = async () => {
    const stats = [];
    for (const dept of departments) {
      try {
        // Get users count
        const users = await getDepartmentUsers(dept.id);
        
        // Get machines count
        const { data: machines } = await supabase
          .from('machines')
          .select('id')
          .eq('department_id', dept.id);

        // Get downtimes count and total duration
        const { data: downtimes } = await supabase
          .from('downtimes')
          .select('duration')
          .eq('department_id', dept.id);

        stats.push({
          department: dept,
          userCount: users.length,
          machineCount: machines?.length || 0,
          downtimeCount: downtimes?.length || 0,
          totalDowntime: downtimes?.reduce((sum, d) => sum + (d.duration || 0), 0) || 0
        });
      } catch (error) {
        console.error('Error getting stats for department:', dept.name, error);
      }
    }
    return stats;
  };

  const [departmentStats, setDepartmentStats] = useState<any[]>([]);

  useEffect(() => {
    if (view === 'analytics' && departments.length > 0) {
      getDepartmentStats().then(setDepartmentStats);
    }
  }, [view, departments]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Laster...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Shield className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Superadministrator</h1>
                <p className="text-purple-200">Velkommen, {user.name}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg transition-colors"
            >
              Logg ut
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8">
            <button
              onClick={() => setView('live')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                view === 'live' 
                  ? 'border-purple-500 text-purple-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🔴 Live Oversikt
            </button>
            <button
              onClick={() => setView('departments')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                view === 'departments' 
                  ? 'border-purple-500 text-purple-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🏢 Avdelinger
            </button>
            <button
              onClick={() => setView('users')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                view === 'users' 
                  ? 'border-purple-500 text-purple-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 Brukere
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                view === 'analytics' 
                  ? 'border-purple-500 text-purple-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📈 Analyse
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {view === 'live' && (
          <div className="space-y-6">
            {departments.map(dept => (
              <LiveDepartmentOverview key={dept.id} department={dept} />
            ))}
          </div>
        )}

        {view === 'overview' && (
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Building2 className="w-8 h-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avdelinger</p>
                    <p className="text-2xl font-semibold text-gray-900">{departments.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Totale brukere</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {departmentStats.reduce((sum, stat) => sum + stat.userCount, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Settings className="w-8 h-8 text-orange-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Totale maskiner</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {departmentStats.reduce((sum, stat) => sum + stat.machineCount, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <BarChart3 className="w-8 h-8 text-red-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Totale stanser</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {departmentStats.reduce((sum, stat) => sum + stat.downtimeCount, 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Overview */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Avdelingsoversikt</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avdeling
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Brukere
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Maskiner
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stanser (total)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stansetid (min)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {departmentStats.map((stat, index) => (
                      <tr key={stat.department.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building2 className="w-5 h-5 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {stat.department.displayName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {stat.department.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.userCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.machineCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.downtimeCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.totalDowntime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'departments' && (
          <div className="space-y-8">
            {/* Create Department Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Opprett ny avdeling</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avdelingsnavn (ID) *
                  </label>
                  <input
                    type="text"
                    value={newDepartmentForm.name}
                    onChange={(e) => setNewDepartmentForm({ ...newDepartmentForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="f.eks. justeverkt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visningsnavn *
                  </label>
                  <input
                    type="text"
                    value={newDepartmentForm.displayName}
                    onChange={(e) => setNewDepartmentForm({ ...newDepartmentForm, displayName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="f.eks. Justeverkt"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleCreateDepartment}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Opprett avdeling
                  </button>
                </div>
              </div>
            </div>

            {/* Departments List */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Alle avdelinger</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {departments.map((dept) => (
                  <div key={dept.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <Building2 className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{dept.displayName}</div>
                        <div className="text-sm text-gray-500">{dept.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        dept.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {dept.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const newDisplayName = prompt('Nytt visningsnavn:', dept.displayName);
                            if (newDisplayName && newDisplayName.trim() && newDisplayName !== dept.displayName) {
                              const newName = prompt('Nytt avdelingsnavn (ID):', dept.name);
                              if (newName && newName.trim() && newName !== dept.name) {
                                // Update both name and display_name
                                supabase
                                  .from('departments')
                                  .update({ 
                                    name: newName.trim().toLowerCase(), 
                                    display_name: newDisplayName.trim() 
                                  })
                                  .eq('id', dept.id)
                                  .then(({ error }) => {
                                    if (error) {
                                      alert('Feil: ' + error.message);
                                    } else {
                                      alert('Avdeling oppdatert!');
                                      loadDepartments();
                                    }
                                  });
                              } else if (newName !== null) {
                                // Update only display_name
                                supabase
                                  .from('departments')
                                  .update({ display_name: newDisplayName.trim() })
                                  .eq('id', dept.id)
                                  .then(({ error }) => {
                                    if (error) {
                                      alert('Feil: ' + error.message);
                                    } else {
                                      alert('Avdeling oppdatert!');
                                      loadDepartments();
                                    }
                                  });
                              }
                            }
                          }}
                          className="text-purple-600 hover:text-purple-800"
                          title="Rediger"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Er du sikker på at du vil slette avdeling "${dept.displayName}"?`)) {
                              if (confirm('Dette vil slette ALLE brukere og data i denne avdelingen. Er du helt sikker?')) {
                                try {
                                  const { error } = await supabase
                                    .from('departments')
                                    .delete()
                                    .eq('id', dept.id);
                                  
                                  if (error) {
                                    alert('Feil ved sletting: ' + error.message);
                                  } else {
                                    alert('Avdeling slettet!');
                                    loadDepartments();
                                  }
                                } catch (err) {
                                  alert('Feil ved sletting');
                                }
                              }
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Slett"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'users' && (
          <div className="space-y-8">
            {/* Create User Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Opprett ny bruker</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brukernavn *
                  </label>
                  <input
                    type="text"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="f.eks. jv_dag"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passord *
                  </label>
                  <input
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Minst 6 tegn"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avdeling *
                  </label>
                  <select
                    value={newUserForm.departmentId}
                    onChange={(e) => setNewUserForm({ ...newUserForm, departmentId: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={0}>Velg avdeling</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rolle *
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="operator">Operatør</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleCreateUser}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Opprett
                  </button>
                </div>
              </div>
            </div>

            {/* All Users */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Brukere i alle avdelinger
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Navn
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Brukernavn
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rolle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avdeling
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hasło
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Handlinger
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'admin' ? 'bg-red-100 text-red-800' :
                            user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                            user.role === 'operator' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.departmentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-mono max-w-xs truncate" title={user.passwordHash}>
                          {user.passwordHash}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                const newName = prompt('Nytt navn:', user.name);
                                if (newName === null) return;
                                
                                const newRole = prompt('Ny rolle (operator/manager/admin/viewer):', user.role);
                                if (newRole === null) return;
                                
                                const newPassword = prompt('Nytt passord (la stå tomt for å beholde eksisterende):');
                                
                                if (newRole && ['operator', 'manager', 'admin', 'viewer'].includes(newRole)) {
                                  try {
                                    const updates: any = {
                                      role: newRole
                                    };
                                    
                                    if (newName && newName.trim() && newName !== user.name) {
                                      updates.display_name = newName.trim();
                                    }
                                    
                                    if (newPassword && newPassword.trim()) {
                                      updates.password_hash = newPassword;
                                    }
                                    
                                    console.log('Updates to send:', updates);
                                    console.log('User ID:', user.id);
                                    console.log('Original name:', user.name);
                                    console.log('New name:', newName);
                                    
                                    const { data, error } = await supabase
                                      .from('user_passwords')
                                      .update(updates)
                                      .eq('user_id', user.id)
                                      .select();
                                    
                                    console.log('Update result:', data);
                                    
                                    if (error) {
                                      console.error('Supabase error:', error);
                                      alert('Feil: ' + error.message);
                                    } else {
                                      alert('Bruker oppdatert!');
                                      loadAllUsers();
                                    }
                                  } catch (err) {
                                    console.error('Update error:', err);
                                    alert('Feil ved oppdatering: ' + err.message);
                                  }
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800"
                              title="Rediger bruker"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (user.role === 'superadmin') {
                                  alert('Kan ikke slette superadmin');
                                  return;
                                }
                                if (confirm(`Er du sikker på at du vil slette bruker "${user.name}"?`)) {
                                  try {
                                    const { error } = await supabase
                                      .from('user_passwords')
                                      .delete()
                                      .eq('user_id', user.id);
                                    
                                    if (error) {
                                      alert('Feil: ' + error.message);
                                    } else {
                                      alert('Bruker slettet!');
                                      loadAllUsers();
                                    }
                                  } catch (err) {
                                    alert('Feil ved sletting');
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-800"
                              title="Slett bruker"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Sammenligning mellom avdelinger</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avdeling
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Brukere
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Maskiner
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stanser
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stansetid (min)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gjennomsnitt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {departmentStats.map((stat) => (
                      <tr key={stat.department.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {stat.department.displayName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.userCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.machineCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.downtimeCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.totalDowntime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.downtimeCount > 0 ? Math.round(stat.totalDowntime / stat.downtimeCount) : 0} min
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
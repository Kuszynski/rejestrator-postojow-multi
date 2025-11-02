'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Department, hasPermission, getDepartmentUsers, addUser } from '@/lib/auth';
import { Play, Pause, Clock, TrendingUp, BarChart3, Calendar, LogOut, AlertCircle, CheckCircle, Edit2, Trash2, Eye, Download, Wrench, Building2 } from 'lucide-react';

interface Machine {
  id: string;
  name: string;
  color: string;
  departmentId: number;
}

interface DowntimeEntry {
  id: any;
  machineId: string;
  machineName: string;
  startTime: number;
  endTime?: number;
  duration: number;
  comment: string;
  postNumber?: string;
  date: string;
  operatorId: string;
  operatorName: string;
  departmentId: number;
}

interface DepartmentDowntimeTrackerProps {
  user: User;
  department: Department | null;
  onLogout: () => void;
}

export default function DepartmentDowntimeTracker({ user, department, onLogout }: DepartmentDowntimeTrackerProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [activeDowntimes, setActiveDowntimes] = useState<DowntimeEntry[]>([]);
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimeEntry[]>([]);
  const [commentModal, setCommentModal] = useState<DowntimeEntry | null>(null);
  const [comment, setComment] = useState('');
  const [view, setView] = useState('today');
  const [loading, setLoading] = useState(true);
  const [postNumber, setPostNumber] = useState('');
  const [currentPostNumber, setCurrentPostNumber] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [manualPostNumber, setManualPostNumber] = useState('');
  const [editModal, setEditModal] = useState<DowntimeEntry | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editPostNumber, setEditPostNumber] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [departmentUsers, setDepartmentUsers] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [newMachineName, setNewMachineName] = useState('');
  const [editMachine, setEditMachine] = useState(null);
  const [editMachineName, setEditMachineName] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const todayDowntimes = downtimeHistory.filter(d => {
    const endDate = d.endTime ? new Date(d.endTime).toISOString().split('T')[0] : today;
    return endDate === today;
  });
  
  const yesterdayDowntimes = downtimeHistory.filter(d => {
    const endDate = d.endTime ? new Date(d.endTime).toISOString().split('T')[0] : yesterdayStr;
    return endDate === yesterdayStr;
  });

  useEffect(() => {
    if (department) {
      loadMachines().then(() => {
        loadData();
      });
    }
  }, [department, user]);

  // Real-time updates for manager view
  useEffect(() => {
    if (department && (user.role === 'manager' || user.role === 'admin' || user.role === 'super_admin')) {
      const interval = setInterval(() => {
        loadData();
      }, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [department, user.role]);

  // Load users when view changes to users
  useEffect(() => {
    if (view === 'users' && department) {
      loadDepartmentUsers();
    }
    if (view === 'history') {
      setFilteredHistory(downtimeHistory);
    }
  }, [view, department, downtimeHistory]);

  // Filter history when dates change
  useEffect(() => {
    if (view === 'history') {
      filterHistory();
    }
  }, [fromDate, toDate]);

  // Timer for active downtimes
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const loadMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('department_id', user.departmentId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading machines:', error);
        return;
      }
      
      setMachines(data || []);
      return data || [];
    } catch (error) {
      console.error('Unexpected error loading machines:', error);
      return [];
    }
  };

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('downtimes')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error loading downtimes:', error);
        return;
      }

      const allMachines = await supabase.from('machines').select('*');
      const machineList = allMachines.data || [];
      
      let enrichedData = (data || []).map(downtime => ({
        id: downtime.id,
        machineId: downtime.machine_id,
        machineName: machineList.find(m => m.id === downtime.machine_id)?.name || `Unknown machine (${downtime.machine_id})`,
        startTime: new Date(downtime.start_time).getTime(),
        endTime: downtime.end_time ? new Date(downtime.end_time).getTime() : null,
        duration: downtime.duration,
        comment: downtime.comment,
        postNumber: downtime.post_number,
        date: downtime.date || new Date(downtime.start_time).toISOString().split('T')[0],
        operatorId: downtime.operator_id,
        operatorName: downtime.operator_id,
        departmentId: downtime.department_id
      }));

      enrichedData = enrichedData.filter(d => d.departmentId === user.departmentId);
      setDowntimeHistory(enrichedData);

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      let todayOmpostings = enrichedData
        .filter(d => d.date === today && d.machineName === 'Omposting/Korigering' && d.postNumber)
        .sort((a, b) => b.startTime - a.startTime);
      
      if (todayOmpostings.length > 0) {
        setCurrentPostNumber(todayOmpostings[0].postNumber);
      } else {
        const yesterdayOmpostings = enrichedData
          .filter(d => d.date === yesterdayStr && d.machineName === 'Omposting/Korigering' && d.postNumber)
          .sort((a, b) => b.startTime - a.startTime);
        
        if (yesterdayOmpostings.length > 0) {
          setCurrentPostNumber(yesterdayOmpostings[0].postNumber);
        }
      }
    } catch (error) {
      console.error('Unexpected error loading data:', error);
    }
    setLoading(false);
  };

  const startDowntime = (machine: Machine) => {
    const tempId = Date.now();
    const newDowntime = {
      id: tempId,
      machineId: machine.id,
      machineName: machine.name,
      startTime: Date.now(),
      operatorId: user.id,
      operatorName: user.name,
      departmentId: machine.departmentId
    };
    setActiveDowntimes([...activeDowntimes, newDowntime]);
  };

  const stopDowntime = (downtime: DowntimeEntry) => {
    setCommentModal(downtime);
    if (downtime.machineName === 'Omposting/Korigering') {
      setPostNumber('');
    }
    setManualPostNumber('');
  };

  const confirmStop = async () => {
    if (!comment.trim()) {
      alert('Vennligst skriv inn årsak til stans');
      return;
    }

    if (commentModal.machineName === 'Omposting/Korigering' && !postNumber.trim()) {
      alert('Vennligst skriv inn Post Nr for omposting');
      return;
    }

    if (!currentPostNumber && !manualPostNumber.trim() && commentModal.machineName !== 'Omposting/Korigering') {
      alert('Vennligst skriv inn Post Nr');
      return;
    }

    const endTime = Date.now();
    const duration = Math.floor((endTime - commentModal.startTime) / 1000 / 60);

    if (commentModal.machineName === 'Omposting/Korigering' && postNumber.trim()) {
      setCurrentPostNumber(postNumber.trim());
    } else if (!currentPostNumber && manualPostNumber.trim()) {
      setCurrentPostNumber(manualPostNumber.trim());
    }
    
    const completedDowntimeForSupabase = {
      machine_id: commentModal.machineId,
      operator_id: user.id,
      start_time: new Date(commentModal.startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration: duration,
      comment: comment.trim(),
      post_number: commentModal.machineName === 'Omposting/Korigering' ? postNumber.trim() : (currentPostNumber || manualPostNumber.trim() || null),
      date: new Date().toISOString().split('T')[0]
    };

    const { data, error } = await supabase
      .from('downtimes')
      .insert([completedDowntimeForSupabase])
      .select();

    if (error) {
      console.error('Error saving downtime:', error);
      alert('Det oppstod en feil ved lagring av stansen.');
    } else {
      const newDowntimeFromSupabase = data[0];
      const machine = machines.find(m => m.id === newDowntimeFromSupabase.machine_id);

      const enrichedDowntime = {
        id: newDowntimeFromSupabase.id,
        machineId: newDowntimeFromSupabase.machine_id,
        machineName: machine ? machine.name : 'Ukjent maskin',
        startTime: new Date(newDowntimeFromSupabase.start_time).getTime(),
        endTime: new Date(newDowntimeFromSupabase.end_time).getTime(),
        duration: newDowntimeFromSupabase.duration,
        comment: newDowntimeFromSupabase.comment,
        postNumber: newDowntimeFromSupabase.post_number,
        date: newDowntimeFromSupabase.date,
        operatorId: newDowntimeFromSupabase.operator_id,
        operatorName: user.name,
        departmentId: newDowntimeFromSupabase.department_id
      };

      setDowntimeHistory(prev => [enrichedDowntime, ...prev]);
      setActiveDowntimes(activeDowntimes.filter(d => d.id !== commentModal.id));
      
      setCommentModal(null);
      setComment('');
      setPostNumber('');
      setManualPostNumber('');
    }
  };

  const formatDuration = (startTime: number) => {
    const elapsed = Math.floor((currentTime - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const exportToExcel = () => {
    const csvContent = [
      ['#', 'Tid', 'Maskin', 'Årsak', 'Varighet', 'Post Nr', 'Operatør'],
      ...todayDowntimes.map((d, index) => [
        index + 1,
        `${new Date(d.startTime).toLocaleDateString('nb-NO')} ${new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}-${new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`,
        d.machineName,
        d.comment,
        `${d.duration} min`,
        d.postNumber || '-',
        d.operatorName
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stanser-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    window.print();
  };

  const editDowntime = (downtime: DowntimeEntry) => {
    setEditModal(downtime);
    setEditComment(downtime.comment);
    setEditPostNumber(downtime.postNumber || '');
    setEditStartTime(new Date(downtime.startTime).toISOString().slice(0, 16));
    setEditEndTime(new Date(downtime.endTime).toISOString().slice(0, 16));
    setEditMinutes(downtime.duration.toString());
  };

  const saveEdit = async () => {
    if (!editComment.trim()) {
      alert('Årsak kan ikke være tom');
      return;
    }

    const duration = parseInt(editMinutes) || 0;
    const startTime = new Date(editStartTime);
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const { error } = await supabase
      .from('downtimes')
      .update({
        comment: editComment.trim(),
        post_number: editPostNumber.trim() || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: duration
      })
      .eq('id', editModal.id);

    if (error) {
      alert('Feil ved oppdatering');
    } else {
      loadData();
      setEditModal(null);
      setEditComment('');
      setEditPostNumber('');
      setEditStartTime('');
      setEditEndTime('');
      setEditMinutes('');
    }
  };

  const deleteDowntime = async (downtime: DowntimeEntry) => {
    if (confirm(`Vil du slette denne stansen?\n${downtime.machineName} - ${downtime.comment}`)) {
      const { error } = await supabase
        .from('downtimes')
        .delete()
        .eq('id', downtime.id);

      if (error) {
        alert('Feil ved sletting');
      } else {
        loadData();
      }
    }
  };

  const loadDepartmentUsers = async () => {
    try {
      const users = await getDepartmentUsers(user.departmentId);
      setDepartmentUsers(users);
    } catch (error) {
      console.error('Unexpected error loading users:', error);
    }
  };

  const addNewUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      alert('Vennligst fyll ut alle felt');
      return;
    }

    const result = await addUser(newUsername.trim(), newPassword.trim(), user.departmentId, 'operator');
    
    if (result.success) {
      setNewUsername('');
      setNewPassword('');
      loadDepartmentUsers();
      alert('Bruker opprettet!');
    } else {
      alert(result.error);
    }
  };

  const deleteUser = async (userId: string) => {
    if (confirm(`Vil du slette brukeren ${userId}?`)) {
      try {
        const { error } = await supabase
          .from('user_passwords')
          .delete()
          .eq('user_id', userId);
        
        if (error) {
          alert('Feil ved sletting');
        } else {
          loadDepartmentUsers();
        }
      } catch (error) {
        alert('Uventet feil ved sletting');
      }
    }
  };

  const filterHistory = () => {
    let filtered = downtimeHistory;
    
    if (fromDate) {
      filtered = filtered.filter(d => {
        const entryDate = new Date(d.endTime || d.startTime).toISOString().split('T')[0];
        return entryDate >= fromDate;
      });
    }
    
    if (toDate) {
      filtered = filtered.filter(d => {
        const entryDate = new Date(d.endTime || d.startTime).toISOString().split('T')[0];
        return entryDate <= toDate;
      });
    }
    
    setFilteredHistory(filtered);
  };

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setFilteredHistory(downtimeHistory);
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    setFromDate(yesterdayStr);
    setToDate(yesterdayStr);
  };

  const exportJSONBackup = async () => {
    try {
      const backupData = {
        downtimes: downtimeHistory,
        machines: machines,
        users: departmentUsers,
        department: department,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-backup-${department?.name}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Feil ved eksport av JSON backup');
    }
  };

  const exportCSVBackup = () => {
    try {
      const csvContent = [
        ['ID', 'Dato', 'Start Tid', 'Slutt Tid', 'Maskin', 'Varighet (min)', 'Årsak', 'Post Nr', 'Operatør', 'Avdeling'],
        ...downtimeHistory.map(d => [
          d.id,
          new Date(d.startTime).toLocaleDateString('nb-NO'),
          new Date(d.startTime).toLocaleTimeString('nb-NO'),
          new Date(d.endTime).toLocaleTimeString('nb-NO'),
          d.machineName,
          d.duration,
          d.comment,
          d.postNumber || '',
          d.operatorName,
          department?.displayName || ''
        ])
      ].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stanser-backup-${department?.name}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Feil ved eksport av CSV backup');
    }
  };

  const addMachine = async () => {
    if (!newMachineName.trim()) {
      alert('Vennligst skriv inn maskinnavn');
      return;
    }

    try {
      console.log('Adding machine:', {
        name: newMachineName.trim(),
        color: 'bg-blue-500',
        department_id: user.departmentId
      });

      const { data, error } = await supabase
        .from('machines')
        .insert([{
          id: `m${Date.now()}`,
          name: newMachineName.trim(),
          color: 'bg-blue-500',
          department_id: user.departmentId
        }])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        alert(`Feil ved opprettelse av maskin: ${error.message}`);
        return;
      }

      console.log('Machine created:', data);
      setNewMachineName('');
      loadMachines();
      alert('Maskin opprettet!');
    } catch (error) {
      console.error('Unexpected error:', error);
      alert(`Uventet feil ved opprettelse: ${error.message}`);
    }
  };

  const updateMachine = async () => {
    if (!editMachineName.trim()) {
      alert('Maskinnavn kan ikke være tomt');
      return;
    }

    try {
      const { error } = await supabase
        .from('machines')
        .update({ name: editMachineName.trim() })
        .eq('id', editMachine.id);

      if (error) {
        alert('Feil ved oppdatering');
        return;
      }

      setEditMachine(null);
      setEditMachineName('');
      loadMachines();
    } catch (error) {
      alert('Uventet feil ved oppdatering');
    }
  };

  const deleteMachine = async (machine) => {
    if (confirm(`Vil du slette maskinen "${machine.name}"?\n\nViktig: Alle stanser knyttet til denne maskinen vil fortsatt være synlige i historikken.`)) {
      try {
        const { error } = await supabase
          .from('machines')
          .delete()
          .eq('id', machine.id);

        if (error) {
          alert('Feil ved sletting');
          return;
        }

        loadMachines();
      } catch (error) {
        alert('Uventet feil ved sletting');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-xl">Laster...</div>
      </div>
    );
  }

  // Operator interface
  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col px-2 py-2">
        {/* Modern Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700 p-4 mb-4 flex-shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-white mb-1">
                  {department?.displayName} - {user.name}
                </h1>
                <p className="text-slate-300 text-sm">Klar for å registrere stanser</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={onLogout}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm transition-colors rounded-lg shadow-md"
              >
                ✕ Logg ut
              </button>
            </div>
          </div>

          {/* Current Post Number Display */}
          {currentPostNumber && (
            <div className="mt-2 flex justify-center">
              <div className="bg-blue-100 border border-blue-300 rounded-lg px-3 py-1">
                <span className="text-blue-800 font-semibold text-xs">
                  Aktiv post: {currentPostNumber}
                </span>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="mt-3 flex gap-1 p-1 bg-gray-100/50 rounded-xl backdrop-blur-sm">
            <button
              onClick={() => setView('main')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                view === 'main' 
                  ? 'bg-white text-blue-600 shadow-lg' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Play className="w-4 h-4" />
              Registrer
            </button>
            
            <button
              onClick={() => setView('today')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center relative text-sm ${
                view === 'today' 
                  ? 'bg-white text-blue-600 shadow-lg' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>I dag </span>
              {todayDowntimes.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {todayDowntimes.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setView('analyse')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                view === 'analyse' 
                  ? 'bg-white text-blue-600 shadow-lg' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Analyse i dag
            </button>
            
            {(user.role === 'manager' || user.role === 'admin' || user.role === 'super') && (
              <button
                onClick={() => setView('yesterday')}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                  view === 'yesterday' 
                    ? 'bg-white text-blue-600 shadow-lg' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                I går
              </button>
            )}
            
            <button
              onClick={() => setView('ukerapport')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                view === 'ukerapport' 
                  ? 'bg-white text-blue-600 shadow-lg' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Uke rapport
            </button>
            
            {(user.role === 'manager' || user.role === 'admin' || user.role === 'super') && (
              <>
                <button
                  onClick={() => setView('reports')}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                    view === 'reports' 
                      ? 'bg-white text-blue-600 shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Rapporter
                </button>
                
                <button
                  onClick={() => setView('history')}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                    view === 'history' 
                      ? 'bg-white text-blue-600 shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  📋 Historikk
                </button>
                
                <button
                  onClick={() => setView('users')}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                    view === 'users' 
                      ? 'bg-white text-blue-600 shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Brukere
                </button>
                
                <button
                  onClick={() => setView('machines')}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                    view === 'machines' 
                      ? 'bg-white text-blue-600 shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  🏭 Maskiner
                </button>
                
                <button
                  onClick={() => setView('backup')}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                    view === 'backup' 
                      ? 'bg-white text-blue-600 shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  💾 Backup
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {view === 'main' && (
            <>
              {activeDowntimes.length > 0 && (
                <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl shadow-xl border border-red-500 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Aktive stanser</h2>
                      <p className="text-red-100 text-sm">Trykk for å avslutte stans</p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {activeDowntimes.map(downtime => (
                      <div key={downtime.id} className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 border border-red-200/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
                              <Clock className="w-6 h-6 text-white animate-pulse" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-lg">{downtime.machineName}</p>
                              <p className="text-gray-600">
                                Start: {new Date(downtime.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-3xl font-bold text-red-600 tabular-nums">
                                {formatDuration(downtime.startTime)}
                              </div>
                              <div className="text-sm text-gray-500">varighet</div>
                            </div>
                            <button
                              onClick={() => stopDowntime(downtime)}
                              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                            >
                              <Pause className="w-5 h-5" />
                              Stopp
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Machine Grid */}
              <div className="bg-blue-50 rounded-2xl shadow-lg border-2 border-blue-200 p-4 flex-1">
                <div className="text-center mb-3">
                  <p className="text-gray-700 font-medium text-sm">Trykk på maskin for å starte stans</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 h-full">
                  {machines.map(machine => {
                    const isActive = activeDowntimes.some(d => d.machineId === machine.id);
                    const activeDowntime = activeDowntimes.find(d => d.machineId === machine.id);
                    
                    return (
                      <button
                        key={machine.id}
                        onClick={() => !isActive && startDowntime(machine)}
                        disabled={isActive}
                        className={`group relative h-24 rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                          isActive 
                            ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-xl cursor-not-allowed' 
                            : 'bg-white/90 backdrop-blur-xl shadow-lg hover:shadow-xl border-2 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center h-full p-2">
                          {isActive && activeDowntime ? (
                            <>
                              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mb-1 animate-pulse">
                                <Clock className="w-4 h-4 text-white" />
                              </div>
                              <div className="text-center text-white">
                                <div className="text-sm font-bold mb-1">
                                  {formatDuration(activeDowntime.startTime)}
                                </div>
                                <div className="text-xs opacity-90 font-medium leading-tight">{machine.name}</div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className={`w-8 h-8 ${machine.color} rounded-lg flex items-center justify-center mb-1 group-hover:scale-110 transition-transform duration-200 shadow-lg`}>
                                <Play className="w-4 h-4 text-white" />
                              </div>
                              <span className="font-semibold text-gray-900 text-center leading-tight group-hover:text-blue-600 transition-colors text-xs">
                                {machine.name}
                              </span>
                            </>
                          )}
                        </div>
                      
                        {isActive && (
                          <div className="absolute inset-0 rounded-2xl bg-red-500/20 blur-lg -z-10 animate-pulse"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {view === 'overview' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl shadow-xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">📊 Dashboard - {department?.displayName}</h2>
                <p className="text-green-100">Live oversikt over produksjonen</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Dagens stanser</p>
                      <p className="text-2xl font-bold text-gray-900">{todayDowntimes.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Total tid</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {todayDowntimes.reduce((sum, d) => sum + d.duration, 0)} min
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Aktive stanser</p>
                      <p className="text-2xl font-bold text-gray-900">{activeDowntimes.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Play className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Maskiner</p>
                      <p className="text-2xl font-bold text-gray-900">{machines.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Wrench className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>
              </div>
              
              {activeDowntimes.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🚨 Aktive stanser</h3>
                  <div className="space-y-3">
                    {activeDowntimes.map(downtime => (
                      <div key={downtime.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                        <div>
                          <p className="font-medium text-gray-900">{downtime.machineName}</p>
                          <p className="text-sm text-gray-600">Operatør: {downtime.operatorName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600">{formatDuration(downtime.startTime)}</p>
                          <p className="text-xs text-gray-500">siden {new Date(downtime.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'reports' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl shadow-xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">📈 Rapporter</h2>
                <p className="text-purple-100">Generer og last ned rapporter</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Daglig rapport</h3>
                  <p className="text-gray-600 text-sm mb-4">Dagens stanser og statistikk</p>
                  <button className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                    <Download className="w-4 h-4 inline mr-2" />
                    Last ned PDF
                  </button>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Ukentlig rapport</h3>
                  <p className="text-gray-600 text-sm mb-4">Sammendrag av uken</p>
                  <button className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                    <Download className="w-4 h-4 inline mr-2" />
                    Last ned PDF
                  </button>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Månedlig rapport</h3>
                  <p className="text-gray-600 text-sm mb-4">Detaljert månedsoversikt</p>
                  <button className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors">
                    <Download className="w-4 h-4 inline mr-2" />
                    Last ned PDF
                  </button>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Hurtigstatistikk</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{todayDowntimes.length}</p>
                    <p className="text-sm text-gray-600">Stanser i dag</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">
                      {todayDowntimes.reduce((sum, d) => sum + d.duration, 0)}
                    </p>
                    <p className="text-sm text-gray-600">Minutter i dag</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">
                      {todayDowntimes.length > 0 ? Math.round(todayDowntimes.reduce((sum, d) => sum + d.duration, 0) / todayDowntimes.length) : 0}
                    </p>
                    <p className="text-sm text-gray-600">Snitt varighet</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{machines.length}</p>
                    <p className="text-sm text-gray-600">Maskiner totalt</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'analyse' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl shadow-xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">📈 Analyse i dag - {department?.displayName}</h2>
                <p className="text-indigo-100">Detaljert oversikt over maskinytelse i dag</p>
              </div>
              

              
              {/* Maskin analyse tabell */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">🔧 Maskinanalyse</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Antall Stanser</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Total Tid</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Gjennomsnitt</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const machineStats = {};
                        todayDowntimes.forEach(d => {
                          if (!machineStats[d.machineName]) {
                            machineStats[d.machineName] = { count: 0, duration: 0 };
                          }
                          machineStats[d.machineName].count += 1;
                          machineStats[d.machineName].duration += d.duration;
                        });
                        
                        // Legg til maskiner uten stanser
                        machines.forEach(machine => {
                          if (!machineStats[machine.name]) {
                            machineStats[machine.name] = { count: 0, duration: 0 };
                          }
                        });
                        
                        return Object.entries(machineStats)
                          .sort(([,a], [,b]) => b.duration - a.duration)
                          .map(([machineName, stats]) => {
                            const machine = machines.find(m => m.name === machineName);
                            return (
                              <tr key={machineName} className="border-b hover:bg-gray-50">
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 ${machine?.color || 'bg-gray-500'} rounded`}></div>
                                    <span className="font-medium text-gray-900">{machineName}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-lg font-bold text-gray-900">{stats.count}</span>
                                </td>
                                <td className="p-4">
                                  <span className={`text-lg font-bold ${
                                    stats.duration > 60 ? 'text-red-600' :
                                    stats.duration > 30 ? 'text-yellow-600' :
                                    stats.duration === 0 ? 'text-green-600' :
                                    'text-blue-600'
                                  }`}>{stats.duration} min</span>
                                </td>
                                <td className="p-4">
                                  <span className="text-gray-700">
                                    {stats.count > 0 ? Math.round(stats.duration / stats.count) : 0} min
                                  </span>
                                </td>
                                <td className="p-4">
                                  {stats.count === 0 ? (
                                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                      ✅ OK
                                    </span>
                                  ) : stats.duration > 60 ? (
                                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                                      🚨 Høy
                                    </span>
                                  ) : stats.duration > 30 ? (
                                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                      ⚠️ Middels
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                      🟡 Lav
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                      })()}
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-50 p-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Status forklaring:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">✅ OK</span>
                      <span className="text-gray-600">Ingen stanser</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">🟡 Lav</span>
                      <span className="text-gray-600">Under 30 min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">⚠️ Middels</span>
                      <span className="text-gray-600">30-60 min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">🚨 Høy</span>
                      <span className="text-gray-600">Over 60 min</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'ukerapport' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Uke rapport</h2>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{(() => {
                          const today = new Date();
                          const weekStart = new Date(today);
                          const dayOfWeek = today.getDay();
                          const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                          weekStart.setDate(today.getDate() + daysToMonday);
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekEnd.getDate() + 6);
                          return downtimeHistory.filter(d => {
                            const entryDate = new Date(d.endTime || d.startTime);
                            return entryDate >= weekStart && entryDate <= weekEnd;
                          }).length;
                        })()}</div>
                        <div className="text-purple-100 text-sm">stanser</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{(() => {
                          const today = new Date();
                          const weekStart = new Date(today);
                          const dayOfWeek = today.getDay();
                          const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                          weekStart.setDate(today.getDate() + daysToMonday);
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekEnd.getDate() + 6);
                          return downtimeHistory.filter(d => {
                            const entryDate = new Date(d.endTime || d.startTime);
                            return entryDate >= weekStart && entryDate <= weekEnd;
                          }).reduce((sum, d) => sum + d.duration, 0);
                        })()}</div>
                        <div className="text-purple-100 text-sm">min total</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors">
                          Excel
                        </button>
                        <button className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors">
                          📄 PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Tygodniowa tabela */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-3 font-semibold text-gray-700">Dag</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Dato</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Antall Stanser</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Stansetid</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Gjennomsnitt</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Pause</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const today = new Date();
                        const weekStart = new Date(today);
                        const dayOfWeek = today.getDay();
                        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                        weekStart.setDate(today.getDate() + daysToMonday);
                        const days = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
                        let weekTotal = { stanser: 0, tid: 0 };
                        
                        return days.map((day, index) => {
                          const currentDate = new Date(weekStart);
                          currentDate.setDate(weekStart.getDate() + index);
                          const dateStr = currentDate.toISOString().split('T')[0];
                          
                          const dayDowntimes = downtimeHistory.filter(d => {
                            const entryDate = new Date(d.endTime || d.startTime).toISOString().split('T')[0];
                            return entryDate === dateStr;
                          });
                          
                          const stanser = dayDowntimes.length;
                          const tid = dayDowntimes.reduce((sum, d) => sum + d.duration, 0);
                          const gjennomsnitt = stanser > 0 ? Math.round(tid / stanser) : 0;
                          
                          weekTotal.stanser += stanser;
                          weekTotal.tid += tid;
                          
                          return (
                            <tr key={day} className="border-b">
                              <td className="p-3 font-medium">{day}</td>
                              <td className="p-3">{currentDate.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                              <td className="p-3">{stanser}</td>
                              <td className="p-3">{tid} min</td>
                              <td className="p-3">{gjennomsnitt} min</td>
                              <td className="p-3">0 min</td>
                            </tr>
                          );
                        }).concat([
                          <tr key="total" className="border-b-2 border-gray-400 bg-gray-50 font-bold">
                            <td className="p-3">UKE TOTALT:</td>
                            <td className="p-3">-</td>
                            <td className="p-3">{weekTotal.stanser}</td>
                            <td className="p-3">{weekTotal.tid} min</td>
                            <td className="p-3">{weekTotal.stanser > 0 ? Math.round(weekTotal.tid / weekTotal.stanser) : 0} min</td>
                            <td className="p-3">0 min</td>
                          </tr>
                        ]);
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Detaljerte stanser */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">Detaljerte stanser denne uken</h3>
                </div>
                
                {(() => {
                  const today = new Date();
                  const weekStart = new Date(today);
                  const dayOfWeek = today.getDay();
                  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                  weekStart.setDate(today.getDate() + daysToMonday);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  
                  const weekDowntimes = downtimeHistory.filter(d => {
                    const entryDate = new Date(d.endTime || d.startTime);
                    return entryDate >= weekStart && entryDate <= weekEnd;
                  });
                  
                  return weekDowntimes.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Ingen stanser denne uken</h3>
                      <p className="text-gray-500">Flott arbeid - produksjonen går som den skal.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b-2 border-gray-200">
                            <th className="text-left p-4 font-semibold text-gray-700">#</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Dag</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Tid</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Årsak</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Varighet</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Post Nr</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Operatør</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weekDowntimes.map((d, index) => {
                            const machine = machines.find(m => m.name === d.machineName);
                            const dayName = new Date(d.endTime || d.startTime).toLocaleDateString('nb-NO', { weekday: 'long' });
                            return (
                              <tr key={d.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                  <div className={`w-8 h-8 ${machine?.color || 'bg-gray-500'} text-white rounded-lg flex items-center justify-center font-semibold text-sm`}>
                                    {index + 1}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-sm font-medium text-gray-900 capitalize">{dayName}</span>
                                </td>
                                <td className="p-4">
                                  <span className="text-sm font-medium text-gray-900">
                                    {new Date(d.startTime).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}-{new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span className="font-medium text-gray-900">{d.machineName}</span>
                                </td>
                                <td className="p-4">
                                  <div className="text-sm text-gray-700 max-w-xs">
                                    {d.comment.length > 50 ? d.comment.substring(0, 50) + '...' : d.comment}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                                    d.duration > 60 ? 'bg-red-100 text-red-800' :
                                    d.duration > 30 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {d.duration} min
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="text-sm">
                                    {d.postNumber ? (
                                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                        {d.postNumber}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">-</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="text-sm text-gray-600">{d.operatorName}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
              
              {/* Maskin analyse tabell for uke */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">🔧 Maskinanalyse denne uken</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Antall Stanser</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Total Tid</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Gjennomsnitt</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const today = new Date();
                        const weekStart = new Date(today);
                        const dayOfWeek = today.getDay();
                        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                        weekStart.setDate(today.getDate() + daysToMonday);
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekEnd.getDate() + 6);
                        
                        const weekDowntimes = downtimeHistory.filter(d => {
                          const entryDate = new Date(d.endTime || d.startTime);
                          return entryDate >= weekStart && entryDate <= weekEnd;
                        });
                        
                        const machineStats = {};
                        weekDowntimes.forEach(d => {
                          if (!machineStats[d.machineName]) {
                            machineStats[d.machineName] = { count: 0, duration: 0 };
                          }
                          machineStats[d.machineName].count += 1;
                          machineStats[d.machineName].duration += d.duration;
                        });
                        
                        // Legg til maskiner uten stanser
                        machines.forEach(machine => {
                          if (!machineStats[machine.name]) {
                            machineStats[machine.name] = { count: 0, duration: 0 };
                          }
                        });
                        
                        return Object.entries(machineStats)
                          .sort(([,a], [,b]) => b.duration - a.duration)
                          .map(([machineName, stats]) => {
                            const machine = machines.find(m => m.name === machineName);
                            return (
                              <tr key={machineName} className="border-b hover:bg-gray-50">
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 ${machine?.color || 'bg-gray-500'} rounded`}></div>
                                    <span className="font-medium text-gray-900">{machineName}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-lg font-bold text-gray-900">{stats.count}</span>
                                </td>
                                <td className="p-4">
                                  <span className={`text-lg font-bold ${
                                    stats.duration > 60 ? 'text-red-600' :
                                    stats.duration > 30 ? 'text-yellow-600' :
                                    stats.duration === 0 ? 'text-green-600' :
                                    'text-blue-600'
                                  }`}>{stats.duration} min</span>
                                </td>
                                <td className="p-4">
                                  <span className="text-gray-700">
                                    {stats.count > 0 ? Math.round(stats.duration / stats.count) : 0} min
                                  </span>
                                </td>
                                <td className="p-4">
                                  {stats.count === 0 ? (
                                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                      ✅ OK
                                    </span>
                                  ) : stats.duration > 60 ? (
                                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                                      🚨 Høy
                                    </span>
                                  ) : stats.duration > 30 ? (
                                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                      ⚠️ Middels
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                      🟡 Lav
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                      })()}
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-50 p-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Status forklaring:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">✅ OK</span>
                      <span className="text-gray-600">Ingen stanser</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">🟡 Lav</span>
                      <span className="text-gray-600">Under 30 min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">⚠️ Middels</span>
                      <span className="text-gray-600">30-60 min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">🚨 Høy</span>
                      <span className="text-gray-600">Over 60 min</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'live' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      📡 Oversikt live - {department?.displayName}
                    </h2>
                    <p className="text-green-100">Sanntidsovervåking av produksjonen</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-green-100">Sist oppdatert:</div>
                    <div className="text-lg font-bold">{new Date().toLocaleTimeString('nb-NO')}</div>
                  </div>
                </div>
              </div>
              
              {/* Live Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Aktive stanser</p>
                      <p className="text-3xl font-bold text-blue-600">{activeDowntimes.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Maskiner i drift</p>
                      <p className="text-3xl font-bold text-green-600">{machines.length - activeDowntimes.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Dagens stanser</p>
                      <p className="text-3xl font-bold text-yellow-600">{todayDowntimes.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Total stansetid</p>
                      <p className="text-3xl font-bold text-red-600">{todayDowntimes.reduce((sum, d) => sum + d.duration, 0)} min</p>
                    </div>
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Live Machine Status Table */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <h3 className="text-lg font-bold text-gray-900">🏭 Live Maskinstatus</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Varighet</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Start tid</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Operatør</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Prioritet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machines.map(machine => {
                        const isActive = activeDowntimes.some(d => d.machineId === machine.id);
                        const activeDowntime = activeDowntimes.find(d => d.machineId === machine.id);
                        const duration = activeDowntime ? Math.floor((currentTime - activeDowntime.startTime) / 1000 / 60) : 0;
                        
                        return (
                          <tr key={machine.id} className={`border-b hover:bg-gray-50 ${
                            isActive ? 'bg-red-50' : 'bg-green-50'
                          }`}>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 ${machine.color} rounded`}></div>
                                <span className="font-medium text-gray-900">{machine.name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {isActive ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                                    🚨 STANS
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                    ✅ I DRIFT
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {isActive && activeDowntime ? (
                                <span className="text-lg font-bold text-red-600 tabular-nums">
                                  {formatDuration(activeDowntime.startTime)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              {isActive && activeDowntime ? (
                                <span className="text-sm text-gray-600">
                                  {new Date(activeDowntime.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              {isActive && activeDowntime ? (
                                <span className="text-sm text-gray-600">{activeDowntime.operatorName}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              {isActive ? (
                                duration > 60 ? (
                                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                    🔴 KRITISK
                                  </span>
                                ) : duration > 30 ? (
                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                                    🟡 HØY
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                                    🟠 NORMAL
                                  </span>
                                )
                              ) : (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                  ✅ OK
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {view === 'users' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl shadow-xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">👥 Brukere - {department?.displayName}</h2>
                <p className="text-indigo-100">Administrer operatører i avdelingen</p>
              </div>
              
              {/* Add New User */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 mb-4">➕ Legg til ny operatør</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Brukernavn *</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="sjef"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Passord *</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <button
                  onClick={addNewUser}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-bold transition-all"
                >
                  ➕ Legg til operatør
                </button>
              </div>
              
              {/* Existing Users */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">Eksisterende brukere</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-4 font-semibold text-gray-700">Brukernavn</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Rolle</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Handlinger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentUsers.map(u => (
                        <tr key={u.id} className="border-b hover:bg-gray-50">
                          <td className="p-4 font-medium text-gray-900">{u.name}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              u.role === 'manager' ? 'bg-purple-100 text-purple-800' :
                              u.role === 'admin' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {u.role === 'manager' ? 'Sjef' : u.role === 'admin' ? 'Administrator' : 'Operatør'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                              Aktiv
                            </span>
                          </td>
                          <td className="p-4">
                            {u.role === 'operator' && (
                              <button
                                onClick={() => deleteUser(u.id)}
                                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Slett"
                              >
                                🗑️ Slett
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === 'today' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      {new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{todayDowntimes.length}</div>
                        <div className="text-blue-100 text-sm">stanser</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => exportToExcel()}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors"
                        >
                          Excel
                        </button>
                        <button 
                          onClick={() => exportToPDF()}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors"
                        >
                          📄 PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Produksjonsoversikt */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 border-b border-blue-500">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Produksjonsoversikt
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-700 border-b border-slate-600">
                        <th className="text-left p-3 font-semibold text-slate-200">Periode</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Post</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Varighet</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Stansetid</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Pause</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Effektivitet</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Antall Stanser</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-600 bg-slate-800">
                        <td className="p-3 font-medium text-white">TOTALT I DAG:</td>
                        <td className="p-3 text-slate-300">-</td>
                        <td className="p-3 text-slate-300">0 min</td>
                        <td className="p-3 text-slate-300">{todayDowntimes.reduce((sum, d) => sum + d.duration, 0)} min</td>
                        <td className="p-3 text-slate-300">0 min</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                            {todayDowntimes.length === 0 ? '100%' : Math.max(0, 100 - Math.round((todayDowntimes.reduce((sum, d) => sum + d.duration, 0) / 480) * 100)) + '%'}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-white">{todayDowntimes.length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detaljerte stanser */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">Detaljerte stanser i dag</h3>
                </div>
                

              
              {todayDowntimes.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Ingen stanser i dag</h3>
                  <p className="text-gray-500">Flott arbeid - produksjonen går som den skal.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b-2 border-gray-200">
                          <th className="text-left p-4 font-semibold text-gray-700">#</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Tid</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Årsak</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Varighet</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Post Nr</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Operatør</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Handlinger</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayDowntimes.map((d, index) => {
                          const machine = machines.find(m => m.name === d.machineName);
                          return (
                            <tr key={d.id} className="border-b-4 border-gray-400 hover:bg-gray-50 transition-colors">
                              <td className="p-4">
                                <div className={`w-8 h-8 ${machine?.color || 'bg-gray-500'} text-white rounded-lg flex items-center justify-center font-semibold text-sm`}>
                                  {index + 1}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(d.startTime).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}-{new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="font-medium text-gray-900">
                                  {d.machineName}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-gray-700 max-w-xs">
                                  {d.comment.length > 50 ? d.comment.substring(0, 50) + '...' : d.comment}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded text-sm font-medium ${
                                  d.duration > 60 ? 'bg-red-100 text-red-800' :
                                  d.duration > 30 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {d.duration} min
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="text-sm">
                                  {d.postNumber ? (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                      {d.postNumber}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-gray-600">{d.operatorName}</div>
                              </td>
                              <td className="p-4">
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => editDowntime(d)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded" 
                                    title="Rediger"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => deleteDowntime(d)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded" 
                                    title="Slett"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {view === 'yesterday' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      {yesterday.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{yesterdayDowntimes.length}</div>
                        <div className="text-purple-100 text-sm">stanser</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Produksjonsoversikt */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4 border-b border-purple-500">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Produksjonsoversikt
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-700 border-b border-slate-600">
                        <th className="text-left p-3 font-semibold text-slate-200">Periode</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Post</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Varighet</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Stansetid</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Pause</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Effektivitet</th>
                        <th className="text-left p-3 font-semibold text-slate-200">Antall Stanser</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-600 bg-slate-800">
                        <td className="p-3 font-medium text-white">TOTALT I GÅR:</td>
                        <td className="p-3 text-slate-300">-</td>
                        <td className="p-3 text-slate-300">0 min</td>
                        <td className="p-3 text-slate-300">{yesterdayDowntimes.reduce((sum, d) => sum + d.duration, 0)} min</td>
                        <td className="p-3 text-slate-300">0 min</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                            {yesterdayDowntimes.length === 0 ? '100%' : Math.max(0, 100 - Math.round((yesterdayDowntimes.reduce((sum, d) => sum + d.duration, 0) / 480) * 100)) + '%'}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-white">{yesterdayDowntimes.length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detaljerte stanser */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">Detaljerte stanser i går</h3>
                </div>
                
              {yesterdayDowntimes.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Ingen stanser i går</h3>
                  <p className="text-gray-500">Flott arbeid - produksjonen gikk som den skulle.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b-2 border-gray-200">
                          <th className="text-left p-4 font-semibold text-gray-700">#</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Tid</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Årsak</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Varighet</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Post Nr</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Operatør</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yesterdayDowntimes.map((d, index) => {
                          const machine = machines.find(m => m.name === d.machineName);
                          return (
                            <tr key={d.id} className="border-b-4 border-gray-400 hover:bg-gray-50 transition-colors">
                              <td className="p-4">
                                <div className={`w-8 h-8 ${machine?.color || 'bg-gray-500'} text-white rounded-lg flex items-center justify-center font-semibold text-sm`}>
                                  {index + 1}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(d.startTime).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}-{new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="font-medium text-gray-900">
                                  {d.machineName}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-gray-700 max-w-xs">
                                  {d.comment.length > 50 ? d.comment.substring(0, 50) + '...' : d.comment}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded text-sm font-medium ${
                                  d.duration > 60 ? 'bg-red-100 text-red-800' :
                                  d.duration > 30 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {d.duration} min
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="text-sm">
                                  {d.postNumber ? (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                      {d.postNumber}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-gray-600">{d.operatorName}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
              
              {/* Maskin analyse tabell for i går */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">🔧 Maskinanalyse i går</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Antall Stanser</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Total Tid</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Gjennomsnitt</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const machineStats = {};
                        yesterdayDowntimes.forEach(d => {
                          if (!machineStats[d.machineName]) {
                            machineStats[d.machineName] = { count: 0, duration: 0 };
                          }
                          machineStats[d.machineName].count += 1;
                          machineStats[d.machineName].duration += d.duration;
                        });
                        
                        // Legg til maskiner uten stanser
                        machines.forEach(machine => {
                          if (!machineStats[machine.name]) {
                            machineStats[machine.name] = { count: 0, duration: 0 };
                          }
                        });
                        
                        return Object.entries(machineStats)
                          .sort(([,a], [,b]) => b.duration - a.duration)
                          .map(([machineName, stats]) => {
                            const machine = machines.find(m => m.name === machineName);
                            return (
                              <tr key={machineName} className="border-b hover:bg-gray-50">
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 ${machine?.color || 'bg-gray-500'} rounded`}></div>
                                    <span className="font-medium text-gray-900">{machineName}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-lg font-bold text-gray-900">{stats.count}</span>
                                </td>
                                <td className="p-4">
                                  <span className={`text-lg font-bold ${
                                    stats.duration > 60 ? 'text-red-600' :
                                    stats.duration > 30 ? 'text-yellow-600' :
                                    stats.duration === 0 ? 'text-green-600' :
                                    'text-blue-600'
                                  }`}>{stats.duration} min</span>
                                </td>
                                <td className="p-4">
                                  <span className="text-gray-700">
                                    {stats.count > 0 ? Math.round(stats.duration / stats.count) : 0} min
                                  </span>
                                </td>
                                <td className="p-4">
                                  {stats.count === 0 ? (
                                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                      ✅ OK
                                    </span>
                                  ) : stats.duration > 60 ? (
                                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                                      🚨 Høy
                                    </span>
                                  ) : stats.duration > 30 ? (
                                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                      ⚠️ Middels
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                      🟡 Lav
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                      })()}
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-50 p-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Status forklaring:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">✅ OK</span>
                      <span className="text-gray-600">Ingen stanser</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">🟡 Lav</span>
                      <span className="text-gray-600">Under 30 min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">⚠️ Middels</span>
                      <span className="text-gray-600">30-60 min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">🚨 Høy</span>
                      <span className="text-gray-600">Over 60 min</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-2xl shadow-xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">📋 Stansehistorikk</h2>
                <p className="text-slate-100">Detaljert oversikt over alle stanser</p>
              </div>
              
              {/* Date Filters */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Fra dato:</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Til dato:</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={clearFilters}
                      className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-bold transition-all"
                    >
                      Tøm
                    </button>
                    <button
                      onClick={setYesterday}
                      className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all"
                    >
                      I går
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const csvContent = [
                          ['Dato', 'Start Tid', 'Slutt Tid', 'Maskin', 'Varighet', 'Årsak', 'Operatør'],
                          ...filteredHistory.map(d => [
                            new Date(d.startTime).toLocaleDateString('nb-NO'),
                            new Date(d.startTime).toLocaleTimeString('nb-NO'),
                            new Date(d.endTime).toLocaleTimeString('nb-NO'),
                            `${d.machineName}${d.postNumber ? `(Post ${d.postNumber})` : ''}`,
                            `${d.duration} min`,
                            d.comment,
                            d.operatorName
                          ])
                        ].map(row => row.join(',')).join('\n');
                        
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `stansehistorikk-${fromDate || 'alle'}-${toDate || 'alle'}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all"
                    >
                      💾 Excel
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all"
                    >
                      📄 PDF
                    </button>
                  </div>
                </div>
              </div>
              
              {/* History Table */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">Stansehistorikk ({filteredHistory.length} stanser)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-4 font-semibold text-gray-700">Dato</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Start Tid</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Slutt Tid</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Varighet</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Årsak</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Operatør</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((d, index) => {
                        const machine = machines.find(m => m.name === d.machineName);
                        return (
                          <tr key={d.id} className="border-b hover:bg-gray-50">
                            <td className="p-4">
                              <span className="text-sm font-medium text-gray-900">
                                {new Date(d.startTime).toLocaleDateString('nb-NO')}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-gray-600">
                                {new Date(d.startTime).toLocaleTimeString('nb-NO')}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-gray-600">
                                {new Date(d.endTime).toLocaleTimeString('nb-NO')}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 ${machine?.color || 'bg-gray-500'} rounded`}></div>
                                <span className="font-medium text-gray-900">
                                  {d.machineName}{d.postNumber ? `(Post ${d.postNumber})` : ''}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                d.duration > 60 ? 'bg-red-100 text-red-800' :
                                d.duration > 30 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {d.duration} min
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-gray-700 max-w-xs">
                                {d.comment}
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-gray-600">{d.operatorName}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Machine Statistics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-900">📊 Stanser per maskin</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left p-3 font-semibold text-gray-700">Maskin</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Antall</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Total</th>
                          <th className="text-left p-3 font-semibold text-gray-700">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const machineStats = {};
                          const totalDuration = filteredHistory.reduce((sum, d) => sum + d.duration, 0);
                          
                          filteredHistory.forEach(d => {
                            if (!machineStats[d.machineName]) {
                              machineStats[d.machineName] = { count: 0, duration: 0 };
                            }
                            machineStats[d.machineName].count += 1;
                            machineStats[d.machineName].duration += d.duration;
                          });
                          
                          return Object.entries(machineStats)
                            .sort(([,a], [,b]) => b.duration - a.duration)
                            .slice(0, 10)
                            .map(([machineName, stats]) => {
                              const percentage = totalDuration > 0 ? ((stats.duration / totalDuration) * 100).toFixed(1) : '0.0';
                              const machine = machines.find(m => m.name === machineName);
                              return (
                                <tr key={machineName} className="border-b hover:bg-gray-50">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 ${machine?.color || 'bg-gray-500'} rounded`}></div>
                                      <span className="font-medium text-gray-900">{machineName}</span>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <span className="text-gray-900">{stats.count} stanser</span>
                                  </td>
                                  <td className="p-3">
                                    <span className="font-bold text-gray-900">{stats.duration} min</span>
                                  </td>
                                  <td className="p-3">
                                    <span className="text-blue-600 font-medium">{percentage}%</span>
                                  </td>
                                </tr>
                              );
                            });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-900">📝 Årsaker per maskin</h3>
                  </div>
                  <div className="p-4 max-h-96 overflow-y-auto">
                    {(() => {
                      const machineReasons = {};
                      
                      filteredHistory.forEach(d => {
                        if (!machineReasons[d.machineName]) {
                          machineReasons[d.machineName] = { count: 0, duration: 0, reasons: {} };
                        }
                        machineReasons[d.machineName].count += 1;
                        machineReasons[d.machineName].duration += d.duration;
                        
                        if (!machineReasons[d.machineName].reasons[d.comment]) {
                          machineReasons[d.machineName].reasons[d.comment] = 0;
                        }
                        machineReasons[d.machineName].reasons[d.comment] += 1;
                      });
                      
                      return Object.entries(machineReasons)
                        .sort(([,a], [,b]) => b.duration - a.duration)
                        .slice(0, 5)
                        .map(([machineName, data]) => (
                          <div key={machineName} className="mb-4">
                            <h4 className="font-bold text-gray-900 mb-2">
                              {machineName}({data.count} stanser, {data.duration} min)
                            </h4>
                            <div className="ml-4 space-y-1">
                              {Object.entries(data.reasons)
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 3)
                                .map(([reason, count]) => (
                                  <div key={reason} className="text-sm text-gray-600">
                                    {reason} ({count}x)
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'backup' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">💾 Database Backup</h2>
                <p className="text-blue-100">Eksporter og sikkerhetskopier data</p>
              </div>
              
              {/* Export Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <Download className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">📊 Eksporter alle data</h3>
                  <p className="text-gray-600 text-sm mb-4">Last ned alle stanser, maskiner og brukere som JSON fil</p>
                  <button 
                    onClick={exportJSONBackup}
                    className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors"
                  >
                    💾 Last ned JSON backup
                  </button>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">📋 Eksporter stanser (CSV)</h3>
                  <p className="text-gray-600 text-sm mb-4">Last ned alle stanser som Excel-kompatibel CSV fil</p>
                  <button 
                    onClick={exportCSVBackup}
                    className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors"
                  >
                    📊 Last ned CSV backup
                  </button>
                </div>
              </div>
              
              {/* Important Information */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-bold text-yellow-800 mb-3">⚠️ Viktig informasjon</h3>
                    <ul className="space-y-2 text-yellow-700">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>JSON backup inneholder alle data og kan brukes til gjenoppretting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>CSV backup er kun for analyse i Excel/Google Sheets</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>For full database backup, bruk Supabase Dashboard</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>Lagre backup filer på sikker plass</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Database Statistics */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 mb-4">📈 Database statistikk</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{downtimeHistory.length}</div>
                    <div className="text-sm text-blue-700 font-medium">Totalt stanser</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{machines.length}</div>
                    <div className="text-sm text-green-700 font-medium">Maskiner</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600">{departmentUsers.length}</div>
                    <div className="text-sm text-purple-700 font-medium">Brukere</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'machines' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">🏭 Maskinadministrasjon</h2>
                    <p className="text-orange-100">Administrer maskiner som kan registreres for stanser</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{machines.length}</div>
                    <div className="text-orange-100 text-sm">Totalt maskiner</div>
                  </div>
                </div>
              </div>
              
              {/* Add New Machine */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Legg til maskin</h3>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newMachineName}
                    onChange={(e) => setNewMachineName(e.target.value)}
                    placeholder="Maskinnavn"
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  />
                  <button
                    onClick={addMachine}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold transition-all"
                  >
                    ➕ Legg til
                  </button>
                </div>
              </div>
              
              {/* Machines List */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left p-4 font-semibold text-gray-700">#</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Maskinnavn</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Handlinger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machines.map((machine, index) => (
                        <tr key={machine.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <div className={`w-8 h-8 ${machine.color} text-white rounded-lg flex items-center justify-center font-semibold text-sm`}>
                              {index + 1}
                            </div>
                          </td>
                          <td className="p-4">
                            <div>
                              <div className="font-medium text-gray-900">{machine.name}</div>
                              <div className="text-sm text-gray-500">ID: {machine.id}</div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditMachine(machine);
                                  setEditMachineName(machine.name);
                                }}
                                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors"
                              >
                                Rediger
                              </button>
                              <button
                                onClick={() => deleteMachine(machine)}
                                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors"
                              >
                                Slett
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

          {/* Edit Machine Modal */}
          {editMachine && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-2xl">
                  <h2 className="text-xl font-bold mb-2">✏️ Rediger maskin</h2>
                  <p className="text-orange-100">ID: {editMachine.id}</p>
                </div>

                <div className="p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Maskinnavn *</label>
                    <input
                      type="text"
                      value={editMachineName}
                      onChange={(e) => setEditMachineName(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-lg"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={updateMachine}
                      className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl transition-all duration-200 font-bold text-lg"
                    >
                      ✅ LAGRE ENDRINGER
                    </button>
                    
                    <button
                      onClick={() => {
                        setEditMachine(null);
                        setEditMachineName('');
                      }}
                      className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium text-gray-700"
                    >
                      ❌ Avbryt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold mb-2">✏️ Rediger stans</h2>
                <p className="text-blue-100">{editModal.machineName}</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">🕰️ Start tid</label>
                    <input
                      type="datetime-local"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">🕰️ Slutt tid</label>
                    <input
                      type="datetime-local"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">⏱️ Varighet (minutter)</label>
                  <input
                    type="number"
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                    min="1"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">📋 Post Nr</label>
                  <input
                    type="text"
                    value={editPostNumber}
                    onChange={(e) => setEditPostNumber(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">💬 Årsak til stans *</label>
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all h-32 resize-none text-base leading-relaxed"
                    maxLength={500}
                  />
                </div>

                <div className="space-y-3">
                  <button
                    onClick={saveEdit}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 font-bold text-lg"
                  >
                    ✅ LAGRE ENDRINGER
                  </button>
                  
                  <button
                    onClick={() => setEditModal(null)}
                    className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium text-gray-700"
                  >
                    ❌ Avbryt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comment Modal */}
        {commentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold mb-2">🛑 Avslutt stans</h2>
                <p className="text-blue-100">{commentModal.machineName}</p>
                <div className="mt-3 bg-white/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Varighet:</span>
                    <span className="text-xl font-bold">
                      {formatDuration(commentModal.startTime)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {commentModal.machineName === 'Omposting/Korigering' && (
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">📋 Post Nr *</label>
                    <input
                      type="text"
                      value={postNumber}
                      onChange={(e) => setPostNumber(e.target.value)}
                      placeholder="F.eks. 1, 2, 3..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                      autoFocus
                    />
                  </div>
                )}

                {!currentPostNumber && commentModal.machineName !== 'Omposting/Korigering' && (
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">📋 Post Nr *</label>
                    <input
                      type="text"
                      value={manualPostNumber}
                      onChange={(e) => setManualPostNumber(e.target.value)}
                      placeholder="F.eks. 1, 2, 3..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                    />
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">💬 Årsak til stans *</label>
                  <textarea
                    value={comment}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setComment(e.target.value);
                      }
                    }}
                    placeholder="Beskriv hva som skjedde..."
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all h-32 resize-none text-base leading-relaxed"
                    autoFocus={commentModal.machineName !== 'Omposting/Korigering'}
                    maxLength={500}
                  />
                  <div className="mt-1 text-xs text-gray-500">{comment.length}/500 tegn</div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={confirmStop}
                    disabled={!comment.trim() || (commentModal.machineName === 'Omposting/Korigering' && !postNumber.trim()) || (!currentPostNumber && !manualPostNumber.trim() && commentModal.machineName !== 'Omposting/Korigering')}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                  >
                    ✅ LAGRE STANS
                  </button>
                  
                  <button
                    onClick={() => {
                      setCommentModal(null);
                      setComment('');
                      setPostNumber('');
                      setManualPostNumber('');
                    }}
                    className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700"
                  >
                    ❌ Avbryt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
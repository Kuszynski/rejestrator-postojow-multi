'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Department, getDepartments, createDepartment, addUser, getDepartmentUsers } from '@/lib/auth';
import { Building2, Users, Plus, Settings, BarChart3, Shield, Trash2, Edit2, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import DepartmentDowntimeTracker from './DepartmentDowntimeTracker';

interface SuperAdminPanelProps {
  user: User;
  onLogout: () => void;
}

// Factory Analytics Component
function FactoryAnalytics({ departments }: { departments: Department[] }) {
  const [analyticsData, setAnalyticsData] = useState<any>({
    today: [],
    week: [],
    month: [],
    departmentStats: [],
    topMachines: [],
    topReasons: [],
    trends: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('today');

  useEffect(() => {
    loadAnalyticsData();
  }, [departments]);

  const loadAnalyticsData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      // Get all downtimes with department info
      const { data: allDowntimes, error } = await supabase
        .from('downtimes')
        .select(`
          *,
          departments(display_name)
        `)
        .gte('date', monthAgo.toISOString().split('T')[0])
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Get machines data
      const { data: machines } = await supabase.from('machines').select('*');
      const machineMap = {};
      machines?.forEach(m => {
        machineMap[m.id] = m.name;
      });

      // Enrich data
      const enrichedData = allDowntimes?.map(d => ({
        ...d,
        machineName: machineMap[d.machine_id] || d.machine_id,
        departmentName: d.departments?.display_name || 'Ukjent'
      })) || [];

      // Filter by time ranges
      const todayData = enrichedData.filter(d => d.date === today);
      const weekData = enrichedData.filter(d => new Date(d.date) >= weekAgo);
      const monthData = enrichedData;

      // Calculate department stats
      const deptStats = departments.map(dept => {
        const deptDowntimes = todayData.filter(d => d.department_id === dept.id);
        const totalDuration = deptDowntimes.reduce((sum, d) => sum + d.duration, 0);
        const efficiency = Math.max(0, 100 - Math.round((totalDuration / 480) * 100)); // 8h = 480min
        
        return {
          department: dept,
          downtimeCount: deptDowntimes.length,
          totalDuration,
          efficiency,
          avgDuration: deptDowntimes.length > 0 ? Math.round(totalDuration / deptDowntimes.length) : 0
        };
      });

      // Top machines by downtime
      const machineStats = {};
      todayData.forEach(d => {
        if (!machineStats[d.machineName]) {
          machineStats[d.machineName] = { count: 0, duration: 0, department: d.departmentName };
        }
        machineStats[d.machineName].count++;
        machineStats[d.machineName].duration += d.duration;
      });

      const topMachines = Object.entries(machineStats)
        .sort(([,a], [,b]) => b.duration - a.duration)
        .slice(0, 10)
        .map(([name, stats]) => ({ name, ...stats }));

      // Top reasons
      const reasonStats = {};
      todayData.forEach(d => {
        const reason = d.comment.toLowerCase();
        if (!reasonStats[reason]) {
          reasonStats[reason] = { count: 0, duration: 0, machines: new Set(), departments: new Set() };
        }
        reasonStats[reason].count++;
        reasonStats[reason].duration += d.duration;
        reasonStats[reason].machines.add(d.machineName);
        reasonStats[reason].departments.add(d.departmentName);
      });

      const topReasons = Object.entries(reasonStats)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 10)
        .map(([reason, stats]) => ({ 
          reason, 
          count: stats.count,
          duration: stats.duration,
          machines: Array.from(stats.machines).join(', '),
          departments: Array.from(stats.departments).join(', ')
        }));

      // Weekly trends (last 7 days)
      const trends = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayData = enrichedData.filter(d => d.date === dateStr);
        
        trends.push({
          date: dateStr,
          day: date.toLocaleDateString('nb-NO', { weekday: 'short' }),
          downtimes: dayData.length,
          duration: dayData.reduce((sum, d) => sum + d.duration, 0)
        });
      }

      setAnalyticsData({
        today: todayData,
        week: weekData,
        month: monthData,
        departmentStats: deptStats,
        topMachines,
        topReasons,
        trends
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Laster analysedata...</div>
      </div>
    );
  }

  const { today, departmentStats, topMachines, topReasons, trends } = analyticsData;
  const totalDowntimes = today.length;
  const totalDuration = today.reduce((sum, d) => sum + d.duration, 0);
  const avgDuration = totalDowntimes > 0 ? Math.round(totalDuration / totalDowntimes) : 0;
  const overallEfficiency = Math.max(0, 100 - Math.round((totalDuration / (480 * departments.length)) * 100));

  return (
    <div className="space-y-6">
      {/* Department Performance */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">📊 Avdelingsytelse i dag</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avdeling</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stanser</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stansetid</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gjennomsnitt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effektivitet</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {departmentStats.map((stat) => (
                <tr key={stat.department.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {stat.department.displayName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {stat.downtimeCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {stat.totalDuration} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {stat.avgDuration} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      stat.efficiency >= 90 ? 'bg-green-100 text-green-800' :
                      stat.efficiency >= 75 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {stat.efficiency}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {stat.efficiency >= 90 ? '🟢 Utmerket' :
                     stat.efficiency >= 75 ? '🟡 Bra' : '🔴 Trenger oppmerksomhet'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 p-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Status forklaring:</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-3">
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex-shrink-0">🟢 Utmerket</span>
              <div className="text-gray-600">
                <div className="font-medium">Effektivitet 90-100%</div>
                <div>Avdelingen fungerer optimalt med minimal stansetid. Fortsett det gode arbeidet.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium flex-shrink-0">🟡 Bra</span>
              <div className="text-gray-600">
                <div className="font-medium">Effektivitet 75-89%</div>
                <div>Akseptabel ytelse, men det er rom for forbedring. Vurder å identifisere hovedproblemer.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex-shrink-0">🔴 Trenger oppmerksomhet</span>
              <div className="text-gray-600">
                <div className="font-medium">Effektivitet under 75%</div>
                <div>Kritisk nivå - krever umiddelbar handling. Analyser årsaker og implementer tiltak.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Top Machines */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">🏭 Mest problematiske maskiner</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maskin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avdeling</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total tid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Antall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topMachines.slice(0, 8).map((machine, index) => (
                  <tr key={machine.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        index === 0 ? 'bg-red-500' :
                        index === 1 ? 'bg-orange-500' :
                        index === 2 ? 'bg-yellow-500' : 'bg-gray-400'
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{machine.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{machine.department}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{machine.duration} min</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{machine.count} stanser</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Reasons */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">🔍 Hyppigste årsaker til stanser</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Årsak</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maskin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avdeling</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Antall</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total tid</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gjennomsnitt</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topReasons.map((reason, index) => (
                <tr key={reason.reason} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index === 0 ? 'bg-red-500' :
                      index === 1 ? 'bg-orange-500' :
                      index === 2 ? 'bg-yellow-500' : 'bg-gray-400'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 capitalize">
                      {reason.reason}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {reason.machines}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {reason.departments}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {reason.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {reason.duration} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Math.round(reason.duration / reason.count)} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Live All Downtimes Component
function LiveAllDowntimes() {
  const [allTodayDowntimes, setAllTodayDowntimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllTodayDowntimes();
    const interval = setInterval(() => {
      loadAllTodayDowntimes();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAllTodayDowntimes = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('downtimes')
        .select(`
          *,
          departments(display_name)
        `)
        .eq('date', today)
        .order('start_time', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading all today downtimes:', error);
        return;
      }

      const machineList = await supabase.from('machines').select('*');
      const machines = machineList.data || [];

      const enrichedData = (data || []).map(d => ({
        ...d,
        machineName: machines.find(m => m.id === d.machine_id)?.name || d.machine_id,
        departmentName: d.departments?.display_name || 'Ukjent avdeling'
      }));

      setAllTodayDowntimes(enrichedData);
    } catch (error) {
      console.error('Error loading all today downtimes:', error);
    }
    if (loading) setLoading(false);
  };



  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            🔴 Live - Alle dagens stanser
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{allTodayDowntimes.length}</div>
              <div className="text-xs text-gray-600">Totalt stanser</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {allTodayDowntimes.reduce((sum, d) => sum + d.duration, 0)}
              </div>
              <div className="text-xs text-gray-600">Min total</div>
            </div>
            <div className="text-xs text-gray-500">
              Oppdateres hvert 5. sekund
            </div>
          </div>
        </div>
      </div>
      
      {allTodayDowntimes.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p>Ingen stanser registrert i dag</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left font-semibold">Tid</th>
                <th className="p-3 text-left font-semibold">Avdeling</th>
                <th className="p-3 text-left font-semibold">Maskin</th>
                <th className="p-3 text-left font-semibold">Varighet</th>
                <th className="p-3 text-left font-semibold">Årsak</th>
                <th className="p-3 text-left font-semibold">Operatør</th>
                <th className="p-3 text-left font-semibold">Post Nr</th>
              </tr>
            </thead>
            <tbody>
              {allTodayDowntimes.map((d) => (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <span className="text-sm font-medium">
                      {new Date(d.start_time).toLocaleDateString('nb-NO')} {new Date(d.start_time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {d.departmentName}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{d.machineName}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      d.duration > 60 ? 'bg-red-100 text-red-800' :
                      d.duration > 30 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {d.duration} min
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="max-w-xs truncate" title={d.comment}>
                      {d.comment}
                    </div>
                  </td>
                  <td className="p-3 text-gray-600">{d.operator_id}</td>
                  <td className="p-3">
                    {d.post_number ? (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                        {d.post_number}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Live Department Overview Component
function LiveDepartmentOverview({ department }: { department: Department }) {
  const [todayDowntimes, setTodayDowntimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodayDowntimes();
    const interval = setInterval(() => {
      loadTodayDowntimes();
    }, 5000);
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
    } catch (error) {
      console.error('Error loading today downtimes:', error);
    }
    if (loading) setLoading(false);
  };



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
  const [view, setView] = useState<'live' | 'departments' | 'users' | 'analytics' | 'historikk' | 'notater'>('live');
  const [selectedHistoryDepartment, setSelectedHistoryDepartment] = useState<Department | null>(null);
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
            <button
              onClick={() => setView('historikk')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                view === 'historikk' 
                  ? 'border-purple-500 text-purple-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📋 Historikk
            </button>
            <button
              onClick={() => setView('notater')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                view === 'notater' 
                  ? 'border-purple-500 text-purple-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📝 Notater (Alle)
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {view === 'live' && (
          <div className="space-y-6">
            {/* Real-time All Downtimes */}
            <LiveAllDowntimes />
            
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
                            {user.role !== 'super' && (
                              <button
                                onClick={async () => {
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
                            )}
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
          <FactoryAnalytics departments={departments} />
        )}

        {view === 'notater' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl shadow-xl p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">📝 Daglige notater fra alle avdelinger</h2>
              <p className="text-indigo-100">Oversikt over alle notater fra operatørene i hele firmaet</p>
            </div>
            
            <DepartmentDowntimeTracker 
              user={{
                ...user,
                role: 'super_admin',
                departmentId: 0
              }}
              department={null}
              onLogout={() => {}}
            />
          </div>
        )}

        {view === 'historikk' && (
          <div className="space-y-6">
            {/* Department Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Velg avdeling for historikk</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => setSelectedHistoryDepartment(dept)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedHistoryDepartment?.id === dept.id
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <Building2 className="w-6 h-6 mx-auto mb-2" />
                    <div className="font-medium">{dept.displayName}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Manager Panel for Selected Department */}
            {selectedHistoryDepartment && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                  <h3 className="text-xl font-bold text-gray-900">
                    Manager panel for {selectedHistoryDepartment.displayName}
                  </h3>
                </div>
                <div className="p-6">
                  <DepartmentDowntimeTracker 
                    user={{
                      ...user,
                      role: 'manager',
                      departmentId: selectedHistoryDepartment.id
                    }}
                    department={selectedHistoryDepartment}
                    onLogout={() => {}}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
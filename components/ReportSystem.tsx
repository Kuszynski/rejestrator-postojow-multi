'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Mail, Calendar, TrendingDown, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DowntimeEntry {
  id: string;
  machineName: string;
  operatorName: string;
  startTime: string;
  duration: number;
  comment: string;
  date: string;
  postNumber?: string;
}

interface ReportData {
  period: string;
  totalDowntime: number;
  totalStops: number;
  avgDowntime: number;
  topMachines: Array<{ name: string; duration: number; stops: number }>;
  topCauses: Array<{ cause: string; count: number; duration: number }>;
  operators: Array<{ name: string; stops: number; duration: number }>;
  dailyTrend: Array<{ date: string; duration: number; stops: number }>;
}

export default function ReportSystem() {
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimeEntry[]>([]);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [emailSettings, setEmailSettings] = useState({
    enabled: false,
    email: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly'
  });

  useEffect(() => {
    loadDowntimeData();
    
    const emailSettingsStored = localStorage.getItem('emailSettings');
    if (emailSettingsStored) {
      setEmailSettings(JSON.parse(emailSettingsStored));
    }
  }, []);

  const loadDowntimeData = async () => {
    try {
      const { data, error } = await supabase
        .from('downtimes')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error loading downtimes:', error);
        return;
      }

      const machines = await supabase.from('machines').select('*');
      const machineList = machines.data || [];
      
      const enrichedData = (data || []).map(downtime => ({
        id: downtime.id,
        machineName: machineList.find(m => m.id === downtime.machine_id)?.name || 'Unknown',
        operatorName: downtime.operator_id,
        startTime: downtime.start_time,
        duration: downtime.duration,
        comment: downtime.comment,
        date: downtime.date || new Date(downtime.start_time).toISOString().split('T')[0],
        postNumber: downtime.post_number
      }));

      setDowntimeHistory(enrichedData);
    } catch (error) {
      console.error('Unexpected error loading data:', error);
    }
  };

  const generateReportData = (): ReportData => {
    let filteredData: DowntimeEntry[] = [];
    const selectedDateObj = new Date(selectedDate);

    switch (reportType) {
      case 'daily':
        filteredData = downtimeHistory.filter(d => d.date === selectedDate);
        break;
      case 'weekly':
        const weekStart = new Date(selectedDateObj);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        filteredData = downtimeHistory.filter(d => {
          const entryDate = new Date(d.date);
          return entryDate >= weekStart && entryDate <= weekEnd;
        });
        break;
      case 'monthly':
        filteredData = downtimeHistory.filter(d => {
          const entryDate = new Date(d.date);
          return entryDate.getMonth() === selectedDateObj.getMonth() && 
                 entryDate.getFullYear() === selectedDateObj.getFullYear();
        });
        break;
    }

    const totalDowntime = filteredData.reduce((sum, d) => sum + d.duration, 0);
    const totalStops = filteredData.length;
    const avgDowntime = totalStops > 0 ? Math.round(totalDowntime / totalStops) : 0;

    // Top maszyny
    const machineStats = {};
    filteredData.forEach(d => {
      if (!machineStats[d.machineName]) {
        machineStats[d.machineName] = { duration: 0, stops: 0 };
      }
      machineStats[d.machineName].duration += d.duration;
      machineStats[d.machineName].stops += 1;
    });

    const topMachines = Object.entries(machineStats)
      .map(([name, stats]: [string, any]) => ({ name, ...stats }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    // Top przyczyny
    const causeStats = {};
    filteredData.forEach(d => {
      if (!causeStats[d.comment]) {
        causeStats[d.comment] = { count: 0, duration: 0 };
      }
      causeStats[d.comment].count += 1;
      causeStats[d.comment].duration += d.duration;
    });

    const topCauses = Object.entries(causeStats)
      .map(([cause, stats]: [string, any]) => ({ cause, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Operatorzy
    const operatorStats = {};
    filteredData.forEach(d => {
      if (!operatorStats[d.operatorName]) {
        operatorStats[d.operatorName] = { stops: 0, duration: 0 };
      }
      operatorStats[d.operatorName].stops += 1;
      operatorStats[d.operatorName].duration += d.duration;
    });

    const operators = Object.entries(operatorStats)
      .map(([name, stats]: [string, any]) => ({ name, ...stats }))
      .sort((a, b) => b.duration - a.duration);

    // Trend dzienny
    const dailyStats = {};
    filteredData.forEach(d => {
      if (!dailyStats[d.date]) {
        dailyStats[d.date] = { duration: 0, stops: 0 };
      }
      dailyStats[d.date].duration += d.duration;
      dailyStats[d.date].stops += 1;
    });

    const dailyTrend = Object.entries(dailyStats)
      .map(([date, stats]: [string, any]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: `${reportType} - ${selectedDate}`,
      totalDowntime,
      totalStops,
      avgDowntime,
      topMachines,
      topCauses,
      operators,
      dailyTrend
    };
  };

  const exportToCSV = () => {
    const reportData = generateReportData();
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header
    csvContent += "Raport Postojów\n";
    csvContent += `Okres,${reportData.period}\n`;
    csvContent += `Łączny czas postojów,${reportData.totalDowntime} min\n`;
    csvContent += `Liczba postojów,${reportData.totalStops}\n`;
    csvContent += `Średni czas postoju,${reportData.avgDowntime} min\n\n`;
    
    // Top maszyny
    csvContent += "Top Maszyny\n";
    csvContent += "Nazwa,Czas postojów (min),Liczba postojów\n";
    reportData.topMachines.forEach(machine => {
      csvContent += `${machine.name},${machine.duration},${machine.stops}\n`;
    });
    
    csvContent += "\nTop Przyczyny\n";
    csvContent += "Przyczyna,Liczba wystąpień,Łączny czas (min)\n";
    reportData.topCauses.forEach(cause => {
      csvContent += `${cause.cause},${cause.count},${cause.duration}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `raport_postojow_${reportData.period.replace(/\s/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDF = () => {
    const reportData = generateReportData();
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Raport Postojów</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
          .stat-box { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .table th { background-color: #f5f5f5; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Raport Postojów Produkcyjnych</h1>
          <h2>${reportData.period}</h2>
          <p>Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
        </div>
        
        <div class="stats">
          <div class="stat-box">
            <h3>Łączny czas postojów</h3>
            <p style="font-size: 24px; color: #dc2626;">${reportData.totalDowntime} min</p>
          </div>
          <div class="stat-box">
            <h3>Liczba postojów</h3>
            <p style="font-size: 24px; color: #ea580c;">${reportData.totalStops}</p>
          </div>
          <div class="stat-box">
            <h3>Średni czas postoju</h3>
            <p style="font-size: 24px; color: #7c3aed;">${reportData.avgDowntime} min</p>
          </div>
          <div class="stat-box">
            <h3>Liczba maszyn</h3>
            <p style="font-size: 24px; color: #059669;">${reportData.topMachines.length}</p>
          </div>
        </div>

        <h3>Top Maszyny</h3>
        <table class="table">
          <thead>
            <tr><th>Nazwa</th><th>Czas postojów (min)</th><th>Liczba postojów</th></tr>
          </thead>
          <tbody>
            ${reportData.topMachines.map(m => 
              `<tr><td>${m.name}</td><td>${m.duration}</td><td>${m.stops}</td></tr>`
            ).join('')}
          </tbody>
        </table>

        <h3>Top Przyczyny</h3>
        <table class="table">
          <thead>
            <tr><th>Przyczyna</th><th>Liczba wystąpień</th><th>Łączny czas (min)</th></tr>
          </thead>
          <tbody>
            ${reportData.topCauses.map(c => 
              `<tr><td>${c.cause}</td><td>${c.count}</td><td>${c.duration}</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const saveEmailSettings = () => {
    localStorage.setItem('emailSettings', JSON.stringify(emailSettings));
    alert('Ustawienia email zapisane!');
  };

  const reportData = generateReportData();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">System Raportów</h1>
          
          {/* Kontrolki */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Typ raportu
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="daily">Dzienny</option>
                <option value="weekly">Tygodniowy</option>
                <option value="monthly">Miesięczny</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div className="flex items-end gap-2">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={generatePDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>

          {/* Statystyki główne */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Łączny czas</p>
                  <p className="text-2xl font-bold text-red-700">{reportData.totalDowntime} min</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600">Liczba postojów</p>
                  <p className="text-2xl font-bold text-orange-700">{reportData.totalStops}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Średni czas</p>
                  <p className="text-2xl font-bold text-purple-700">{reportData.avgDowntime} min</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Maszyny</p>
                  <p className="text-2xl font-bold text-blue-700">{reportData.topMachines.length}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Tabele */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Maszyny */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Top Maszyny</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Nazwa</th>
                      <th className="text-left p-2">Czas (min)</th>
                      <th className="text-left p-2">Postoje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.topMachines.map((machine, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 font-medium">{machine.name}</td>
                        <td className="p-2 text-red-600">{machine.duration}</td>
                        <td className="p-2">{machine.stops}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Przyczyny */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Top Przyczyny</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Przyczyna</th>
                      <th className="text-left p-2">Wystąpienia</th>
                      <th className="text-left p-2">Czas (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.topCauses.map((cause, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{cause.cause}</td>
                        <td className="p-2 font-medium">{cause.count}</td>
                        <td className="p-2 text-red-600">{cause.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Ustawienia Email */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Automatyczne raporty email
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emailSettings.enabled}
                  onChange={(e) => setEmailSettings({...emailSettings, enabled: e.target.checked})}
                />
                Włącz automatyczne raporty
              </label>
            </div>
            
            <div>
              <input
                type="email"
                placeholder="Email managera"
                value={emailSettings.email}
                onChange={(e) => setEmailSettings({...emailSettings, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={emailSettings.frequency}
                onChange={(e) => setEmailSettings({...emailSettings, frequency: e.target.value as any})}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="daily">Codziennie</option>
                <option value="weekly">Tygodniowo</option>
                <option value="monthly">Miesięcznie</option>
              </select>
              
              <button
                onClick={saveEmailSettings}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
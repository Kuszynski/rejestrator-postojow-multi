import React from 'react';
import { getWeekPeriods } from '@/utils/weekReportHelper';

function DowntimeCell({ start, end, isPause, departmentId, supabase }) {
  const [value, setValue] = React.useState('...');
  
  React.useEffect(() => {
    const fetchSum = async () => {
      const { data } = await supabase
        .from('downtimes')
        .select('duration, comment, machine_id')
        .eq('department_id', departmentId)
        .gte('start_time', start)
        .lt('start_time', end);
      
      if (!data) { setValue('0 min'); return; }
      
      let sum = 0;
      
      // Dodaj czas postojów (bez ompostingu)
      sum += data
        .filter(d => {
          if (d.machine_id === 'm14') return false;
          const comment = d.comment.toLowerCase();
          return isPause ? (comment.includes('pause') || comment.includes('mat')) : !(comment.includes('pause') || comment.includes('mat'));
        })
        .reduce((s, d) => s + d.duration, 0);
      
      // Dodaj czas ompostingu do postojów (nie do pauz)
      if (!isPause) {
        sum += data
          .filter(d => d.machine_id === 'm14')
          .reduce((s, d) => s + d.duration, 0);
      }
      
      setValue(sum + ' min');
    };
    
    fetchSum();
    
    // Auto-refresh co 10 sekund
    const interval = setInterval(fetchSum, 10000);
    return () => clearInterval(interval);
  }, [start, end, isPause, departmentId, supabase]);
  
  return <>{value}</>;
}

function PostNumberCell({ start, end, isMonday, departmentId, supabase }) {
  const [postNumber, setPostNumber] = React.useState('-');
  
  React.useEffect(() => {
    const fetchPostNumber = async () => {
      // Sprawdź czy jest omposting na początku tego okresu
      const { data: ompostingAtStart } = await supabase
        .from('downtimes')
        .select('post_number, start_time')
        .eq('machine_id', 'm14')
        .eq('department_id', departmentId)
        .eq('start_time', start)
        .limit(1);
      
      if (ompostingAtStart?.[0]) {
        // Jest omposting na początku - użyj jego numeru
        setPostNumber(ompostingAtStart[0].post_number);
      } else {
        // Znajdź ostatni omposting przed początkiem tego okresu
        const { data } = await supabase
          .from('downtimes')
          .select('post_number, start_time')
          .eq('machine_id', 'm14')
          .eq('department_id', departmentId)
          .lt('start_time', start)
          .order('start_time', { ascending: false })
          .limit(1);
        
        setPostNumber(data?.[0]?.post_number || '-');
      }
    };
    fetchPostNumber();
  }, [start, end, departmentId]);
  
  return <>{postNumber}</>;
}

function OmpostingCell({ start, end, isStart, dayName, departmentId, supabase }) {
  const [time, setTime] = React.useState('-');
  
  React.useEffect(() => {
    const fetchOmpostingTime = async () => {
      if (isStart) {
        // Start omposting - sprawdź czy był nowy omposting w tym dniu
        const { data } = await supabase
          .from('downtimes')
          .select('start_time')
          .eq('machine_id', 'm14')
          .eq('department_id', departmentId)
          .gte('start_time', start)
          .lt('start_time', end)
          .order('start_time', { ascending: true })
          .limit(1);
        
        if (data?.[0]) {
          const startTime = new Date(data[0].start_time);
          setTime(startTime.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }));
        } else {
          setTime('06:00');
        }
      } else {
        // Stop omposting - sprawdź czy jest następny omposting w tym samym dniu
        const currentDate = new Date(start).toISOString().split('T')[0];
        const dayEndTime = `${currentDate}T23:59:59`;
        
        const { data: nextInSameDay } = await supabase
          .from('downtimes')
          .select('start_time')
          .eq('machine_id', 'm14')
          .eq('department_id', departmentId)
          .gte('start_time', end)
          .lte('start_time', dayEndTime)
          .order('start_time', { ascending: true })
          .limit(1);
        
        if (nextInSameDay?.[0]) {
          // Jest następny omposting w tym samym dniu
          const stopTime = new Date(nextInSameDay[0].start_time);
          setTime(stopTime.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }));
        } else {
          // Nie ma następnego w tym dniu - kończy się o 23:20 (lub 14:00 dla piątku bez nadg.)
          setTime('23:20');
        }
      }
    };
    fetchOmpostingTime();
  }, [start, end, isStart, dayName, departmentId]);
  
  return <>{time}</>;
}

function DowntimeCountCell({ start, end, departmentId, supabase }) {
  const [count, setCount] = React.useState('...');
  
  React.useEffect(() => {
    const fetchCount = async () => {
      const { data } = await supabase
        .from('downtimes')
        .select('id, machine_id, comment')
        .eq('department_id', departmentId)
        .gte('start_time', start)
        .lt('start_time', end);
      
      if (!data) { setCount('0'); return; }
      
      const count = data
        .filter(d => {
          const comment = d.comment.toLowerCase();
          return !(comment.includes('pause') || comment.includes('mat'));
        })
        .length;
      
      setCount(count.toString());
    };
    
    fetchCount();
    
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, [start, end, departmentId, supabase]);
  
  return <>{count}</>;
}

function WeekTotalCountCell({ periods, departmentId, supabase, isPause }) {
  const [total, setTotal] = React.useState('...');
  
  React.useEffect(() => {
    const fetchWeekTotal = async () => {
      let totalCount = 0;
      
      for (const period of periods) {
        const { data } = await supabase
          .from('downtimes')
          .select('id, machine_id, comment')
          .eq('department_id', departmentId)
          .gte('start_time', period.startISO)
          .lt('start_time', period.endISO);
        
        if (data) {
          const count = data
            .filter(d => {
              const comment = d.comment.toLowerCase();
              return isPause ? (comment.includes('pause') || comment.includes('mat')) : !(comment.includes('pause') || comment.includes('mat'));
            })
            .length;
          totalCount += count;
        }
      }
      
      setTotal(totalCount.toString());
      
      // Update header with sum of both
      if (!isPause) {
        window.weekTotalStopCount = totalCount;
      } else {
        window.weekTotalPauseCount = totalCount;
      }
      
      if (window.weekTotalStopCount !== undefined && window.weekTotalPauseCount !== undefined) {
        const headerEl = document.getElementById('week-total-count');
        if (headerEl) {
          const valueEl = headerEl.querySelector('.text-2xl');
          if (valueEl) valueEl.textContent = (window.weekTotalStopCount + window.weekTotalPauseCount).toString();
        }
      }
    };
    
    if (periods.length > 0) {
      fetchWeekTotal();
      
      const interval = setInterval(fetchWeekTotal, 10000);
      return () => clearInterval(interval);
    }
  }, [periods, departmentId, supabase, isPause]);
  
  return <>{total}</>;
}

function WeekTotalCell({ periods, isPause, departmentId, supabase }) {
  const [total, setTotal] = React.useState('...');
  
  React.useEffect(() => {
    const fetchWeekTotal = async () => {
      let totalMinutes = 0;
      
      for (const period of periods) {
        const { data } = await supabase
          .from('downtimes')
          .select('duration, comment, machine_id')
          .eq('department_id', departmentId)
          .gte('start_time', period.startISO)
          .lt('start_time', period.endISO);
        
        if (data) {
          let sum = 0;
          
          // Dodaj czas postojów (bez ompostingu)
          sum += data
            .filter(d => {
              if (d.machine_id === 'm14') return false;
              const comment = d.comment.toLowerCase();
              return isPause ? (comment.includes('pause') || comment.includes('mat')) : !(comment.includes('pause') || comment.includes('mat'));
            })
            .reduce((s, d) => s + d.duration, 0);
          
          // Dodaj czas ompostingu do postojów (nie do pauz)
          if (!isPause) {
            sum += data
              .filter(d => d.machine_id === 'm14')
              .reduce((s, d) => s + d.duration, 0);
          }
          
          totalMinutes += sum;
        }
      }
      
      setTotal(totalMinutes + ' min');
      
      // Update header with sum of both
      if (!isPause) {
        window.weekTotalStopTime = totalMinutes;
      } else {
        window.weekTotalPauseTime = totalMinutes;
      }
      
      if (window.weekTotalStopTime !== undefined && window.weekTotalPauseTime !== undefined) {
        const headerEl = document.getElementById('week-total-time');
        if (headerEl) {
          const valueEl = headerEl.querySelector('.text-2xl');
          if (valueEl) valueEl.textContent = (window.weekTotalStopTime + window.weekTotalPauseTime).toString();
        }
      }
    };
    
    if (periods.length > 0) {
      fetchWeekTotal();
      
      // Auto-refresh co 10 sekund
      const interval = setInterval(fetchWeekTotal, 10000);
      return () => clearInterval(interval);
    }
  }, [periods, isPause, departmentId, supabase]);
  
  return <>{total}</>;
}

export default function DynamicWeekTable({ departmentId, supabase, editingRow, setEditingRow, editRowData, setEditRowData, savedProductionData, saveProductionData }) {
  const [periods, setPeriods] = React.useState([]);
  const [selectedWeek, setSelectedWeek] = React.useState(null);
  const [availableWeeks, setAvailableWeeks] = React.useState([]);
  
  // Funkcja do obliczania początku tygodnia (poniedziałek)
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };
  
  // Funkcja do formatowania tygodnia
  const formatWeek = (weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.getDate()}.${weekStart.getMonth() + 1} - ${weekEnd.getDate()}.${weekEnd.getMonth() + 1}.${weekStart.getFullYear()}`;
  };
  
  // Inicjalizacja - ustaw aktualny tydzień
  React.useEffect(() => {
    const currentWeekStart = getWeekStart(new Date());
    setSelectedWeek(currentWeekStart);
    
    // Pobierz dostępne tygodnie z bazy
    const fetchAvailableWeeks = async () => {
      const { data } = await supabase
        .from('downtimes')
        .select('start_time')
        .eq('department_id', departmentId)
        .order('start_time', { ascending: false });
      
      if (data && data.length > 0) {
        const weeks = new Set();
        data.forEach(d => {
          const weekStart = getWeekStart(new Date(d.start_time));
          weeks.add(weekStart.toISOString().split('T')[0]);
        });
        
        const sortedWeeks = Array.from(weeks)
          .map(w => new Date(w))
          .sort((a, b) => b - a);
        
        setAvailableWeeks(sortedWeeks);
      }
    };
    
    if (departmentId) {
      fetchAvailableWeeks();
    }
  }, [departmentId, supabase]);
  
  React.useEffect(() => {
    const generatePeriods = async () => {
      if (!selectedWeek) return;
      
      const days = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
      const weekStart = new Date(selectedWeek);
      const dates = [];
      const fullDates = [];
      
      // Generuj daty dla wybranego tygodnia
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        dates.push(`${date.getDate()}.${date.getMonth() + 1}.`);
        fullDates.push(date.toISOString().split('T')[0]);
      }
      
      const newPeriods = [];
      
      for (let i = 0; i < days.length; i++) {
        const dayStart = `${fullDates[i]}T06:00:00`;
        const dayEnd = `${fullDates[i]}T23:59:59`;
        
        // Pobierz omposting dla tego dnia
        const { data: ompostings } = await supabase
          .from('downtimes')
          .select('start_time, post_number')
          .eq('machine_id', 'm14')
          .gte('start_time', dayStart)
          .lte('start_time', dayEnd)
          .order('start_time', { ascending: true });
        
        // Sprawdź czy była jakakolwiek aktywność w tym dniu
        const { data: anyActivity } = await supabase
          .from('downtimes')
          .select('id')
          .gte('start_time', dayStart)
          .lte('start_time', dayEnd)
          .limit(1);
        
        // Pomiń dni bez aktywności (weekend bez pracy)
        if (!anyActivity || anyActivity.length === 0) {
          continue;
        }
        
        if (!ompostings || ompostings.length === 0) {
          // Brak omposting - jeden okres na cały dzień
          const endTime = days[i] === 'Fredag' ? 
            (anyActivity ? `${fullDates[i]}T23:20:00` : `${fullDates[i]}T14:00:00`) : 
            `${fullDates[i]}T23:20:00`;
          
          newPeriods.push({
            day: days[i],
            date: dates[i],
            startISO: dayStart,
            endISO: endTime
          });
        } else {
          // Pierwszy okres - od 06:00 do pierwszego omposting
          const firstOmposting = ompostings[0];
          newPeriods.push({
            day: days[i],
            date: dates[i],
            startISO: dayStart,
            endISO: firstOmposting.start_time
          });
          
          // Okresy między omposting
          for (let j = 0; j < ompostings.length; j++) {
            const currentOmposting = ompostings[j];
            const nextOmposting = ompostings[j + 1];
            const endTime = nextOmposting ? nextOmposting.start_time : `${fullDates[i]}T23:20:00`;
            
            newPeriods.push({
              day: days[i],
              date: dates[i],
              startISO: currentOmposting.start_time,
              endISO: endTime
            });
          }
        }
      }
      
      setPeriods(newPeriods);
    };
    
    generatePeriods();
  }, [supabase, selectedWeek, departmentId]);
  
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex items-center gap-4">
        <label className="font-semibold">Wybierz tydzień:</label>
        <select 
          value={selectedWeek ? selectedWeek.toISOString().split('T')[0] : ''} 
          onChange={(e) => setSelectedWeek(new Date(e.target.value))}
          className="px-3 py-1 border rounded"
        >
          {availableWeeks.map(week => (
            <option key={week.toISOString()} value={week.toISOString().split('T')[0]}>
              {formatWeek(week)}
            </option>
          ))}
        </select>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-semibold text-gray-700">Dag</th>
            <th className="text-left p-3 font-semibold text-gray-700">Dato</th>
            <th className="text-left p-3 font-semibold text-gray-700">Post nr</th>
            <th className="text-left p-3 font-semibold text-gray-700">Antall</th>
            <th className="text-left p-3 font-semibold text-gray-700">ALT</th>
            <th className="text-left p-3 font-semibold text-gray-700">Snitt lengde</th>
            <th className="text-left p-3 font-semibold text-gray-700">Sp vol l/stl</th>
            <th className="text-left p-3 font-semibold text-gray-700">Utbytte</th>
            <th className="text-left p-3 font-semibold text-gray-700">Start omposting</th>
            <th className="text-left p-3 font-semibold text-gray-700">Stop omposting</th>
            <th className="text-left p-3 font-semibold text-gray-700">Stop tid</th>
            <th className="text-left p-3 font-semibold text-gray-700">Ant. postojów</th>
            <th className="text-left p-3 font-semibold text-gray-700">Mat pause</th>
            <th className="text-left p-3 font-semibold text-gray-700">Handling</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((period, index) => {
            const rowId = `${period.day.toLowerCase()}-${index}`;
            const isEditing = editingRow === rowId;
            
            return (
              <tr key={rowId} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{period.day}</td>
                <td className="p-3">{period.date}</td>
                <td className="p-3 font-bold">
                  <PostNumberCell 
                    key={`post-${period.day}-${period.date}`}
                    start={period.startISO} 
                    end={period.endISO} 
                    isMonday={period.day === 'Mandag'} 
                    departmentId={departmentId} 
                    supabase={supabase} 
                  />
                </td>
                <td className="p-3">
                  {isEditing ? (
                    <input type="number" value={editRowData.antall || ''} onChange={(e) => setEditRowData({...editRowData, antall: e.target.value})} className="w-16 px-1 py-1 border rounded text-xs" placeholder="0" />
                  ) : (savedProductionData[rowId]?.antall || '-')}
                </td>
                <td className="p-3">
                  {isEditing ? (
                    <input type="number" value={editRowData.alt || ''} onChange={(e) => setEditRowData({...editRowData, alt: e.target.value})} className="w-16 px-1 py-1 border rounded text-xs" placeholder="0" />
                  ) : (savedProductionData[rowId]?.alt || '-')}
                </td>
                <td className="p-3">
                  {isEditing ? (
                    <input type="number" value={editRowData.snittLengde || ''} onChange={(e) => setEditRowData({...editRowData, snittLengde: e.target.value})} className="w-16 px-1 py-1 border rounded text-xs" placeholder="0" />
                  ) : (savedProductionData[rowId]?.snittLengde || '-')}
                </td>
                <td className="p-3">
                  {isEditing ? (
                    <input type="number" value={editRowData.spVol || ''} onChange={(e) => setEditRowData({...editRowData, spVol: e.target.value})} className="w-16 px-1 py-1 border rounded text-xs" placeholder="0" />
                  ) : (savedProductionData[rowId]?.spVol || '-')}
                </td>
                <td className="p-3">
                  {isEditing ? (
                    <input type="number" value={editRowData.utbytte || ''} onChange={(e) => setEditRowData({...editRowData, utbytte: e.target.value})} className="w-16 px-1 py-1 border rounded text-xs" placeholder="0" />
                  ) : (savedProductionData[rowId]?.utbytte || '-')}
                </td>
                <td className="p-3">
                  <OmpostingCell 
                    key={`start-${period.day}-${period.date}`}
                    start={period.startISO} 
                    end={period.endISO} 
                    isStart={true} 
                    dayName={period.day}
                    departmentId={departmentId} 
                    supabase={supabase} 
                  />
                </td>
                <td className="p-3">
                  <OmpostingCell 
                    key={`stop-${period.day}-${period.date}`}
                    start={period.startISO} 
                    end={period.endISO} 
                    isStart={false} 
                    dayName={period.day}
                    departmentId={departmentId} 
                    supabase={supabase} 
                  />
                </td>
                <td className="p-3">
                  <DowntimeCell start={period.startISO} end={period.endISO} isPause={false} departmentId={departmentId} supabase={supabase} />
                </td>
                <td className="p-3">
                  <DowntimeCountCell start={period.startISO} end={period.endISO} departmentId={departmentId} supabase={supabase} />
                </td>
                <td className="p-3">
                  <DowntimeCell start={period.startISO} end={period.endISO} isPause={true} departmentId={departmentId} supabase={supabase} />
                </td>
                <td className="p-3">
                  {isEditing ? (
                    <div className="flex gap-1">
                      <button onClick={async () => { 
                        const success = await saveProductionData(rowId, editRowData);
                        if (success) {
                          setEditingRow(null); 
                          setEditRowData({}); 
                        }
                      }} className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs">✓</button>
                      <button onClick={() => { setEditingRow(null); setEditRowData({}); }} className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingRow(rowId); setEditRowData({}); }} className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs">
                      Rediger
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          <tr className="border-b-2 border-gray-400 bg-gray-50 font-bold">
            <td className="p-3" colSpan={10}>UKE TOTALT:</td>
            <td className="p-3 text-center text-lg text-red-600">
              <WeekTotalCell periods={periods} isPause={false} departmentId={departmentId} supabase={supabase} />
            </td>
            <td className="p-3 text-center text-lg text-blue-600">
              <WeekTotalCountCell periods={periods} departmentId={departmentId} supabase={supabase} isPause={false} />
            </td>
            <td className="p-3 text-center text-lg text-orange-600">
              <WeekTotalCell periods={periods} isPause={true} departmentId={departmentId} supabase={supabase} />
              <div style={{display: 'none'}}>
                <WeekTotalCountCell periods={periods} departmentId={departmentId} supabase={supabase} isPause={true} />
              </div>
            </td>
            <td className="p-3"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

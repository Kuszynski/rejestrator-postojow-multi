// Helper do generowania dynamicznych wierszy dla Ukerapport

export function getWeekDays() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const days = [];
  const dayNames = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
  
  for (let i = 0; i <= (dayOfWeek === 0 ? 6 : dayOfWeek - 1); i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    
    days.push({
      name: dayNames[i],
      date: date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'numeric' }),
      fullDate: date.toISOString().split('T')[0]
    });
  }
  
  return days;
}

export function getWeekPeriods() {
  const days = getWeekDays();
  const periods = [];
  
  days.forEach((day, index) => {
    const nextDay = days[index + 1];
    const startISO = `${day.fullDate}T06:00:00`;
    const endISO = nextDay ? `${nextDay.fullDate}T06:00:00` : new Date().toISOString();
    
    periods.push({
      day: day.name,
      date: day.date,
      fullDate: day.fullDate,
      startTime: '06:00',
      endTime: nextDay ? '06:00' : new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
      startISO,
      endISO
    });
  });
  
  return periods;
}

export async function getWeekPeriodsWithOmposting(supabase) {
  const days = getWeekDays();
  const periods = [];
  
  for (const day of days) {
    const dayStart = `${day.fullDate}T06:00:00`;
    const dayEnd = `${day.fullDate}T23:59:59`;
    
    // Pobierz wszystkie omposting dla tego dnia
    const { data: ompostings } = await supabase
      .from('downtimes')
      .select('start_time, post_number')
      .eq('machine_id', 'm14')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time', { ascending: true });
    
    if (!ompostings || ompostings.length === 0) {
      // Brak omposting - jeden okres na cały dzień (kontynuacja poprzedniego postu)
      periods.push({
        day: day.name,
        date: day.date,
        fullDate: day.fullDate,
        startTime: '06:00',
        endTime: day.name === 'Fredag' ? '14:00' : '23:20',
        startISO: dayStart,
        endISO: day.name === 'Fredag' ? `${day.fullDate}T14:00:00` : `${day.fullDate}T23:20:00`
      });
    } else {
      // Pierwszy okres - od 06:00 do pierwszego omposting (tylko jeśli omposting nie jest o 06:00)
      const firstOmposting = ompostings[0];
      const firstOmpostingTime = new Date(firstOmposting.start_time);
      const firstOmpostingHour = firstOmpostingTime.getHours();
      const firstOmpostingMinute = firstOmpostingTime.getMinutes();
      
      if (!(firstOmpostingHour === 6 && firstOmpostingMinute === 0)) {
        periods.push({
          day: day.name,
          date: day.date,
          fullDate: day.fullDate,
          startTime: '06:00',
          endTime: new Date(firstOmposting.start_time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
          startISO: dayStart,
          endISO: firstOmposting.start_time
        });
      }
      
      // Okresy między omposting
      for (let i = 0; i < ompostings.length; i++) {
        const currentOmposting = ompostings[i];
        const nextOmposting = ompostings[i + 1];
        const endTime = nextOmposting ? nextOmposting.start_time : (day.name === 'Fredag' ? `${day.fullDate}T14:00:00` : `${day.fullDate}T23:20:00`);
        
        periods.push({
          day: day.name,
          date: day.date,
          fullDate: day.fullDate,
          startTime: new Date(currentOmposting.start_time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
          endTime: nextOmposting ? new Date(nextOmposting.start_time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : (day.name === 'Fredag' ? '14:00' : '23:20'),
          startISO: currentOmposting.start_time,
          endISO: endTime
        });
      }
    }
  }
  
  return periods;
}

'use client'
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Play, Pause, Clock, TrendingUp, BarChart3, Calendar, LogOut, AlertCircle, CheckCircle, Edit2, Trash2, Eye, Download, Wrench } from 'lucide-react';
import SimpleChart from './SimpleChart';
import MachineManager from './MachineManager';

interface Machine {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  username: string;
  role: string;
  name: string;
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
}



export default function DowntimeTracker() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeDowntimes, setActiveDowntimes] = useState<DowntimeEntry[]>([]);
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimeEntry[]>([]);
  const [commentModal, setCommentModal] = useState<DowntimeEntry | null>(null);
  const [comment, setComment] = useState('');
  const [view, setView] = useState('main');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [editModal, setEditModal] = useState<DowntimeEntry | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [postNumber, setPostNumber] = useState('');
  const [editPostNumber, setEditPostNumber] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPasswordForm, setNewPasswordForm] = useState({ password: '', confirm: '' });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('main');
  const [currentPostNumber, setCurrentPostNumber] = useState<string>('');
  const [newUser, setNewUser] = useState({ username: '', password: '' });

  useEffect(() => {
    loadMachines();
    loadUsers();
  }, []);

  useEffect(() => {
    if (machines.length > 0 && users.length > 0) {
      loadData();
    }
  }, [machines, users]);

  const loadMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading machines:', error);
        alert('Feil ved lasting av maskiner: ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        setMachines(data);
      } else {
        console.log('Ingen maskiner funnet i databasen');
        setMachines([]);
      }
    } catch (error) {
      console.error('Unexpected error loading machines:', error);
      alert('Nettverksfeil ved lasting av maskiner');
    }
  };

  useEffect(() => {
    if (user?.role === 'operator') {
      const interval = setInterval(() => {
        setActiveDowntimes(prev => [...prev]);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Auto-refresh data for managers and viewers
  useEffect(() => {
    if (user?.role === 'manager' || user?.role === 'admin' || user?.role === 'viewer') {
      const interval = setInterval(() => {
        loadData();
      }, user?.role === 'viewer' ? 5000 : 10000); // Viewers refresh every 5 seconds, managers every 10
      return () => clearInterval(interval);
    }
  }, [user, machines, users]);

  const loadData = async () => {
    console.log('Loading data from Supabase...');
    console.log('Machines available:', machines.length);
    console.log('Users available:', users.length);
    
    try {
      const { data, error } = await supabase
        .from('downtimes')
        .select('*')
        .order('start_time', { ascending: false });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Feil ved lasting av data fra Supabase:', error);
        setDowntimeHistory([]);
      } else {
        console.log('Raw data from Supabase:', data);
        const enrichedData = data.map(downtime => {
          const machine = machines.find(m => m.id === downtime.machine_id);
          const operator = users.find(u => u.id === downtime.operator_id);
          console.log(`Processing downtime ${downtime.id}: machine_id=${downtime.machine_id}, found machine:`, machine);
          return {
            id: downtime.id,
            machineId: downtime.machine_id,
            machineName: machine ? machine.name : `Ukjent maskin (${downtime.machine_id})`,
            startTime: new Date(downtime.start_time).getTime(),
            endTime: downtime.end_time ? new Date(downtime.end_time).getTime() : null,
            duration: downtime.duration,
            comment: downtime.comment,
            postNumber: downtime.post_number,
            photoUrl: downtime.photo_url,
            date: downtime.date,
            operatorId: downtime.operator_id,
            operatorName: operator ? operator.name : `Ukjent operator (${downtime.operator_id})`,
          };
        });
        console.log('Enriched data:', enrichedData);
        setDowntimeHistory(enrichedData);
        
        // Znajdź ostatni numer postu - najpierw z dzisiaj, potem z wczoraj
        const today = new Date().toISOString().split('T')[0];
        const todayOmpostings = enrichedData
          .filter(d => d.date === today && d.machineName === 'Omposting/Korigering' && d.postNumber)
          .sort((a, b) => b.startTime - a.startTime);
        
        if (todayOmpostings.length > 0) {
          console.log('Setting current post number from today:', todayOmpostings[0].postNumber);
          setCurrentPostNumber(todayOmpostings[0].postNumber);
        } else {
          // Jeśli nie ma z dzisiaj, szukaj z wczoraj
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          const yesterdayOmpostings = enrichedData
            .filter(d => d.date === yesterdayStr && d.machineName === 'Omposting/Korigering' && d.postNumber)
            .sort((a, b) => b.startTime - a.startTime);
          
          if (yesterdayOmpostings.length > 0) {
            console.log('Setting current post number from yesterday:', yesterdayOmpostings[0].postNumber);
            setCurrentPostNumber(yesterdayOmpostings[0].postNumber);
          } else {
            console.log('No ompostings found for today or yesterday');
          }
        }
      }
    } catch (error) {
      console.error('Uventet feil ved lasting av data:', error);
      setDowntimeHistory([]);
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_passwords')
        .select('user_id');

      if (error) {
        console.error('Feil ved lasting av brukere:', error);
        return;
      }

      const userList = data.map(u => ({
        id: u.user_id,
        username: u.user_id,
        role: u.user_id === 'admin' ? 'admin' : 
              u.user_id === 'sjef' ? 'manager' : 
              u.user_id === 'tv' ? 'viewer' : 'operator',
        name: u.user_id === 'operatør' ? 'Operatør' : 
              u.user_id === 'operator' ? 'Operator' :
              u.user_id === 'Dag' ? 'Dag' :
              u.user_id === 'dag' ? 'Dag' :
              u.user_id === 'Kveld' ? 'Kveld' :
              u.user_id === 'kveld' ? 'Kveld' :
              u.user_id === 'sjef' ? 'Sjef' :
              u.user_id === 'admin' ? 'Admin' :
              u.user_id === 'tv' ? 'TV Monitor' :
              u.user_id.charAt(0).toUpperCase() + u.user_id.slice(1)
      }));
      
      setUsers(userList);
    } catch (error) {
      console.error('Uventet feil ved lasting av brukere:', error);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    
    console.log('Login attempt:', loginForm.username);
    
    const foundUser = users.find(u => u.username === loginForm.username);
    if (!foundUser) {
      alert('Feil brukernavn. Tilgjengelige: ' + users.map(u => u.username).join(', '));
      return;
    }

    console.log('Found user:', foundUser);

    try {
      console.log('Checking password for user ID:', foundUser.id);
      const { data: userPassword, error } = await supabase
        .from('user_passwords')
        .select('password_hash')
        .eq('user_id', foundUser.id)
        .single();

      console.log('Supabase response:', { data: userPassword, error });

      // Hvis ingen passord funnet, vis opprett passord modal
      if (error?.code === 'PGRST116' || !userPassword) {
        console.log('No password found, showing create password modal');
        setSelectedUser(foundUser);
        setShowSetPassword(true);
        return;
      }

      // Hvis andre feil, vis feilmelding
      if (error) {
        console.error('Supabase error:', error);
        alert('Feil ved innlogging. Prøv igjen eller kontakt administrator.');
        return;
      }

      // Sjekk passord
      console.log('Checking password:', loginForm.password, 'vs', userPassword.password_hash);
      if (userPassword.password_hash === loginForm.password) {
        console.log('Password correct, logging in');
        setUser(foundUser);
        setLoginForm({ username: '', password: '' });
      } else {
        alert('Feil passord');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Nettverksfeil. Sjekk internettforbindelsen.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('main');
    setActiveDowntimes([]);
  };

  const setInitialPassword = async () => {
    if (!newPasswordForm.password || !newPasswordForm.confirm) {
      alert('Vennligst fyll ut alle felt');
      return;
    }

    if (newPasswordForm.password !== newPasswordForm.confirm) {
      alert('Passordene stemmer ikke overens');
      return;
    }

    if (newPasswordForm.password.length < 6) {
      alert('Passordet må være minst 6 tegn');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_passwords')
        .insert({
          user_id: selectedUser.id,
          password_hash: newPasswordForm.password
        });

      if (error) {
        console.error('Feil ved lagring av passord:', error);
        alert('Kunne ikke lagre passord: ' + error.message);
        return;
      }

      alert('Passord opprettet! Du kan nå logge inn.');
      setShowSetPassword(false);
      setNewPasswordForm({ password: '', confirm: '' });
      setSelectedUser(null);
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Nettverksfeil ved lagring av passord.');
    }
  };

  const changePassword = async () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      alert('Vennligst fyll ut alle felt');
      return;
    }

    if (passwordForm.new !== passwordForm.confirm) {
      alert('Nye passord stemmer ikke overens');
      return;
    }

    if (passwordForm.new.length < 6) {
      alert('Nytt passord må være minst 6 tegn');
      return;
    }

    try {
      // Hent nåværende passord fra Supabase
      const { data: currentPassword, error: fetchError } = await supabase
        .from('user_passwords')
        .select('password_hash')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('Feil ved henting av nåværende passord:', fetchError);
        alert('Kunne ikke hente nåværende passord: ' + fetchError.message);
        return;
      }
      
      if (currentPassword.password_hash !== passwordForm.current) {
        alert('Nåværende passord er feil');
        return;
      }

      // Oppdater passord i Supabase
      const { error: updateError } = await supabase
        .from('user_passwords')
        .update({ password_hash: passwordForm.new })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Feil ved oppdatering av passord:', updateError);
        alert('Kunne ikke endre passord: ' + updateError.message);
        return;
      }

      alert('Passord endret!');
      setShowPasswordChange(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Nettverksfeil ved endring av passord.');
    }
  };

  const startDowntime = (machine) => {
    const tempId = Date.now(); // Generujemy tymczasowe ID
    const newDowntime = {
      id: tempId, // Używamy tymczasowego ID
      machineId: machine.id,
      machineName: machine.name,
      startTime: Date.now(),
      operatorId: user.id,
      operatorName: user.name,
    };
    setActiveDowntimes([...activeDowntimes, newDowntime]);
  };

  const stopDowntime = (downtime) => {
    setCommentModal(downtime);
    if (downtime.machineName === 'Omposting/Korigering') {
      setPostNumber('');
    }
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

    const endTime = Date.now();
    const duration = Math.floor((endTime - commentModal.startTime) / 1000 / 60);

    // Jeśli to Omposting/Korigering, ustaw nowy numer postu
    if (commentModal.machineName === 'Omposting/Korigering' && postNumber.trim()) {
      console.log('Setting new current post number:', postNumber.trim());
      setCurrentPostNumber(postNumber.trim());
    }
    
    console.log('Using post number for this downtime:', commentModal.machineName === 'Omposting/Korigering' ? postNumber.trim() : currentPostNumber);
    
    const completedDowntimeForSupabase = {
      machine_id: commentModal.machineId,
      operator_id: user.id,
      start_time: new Date(commentModal.startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration: duration,
      comment: comment.trim(),
      post_number: commentModal.machineName === 'Omposting/Korigering' ? postNumber.trim() : currentPostNumber || null,
      date: new Date().toISOString().split('T')[0],
    };

    const { data, error } = await supabase
      .from('downtimes')
      .insert([completedDowntimeForSupabase])
      .select();

    if (error) {
      console.error('Feil ved lagring av stans til Supabase:', error);
      alert('Det oppstod en feil ved lagring av stansen.');
    } else {
      const newDowntimeFromSupabase = data[0];
      const machine = machines.find(m => m.id === newDowntimeFromSupabase.machine_id);
      const operator = users.find(u => u.id === newDowntimeFromSupabase.operator_id);

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
        operatorName: operator ? operator.name : 'Ukjent operator',
      };

      setDowntimeHistory(prev => [enrichedDowntime, ...prev]);
      setActiveDowntimes(activeDowntimes.filter(d => d.id !== commentModal.id));
      
      // Email alert for long downtimes (disabled for now)
      // if (duration > 60) {
      //   const alertData = {
      //     machine: commentModal.machineName,
      //     duration: duration,
      //     comment: comment.trim(),
      //     operator: user.name,
      //     startTime: new Date(commentModal.startTime).toLocaleString('nb-NO'),
      //     endTime: new Date(endTime).toLocaleString('nb-NO')
      //   };
      //   
      //   fetch('/api/send-alert', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(alertData)
      //   }).catch(err => console.log('Email alert failed:', err));
      //   
      //   console.log('Long downtime alert sent:', alertData);
      // }
      
      setCommentModal(null);
      setComment('');
      setPostNumber('');
    }
  }; // Dodano brakujący nawias klamrowy

  const openEditModal = (downtime) => {
    setEditModal(downtime);
    setEditComment(downtime.comment);
    setEditDuration(downtime.duration.toString());
    setEditPostNumber(downtime.postNumber || '');
    setEditPhoto(downtime.photoUrl || null);
    setPhotoFile(null);
  }; // Dodano brakujący nawias klamrowy

  const saveEdit = async () => {
    if (!editComment.trim()) {
      alert('Vennligst skriv inn årsak til stans');
      return;
    }

    const newDuration = parseInt(editDuration);
    if (isNaN(newDuration) || newDuration <= 0) {
      alert('Vennligst skriv inn gyldig varighet');
      return;
    }

    if (editModal.machineName === 'Omposting/Korigering' && !editPostNumber.trim()) {
      alert('Vennligst skriv inn Post Nr for omposting');
      return;
    }

    const { data, error } = await supabase
      .from('downtimes')
      .update({
        comment: editComment.trim(),
        duration: newDuration,
        post_number: editModal.machineName === 'Omposting/Korigering' ? editPostNumber.trim() : editModal.postNumber,
        photo_url: editPhoto
      })
      .eq('id', editModal.id)
      .select();

    if (error) {
      console.error('Feil ved oppdatering av stans i Supabase:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      alert(`Det oppstod en feil ved oppdatering av stansen: ${error.message || 'Ukjent feil'}`);
    } else {
      const updatedDowntimeFromSupabase = data[0];
      const machine = machines.find(m => m.id === updatedDowntimeFromSupabase.machine_id);
      const operator = users.find(u => u.id === updatedDowntimeFromSupabase.operator_id);

      const enrichedDowntime = {
        id: updatedDowntimeFromSupabase.id,
        machineId: updatedDowntimeFromSupabase.machine_id,
        machineName: machine ? machine.name : 'Ukjent maskin',
        startTime: new Date(updatedDowntimeFromSupabase.start_time).getTime(),
        endTime: new Date(updatedDowntimeFromSupabase.end_time).getTime(),
        duration: updatedDowntimeFromSupabase.duration,
        comment: updatedDowntimeFromSupabase.comment,
        postNumber: updatedDowntimeFromSupabase.post_number,
        photoUrl: updatedDowntimeFromSupabase.photo_url,
        date: updatedDowntimeFromSupabase.date,
        operatorId: updatedDowntimeFromSupabase.operator_id,
        operatorName: operator ? operator.name : 'Ukjent operator',
      };

      setDowntimeHistory(prev => prev.map(d => d.id === editModal.id ? enrichedDowntime : d));
      setEditModal(null);
      setEditComment('');
      setEditDuration('');
      setEditPostNumber('');
      setEditPhoto(null);
      setPhotoFile(null);
    }
  };

  const getProductionStats = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=niedziela, 1=poniedziałek, 5=piątek
    
    // Określ godziny produkcji
    const isSunday = dayOfWeek === 0; // tylko niedziela
    const isFriday = dayOfWeek === 5;
    
    let productionStart, productionEnd;
    
    if (isSunday) {
      // Niedziela - brak produkcji
      return [];
    } else if (isFriday) {
      // Piątek: 6:00 - 14:00
      productionStart = new Date(today);
      productionStart.setHours(6, 0, 0, 0);
      productionEnd = new Date(today);
      productionEnd.setHours(14, 0, 0, 0);
    } else {
      // Poniedziałek-Czwartek: 6:00 - 23:20
      productionStart = new Date(today);
      productionStart.setHours(6, 0, 0, 0);
      productionEnd = new Date(today);
      productionEnd.setHours(23, 20, 0, 0);
    }
    
    const todayStr = today.toISOString().split('T')[0];
    const todayDowntimes = downtimeHistory.filter(d => d.date === todayStr);
    
    // Znajdź wszystkie ompostingi z dzisiaj
    const ompostings = todayDowntimes
      .filter(d => d.machineName === 'Omposting/Korigering' && d.postNumber)
      .sort((a, b) => a.startTime - b.startTime);
    
    const productionPeriods = [];
    
    // Jeśli nie ma ompostingów, sprawdź czy jest kontynuacja z wczoraj
    if (ompostings.length === 0) {
      // Znajdź ostatni post z wczoraj
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const yesterdayOmpostings = downtimeHistory
        .filter(d => d.date === yesterdayStr && d.machineName === 'Omposting/Korigering' && d.postNumber)
        .sort((a, b) => b.startTime - a.startTime);
      
      if (yesterdayOmpostings.length > 0) {
        const lastPost = yesterdayOmpostings[0];
        const nonOmpostingDowntimes = todayDowntimes.filter(d => d.machineName !== 'Omposting/Korigering');
        const pauseDowntimes = nonOmpostingDowntimes.filter(d => d.machineName.toLowerCase().includes('pause'));
        const regularDowntimes = nonOmpostingDowntimes.filter(d => !d.machineName.toLowerCase().includes('pause'));
        
        productionPeriods.push({
          postNumber: lastPost.postNumber,
          startTime: productionStart.getTime(),
          endTime: productionEnd.getTime(),
          duration: Math.floor((productionEnd.getTime() - productionStart.getTime()) / 1000 / 60),
          downtimes: nonOmpostingDowntimes,
          totalDowntime: regularDowntimes.reduce((sum, d) => sum + d.duration, 0),
          totalPause: pauseDowntimes.reduce((sum, d) => sum + d.duration, 0),
          continued: true
        });
      }
    } else {
      // Pierwszy okres - od początku produkcji do pierwszego omposting
      const firstOmposting = ompostings[0];
      
      // Sprawdź czy jest kontynuacja z wczoraj
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const yesterdayOmpostings = downtimeHistory
        .filter(d => d.date === yesterdayStr && d.machineName === 'Omposting/Korigering' && d.postNumber)
        .sort((a, b) => b.startTime - a.startTime);
      
      if (yesterdayOmpostings.length > 0) {
        const lastPost = yesterdayOmpostings[0];
        const beforeFirstDowntimes = todayDowntimes.filter(d => 
          d.startTime < firstOmposting.startTime && d.machineName !== 'Omposting/Korigering'
        );
        const pauseDowntimes = beforeFirstDowntimes.filter(d => d.machineName.toLowerCase().includes('pause'));
        const regularDowntimes = beforeFirstDowntimes.filter(d => !d.machineName.toLowerCase().includes('pause'));
        
        productionPeriods.push({
          postNumber: lastPost.postNumber,
          startTime: productionStart.getTime(),
          endTime: firstOmposting.startTime,
          duration: Math.floor((firstOmposting.startTime - productionStart.getTime()) / 1000 / 60),
          downtimes: beforeFirstDowntimes,
          totalDowntime: regularDowntimes.reduce((sum, d) => sum + d.duration, 0),
          totalPause: pauseDowntimes.reduce((sum, d) => sum + d.duration, 0),
          continued: true
        });
      }
      
      // Okresy między ompostingami
      ompostings.forEach((omposting, idx) => {
        const nextOmposting = ompostings[idx + 1];
        const periodEnd = nextOmposting ? nextOmposting.startTime : productionEnd.getTime();
        
        const periodDowntimes = todayDowntimes.filter(d => {
          if (d.machineName === 'Omposting/Korigering') return false;
          if (d.startTime < omposting.startTime) return false;
          if (nextOmposting && d.startTime >= nextOmposting.startTime) return false;
          return true;
        });
        const pauseDowntimes = periodDowntimes.filter(d => d.machineName.toLowerCase().includes('pause'));
        const regularDowntimes = periodDowntimes.filter(d => !d.machineName.toLowerCase().includes('pause'));
        
        productionPeriods.push({
          postNumber: omposting.postNumber,
          startTime: omposting.startTime,
          endTime: periodEnd,
          duration: Math.floor((periodEnd - omposting.startTime) / 1000 / 60),
          downtimes: periodDowntimes,
          totalDowntime: regularDowntimes.reduce((sum, d) => sum + d.duration, 0),
          totalPause: pauseDowntimes.reduce((sum, d) => sum + d.duration, 0),
          continued: false,
          ompostingTime: new Date(omposting.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
        });
      });
    }
    
    return productionPeriods;
  };

  const getWeekStats = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1); // Poniedziałek
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Niedziela
    
    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = sunday.toISOString().split('T')[0];
    
    const weekDowntimes = downtimeHistory.filter(d => 
      d.date >= weekStart && d.date <= weekEnd
    );
    
    const dayStats = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(monday);
      currentDay.setDate(monday.getDate() + i);
      const dayStr = currentDay.toISOString().split('T')[0];
      const dayName = currentDay.toLocaleDateString('nb-NO', { weekday: 'long' });
      
      const dayDowntimes = weekDowntimes.filter(d => d.date === dayStr);
      const pauseDowntimes = dayDowntimes.filter(d => d.machineName.toLowerCase().includes('pause'));
      const regularDowntimes = dayDowntimes.filter(d => !d.machineName.toLowerCase().includes('pause'));
      const totalDowntime = regularDowntimes.reduce((sum, d) => sum + d.duration, 0);
      const totalPause = pauseDowntimes.reduce((sum, d) => sum + d.duration, 0);
      
      dayStats.push({
        date: dayStr,
        dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        downtimes: dayDowntimes,
        totalDuration: totalDowntime + totalPause,
        totalDowntime,
        totalPause,
        count: dayDowntimes.length
      });
    }
    
    const weekPauseDowntimes = weekDowntimes.filter(d => d.machineName.toLowerCase().includes('pause'));
    const weekRegularDowntimes = weekDowntimes.filter(d => !d.machineName.toLowerCase().includes('pause'));
    
    return {
      weekStart,
      weekEnd,
      dayStats,
      totalWeekDowntime: weekRegularDowntimes.reduce((sum, d) => sum + d.duration, 0),
      totalWeekPause: weekPauseDowntimes.reduce((sum, d) => sum + d.duration, 0),
      totalWeekCount: weekDowntimes.length
    };
  };

  const getPostingStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayDowntimes = downtimeHistory.filter(d => d.date === today);

    const ompostings = todayDowntimes
      .filter(d => d.machineName === 'Omposting/Korigering' && d.postNumber)
      .sort((a, b) => a.startTime - b.startTime);

    if (ompostings.length === 0) {
      const totalToday = todayDowntimes.reduce((sum, d) => sum + d.duration, 0);
      return [{
        postNumber: 'Start av dagen',
        startTime: null,
        downtimes: todayDowntimes,
        totalDuration: totalToday
      }];
    }

    const periods = [];

    const beforeFirst = todayDowntimes.filter(d =>
      d.startTime < ompostings[0].startTime && d.machineName !== 'Omposting/Korigering'
    );
    if (beforeFirst.length > 0) {
      periods.push({
        postNumber: 'Før Post ' + ompostings[0].postNumber,
        startTime: null,
        endTime: ompostings[0].startTime,
        downtimes: beforeFirst,
        totalDuration: beforeFirst.reduce((sum, d) => sum + d.duration, 0)
      });
    }

    ompostings.forEach((omposting, idx) => {
      const nextOmposting = ompostings[idx + 1];
      const periodDowntimes = todayDowntimes.filter(d => {
        // Uwzględnij sam omposting jako pierwszy w tabeli
        if (d.machineName === 'Omposting/Korigering' && d.id === omposting.id) return true;
        // Wyklucz inne ompostingi
        if (d.machineName === 'Omposting/Korigering') return false;
        if (d.startTime < omposting.startTime) return false;
        if (nextOmposting && d.startTime >= nextOmposting.startTime) return false;
        return true;
      });
      
      // Posortuj żeby omposting był pierwszy
      periodDowntimes.sort((a, b) => {
        if (a.machineName === 'Omposting/Korigering') return -1;
        if (b.machineName === 'Omposting/Korigering') return 1;
        return a.startTime - b.startTime;
      });

      const postStartTime = omposting.startTime;
      const postEndTime = nextOmposting ? nextOmposting.startTime : Date.now();
      const postDurationMinutes = Math.floor((postEndTime - postStartTime) / 1000 / 60);
      
      periods.push({
        postNumber: 'Post ' + omposting.postNumber,
        startTime: omposting.startTime,
        endTime: nextOmposting ? nextOmposting.startTime : null,
        downtimes: periodDowntimes,
        totalDuration: periodDowntimes.reduce((sum, d) => sum + d.duration, 0),
        ompostingTime: new Date(omposting.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
        postDurationMinutes: postDurationMinutes,
        postStartTime: new Date(postStartTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
        postEndTime: nextOmposting ? new Date(nextOmposting.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : 'Pågår'
      });
    });

    return periods;
  }; // Dodano brakujący nawias klamrowy

  const deleteDowntime = async (id) => {
    if (confirm('Er du sikker på at du vil slette denne stanseregistreringen?')) {
      const { error } = await supabase
        .from('downtimes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Feil ved sletting av stans fra Supabase:', error);
        alert('Det oppstod en feil ved sletting av stansen.');
      } else {
        setDowntimeHistory(prev => prev.filter(d => d.id !== id));
      }
    }
  };

  const handlePhotoUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Maksymalne wymiary - lepsza jakość
          const maxWidth = 800;
          const maxHeight = 600;
          
          let { width, height } = img;
          
          // Oblicz nowe wymiary zachowując proporcje
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Lepsza jakość - mniej agresywna kompresja
          let quality = 0.85;
          if (file.size > 5 * 1024 * 1024) quality = 0.7; // >5MB = 70%
          else if (file.size > 2 * 1024 * 1024) quality = 0.75; // >2MB = 75%
          else if (file.size > 1 * 1024 * 1024) quality = 0.8; // >1MB = 80%
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          setEditPhoto(compressedDataUrl);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
      setPhotoFile(file);
    }
  };

  const formatDuration = (startTime) => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getFilteredHistory = () => {
    if (!dateFilter.from && !dateFilter.to) return downtimeHistory;
    return downtimeHistory.filter(d => {
      if (dateFilter.from && d.date < dateFilter.from) return false;
      if (dateFilter.to && d.date > dateFilter.to) return false;
      return true;
    });
  };

  const getStats = () => {
    const filtered = getFilteredHistory();
    const totalDowntime = filtered.reduce((sum, d) => sum + d.duration, 0);
    const byMachine = {};
    const byDate = {};

    filtered.forEach(d => {
      byMachine[d.machineName] = (byMachine[d.machineName] || 0) + d.duration;
      byDate[d.date] = (byDate[d.date] || 0) + d.duration;
    });

    return { totalDowntime, byMachine, byDate, count: filtered.length };
  };

  const exportTodayToExcel = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayDowntimes = downtimeHistory.filter(d => d.date === today);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Dato,Tid Start,Tid Slutt,Maskin,Varighet (min),Årsak,Post Nr,Operatør\n";
    
    todayDowntimes.forEach(d => {
      const startTime = new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
      const endTime = new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
      csvContent += `${d.date},${startTime},${endTime},"${d.machineName}",${d.duration},"${d.comment}",${d.postNumber || ''},"${d.operatorName}"\n`;
    });
    
    // Legg til totaler
    const totalDuration = todayDowntimes.reduce((sum, d) => sum + d.duration, 0);
    csvContent += `\nTOTALT:,,,${todayDowntimes.length} stanser,${totalDuration} min,,,\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stanser_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTodayToPDF = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayDowntimes = downtimeHistory.filter(d => d.date === today);
    const productionStats = getProductionStats();
    
    // Create PDF content as HTML
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>Daglig Stanser Rapport - ${new Date().toLocaleDateString('nb-NO')}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 30px; 
              line-height: 1.4;
              color: #333;
            }
            h1 { 
              color: #1f2937; 
              font-size: 24px;
              margin-bottom: 5px;
              font-weight: bold;
            }
            h2 { 
              color: #374151; 
              font-size: 18px;
              margin-top: 25px;
              margin-bottom: 10px;
              font-weight: bold;
            }
            .date {
              font-size: 16px;
              margin-bottom: 25px;
              color: #666;
            }
            .summary {
              margin: 20px 0;
            }
            .summary p {
              margin: 8px 0;
              font-size: 14px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0;
              font-size: 12px;
            }
            th, td { 
              border: 1px solid #ccc; 
              padding: 8px; 
              text-align: left;
              vertical-align: top;
            }
            th { 
              background-color: #f5f5f5; 
              font-weight: bold;
              font-size: 11px;
            }
            .total-row { 
              background-color: #f9f9f9; 
              font-weight: bold;
            }
            .center { text-align: center; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>Daglig Stanser Rapport</h1>
          <div class="date">Dato: ${new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          
          <h2>Sammendrag</h2>
          <div class="summary">
            <p><strong>Totalt antall stanser:</strong> ${todayDowntimes.length}</p>
            <p><strong>Total stansetid:</strong> ${todayDowntimes.filter(d => !d.machineName.toLowerCase().includes('pause')).reduce((sum, d) => sum + d.duration, 0)} min</p>
            <p><strong>Total pause tid:</strong> ${todayDowntimes.filter(d => d.machineName.toLowerCase().includes('pause')).reduce((sum, d) => sum + d.duration, 0)} min</p>
          </div>

          <h2>Produksjonsoversikt</h2>
          <table>
            <thead>
              <tr>
                <th>Post Nr</th>
                <th>Periode</th>
                <th class="center">Varighet</th>
                <th class="center">Stansetid</th>
                <th class="center">Pause</th>
                <th class="center">Effektivitet</th>
                <th class="center">Antall Stanser</th>
              </tr>
            </thead>
            <tbody>
              ${productionStats.map(period => {
                const efficiency = period.duration > 0 ? Math.round(((period.duration - period.totalDowntime) / period.duration) * 100) : 100;
                return `
                  <tr>
                    <td>Post ${period.postNumber}${period.continued ? ' (fra i går)' : ''}</td>
                    <td>${new Date(period.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} - ${period.endTime <= Date.now() ? new Date(period.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : 'Pågår'}</td>
                    <td class="center">${period.duration} min</td>
                    <td class="center">${period.totalDowntime} min</td>
                    <td class="center">${period.totalPause || 0} min</td>
                    <td class="center">${efficiency}%</td>
                    <td class="center">${period.downtimes.length}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td colspan="2"><strong>TOTALT I DAG:</strong></td>
                <td class="center"><strong>${productionStats.reduce((sum, p) => sum + p.duration, 0)} min</strong></td>
                <td class="center"><strong>${productionStats.reduce((sum, p) => sum + p.totalDowntime, 0)} min</strong></td>
                <td class="center"><strong>${productionStats.reduce((sum, p) => sum + (p.totalPause || 0), 0)} min</strong></td>
                <td class="center"><strong>${(() => {
                  const totalDuration = productionStats.reduce((sum, p) => sum + p.duration, 0);
                  const totalDowntime = productionStats.reduce((sum, p) => sum + p.totalDowntime, 0);
                  return totalDuration > 0 ? Math.round(((totalDuration - totalDowntime) / totalDuration) * 100) : 100;
                })()}%</strong></td>
                <td class="center"><strong>${productionStats.reduce((sum, p) => sum + p.downtimes.length, 0)}</strong></td>
              </tr>
            </tbody>
          </table>

          <h2>Detaljerte stanser</h2>
          <table>
            <thead>
              <tr>
                <th class="center">#</th>
                <th>Tid</th>
                <th>Maskin</th>
                <th>Årsak</th>
                <th class="center">Varighet</th>
                <th class="center">Post Nr</th>
                <th>Operatør</th>
              </tr>
            </thead>
            <tbody>
              ${todayDowntimes.map((d, index) => `
                <tr>
                  <td class="center">${index + 1}</td>
                  <td>${new Date(d.startTime).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}-${new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>${d.machineName}${d.postNumber ? ` Post ${d.postNumber}` : ''}</td>
                  <td>${d.comment}</td>
                  <td class="center">${d.duration} min</td>
                  <td class="center">${d.postNumber || '-'}</td>
                  <td>${d.operatorName}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    // Open in new window for printing to PDF
    const newWindow = window.open('', '_blank');
    newWindow?.document.write(htmlContent);
    newWindow?.document.close();
    newWindow?.print();
  };

  const exportWeekToExcel = () => {
    const weekStats = getWeekStats();
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Dag,Dato,Antall Stanser,Total Stansetid (min),Gjennomsnitt (min)\n";
    
    weekStats.dayStats.forEach(day => {
      const avg = day.count > 0 ? Math.round(day.totalDuration / day.count) : 0;
      csvContent += `${day.dayName},${day.date},${day.count},${day.totalDuration},${avg}\n`;
    });
    
    csvContent += `\nUKE TOTALT:,${weekStats.weekStart} - ${weekStats.weekEnd},${weekStats.totalWeekCount},${weekStats.totalWeekDowntime},${weekStats.totalWeekCount > 0 ? Math.round(weekStats.totalWeekDowntime / weekStats.totalWeekCount) : 0}\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `uke_rapport_${weekStats.weekStart}_${weekStats.weekEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addNewUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim() || newUser.password.length < 6) {
      alert('Vennligst fyll ut alle felt. Passord må være minst 6 tegn.');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_passwords')
        .insert({
          user_id: newUser.username.trim(),
          password_hash: newUser.password
        });

      if (error) {
        if (error.code === '23505') {
          alert('Brukernavn eksisterer allerede. Velg et annet navn.');
        } else {
          alert('Feil ved opprettelse av bruker: ' + error.message);
        }
        return;
      }

      alert(`Operatør "${newUser.username}" ble opprettet!`);
      setNewUser({ username: '', password: '' });
      loadUsers(); // Refresh user list
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Nettverksfeil ved opprettelse av bruker.');
    }
  };

  const deleteUser = async (userId: string) => {
    if (userId === 'admin' || userId === 'sjef') {
      alert('Kan ikke slette administrator eller sjef.');
      return;
    }

    if (confirm(`Er du sikker på at du vil slette brukeren "${userId}"?`)) {
      try {
        const { error } = await supabase
          .from('user_passwords')
          .delete()
          .eq('user_id', userId);

        if (error) {
          alert('Feil ved sletting av bruker: ' + error.message);
          return;
        }

        alert(`Bruker "${userId}" ble slettet.`);
        loadUsers(); // Refresh user list
      } catch (err) {
        console.error('Unexpected error:', err);
        alert('Nettverksfeil ved sletting av bruker.');
      }
    }
  };

  const exportPostsToExcel = () => {
    const today = new Date().toISOString().split('T')[0];
    const postStats = getPostingStats();
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Post Periode,Stansetid (min),Antall Stanser,Detaljer\n";
    
    postStats.forEach(period => {
      csvContent += `"${period.postNumber}",${period.totalDuration},${period.downtimes.length},"${period.downtimes.map(d => `${d.machineName}: ${d.duration}min`).join('; ')}"\n`;
    });
    
    const totalDuration = postStats.reduce((sum, p) => sum + p.totalDuration, 0);
    csvContent += `\nTOTALT:,${totalDuration} min,${postStats.reduce((sum, p) => sum + p.downtimes.length, 0)} stanser,\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `post_rapport_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-xl">Laster...</div>
      </div>
    );
  }

  if (!user) {
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
                    <Clock className="w-16 h-16 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-green-400 rounded-full border-4 border-white shadow-sm"></div>
                </div>
                
                <h1 className="text-6xl font-bold text-gray-900 mb-6">Velkommen</h1>
                <p className="text-2xl text-gray-600 mb-8">Logg inn for å fortsette</p>
                
                {/* Location Info */}
                <div className="inline-flex items-center gap-4 px-8 py-4 bg-blue-50 rounded-full border border-blue-100">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span className="text-xl font-medium text-blue-700">Haslestad</span>
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
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    className="w-full bg-beerenberg-red hover:bg-opacity-90 text-white font-bold py-8 px-12 rounded-3xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-beerenberg-red focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] text-2xl min-h-[100px]"
                  >
                    Logg inn
                  </button>
                </div>
              </form>
            </div>
          </div>
          

        </div>
        
        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-[10px] text-gray-400">
            © 2025 Kuszynski
          </p>
        </div>
      </div>
    );
  }

  if (user.role === 'viewer') {
    const todayDowntimes = downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">📺 TV Monitor</h1>
            <p className="text-xl text-gray-300">
              {new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Logg ut
              </button>
            </div>
          </div>

          {/* Active Downtimes */}
          {(() => {
            const activeDowntimes = todayDowntimes.filter(d => !d.endTime);
            return activeDowntimes.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 text-red-400">🚨 AKTIVE STANSER</h2>
                <div className="grid gap-4">
                  {activeDowntimes.map(downtime => {
                    const duration = Math.floor((Date.now() - downtime.startTime) / 1000 / 60);
                    return (
                      <div key={downtime.id} className="bg-red-900/50 border border-red-500 rounded-xl p-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-xl font-bold text-red-300">{downtime.machineName}</h3>
                            <p className="text-gray-300">Start: {new Date(downtime.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-gray-300">Årsak: {downtime.comment}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-red-400">{duration} min</div>
                            <div className="text-sm text-gray-400">varighet</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Today's Downtimes */}
          <div>
            <h2 className="text-2xl font-bold mb-4">📋 DAGENS STANSER ({todayDowntimes.length})</h2>
            {todayDowntimes.length === 0 ? (
              <div className="bg-green-900/30 border border-green-500 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-green-400">Ingen stanser i dag</h3>
                <p className="text-gray-300">Perfekt produksjon!</p>
              </div>
            ) : (
              <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-700">
                      <th className="text-left p-4 font-bold">Tid</th>
                      <th className="text-left p-4 font-bold">Maskin</th>
                      <th className="text-left p-4 font-bold">Årsak</th>
                      <th className="text-right p-4 font-bold">Varighet</th>
                      <th className="text-left p-4 font-bold">Operatør</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayDowntimes.map((d, index) => {
                      const isActive = !d.endTime;
                      return (
                        <tr key={d.id} className={`border-b border-slate-600 ${isActive ? 'bg-red-900/30' : 'hover:bg-slate-700/50'}`}>
                          <td className="p-4">
                            <div className="text-sm">
                              {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                              {d.endTime && (
                                <span> - {new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-medium">{d.machineName}</span>
                            {isActive && <span className="ml-2 text-red-400 animate-pulse">🔴 AKTIV</span>}
                          </td>
                          <td className="p-4">
                            <div className="max-w-xs truncate">{d.comment}</div>
                          </td>
                          <td className="p-4 text-right">
                            <span className={`font-bold ${
                              isActive ? 'text-red-400' :
                              d.duration > 60 ? 'text-red-400' :
                              d.duration > 30 ? 'text-yellow-400' :
                              'text-green-400'
                            }`}>
                              {isActive ? 
                                Math.floor((Date.now() - d.startTime) / 1000 / 60) + ' min' :
                                d.duration + ' min'
                              }
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-gray-300">{d.operatorName}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (user.role === 'operator' || user.role === 'admin') {
    const todayDowntimes = downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]);

    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col px-2 py-2">
          {/* Modern Header */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-4 mb-4 flex-shrink-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-1">Hei, {user.name}!</h1>
                  <p className="text-gray-600 text-sm">Klar for å registrere stanser</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm transition-colors"
                >
                  🔑 Passord
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm transition-colors"
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
                    ? 'bg-white text-beerenberg-red shadow-lg' 
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
                    ? 'bg-white text-beerenberg-red shadow-lg' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>I dag</span>
                {todayDowntimes.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {todayDowntimes.length}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setView('week')}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center text-sm ${
                  view === 'week' 
                    ? 'bg-white text-beerenberg-red shadow-lg' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Uke
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {view === 'main' && (
              <>
                {activeDowntimes.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">Aktive stanser</h2>
                        <p className="text-gray-600 text-sm">Trykk for å avslutte stans</p>
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
                            <div className="flex gap-3">
                              <button
                                onClick={() => {
                                  if (confirm('Er du sikker på at du vil slette denne registreringen?')) {
                                    setActiveDowntimes(activeDowntimes.filter(d => d.id !== downtime.id));
                                  }
                                }}
                                className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-2xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                                title="Slett registrering uten å lagre"
                              >
                                <Trash2 className="w-5 h-5" />
                                Slett
                              </button>
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
                            // Active state
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
                            // Inactive state
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
                      
                          {/* Glow effect for active machines */}
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
          </div>

          {view === 'today' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      
                    </h2>
                    <p className="text-blue-100">
                      {new Date().toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{todayDowntimes.length}</div>
                      <div className="text-blue-100 text-sm">stanser</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={exportTodayToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                      >
                        <Download className="w-4 h-4" />
                        Excel
                      </button>
                      <button
                        onClick={exportTodayToPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                      >
                        📄 PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela podsumowania produkcji */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="p-4 bg-gray-50 border-b">
                  <h3 className="text-lg font-semibold text-gray-800">Produksjonsoversikt</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="text-left p-4 font-semibold text-gray-700">Periode</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Post</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Varighet</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Stansetid</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Pause</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Effektivitet</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Antall Stanser</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getProductionStats().map((period, idx) => {
                        const efficiency = period.duration > 0 ? Math.round(((period.duration - period.totalDowntime) / period.duration) * 100) : 100;
                        const downtimePercent = period.duration > 0 ? Math.round((period.totalDowntime / period.duration) * 100) : 0;
                        
                        return (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">
                                  {period.continued ? '🔄' : '🎆'}
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(period.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} - 
                                  {period.endTime <= Date.now() ? 
                                    new Date(period.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : 
                                    'Pågår'
                                  }
                                  {period.continued && <span className="text-xs text-blue-600 ml-2">(fra i går)</span>}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <span className="font-bold text-gray-900">
                                {period.postNumber}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-lg font-bold text-blue-600">{period.duration} min</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-lg font-bold text-red-600">{period.totalDowntime} min</span>
                              <span className="text-xs text-gray-500 ml-1">({downtimePercent}%)</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-lg font-bold text-orange-600">{period.totalPause || 0} min</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`text-lg font-bold ${
                                efficiency >= 90 ? 'text-green-600' :
                                efficiency >= 80 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {efficiency}%
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-lg font-bold text-gray-700">{period.downtimes.length}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2">
                        <td className="p-4 font-semibold text-gray-800">TOTALT I DAG:</td>
                        <td className="p-4 text-center font-semibold text-gray-800">-</td>
                        <td className="p-4 text-center">
                          <span className="text-xl font-bold text-blue-600">
                            {getProductionStats().reduce((sum, p) => sum + p.duration, 0)} min
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-xl font-bold text-red-600">
                            {getProductionStats().reduce((sum, p) => sum + p.totalDowntime, 0)} min
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-xl font-bold text-orange-600">
                            {getProductionStats().reduce((sum, p) => sum + (p.totalPause || 0), 0)} min
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-xl font-bold text-gray-700">
                            {(() => {
                              const totalDuration = getProductionStats().reduce((sum, p) => sum + p.duration, 0);
                              const totalDowntime = getProductionStats().reduce((sum, p) => sum + p.totalDowntime, 0);
                              return totalDuration > 0 ? Math.round(((totalDuration - totalDowntime) / totalDuration) * 100) : 100;
                            })()}%
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-xl font-bold text-gray-700">
                            {getProductionStats().reduce((sum, p) => sum + p.downtimes.length, 0)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="pb-8"></div>
              </div>

              {/* Szczegółowa tabela postojów */}
              <div className="mt-24"></div>
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
                  <div className="p-4 bg-gray-50 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Detaljerte stanser i dag</h3>
                  </div>
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
                                  {d.photoUrl && (
                                    <div className="mt-2">
                                      <img 
                                        src={d.photoUrl} 
                                        alt="Stans foto" 
                                        className="w-12 h-12 object-cover rounded border cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => {
                                          const newWindow = window.open();
                                          newWindow?.document.write(`<img src="${d.photoUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />`);
                                        }}
                                        title="Klikk for å se større bilde"
                                      />
                                    </div>
                                  )}
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
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(d)}
                                    className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                                    title="Rediger"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteDowntime(d.id)}
                                    className="p-2 bg-beerenberg-red/10 hover:bg-beerenberg-red/20 text-beerenberg-red rounded-lg transition-colors"
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
          )}

          {view === 'posts' && (
            <div className="space-y-6">
              {/* Header with stats */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-1">Dagens stanser</h2>
                    <p className="text-gray-500">{new Date().toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <button
                    onClick={exportTodayToExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Eksporter
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-2xl font-semibold text-gray-900">{todayDowntimes.length}</div>
                    <div className="text-sm text-gray-500 mt-1">Stanser</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-2xl font-semibold text-red-500">{todayDowntimes.reduce((sum, d) => sum + d.duration, 0)}</div>
                    <div className="text-sm text-gray-500 mt-1">Minutter</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-2xl font-semibold text-gray-900">
                      {todayDowntimes.length > 0 ? Math.round(todayDowntimes.reduce((sum, d) => sum + d.duration, 0) / todayDowntimes.length) : 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Gjennomsnitt</div>
                  </div>
                </div>
              </div>

              {/* Content */}
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
                                <div className="text-sm">
                                  <div className="font-medium text-gray-700 mb-1">
                                    {new Date(d.startTime).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </div>
                                  <div className="font-medium text-gray-900">
                                    {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                  </div>

                                  <div className="text-gray-500">
                                    {new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div>
                                  <div className="font-medium text-gray-900">{d.machineName}</div>
                                  {d.postNumber && (
                                    <div className="text-xs text-blue-600 mt-1">Post {d.postNumber}</div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-gray-700 max-w-xs">
                                  {d.comment.length > 50 ? d.comment.substring(0, 50) + '...' : d.comment}
                                  {d.photoUrl && (
                                    <div className="mt-2">
                                      <img 
                                        src={d.photoUrl} 
                                        alt="Stans foto" 
                                        className="w-12 h-12 object-cover rounded border cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => {
                                          const newWindow = window.open();
                                          newWindow?.document.write(`<img src="${d.photoUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />`);
                                        }}
                                        title="Klikk for å se større bilde"
                                      />
                                    </div>
                                  )}
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
                                      #{d.postNumber}
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
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(d)}
                                    className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                                    title="Rediger"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteDowntime(d.id)}
                                    className="p-2 bg-beerenberg-red/10 hover:bg-beerenberg-red/20 text-beerenberg-red rounded-lg transition-colors"
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
          )}

          {view === 'posts' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      📈 Dag Rapport
                    </h2>
                    <p className="text-green-100">{new Date().toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{getPostingStats().length}</div>
                      <div className="text-green-100 text-sm">perioder</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{getPostingStats().reduce((sum, p) => sum + p.totalDuration, 0)}</div>
                      <div className="text-green-100 text-sm">min total</div>
                    </div>
                    <button
                      onClick={exportPostsToExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-white/30"
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Detaljert tabell for hver post periode */}
              <div className="space-y-6">
                {getPostingStats().map((period, idx) => {
                  const isFirstPost = idx === 0;
                  const statusColor = period.totalDuration === 0 
                    ? 'from-green-500 to-green-600' 
                    : period.totalDuration > 60 
                      ? 'from-red-500 to-red-600'
                      : 'from-yellow-500 to-yellow-600';
                  
                  return (
                    <div key={idx} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                      {/* Post header */}
                      <div className={`bg-gradient-to-r ${statusColor} text-white p-4`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">
                              {isFirstPost ? '🌅' : '🔄'}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">{period.postNumber}</h3>
                              {period.ompostingTime && (
                                <div className="text-sm opacity-90">
                                  <p>Omposting: {period.ompostingTime}</p>
                                  <p>Post varighet: {period.postStartTime} - {period.postEndTime} ({period.postDurationMinutes} min)</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">{period.totalDuration} min</div>
                            <div className="text-sm opacity-90">{period.downtimes.length} stanser</div>
                          </div>
                        </div>
                      </div>

                      {/* Stanser i denne perioden */}
                      {period.downtimes.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Maskin</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Start Dato/Tid</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Slutt Dato/Tid</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Varighet</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Post Nr</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Årsak</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Operatør</th>
                              </tr>
                            </thead>
                            <tbody>
                              {period.downtimes.map((d, dIdx) => {
                                const machine = machines.find(m => m.name === d.machineName);
                                const startDate = new Date(d.startTime);
                                const endDate = new Date(d.endTime);
                                
                                return (
                                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${machine?.color || 'bg-gray-400'}`}></div>
                                        <span className="font-medium text-gray-800">{d.machineName}</span>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm">
                                        <div className="font-medium text-gray-800">
                                          {startDate.toLocaleDateString('nb-NO', { 
                                            day: '2-digit', 
                                            month: '2-digit', 
                                            year: 'numeric' 
                                          })}
                                        </div>
                                        <div className="text-gray-600">
                                          {startDate.toLocaleTimeString('nb-NO', { 
                                            hour: '2-digit', 
                                            minute: '2-digit',
                                            second: '2-digit'
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm">
                                        <div className="font-medium text-gray-800">
                                          {endDate.toLocaleDateString('nb-NO', { 
                                            day: '2-digit', 
                                            month: '2-digit', 
                                            year: 'numeric' 
                                          })}
                                        </div>
                                        <div className="text-gray-600">
                                          {endDate.toLocaleTimeString('nb-NO', { 
                                            hour: '2-digit', 
                                            minute: '2-digit',
                                            second: '2-digit'
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <span className="text-lg font-bold text-red-600">{d.duration} min</span>
                                    </td>
                                    <td className="p-3">
                                      {d.postNumber ? (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                          #{d.postNumber}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 text-xs">-</span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm text-gray-700 max-w-xs">
                                        {d.comment}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm text-gray-600">{d.operatorName}</div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-50 border-t-2">
                                <td className="p-3 font-semibold text-gray-800">Periode totalt:</td>
                                <td colSpan={2} className="p-3 text-sm text-gray-600">
                                  {period.downtimes.length} stanser
                                </td>
                                <td className="p-3">
                                  <span className="text-lg font-bold text-red-600">{period.totalDuration} min</span>
                                </td>
                                <td colSpan={3} className="p-3 text-sm text-gray-600">
                                  Gjennomsnitt: {period.downtimes.length > 0 ? Math.round(period.totalDuration / period.downtimes.length) : 0} min/stans
                                </td>
                              </tr>
                              <tr className="bg-blue-50 border-t">
                                <td className="p-3 font-semibold text-blue-800">Post sammendrag:</td>
                                <td colSpan={2} className="p-3 text-sm text-blue-700">
                                  Varighet: {period.postDurationMinutes} min
                                </td>
                                <td className="p-3">
                                  <span className="text-sm font-medium text-blue-700">
                                    {period.totalDuration > 0 ? Math.round((period.totalDuration / period.postDurationMinutes) * 100) : 0}% stansetid
                                  </span>
                                </td>
                                <td colSpan={3} className="p-3 text-sm text-blue-700">
                                  Effektivitet: {period.totalDuration > 0 ? Math.round(((period.postDurationMinutes - period.totalDuration) / period.postDurationMinutes) * 100) : 100}%
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <div className="text-4xl mb-2">🎉</div>
                          <p className="text-lg font-semibold text-gray-800">Ingen stanser i denne perioden!</p>
                          <p className="text-gray-600">Perfekt produksjon.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>


            </div>
          )}

          {view === 'week' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      📅 UKE Rapport
                    </h2>
                    <p className="text-purple-100">
                      {(() => {
                        const weekStats = getWeekStats();
                        return `${weekStats.weekStart} - ${weekStats.weekEnd}`;
                      })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{getWeekStats().totalWeekCount}</div>
                      <div className="text-purple-100 text-sm">stanser</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{getWeekStats().totalWeekDowntime}</div>
                      <div className="text-purple-100 text-sm">min total</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={exportWeekToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                      >
                        <Download className="w-4 h-4" />
                        Excel
                      </button>
                      <button
                        onClick={() => {
                          const weekStats = getWeekStats();
                          const weekDowntimes = downtimeHistory.filter(d => 
                            d.date >= weekStats.weekStart && d.date <= weekStats.weekEnd
                          ).sort((a, b) => b.startTime - a.startTime);
                          
                          const htmlContent = `
                            <html>
                              <head>
                                <meta charset="utf-8">
                                <title>Ukentlig Stanser Rapport - ${weekStats.weekStart} til ${weekStats.weekEnd}</title>
                                <style>
                                  body { font-family: Arial, sans-serif; margin: 30px; line-height: 1.4; color: #333; }
                                  h1 { color: #1f2937; font-size: 24px; margin-bottom: 5px; font-weight: bold; }
                                  h2 { color: #374151; font-size: 18px; margin-top: 25px; margin-bottom: 10px; font-weight: bold; }
                                  .date { font-size: 16px; margin-bottom: 25px; color: #666; }
                                  .summary { margin: 20px 0; }
                                  .summary p { margin: 8px 0; font-size: 14px; }
                                  table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
                                  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
                                  th { background-color: #f5f5f5; font-weight: bold; font-size: 11px; }
                                  .total-row { background-color: #f9f9f9; font-weight: bold; }
                                  .center { text-align: center; }
                                  .right { text-align: right; }
                                </style>
                              </head>
                              <body>
                                <h1>Ukentlig Stanser Rapport</h1>
                                <div class="date">Uke: ${weekStats.weekStart} - ${weekStats.weekEnd}</div>
                                
                                <h2>Sammendrag</h2>
                                <div class="summary">
                                  <p><strong>Totalt antall stanser:</strong> ${weekStats.totalWeekCount}</p>
                                  <p><strong>Total stansetid:</strong> ${weekStats.totalWeekDowntime} min</p>
                                  <p><strong>Total pause tid:</strong> ${weekStats.totalWeekPause} min</p>
                                </div>

                                <h2>Daglig oversikt</h2>
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Dag</th>
                                      <th>Dato</th>
                                      <th class="center">Antall Stanser</th>
                                      <th class="center">Stansetid</th>
                                      <th class="center">Pause</th>
                                      <th class="center">Gjennomsnitt</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    ${weekStats.dayStats.map(day => `
                                      <tr>
                                        <td>${day.dayName}</td>
                                        <td>${new Date(day.date).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                        <td class="center">${day.count}</td>
                                        <td class="center">${day.totalDowntime} min</td>
                                        <td class="center">${day.totalPause} min</td>
                                        <td class="center">${Math.round(day.totalDuration / (day.count || 1))} min</td>
                                      </tr>
                                    `).join('')}
                                    <tr class="total-row">
                                      <td colspan="2"><strong>UKE TOTALT:</strong></td>
                                      <td class="center"><strong>${weekStats.totalWeekCount}</strong></td>
                                      <td class="center"><strong>${weekStats.totalWeekDowntime} min</strong></td>
                                      <td class="center"><strong>${weekStats.totalWeekPause} min</strong></td>
                                      <td class="center"><strong>${weekStats.totalWeekCount > 0 ? Math.round((weekStats.totalWeekDowntime + weekStats.totalWeekPause) / weekStats.totalWeekCount) : 0} min</strong></td>
                                    </tr>
                                  </tbody>
                                </table>

                                <h2>Detaljerte stanser</h2>
                                <table>
                                  <thead>
                                    <tr>
                                      <th class="center">#</th>
                                      <th>Dag</th>
                                      <th>Tid</th>
                                      <th>Maskin</th>
                                      <th>Årsak</th>
                                      <th class="center">Varighet</th>
                                      <th class="center">Post Nr</th>
                                      <th>Operatør</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    ${weekDowntimes.map((d, index) => `
                                      <tr>
                                        <td class="center">${index + 1}</td>
                                        <td>${new Date(d.startTime).toLocaleDateString('nb-NO', { weekday: 'long' })} ${new Date(d.startTime).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}</td>
                                        <td>${new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}-${new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td>${d.machineName}</td>
                                        <td>${d.comment}</td>
                                        <td class="center">${d.duration} min</td>
                                        <td class="center">${d.postNumber || '-'}</td>
                                        <td>${d.operatorName}</td>
                                      </tr>
                                    `).join('')}
                                  </tbody>
                                </table>
                              </body>
                            </html>
                          `;
                          
                          const newWindow = window.open('', '_blank');
                          newWindow?.document.write(htmlContent);
                          newWindow?.document.close();
                          newWindow?.print();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                      >
                        📄 PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tygodniowa tabela */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-4 font-semibold text-gray-700">Dag</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Dato</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Antall Stanser</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Stansetid</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Gjennomsnitt</th>
                        <th className="text-center p-4 font-semibold text-gray-700">Pause</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getWeekStats().dayStats.map((day, index) => {
                        const isToday = day.date === new Date().toISOString().split('T')[0];
                        const avg = day.count > 0 ? Math.round(day.totalDuration / day.count) : 0;
                        
                        return (
                          <tr key={day.date} className={`border-b border-gray-100 hover:bg-gray-50 ${
                            isToday ? 'bg-blue-50' : ''
                          }`}>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {isToday && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                                <span className={`font-medium ${
                                  isToday ? 'text-blue-700' : 'text-gray-900'
                                }`}>
                                  {day.dayName}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-gray-700">
                                {new Date(day.date).toLocaleDateString('nb-NO', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-lg font-bold text-blue-600">{day.count}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-lg font-bold text-red-600">{day.totalDowntime} min</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-gray-700">{Math.round(day.totalDuration / (day.count || 1))} min</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-lg font-bold text-orange-600">{day.totalPause} min</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2">
                        <td className="p-4 font-semibold text-gray-800" colSpan={2}>UKE TOTALT:</td>
                        <td className="p-4 text-center">
                          <span className="text-xl font-bold text-blue-600">{getWeekStats().totalWeekCount}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-xl font-bold text-red-600">{getWeekStats().totalWeekDowntime} min</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-gray-700">
                            {getWeekStats().totalWeekCount > 0 ? Math.round((getWeekStats().totalWeekDowntime + getWeekStats().totalWeekPause) / getWeekStats().totalWeekCount) : 0} min
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-xl font-bold text-orange-600">{getWeekStats().totalWeekPause} min</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Detaljerte stanser for hele uken */}
              <div className="mt-24"></div>
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                  <h3 className="text-lg font-semibold text-gray-800">Detaljerte stanser denne uken</h3>
                </div>
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
                      {(() => {
                        const weekStats = getWeekStats();
                        const weekDowntimes = downtimeHistory.filter(d => 
                          d.date >= weekStats.weekStart && d.date <= weekStats.weekEnd
                        ).sort((a, b) => b.startTime - a.startTime);
                        
                        return weekDowntimes.map((d, index) => {
                          const machine = machines.find(m => m.name === d.machineName);
                          const dayName = new Date(d.startTime).toLocaleDateString('nb-NO', { weekday: 'long' });
                          
                          return (
                            <tr key={d.id} className="border-b-4 border-gray-400 hover:bg-gray-50 transition-colors">
                              <td className="p-4">
                                <div className={`w-8 h-8 ${machine?.color || 'bg-gray-500'} text-white rounded-lg flex items-center justify-center font-semibold text-sm`}>
                                  {index + 1}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="font-medium text-gray-900 capitalize">{dayName} {new Date(d.startTime).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}</span>
                              </td>
                              <td className="p-4">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}-{new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="font-medium text-gray-900">
                                  {d.machineName}{d.postNumber && <span className="text-xs text-blue-600 ml-2">Post {d.postNumber}</span>}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-gray-700 max-w-xs">
                                  {d.comment.length > 50 ? d.comment.substring(0, 50) + '...' : d.comment}
                                  {d.photoUrl && (
                                    <div className="mt-2">
                                      <img 
                                        src={d.photoUrl} 
                                        alt="Stans foto" 
                                        className="w-12 h-12 object-cover rounded border cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => {
                                          const newWindow = window.open();
                                          newWindow?.document.write(`<img src="${d.photoUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />`);
                                        }}
                                        title="Klikk for å se større bilde"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded text-sm font-medium ${
                                  d.machineName.toLowerCase().includes('pause') ? 'bg-orange-100 text-orange-800' :
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
                        });
                      })()
                      }
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {view === 'production' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      🏢 Produksjon
                    </h2>
                    <p className="text-orange-100">
                      {new Date().toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-orange-200 text-sm mt-1">
                      {(() => {
                        const today = new Date();
                        const dayOfWeek = today.getDay();
                        const isFriday = dayOfWeek === 5;
                        const isSunday = dayOfWeek === 0;
                        
                        if (isSunday) return 'Ingen produksjon på søndag';
                        if (isFriday) return 'Produksjonstid: 06:00 - 14:00';
                        return 'Produksjonstid: 06:00 - 23:20';
                      })()} 
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{getProductionStats().length}</div>
                    <div className="text-orange-100 text-sm">post perioder</div>
                  </div>
                </div>
              </div>

              {/* Produksjonstabeller */}
              {getProductionStats().length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                  <div className="text-4xl mb-4">😴</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Ingen produksjon i dag</h3>
                  <p className="text-gray-500">Helg eller ingen registrerte poster.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b-2 border-gray-200">
                          <th className="text-left p-4 font-semibold text-gray-700">Post Nr</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Periode</th>
                          <th className="text-center p-4 font-semibold text-gray-700">Varighet</th>
                          <th className="text-center p-4 font-semibold text-gray-700">Stansetid</th>
                          <th className="text-center p-4 font-semibold text-gray-700">Effektivitet</th>
                          <th className="text-center p-4 font-semibold text-gray-700">Antall Stanser</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getProductionStats().map((period, idx) => {
                          const efficiency = period.duration > 0 ? Math.round(((period.duration - period.totalDowntime) / period.duration) * 100) : 100;
                          const downtimePercent = period.duration > 0 ? Math.round((period.totalDowntime / period.duration) * 100) : 0;
                          
                          return (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">
                                    {period.continued ? '🔄' : '🎆'}
                                  </span>
                                  <span className="font-bold text-gray-900">
                                    Post {period.postNumber}{period.continued && <span className="text-xs text-blue-600 ml-1">(fra i går)</span>}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(period.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} - 
                                  {period.endTime <= Date.now() ? 
                                    new Date(period.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : 
                                    'Pågår'
                                  }
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span className="text-lg font-bold text-blue-600">{period.duration} min</span>
                              </td>
                              <td className="p-4 text-center">
                                <span className="text-lg font-bold text-red-600">{period.totalDowntime} min</span>
                                <span className="text-xs text-gray-500 ml-1">({downtimePercent}%)</span>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`text-lg font-bold ${
                                  efficiency >= 90 ? 'text-green-600' :
                                  efficiency >= 80 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {efficiency}%
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span className="text-lg font-bold text-gray-700">{period.downtimes.length}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2">
                          <td className="p-4 font-semibold text-gray-800" colSpan={2}>TOTALT I DAG:</td>
                          <td className="p-4 text-center">
                            <span className="text-xl font-bold text-blue-600">
                              {getProductionStats().reduce((sum, p) => sum + p.duration, 0)} min
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-xl font-bold text-red-600">
                              {getProductionStats().reduce((sum, p) => sum + p.totalDowntime, 0)} min
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-xl font-bold text-gray-700">
                              {(() => {
                                const totalDuration = getProductionStats().reduce((sum, p) => sum + p.duration, 0);
                                const totalDowntime = getProductionStats().reduce((sum, p) => sum + p.totalDowntime, 0);
                                return totalDuration > 0 ? Math.round(((totalDuration - totalDowntime) / totalDuration) * 100) : 100;
                              })()}%
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-xl font-bold text-gray-700">
                              {getProductionStats().reduce((sum, p) => sum + p.downtimes.length, 0)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  
                  {/* Detaljert lista over stanser */}
                  <div className="border-t border-gray-200">
                    <div className="p-4 bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Detaljerte stanser i dag</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-100 border-b">
                            <th className="text-left p-3 text-sm font-semibold text-gray-700">Post</th>
                            <th className="text-left p-3 text-sm font-semibold text-gray-700">Tid</th>
                            <th className="text-left p-3 text-sm font-semibold text-gray-700">Maskin</th>
                            <th className="text-left p-3 text-sm font-semibold text-gray-700">Årsak</th>
                            <th className="text-center p-3 text-sm font-semibold text-gray-700">Varighet</th>
                            <th className="text-left p-3 text-sm font-semibold text-gray-700">Operatør</th>
                          </tr>
                        </thead>
                        <tbody>
                          {downtimeHistory
                            .filter(d => d.date === new Date().toISOString().split('T')[0])
                            .sort((a, b) => a.startTime - b.startTime)
                            .map((d, index) => {
                            const machine = machines.find(m => m.name === d.machineName);
                            return (
                              <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="p-3">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                    #{d.postNumber}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className="text-sm font-medium text-gray-900">
                                    {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} - {new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${machine?.color || 'bg-gray-400'}`}></div>
                                    <span className="font-medium text-gray-800">{d.machineName}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm text-gray-700 max-w-xs">
                                    {d.comment.length > 40 ? d.comment.substring(0, 40) + '...' : d.comment}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                                    d.duration > 60 ? 'bg-red-100 text-red-800' :
                                    d.duration > 30 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {d.duration} min
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm text-gray-600">{d.operatorName}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]).length === 0 && (
                        <div className="text-center py-8">
                          <div className="text-4xl mb-2">🎉</div>
                          <p className="text-lg font-semibold text-gray-800">Ingen stanser i dag!</p>
                          <p className="text-gray-600">Perfekt produksjon.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {commentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold mb-2">
                  🛑 Avslutt stans
                </h2>
                <p className="text-blue-100">
                  {commentModal.machineName}
                </p>
                <div className="mt-3 bg-white/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Varighet:</span>
                    <span className="text-xl font-bold">
                      {Math.floor((Date.now() - commentModal.startTime) / 1000 / 60)} min
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {commentModal.machineName === 'Omposting/Korigering' && (
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      📋 Post Nr *
                    </label>
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

                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    💬 Årsak til stans *
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setComment(e.target.value);
                      }
                    }}
                    placeholder="Beskriv hva som skjedde...\n\nEksempler:\n• Maskin stoppet plutselig\n• Materialmangel\n• Teknisk feil\n• Planlagt vedlikehold"
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all h-32 md:h-40 resize-none text-base leading-relaxed"
                    autoFocus={commentModal.machineName !== 'Omposting/Korigering'}
                    maxLength={500}
                    style={{
                      minHeight: '120px'
                    }}
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {comment.length}/500 tegn
                  </div>
                </div>

                {/* Action buttons right after textarea */}
                <div className="space-y-3">
                  <button
                    onClick={confirmStop}
                    disabled={!comment.trim() || (commentModal.machineName === 'Omposting/Korigering' && !postNumber.trim())}
                    className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-green-300 focus:ring-opacity-50"
                  >
                    ✅ LAGRE STANS
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('SLETT BUTTON CLICKED - NEW CODE!');
                      if (confirm('Vil du slette denne registreringen uten å lagre?')) {
                        setActiveDowntimes(activeDowntimes.filter(d => d.id !== commentModal.id));
                        setCommentModal(null);
                        setComment('');
                        setPostNumber('');
                      }
                    }}
                    className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300"
                  >
                    🗑️ SLETT REGISTRERING
                  </button>
                </div>

                {/* Help text */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700">
                    💡 <strong>Tips:</strong> Beskriv kort og tydelig hva som forårsaket stansen for bedre oppfølging.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {editModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold mb-2">
                  ✏️ Rediger stans
                </h2>
                <p className="text-orange-100">
                  {editModal.machineName}
                </p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ⏱️ Varighet (minutter)
                  </label>
                  <input
                    type="number"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-lg font-bold text-center"
                    min="1"
                    autoFocus
                  />
                </div>

                {editModal.machineName === 'Omposting/Korigering' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      📋 Post Nr *
                    </label>
                    <input
                      type="text"
                      value={editPostNumber}
                      onChange={(e) => setEditPostNumber(e.target.value)}
                      placeholder="F.eks. 1, 2, 3..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-lg"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    📷 Legg til bilde (valgfritt)
                  </label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file);
                        }}
                        className="hidden"
                        id="camera-input"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file);
                        }}
                        className="hidden"
                        id="gallery-input"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('camera-input')?.click()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl transition-colors font-medium"
                      >
                        📷 Ta bilde
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById('gallery-input')?.click()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl transition-colors font-medium"
                      >
                        🖼️ Velg fra galleri
                      </button>
                    </div>
                  </div>
                  {editPhoto && (
                    <div className="mt-3">
                      <img 
                        src={editPhoto} 
                        alt="Uploaded" 
                        className="w-full max-w-xs h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <button
                        onClick={() => {
                          setEditPhoto(null);
                          setPhotoFile(null);
                        }}
                        className="mt-2 text-sm text-red-600 hover:text-red-800"
                      >
                        🗑️ Fjern bilde
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    💬 Årsak til stans *
                  </label>
                  <textarea
                    value={editComment}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setEditComment(e.target.value);
                      }
                    }}
                    placeholder="Beskriv årsaken til stansen...\n\nEksempler:\n• Maskin stoppet plutselig\n• Materialmangel\n• Teknisk feil\n• Planlagt vedlikehold"
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all h-32 md:h-40 resize-none text-base leading-relaxed"
                    maxLength={500}
                    style={{
                      minHeight: '120px'
                    }}
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {editComment.length}/500 tegn
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={saveEdit}
                    disabled={!editComment.trim() || !editDuration || (editModal.machineName === 'Omposting/Korigering' && !editPostNumber.trim())}
                    className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-opacity-50"
                  >
                    ✅ LAGRE ENDRINGER
                  </button>
                  
                  <button
                    onClick={() => {
                      setEditModal(null);
                      setEditComment('');
                      setEditDuration('');
                      setEditPostNumber('');
                      setEditPhoto(null);
                      setPhotoFile(null);
                    }}
                    className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  >
                    ❌ Avbryt
                  </button>
                </div>

                {/* Help text */}
                <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-700">
                    💡 <strong>Tips:</strong> Du kan endre varighet, årsak og post nummer for denne stansen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPasswordChange && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold mb-2">
                  🔑 Endre passord
                </h2>
                <p className="text-blue-100">
                  {user.name}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nåværende passord *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nytt passord *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Bekreft nytt passord *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={changePassword}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                  >
                    ✅ ENDRE PASSORD
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowPasswordChange(false);
                      setPasswordForm({ current: '', new: '', confirm: '' });
                    }}
                    className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700"
                  >
                    ❌ Avbryt
                  </button>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700">
                    📝 <strong>Tips:</strong> Bruk minst 6 tegn. Passordet lagres sikkert i nettleseren.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (user.role === 'manager' || user.role === 'admin') {
    const stats = getStats();
    const filtered = getFilteredHistory();

    return (
    <div className="min-h-screen bg-gray-200 p-2">
      <div className="max-w-full mx-auto">
        {/* Windows-style title bar */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 flex justify-between items-center border-b border-blue-800">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">Lederpanel - {user.name}</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowPasswordChange(true)}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-400 text-white text-sm border border-blue-400 transition-colors"
            >
              🔑 Passord
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 hover:bg-red-400 text-white text-sm border border-red-400 transition-colors"
            >
              ✕ Logg ut
            </button>
          </div>
        </div>

        {/* Windows-style menu bar */}
        <div className="bg-gray-100 border-b border-gray-300 px-2 py-1">
          <div className="flex gap-0">
            <button
              onClick={() => setView('main')}
              className={`px-4 py-2 text-sm border-r border-gray-300 transition-colors ${view === 'main' ? 'bg-white border-t-2 border-t-blue-500 text-blue-700 font-semibold' : 'hover:bg-gray-200 text-gray-700'
                }`}
            >
              📊 Oversikt
            </button>
            <button
              onClick={() => setView('history')}
              className={`px-4 py-2 text-sm border-r border-gray-300 transition-colors ${view === 'history' ? 'bg-white border-t-2 border-t-blue-500 text-blue-700 font-semibold' : 'hover:bg-gray-200 text-gray-700'
                }`}
            >
              📅 Historikk
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`px-4 py-2 text-sm border-r border-gray-300 transition-colors ${view === 'analytics' ? 'bg-white border-t-2 border-t-blue-500 text-blue-700 font-semibold' : 'hover:bg-gray-200 text-gray-700'
                }`}
            >
              📈 Analyse
            </button>
            <button
              onClick={() => setView('machines')}
              className={`px-4 py-2 text-sm border-r border-gray-300 transition-colors ${view === 'machines' ? 'bg-white border-t-2 border-t-blue-500 text-blue-700 font-semibold' : 'hover:bg-gray-200 text-gray-700'
                }`}
            >
              🔧 Maskiner
            </button>
            <button
              onClick={() => setView('users')}
              className={`px-4 py-2 text-sm border-r border-gray-300 transition-colors ${view === 'users' ? 'bg-white border-t-2 border-t-blue-500 text-blue-700 font-semibold' : 'hover:bg-gray-200 text-gray-700'
                }`}
            >
              👥 Brukere
            </button>
            <button
              onClick={() => setView('backup')}
              className={`px-4 py-2 text-sm transition-colors ${view === 'backup' ? 'bg-white border-t-2 border-t-blue-500 text-blue-700 font-semibold' : 'hover:bg-gray-200 text-gray-700'
                }`}
            >
              💾 Backup
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="bg-white border border-gray-300 m-2 p-4">

        {view === 'main' && (
          <div className="space-y-6">
            {/* Windows-style statistics */}
            <div className="border border-gray-400 mb-4">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-800">📊 Oversikt - I dag</h2>
              </div>
              <div className="p-4 bg-white">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 border border-gray-300 bg-gray-50">
                    <div className="text-2xl font-bold text-red-600 mb-1">{(() => {
                      const today = new Date().toISOString().split('T')[0];
                      const todayDowntimes = downtimeHistory.filter(d => d.date === today);
                      return todayDowntimes.reduce((sum, d) => sum + d.duration, 0);
                    })()}</div>
                    <div className="text-xs text-gray-600">Total stansetid (min)</div>
                  </div>
                  <div className="text-center p-3 border border-gray-300 bg-gray-50">
                    <div className="text-2xl font-bold text-blue-600 mb-1">{(() => {
                      const today = new Date().toISOString().split('T')[0];
                      return downtimeHistory.filter(d => d.date === today).length;
                    })()}</div>
                    <div className="text-xs text-gray-600">Antall stanser</div>
                  </div>
                  <div className="text-center p-3 border border-gray-300 bg-gray-50">
                    <div className="text-2xl font-bold text-purple-600 mb-1">
                      {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const todayDowntimes = downtimeHistory.filter(d => d.date === today);
                        const totalTime = todayDowntimes.reduce((sum, d) => sum + d.duration, 0);
                        return todayDowntimes.length > 0 ? Math.round(totalTime / todayDowntimes.length) : 0;
                      })()}
                    </div>
                    <div className="text-xs text-gray-600">Gjennomsnitt (min)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Windows-style recent downtimes */}
            <div className="border border-gray-400">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-800">📋 Siste stanser i dag</h2>
              </div>
              <div className="overflow-x-auto bg-white">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-400">
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Dato</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Tid</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Maskin</th>
                      <th className="text-center p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Post Nr</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Årsak</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Operatør</th>
                      <th className="text-right p-2 text-xs font-bold text-gray-800">Varighet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtimeHistory
                      .filter(d => d.date === new Date().toISOString().split('T')[0])
                      .slice(0, 15)
                      .map((d, index) => {
                        const machine = machines.find(m => m.name === d.machineName);
                        return (
                          <tr key={d.id} className="border-b border-gray-200 hover:bg-blue-50 even:bg-gray-50">
                            <td className="p-2 text-xs text-gray-700 border-r border-gray-200">
                              {new Date(d.startTime).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}
                            </td>
                            <td className="p-2 text-xs font-medium text-gray-900 border-r border-gray-200">
                              {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}-{new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2 border-r border-gray-200">
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 ${machine?.color || 'bg-gray-400'}`}></div>
                                <span className="text-xs font-medium text-gray-900">{d.machineName}</span>
                              </div>
                            </td>
                            <td className="p-2 text-center border-r border-gray-200">
                              {d.postNumber ? (
                                <span className="px-1 py-0.5 bg-blue-200 text-blue-800 text-xs font-medium border border-blue-300">
                                  {d.postNumber}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="p-2 text-xs text-gray-700 max-w-xs truncate border-r border-gray-200" title={d.comment}>
                              {d.comment}
                            </td>
                            <td className="p-2 text-xs text-gray-600 border-r border-gray-200">{d.operatorName}</td>
                            <td className="p-2 text-right">
                              <span className="text-sm font-bold text-red-600">{d.duration} min</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]).length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Ingen stanser i dag</h3>
                    <p className="text-gray-500">Flott arbeid - produksjonen går som den skal.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* History Table - Left Side */}
            <div className="lg:col-span-2 border border-gray-400">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-800">📋 Stansehistorikk</h2>
              </div>
              <div className="p-4 bg-white">
              <div className="flex justify-between items-start mb-4 flex-wrap gap-4">
                <div className="flex gap-4 flex-wrap items-end">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">Fra dato:</label>
                    <input
                      type="date"
                      value={dateFilter.from}
                      onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">Til dato:</label>
                    <input
                      type="date"
                      value={dateFilter.to}
                      onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setDateFilter({ from: '', to: '' })}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 border border-gray-400 text-sm transition-colors"
                  >
                    Tøm
                  </button>
                  <button
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      const yesterdayStr = yesterday.toISOString().split('T')[0];
                      setDateFilter({ from: yesterdayStr, to: yesterdayStr });
                    }}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white border border-blue-600 text-sm transition-colors"
                  >
                    I går
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const filtered = getFilteredHistory();
                        let csvContent = "data:text/csv;charset=utf-8,";
                        csvContent += "Dato,Start Tid,Slutt Tid,Maskin,Varighet (min),Årsak,Post Nr,Operatør\n";
                        
                        filtered.forEach(d => {
                          const startDate = new Date(d.startTime);
                          const endDate = new Date(d.endTime);
                          const startTime = startDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          const endTime = endDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          const date = startDate.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                          csvContent += `${date},${startTime},${endTime},"${d.machineName}",${d.duration},"${d.comment}",${d.postNumber || ''},"${d.operatorName}"\n`;
                        });
                        
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `stansehistorikk_${new Date().toISOString().split('T')[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white border border-green-700 text-sm transition-colors"
                    >
                      💾 Excel
                    </button>
                    <button
                      onClick={() => {
                        const filtered = getFilteredHistory();
                        const dateRange = dateFilter.from && dateFilter.to ? 
                          `${dateFilter.from} til ${dateFilter.to}` : 
                          'Alle data';
                        
                        // Machine groups for analysis
                        const machineGroups = {};
                        filtered.forEach(d => {
                          if (!machineGroups[d.machineName]) {
                            machineGroups[d.machineName] = [];
                          }
                          machineGroups[d.machineName].push(d);
                        });
                        
                        const htmlContent = `
                          <html>
                            <head>
                              <meta charset="utf-8">
                              <title>Stansehistorikk Rapport - ${dateRange}</title>
                              <style>
                                body { font-family: Arial, sans-serif; margin: 30px; line-height: 1.4; color: #333; }
                                h1 { color: #1f2937; font-size: 24px; margin-bottom: 5px; font-weight: bold; }
                                h2 { color: #374151; font-size: 18px; margin-top: 25px; margin-bottom: 10px; font-weight: bold; }
                                .date { font-size: 16px; margin-bottom: 25px; color: #666; }
                                .summary { margin: 20px 0; }
                                .summary p { margin: 8px 0; font-size: 14px; }
                                table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
                                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
                                th { background-color: #f5f5f5; font-weight: bold; font-size: 11px; }
                                .total-row { background-color: #f9f9f9; font-weight: bold; }
                                .center { text-align: center; }
                                .machine-section { margin: 20px 0; }
                                .machine-header { font-weight: bold; margin: 15px 0 5px 0; }
                                ul { margin: 5px 0 15px 20px; }
                                li { margin: 3px 0; }
                              </style>
                            </head>
                            <body>
                              <h1>Stansehistorikk Rapport</h1>
                              <div class="date">Periode: ${dateRange}</div>
                              
                              <h2>Sammendrag</h2>
                              <div class="summary">
                                <p><strong>Totalt antall stanser:</strong> ${filtered.length}</p>
                                <p><strong>Total stansetid:</strong> ${filtered.reduce((sum, d) => sum + d.duration, 0)} min</p>
                                <p><strong>Gjennomsnittlig stansetid:</strong> ${filtered.length > 0 ? Math.round(filtered.reduce((sum, d) => sum + d.duration, 0) / filtered.length) : 0} min</p>
                              </div>

                              <h2>Stanser per maskin</h2>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Maskin</th>
                                    <th class="center">Antall Stanser</th>
                                    <th class="center">Total Tid (min)</th>
                                    <th class="center">Gjennomsnitt (min)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${Object.entries(machineGroups)
                                    .sort((a, b) => b[1].length - a[1].length)
                                    .map(([machine, downtimes]) => {
                                      const totalTime = downtimes.reduce((sum, d) => sum + d.duration, 0);
                                      const avgTime = Math.round(totalTime / downtimes.length);
                                      return `
                                        <tr>
                                          <td>${machine}</td>
                                          <td class="center">${downtimes.length}</td>
                                          <td class="center">${totalTime}</td>
                                          <td class="center">${avgTime}</td>
                                        </tr>
                                      `;
                                    }).join('')}
                                </tbody>
                              </table>

                              <h2>Årsaker per maskin</h2>
                              ${Object.entries(machineGroups)
                                .sort((a, b) => b[1].length - a[1].length)
                                .slice(0, 8)
                                .map(([machine, downtimes]) => {
                                  const causes = {};
                                  downtimes.forEach(d => {
                                    if (!causes[d.comment]) causes[d.comment] = 0;
                                    causes[d.comment]++;
                                  });
                                  
                                  return `
                                    <div class="machine-section">
                                      <div class="machine-header">${machine} (${downtimes.length} stanser):</div>
                                      <ul>
                                        ${Object.entries(causes)
                                          .sort((a, b) => b[1] - a[1])
                                          .slice(0, 5)
                                          .map(([cause, count]) => `<li>${cause}</li>`)
                                          .join('')}
                                      </ul>
                                    </div>
                                  `;
                                }).join('')}

                              <h2>Detaljert historikk</h2>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Dato</th>
                                    <th>Tid</th>
                                    <th>Maskin</th>
                                    <th>Årsak</th>
                                    <th class="center">Varighet</th>
                                    <th class="center">Post Nr</th>
                                    <th>Operatør</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${filtered.map(d => `
                                    <tr>
                                      <td>${new Date(d.startTime).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                      <td>${new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}-${new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</td>
                                      <td>${d.machineName}</td>
                                      <td>${d.comment}</td>
                                      <td class="center">${d.duration} min</td>
                                      <td class="center">${d.postNumber || '-'}</td>
                                      <td>${d.operatorName}</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>
                            </body>
                          </html>
                        `;
                        
                        const newWindow = window.open('', '_blank');
                        newWindow?.document.write(htmlContent);
                        newWindow?.document.close();
                        newWindow?.print();
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 text-sm transition-colors"
                    >
                      📄 PDF
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-400">
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Dato</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Start Tid</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Slutt Tid</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Maskin</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Varighet</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800 border-r border-gray-300">Årsak</th>
                      <th className="text-left p-2 text-xs font-bold text-gray-800">Operatør</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(d => {
                      const startDate = new Date(d.startTime);
                      const endDate = new Date(d.endTime);
                      
                      return (
                        <tr key={d.id} className="border-b border-gray-200 hover:bg-blue-50 even:bg-gray-50">
                          <td className="p-2 text-xs text-gray-700 border-r border-gray-200">
                            {startDate.toLocaleDateString('nb-NO', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric' 
                            })}
                          </td>
                          <td className="p-2 text-xs font-medium text-gray-800 border-r border-gray-200">
                            {startDate.toLocaleTimeString('nb-NO', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="p-2 text-xs font-medium text-gray-800 border-r border-gray-200">
                            {endDate.toLocaleTimeString('nb-NO', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="p-2 text-xs font-medium border-r border-gray-200">
                            {d.machineName}
                            {d.postNumber && <span className="text-blue-600 ml-1">(Post {d.postNumber})</span>}
                          </td>
                          <td className="p-2 text-xs font-bold text-red-600 border-r border-gray-200">{d.duration} min</td>
                          <td className="p-2 text-xs max-w-xs border-r border-gray-200">
                            <div className="truncate" title={d.comment}>{d.comment}</div>
                          </td>
                          <td className="p-2 text-xs">{d.operatorName}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-gray-500 py-8">Ingen data å vise</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analytics - Right Side */}
            <div className="space-y-4">
              {/* Stanser per maskin */}
              <div className="border border-gray-400">
                <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-2 border-b border-gray-400">
                  <h3 className="text-sm font-bold text-gray-800">📊 Stanser per maskin</h3>
                </div>
                <div className="bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-3 text-xs font-semibold text-gray-700">Maskin</th>
                        <th className="text-center p-3 text-xs font-semibold text-gray-700">Antall</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-700">Total</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-700">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.byMachine)
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .slice(0, 6)
                        .map(([machine, duration]) => {
                          const machineData = machines.find(m => m.name === machine);
                          const percentage = (((duration as number) / stats.totalDowntime) * 100).toFixed(1);
                          const machineDowntimes = filtered.filter(d => d.machineName === machine);
                          
                          return (
                            <tr key={machine} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${machineData?.color || 'bg-gray-400'}`}></div>
                                  <span className="text-xs font-medium text-gray-900">{machine}</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-sm font-bold text-blue-600">{machineDowntimes.length}</span>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-sm font-bold text-red-600">{duration as number} min</span>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-xs font-medium text-gray-600">{percentage}%</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

                </div>
              </div>

              {/* Årsaker per maskin */}
              <div className="border border-gray-400">
                <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-2 border-b border-gray-400">
                  <h3 className="text-sm font-bold text-gray-800">📝 Årsaker per maskin</h3>
                </div>
                <div className="bg-white overflow-x-auto max-h-96">
                  <div className="space-y-2 p-3">
                    {(() => {
                      const machineGroups = {};
                      filtered.forEach(d => {
                        if (!machineGroups[d.machineName]) {
                          machineGroups[d.machineName] = [];
                        }
                        machineGroups[d.machineName].push(d);
                      });
                      
                      return Object.entries(machineGroups)
                        .sort((a, b) => b[1].length - a[1].length)
                        .slice(0, 6)
                        .map(([machine, downtimes]: [string, any[]]) => {
                          const machineData = machines.find(m => m.name === machine);
                          const causes = {};
                          downtimes.forEach(d => {
                            if (!causes[d.comment]) causes[d.comment] = 0;
                            causes[d.comment]++;
                          });
                          
                          return (
                            <div key={machine} className="mb-4">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-3 h-3 rounded-full ${machineData?.color || 'bg-gray-400'}`}></div>
                                <span className="text-sm font-bold text-gray-900">{machine}</span>
                                <span className="text-xs text-gray-500">({downtimes.length} stanser, {downtimes.reduce((sum, d) => sum + d.duration, 0)} min)</span>
                              </div>
                              <ul className="ml-5 space-y-1">
                                {Object.entries(causes)
                                  .sort((a, b) => b[1] - a[1])
                                  .slice(0, 4)
                                  .map(([cause, count]: [string, any]) => (
                                    <li key={cause} className="text-xs text-gray-700">
                                      {cause.length > 30 ? cause.substring(0, 30) + '...' : cause}
                                    </li>
                                  ))
                                }
                              </ul>
                            </div>
                          );
                        });
                    })()
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <div className="space-y-6">
            {/* Stanser per maskin */}
            <div className="bg-white rounded-2xl shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Stanser per maskin</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Siste stans - Dato</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Siste stans - Tid</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Total stansetid</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Prosent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byMachine)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .map(([machine, duration]) => {
                        const machineData = machines.find(m => m.name === machine);
                        const percentage = (((duration as number) / stats.totalDowntime) * 100).toFixed(1);
                        
                        // Finn siste stans for denne maskinen
                        const machineDowntimes = filtered.filter(d => d.machineName === machine);
                        const latestDowntime = machineDowntimes.sort((a, b) => b.startTime - a.startTime)[0];
                        
                        return (
                          <tr key={machine} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full ${machineData?.color || 'bg-gray-400'}`}></div>
                                <span className="font-medium text-gray-900">{machine}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {latestDowntime ? (
                                <span className="text-sm text-gray-700">
                                  {new Date(latestDowntime.startTime).toLocaleDateString('nb-NO', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  })}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              {latestDowntime ? (
                                <span className="text-sm text-gray-700">
                                  {new Date(latestDowntime.startTime).toLocaleTimeString('nb-NO', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-lg font-bold text-red-600">{duration as number} min</span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-sm font-medium text-gray-600">{percentage}%</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {Object.keys(stats.byMachine).length === 0 && (
                  <p className="text-center text-gray-500 py-8">Ingen data</p>
                )}
              </div>
            </div>

            {/* Stanser per dag */}
            <div className="bg-white rounded-2xl shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Stanser per dag</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700">Dato</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Ukedag</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Stansetid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byDate)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .slice(0, 10)
                      .map(([date, duration]) => {
                        const dateObj = new Date(date);
                        const formattedDate = dateObj.toLocaleDateString('nb-NO', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        });
                        const weekday = dateObj.toLocaleDateString('nb-NO', {
                          weekday: 'long'
                        });
                        
                        return (
                          <tr key={date} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-4">
                              <span className="font-medium text-gray-900">{formattedDate}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-gray-600 capitalize">{weekday}</span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-lg font-bold text-red-600">{duration as number} min</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {Object.keys(stats.byDate).length === 0 && (
                  <p className="text-center text-gray-500 py-8">Ingen data</p>
                )}
              </div>
            </div>

            {/* Vanligste årsaker */}
            <div className="bg-white rounded-2xl shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Vanligste årsaker</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Årsak</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Antall</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Prosent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const causesWithMachines = {};
                      filtered.forEach(d => {
                        const key = `${d.comment}|${d.machineName}`;
                        if (!causesWithMachines[key]) {
                          causesWithMachines[key] = {
                            cause: d.comment,
                            machine: d.machineName,
                            count: 0
                          };
                        }
                        causesWithMachines[key].count += 1;
                      });
                      
                      const totalCauses = Object.values(causesWithMachines).reduce((sum, item: any) => sum + item.count, 0);
                      
                      return Object.values(causesWithMachines)
                        .sort((a: any, b: any) => b.count - a.count)
                        .slice(0, 15)
                        .map((item: any, index) => {
                          const percentage = ((item.count / (totalCauses as number)) * 100).toFixed(1);
                          const machineData = machines.find(m => m.name === item.machine);
                          
                          return (
                            <tr key={`${item.cause}-${item.machine}`} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${machineData?.color || 'bg-gray-400'}`}></div>
                                  <span className="font-medium text-gray-900">{item.machine}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="text-gray-700">{item.cause}</span>
                              </td>
                              <td className="p-4 text-right">
                                <span className="text-lg font-bold text-blue-600">{item.count}</span>
                              </td>
                              <td className="p-4 text-right">
                                <span className="text-sm font-medium text-gray-600">{percentage}%</span>
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Ingen data</p>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'machines' && (
          <MachineManager />
        )}

        {view === 'users' && (
          <div className="space-y-6">
            {/* Add New User Form */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Legg til ny operatør</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brukernavn *
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="F.eks. Natt, Helg, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passord *
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Minst 6 tegn"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addNewUser}
                    disabled={!newUser.username.trim() || !newUser.password.trim() || newUser.password.length < 6}
                    className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                  >
                    ➕ Legg til operatør
                  </button>
                </div>
              </div>
            </div>

            {/* Current Users List */}
            <div className="bg-white rounded-2xl shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Eksisterende brukere</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700">Brukernavn</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Rolle</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Handlinger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4">
                          <span className="font-medium text-gray-900">{u.name}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            u.role === 'admin' ? 'bg-red-100 text-red-800' :
                            u.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                            u.role === 'viewer' ? 'bg-purple-100 text-purple-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {u.role === 'admin' ? 'Administrator' :
                             u.role === 'manager' ? 'Sjef' :
                             u.role === 'viewer' ? 'TV Monitor' : 'Operatør'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            Aktiv
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {u.role === 'operator' && (
                            <button
                              onClick={() => deleteUser(u.id)}
                              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors"
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

        {view === 'backup' && (
          <div className="space-y-6">
            {/* Backup Options */}
            <div className="border border-gray-400">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-800">💾 Database Backup</h2>
              </div>
              <div className="p-4 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-300 bg-gray-50">
                    <h3 className="font-bold text-gray-800 mb-2">📊 Eksporter alle data</h3>
                    <p className="text-sm text-gray-600 mb-4">Last ned alle stanser, maskiner og brukere som JSON fil</p>
                    <button
                      onClick={() => {
                        const backupData = {
                          timestamp: new Date().toISOString(),
                          version: '1.0',
                          data: {
                            downtimes: downtimeHistory,
                            machines: machines,
                            users: users.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name }))
                          }
                        };
                        
                        const dataStr = JSON.stringify(backupData, null, 2);
                        const dataBlob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(dataBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `rejestrator_backup_${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 text-sm transition-colors font-medium"
                    >
                      💾 Last ned JSON backup
                    </button>
                  </div>
                  
                  <div className="p-4 border border-gray-300 bg-gray-50">
                    <h3 className="font-bold text-gray-800 mb-2">📋 Eksporter stanser (CSV)</h3>
                    <p className="text-sm text-gray-600 mb-4">Last ned alle stanser som Excel-kompatibel CSV fil</p>
                    <button
                      onClick={() => {
                        let csvContent = "data:text/csv;charset=utf-8,";
                        csvContent += "Dato,Start Tid,Slutt Tid,Maskin,Varighet (min),Årsak,Post Nr,Operatør\n";
                        
                        downtimeHistory.forEach(d => {
                          const startDate = new Date(d.startTime);
                          const endDate = new Date(d.endTime);
                          const startTime = startDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          const endTime = endDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          const date = startDate.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                          csvContent += `${date},${startTime},${endTime},"${d.machineName}",${d.duration},"${d.comment}",${d.postNumber || ''},"${d.operatorName}"\n`;
                        });
                        
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `alle_stanser_${new Date().toISOString().split('T')[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white border border-green-700 text-sm transition-colors font-medium"
                    >
                      📊 Last ned CSV backup
                    </button>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200">
                  <h4 className="font-bold text-yellow-800 mb-2">⚠️ Viktig informasjon</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• JSON backup inneholder alle data og kan brukes til gjenoppretting</li>
                    <li>• CSV backup er kun for analyse i Excel/Google Sheets</li>
                    <li>• For full database backup, bruk Supabase Dashboard</li>
                    <li>• Lagre backup filer på sikker plass</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Backup Statistics */}
            <div className="border border-gray-400">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-800">📈 Database statistikk</h2>
              </div>
              <div className="p-4 bg-white">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 border border-gray-300 bg-gray-50">
                    <div className="text-2xl font-bold text-blue-600 mb-1">{downtimeHistory.length}</div>
                    <div className="text-xs text-gray-600">Totalt stanser</div>
                  </div>
                  <div className="text-center p-3 border border-gray-300 bg-gray-50">
                    <div className="text-2xl font-bold text-green-600 mb-1">{machines.length}</div>
                    <div className="text-xs text-gray-600">Maskiner</div>
                  </div>
                  <div className="text-center p-3 border border-gray-300 bg-gray-50">
                    <div className="text-2xl font-bold text-purple-600 mb-1">{users.length}</div>
                    <div className="text-xs text-gray-600">Brukere</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>

      {showPasswordChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-xl font-bold mb-2">
                🔑 Endre passord
              </h2>
              <p className="text-blue-100">
                {user.name}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nåværende passord *
                </label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nytt passord *
                </label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Bekreft nytt passord *
                </label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={changePassword}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                >
                  ✅ ENDRE PASSORD
                </button>
                
                <button
                  onClick={() => {
                    setShowPasswordChange(false);
                    setPasswordForm({ current: '', new: '', confirm: '' });
                  }}
                  className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700"
                >
                  ❌ Avbryt
                </button>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
🔒 <strong>Sikkert:</strong> Passordet lagres kryptert i Supabase og er ikke synlig i GitHub koden.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSetPassword && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-xl font-bold mb-2">
                🔐 Opprett passord
              </h2>
              <p className="text-green-100">
                Hei {selectedUser.name}! Du må opprette et passord først.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nytt passord *
                </label>
                <input
                  type="password"
                  value={newPasswordForm.password}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-lg"
                  autoFocus
                  placeholder="Minst 6 tegn"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Bekreft passord *
                </label>
                <input
                  type="password"
                  value={newPasswordForm.confirm}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, confirm: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-lg"
                  placeholder="Gjenta passordet"
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={setInitialPassword}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                >
                  ✅ OPPRETT PASSORD
                </button>
                
                <button
                  onClick={() => {
                    setShowSetPassword(false);
                    setNewPasswordForm({ password: '', confirm: '' });
                    setSelectedUser(null);
                  }}
                  className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700"
                >
                  ❌ Avbryt
                </button>
              </div>

              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-700">
🔒 <strong>Sikkert:</strong> Passordet lagres sikkert i Supabase og er ikke synlig i GitHub koden.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }
}

'use client';

import { useState, useEffect } from 'react';
import MultiDepartmentTracker from './MultiDepartmentTracker';
import PWAInstaller from './PWAInstaller';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';

export default function MainApp() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MultiDepartmentTracker />
      
      {/* PWA Installer */}
      <PWAInstaller />
      
      {/* Service Worker Registration */}
      <ServiceWorkerRegistration />
    </div>
  );
}


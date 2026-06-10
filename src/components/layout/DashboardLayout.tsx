import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  FlaskConical, 
  Pill, 
  Package, 
  Receipt, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  UserCircle,
  AlertTriangle,
  Check,
  CheckCheck,
  BellOff,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiAssistantChatBot } from '@/components/AiAssistantChatBot';

export const DashboardLayout = () => {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dynamic system notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Formatting utility for relative time
  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Just now';
    }
  };

  // Fetch real-time system alerts from table states
  const fetchSystemNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const newAlerts: any[] = [];

      // 1. Fetch pending laboratory requests
      try {
        const { data: labRequests, error: labErr } = await supabase()
          .from('lab_requests')
          .select(`
            id,
            created_at,
            status,
            patients(first_name, last_name),
            lab_test_catalog(name)
          `)
          .eq('status', 'Pending')
          .order('created_at', { ascending: false })
          .limit(5);

        if (labRequests && !labErr) {
          labRequests.forEach((req: any) => {
            const patientName = req.patients ? `${req.patients.first_name} ${req.patients.last_name}` : 'Unknown Patient';
            const testName = req.lab_test_catalog?.name || 'Lab Test';
            newAlerts.push({
              id: `lab-${req.id}`,
              type: 'lab',
              title: 'Pending Lab Request',
              description: `${testName} requested for ${patientName}`,
              time: req.created_at,
              read: false,
              actionUrl: '/laboratory'
            });
          });
        }
      } catch (err) {
        console.warn('Could not fetch lab requests for notifications:', err);
      }

      // 2. Fetch inventory for low-stock medicines
      try {
        const { data: medicines, error: medErr } = await supabase()
          .from('medicines')
          .select('id, name, quantity_available, min_stock_level, created_at')
          .order('name');

        if (medicines && !medErr) {
          const lowStockMeds = medicines.filter((m: any) => m.quantity_available <= (m.min_stock_level || 10));
          lowStockMeds.forEach((med: any) => {
            newAlerts.push({
              id: `stock-${med.id}`,
              type: 'stock',
              title: 'Low Stock Alert',
              description: `Only ${med.quantity_available} left of ${med.name} (Min: ${med.min_stock_level || 10})`,
              time: med.created_at || new Date().toISOString(),
              read: false,
              actionUrl: '/inventory'
            });
          });
        }
      } catch (err) {
        console.warn('Could not fetch low stock medicines for notifications:', err);
      }

      // 3. Fetch unpaid invoices
      try {
        const { data: unpaidInvoices, error: invErr } = await supabase()
          .from('invoices')
          .select(`
            id,
            invoice_number,
            total_amount,
            created_at,
            patients(first_name, last_name)
          `)
          .eq('status', 'Unpaid')
          .order('created_at', { ascending: false })
          .limit(5);

        if (unpaidInvoices && !invErr) {
          unpaidInvoices.forEach((inv: any) => {
            const patientName = inv.patients ? `${inv.patients.first_name} ${inv.patients.last_name}` : 'Unknown';
            newAlerts.push({
              id: `invoice-${inv.id}`,
              type: 'invoice',
              title: 'Unpaid Invoice',
              description: `Invoice ${inv.invoice_number} of TZS ${Number(inv.total_amount).toLocaleString()} for ${patientName}`,
              time: inv.created_at,
              read: false,
              actionUrl: '/billing'
            });
          });
        }
      } catch (err) {
        console.warn('Could not fetch unpaid invoices for notifications:', err);
      }

      // 4. Fetch pending prescriptions to dispense
      try {
        const { data: prescriptions, error: prescErr } = await supabase()
          .from('prescriptions')
          .select(`
            id,
            created_at,
            patients(first_name, last_name)
          `)
          .eq('status', 'Pending')
          .order('created_at', { ascending: false })
          .limit(5);

        if (prescriptions && !prescErr) {
          prescriptions.forEach((p: any) => {
            const patientName = p.patients ? `${p.patients.first_name} ${p.patients.last_name}` : 'Unknown';
            newAlerts.push({
              id: `prescription-${p.id}`,
              type: 'prescription',
              title: 'Pending Prescription',
              description: `Dispense medicines for ${patientName}`,
              time: p.created_at,
              read: false,
              actionUrl: '/pharmacy'
            });
          });
        }
      } catch (err) {
        console.warn('Could not fetch pending prescriptions for notifications:', err);
      }

      // Sort notifications by timestamp (newest first)
      newAlerts.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      // Fallback welcome message if clinic has zero current tasks
      if (newAlerts.length === 0) {
        newAlerts.push({
          id: 'welcome-01',
          type: 'info',
          title: 'Welcome to APLD MS!',
          description: 'Explore the patients registry, laboratory requests, or billing options securely.',
          time: new Date().toISOString(),
          read: false,
          actionUrl: '/dashboard'
        });
      }

      // Sync read actions from localStorage
      const readStatusesStr = localStorage.getItem('apld_read_notifications');
      if (readStatusesStr) {
        try {
          const readIds = JSON.parse(readStatusesStr);
          if (Array.isArray(readIds)) {
            newAlerts.forEach(alert => {
              if (readIds.includes(alert.id)) {
                alert.read = true;
              }
            });
          }
        } catch (_) {}
      }

      setNotifications(newAlerts);
    } catch (err) {
      console.error('Error constructing notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(notif => {
      if (notif.id === id) {
        return { ...notif, read: true };
      }
      return notif;
    }));
    
    // Save to local storage for persistent states
    const readStatusesStr = localStorage.getItem('apld_read_notifications');
    let readIds = [];
    try {
      readIds = readStatusesStr ? JSON.parse(readStatusesStr) : [];
      if (!Array.isArray(readIds)) readIds = [];
    } catch (_) {
      readIds = [];
    }
    
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem('apld_read_notifications', JSON.stringify(readIds));
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('apld_read_notifications', JSON.stringify(allIds));
    toast.success("All alerts marked as read");
  };

  const handleNotificationClick = (notif: any) => {
    markAsRead(notif.id);
    setShowNotifications(false);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  useEffect(() => {
    fetchSystemNotifications();
    
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSystemNotifications();
      }
    }, 60000); // refresh every 60s when visible to keep dashboard reactive without performance degradation
    
    return () => clearInterval(interval);
  }, []);

  // Handle click outside dropdown to dismiss flyout
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const allNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['Administrator'] },
    { label: 'Patients', path: '/patients', icon: Users, roles: ['Administrator', 'Receptionist', 'Doctor'] },
    { label: 'Consultations', path: '/consultations', icon: Stethoscope, roles: ['Administrator', 'Doctor'] },
    { label: 'Laboratory', path: '/laboratory', icon: FlaskConical, roles: ['Administrator', 'Doctor', 'Laboratory Technician'] },
    { label: 'Pharmacy', path: '/pharmacy', icon: Pill, roles: ['Administrator', 'Doctor', 'Pharmacist'] },
    { label: 'Inventory', path: '/inventory', icon: Package, roles: ['Administrator', 'Pharmacist'] },
    { label: 'Billing', path: '/billing', icon: Receipt, roles: ['Administrator', 'Receptionist'] },
    { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['Administrator'] },
    { label: 'Staff Management', path: '/staff', icon: Users, roles: ['Administrator'] },
    { label: 'Settings', path: '/settings', icon: Settings, roles: ['Administrator'] },
  ];

  // Robust fallback to Administrator if no role is active to prevent locking anyone out
  const userRole = profile?.roles?.name || 'Administrator';
  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 text-white flex flex-col shadow-xl z-30 transition-all duration-300 absolute md:relative h-full w-64",
        mobileMenuOpen ? "left-0" : "-left-64 md:left-0"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center font-bold shadow-sm shrink-0">
               A
             </div>
             <span className="font-bold text-lg tracking-tight truncate">APLD System</span>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn("w-full justify-start transition-colors font-medium text-sm", isActive ? "bg-blue-600 text-white hover:bg-blue-700" : "text-slate-300 hover:text-white hover:bg-slate-800 ")}
                >
                  <Icon className="mr-3 h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
          <div className="flex flex-col space-y-3">
             <div className="flex items-center gap-3 px-2">
               {profile?.avatar_url ? (
                 <img src={profile.avatar_url} alt="Profile" className="h-10 w-10 rounded-full object-cover border border-slate-700 shrink-0" referrerPolicy="no-referrer" />
               ) : (
                 <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                   <UserCircle className="h-6 w-6 text-slate-400" />
                 </div>
               )}
               <div className="flex flex-col overflow-hidden">
                 <span className="text-sm font-semibold truncate text-white">
                   {profile?.full_name || user?.email?.split('@')[0] || 'Clinic Staff'}
                 </span>
                 <span className="text-xs text-slate-400 truncate mt-0.5">
                   {profile?.roles?.name || 'Administrator'}
                 </span>
               </div>
             </div>
            <Button variant="outline" className="w-full justify-center bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4 shrink-0" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
        <header className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500 hover:text-slate-900" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 hidden sm:block">
              {navItems.find(i => location.pathname.startsWith(i.path))?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-4 flex-1 justify-end max-w-xl">
             <div className="relative hidden md:block flex-1 max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input placeholder="Global patient search..." className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500" />
             </div>
             
             <div className="relative" ref={dropdownRef}>
               <button 
                 onClick={() => {
                    const nextVal = !showNotifications;
                    setShowNotifications(nextVal);
                    if (nextVal) {
                      fetchSystemNotifications();
                    }
                  }}
                 className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 relative transition-all duration-200 focus:outline-hidden flex items-center justify-center p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900"
                 aria-label="Toggle system events notification board"
               >
                 <Bell className="h-5 w-5" />
                 {notifications.filter(n => !n.read).length > 0 && (
                   <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full border border-white dark:border-slate-950 shadow-xs animate-pulse" />
                 )}
               </button>

               {showNotifications && (
                 <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-950 rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-800/80 z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-3 duration-200">
                   {/* Board Header */}
                   <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                     <div className="flex items-center gap-2">
                       <span className="font-semibold text-sm text-slate-900 dark:text-slate-50">System Events</span>
                       {notifications.filter(n => !n.read).length > 0 && (
                         <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                           {notifications.filter(n => !n.read).length} new
                         </span>
                       )}
                     </div>
                     {notifications.filter(n => !n.read).length > 0 && (
                       <button 
                         onClick={markAllAsRead}
                         className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline focus:outline-hidden bg-transparent border-none cursor-pointer"
                       >
                         Mark all read
                       </button>
                     )}
                   </div>

                   {/* Alerts List */}
                   <div className="max-h-[380px] overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800/80">
                     {notifications.length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                         <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-full text-slate-400 dark:text-slate-500 mb-3.5">
                           <BellOff className="h-5 w-5" />
                         </div>
                         <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">All checks green</p>
                         <p className="text-xs text-slate-550 dark:text-slate-400 mt-1 leading-relaxed">No alerts or tasks require immediate attention right now.</p>
                       </div>
                     ) : (
                       notifications.map((notif) => {
                         const IconComponent = 
                           notif.type === 'lab' ? FlaskConical :
                           notif.type === 'stock' ? AlertTriangle :
                           notif.type === 'invoice' ? Receipt :
                           notif.type === 'prescription' ? Pill : Bell;
                         
                         const colorClasses = 
                           notif.type === 'lab' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' :
                           notif.type === 'stock' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' :
                           notif.type === 'invoice' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                           notif.type === 'prescription' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' :
                           'bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-450';

                         return (
                           <div 
                             key={notif.id}
                             onClick={() => handleNotificationClick(notif)}
                             className={cn(
                               "px-4 py-3.5 flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors cursor-pointer relative group",
                               !notif.read && "bg-blue-50/25 dark:bg-blue-950/10"
                             )}
                           >
                             {/* Indicator dot */}
                             {!notif.read && (
                               <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500" />
                             )}

                             {/* Avatar representation Icon */}
                             <div className={cn("p-2 rounded-lg shrink-0", colorClasses)}>
                               <IconComponent className="h-4 w-4" />
                             </div>

                             {/* Alert Information details */}
                             <div className="flex-1 space-y-0.5 min-w-0">
                               <div className="flex items-center justify-between gap-1">
                                 <p className={cn(
                                   "text-xs text-slate-900 dark:text-slate-50 truncate",
                                   !notif.read ? "font-semibold" : "font-medium"
                                 )}>
                                   {notif.title}
                                 </p>
                                 
                                 {/* Individual Mark Read Icon in Hover */}
                                 {!notif.read && (
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       markAsRead(notif.id);
                                       toast.success("Alert dismissed");
                                     }}
                                     className="opacity-0 group-hover:opacity-100 hover:bg-slate-105 dark:hover:bg-slate-850 p-0.5 rounded text-blue-600 dark:text-blue-400 transition-opacity focus:outline-hidden bg-transparent border-none cursor-pointer"
                                     title="Dismiss"
                                   >
                                     <Check className="h-3 w-3" />
                                   </button>
                                 )}
                               </div>
                               <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal line-clamp-2">
                                 {notif.description}
                               </p>
                               <div className="flex items-center gap-1.5 text-[10px] text-slate-450 dark:text-slate-500 pt-1 font-mono">
                                 <Clock className="h-3 w-3" />
                                 <span>{formatRelativeTime(notif.time)}</span>
                               </div>
                             </div>
                           </div>
                         );
                       })
                     )}
                   </div>
                   
                   {/* Bottom info banner */}
                   <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-900 text-center">
                     <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold font-mono">APLD Live Monitor</span>
                   </div>
                 </div>
               )}
             </div>
             
             <Link to="/settings" className="flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-800 cursor-pointer hover:opacity-80">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="h-8 w-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" referrerPolicy="no-referrer" />
                ) : (
                  <UserCircle className="h-8 w-8 text-slate-400 dark:text-slate-300" />
                )}
                <div className="hidden sm:block text-sm">
                  <p className="font-medium text-slate-700 dark:text-slate-300 leading-none">{profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Staff'}</p>
                </div>
             </Link>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
        <AiAssistantChatBot />
      </main>
    </div>
  );
};

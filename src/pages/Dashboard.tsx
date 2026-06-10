import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Stethoscope, FlaskConical, CircleDollarSign, Pill, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export const Dashboard = () => {
    const { profile } = useAuth();
    
    const [stats, setStats] = useState({
        patientsToday: 0,
        consultationsToday: 0,
        pendingLabTests: 0,
        completedLabTests: 0,
        revenueToday: 0,
        revenueMonth: 0,
        lowStockMedicines: 0,
        expiringMedicines: 0
    });
    
    // We'll generate some chart data dynamically from DB stats or simple mock based on aggregates if needed
    // But since "No mock data" is a strict rule, we must fetch real data.
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (profile?.roles?.name !== 'Administrator') return;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();
            
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

            try {
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Dashboard load timed out. Please check your Supabase server connection.')), 30000)
                );
                
                const [
                    patientsTodayRes,
                    consultationsTodayRes,
                    pendingLabTestsRes,
                    completedLabTestsRes,
                    revenueTodayRes,
                    revenueMonthRes,
                    lowStockMedicinesRes,
                    expiringMedicinesRes
                ] = await Promise.race([
                    Promise.all([
                        supabase().from('patients').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
                        supabase().from('visits').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
                        supabase().from('lab_requests').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
                        supabase().from('lab_requests').select('*', { count: 'exact', head: true }).eq('status', 'Completed').gte('updated_at', todayISO),
                        supabase().from('payments').select('amount').gte('created_at', todayISO),
                        supabase().from('payments').select('amount').gte('created_at', firstDayOfMonth),
                        supabase().from('medicines').select('*', { count: 'exact', head: true }).lt('quantity_available', 10),
                        supabase().from('medicines').select('*', { count: 'exact', head: true }).not('expiry_date', 'is', null).lt('expiry_date', new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString())
                    ]),
                    timeoutPromise
                ]) as any[];

                const patientsToday = patientsTodayRes?.count || 0;
                const consultationsToday = consultationsTodayRes?.count || 0;
                const pendingLabTests = pendingLabTestsRes?.count || 0;
                const completedLabTests = completedLabTestsRes?.count || 0;
                const revenueTodayData = revenueTodayRes?.data || [];
                const revenueMonthData = revenueMonthRes?.data || [];
                const lowStockMedicines = lowStockMedicinesRes?.count || 0;
                const expiringMedicines = expiringMedicinesRes?.count || 0;

                const rToday = revenueTodayData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
                const rMonth = revenueMonthData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

                setStats({
                    patientsToday: patientsToday || 0,
                    consultationsToday: consultationsToday || 0,
                    pendingLabTests: pendingLabTests || 0,
                    completedLabTests: completedLabTests || 0,
                    revenueToday: rToday,
                    revenueMonth: rMonth,
                    lowStockMedicines: lowStockMedicines || 0,
                    expiringMedicines: expiringMedicines || 0
                });

                setChartData([
                    { name: 'Pending Labs', value: pendingLabTests || 0 },
                    { name: 'Completed Labs', value: completedLabTests || 0 },
                    { name: 'Patients Today', value: patientsToday || 0 },
                    { name: 'Consultations', value: consultationsToday || 0 },
                ]);

            } catch (err: any) {
                console.error("Failed to fetch dashboard stats", err);
                toast.error(err.message || "Failed to load dashboard metrics. Check your database connection.");
            }
        };

        fetchDashboardData();
    }, [profile]);
    
    // Auto-routing for non-admins
    if (profile?.roles?.name && profile.roles.name !== 'Administrator') {
        const role = profile.roles.name;
        if (role === 'Doctor' || role === 'Receptionist') return <Navigate to="/patients" replace />;
        if (role === 'Laboratory Technician') return <Navigate to="/laboratory" replace />;
        if (role === 'Pharmacist') return <Navigate to="/pharmacy" replace />;
    }
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">System Overview</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Patients Today</p>
                            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{stats.patientsToday}</p>
                        </div>
                        <div className="h-12 w-12 bg-blue-100 dark:bg-blue-950/50 rounded-full flex items-center justify-center">
                            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Consultations Today</p>
                            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{stats.consultationsToday}</p>
                        </div>
                        <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-950/50 rounded-full flex items-center justify-center">
                            <Stethoscope className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Lab Tests</p>
                            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{stats.pendingLabTests}</p>
                        </div>
                        <div className="h-12 w-12 bg-orange-100 dark:bg-orange-950/50 rounded-full flex items-center justify-center">
                            <FlaskConical className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Revenue Today</p>
                            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">TZS {stats.revenueToday.toLocaleString()}</p>
                        </div>
                        <div className="h-12 w-12 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center">
                            <CircleDollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Low Stock Medicines</p>
                            <p className="text-3xl font-bold text-orange-600 dark:text-orange-500">{stats.lowStockMedicines}</p>
                        </div>
                        <div className="h-12 w-12 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Monthly Revenue</p>
                            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">TZS {stats.revenueMonth.toLocaleString()}</p>
                        </div>
                        <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center">
                            <CircleDollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                        <CardTitle className="text-slate-900 dark:text-slate-100 font-semibold">Daily Activity Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80 w-full pt-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="opacity-50 dark:stroke-slate-800" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'currentColor' }}
                                    className="text-slate-500 dark:text-slate-400 text-xs" 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    allowDecimals={false} 
                                    tick={{ fill: 'currentColor' }}
                                    className="text-slate-500 dark:text-slate-400 text-xs" 
                                />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                                    contentStyle={{
                                        backgroundColor: 'rgb(15, 23, 42)',
                                        borderColor: 'rgb(30, 41, 59)',
                                        color: '#fff',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

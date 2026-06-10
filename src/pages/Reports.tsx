import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { format, subDays } from 'date-fns';

export const Reports = () => {
    const { data: reportData, loading } = useQuery(async () => {
        const days = Array.from({length: 7}).map((_, i) => subDays(new Date(), 6 - i));
        
        // Revenue & Patients
        const dailyData = await Promise.all(days.map(async (day) => {
            const dateStr = day.toISOString().split('T')[0];
            
            const [revResponse, patResponse, labResponse] = await Promise.all([
                supabase().from('payments').select('amount').gte('created_at', dateStr + 'T00:00:00Z').lte('created_at', dateStr + 'T23:59:59Z'),
                supabase().from('patients').select('id', { count: 'exact', head: true }).gte('created_at', dateStr + 'T00:00:00Z').lte('created_at', dateStr + 'T23:59:59Z'),
                supabase().from('lab_requests').select('id', { count: 'exact', head: true }).gte('created_at', dateStr + 'T00:00:00Z').lte('created_at', dateStr + 'T23:59:59Z')
            ]);
            
            const revenue = revResponse.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
            return {
                name: format(day, 'MMM d'),
                revenue,
                patients: patResponse.count || 0,
                labTests: labResponse.count || 0
            };
        }));

        // Inventory Status (Pie chart)
        const { data: medicines } = await supabase().from('medicines').select('quantity_available, min_stock_level');
        const invStats = { inStock: 0, lowStock: 0, outOfStock: 0 };
        
        medicines?.forEach(m => {
            if (m.quantity_available === 0) invStats.outOfStock++;
            else if (m.quantity_available <= m.min_stock_level) invStats.lowStock++;
            else invStats.inStock++;
        });

        const inventoryData = [
            { name: 'In Stock', value: invStats.inStock, color: '#10b981' },
            { name: 'Low Stock', value: invStats.lowStock, color: '#f59e0b' },
            { name: 'Out of Stock', value: invStats.outOfStock, color: '#ef4444' }
        ].filter(d => d.value > 0);

        return { dailyData, inventoryData };
    });

    if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading comprehensive analytics...</div>;

    const { dailyData = [], inventoryData = [] } = reportData || {};

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight flex items-center text-slate-800">
                <BarChart3 className="mr-2 h-6 w-6 text-indigo-600"/> Reports & Analytics
            </h2>
            
            {/* Full Width Revenue Chart */}
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Revenue Trend (Last 7 Days)</CardTitle>
                    <CardDescription>Daily revenue based on processed payments.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `TZS ${val}`} />
                                <Tooltip formatter={(value: number) => `TZS ${value.toLocaleString()}`} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <Card className="w-full relative">
                    <CardHeader>
                        <CardTitle>Patient Growth</CardTitle>
                        <CardDescription>New patient registrations.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dailyData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="patients" name="New Patients" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="w-full relative">
                    <CardHeader>
                        <CardTitle>Laboratory Activity</CardTitle>
                        <CardDescription>Total lab requests generated.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                    <Bar dataKey="labTests" name="Lab Tests" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="w-full relative md:col-span-2 xl:col-span-1">
                    <CardHeader>
                        <CardTitle>Inventory Health</CardTitle>
                        <CardDescription>Current stock distribution.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center items-center h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={inventoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {inventoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        {inventoryData.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                No inventory data
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

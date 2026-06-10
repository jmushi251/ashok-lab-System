import { useState } from 'react';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FlaskConical, FileCheck2, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const Laboratory = () => {
    const { profile } = useAuth();
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [resultData, setResultData] = useState({ result: '', comments: '' });

    const { data: requests, loading, refetch } = useQuery(async () => {
        return await supabase().from('lab_requests').select(`
            *,
            patients(patient_number, first_name, last_name),
            lab_test_catalog(name),
            profiles!lab_requests_requested_by_fkey(full_name)
        `).order('created_at', { ascending: false });
    }, []);

    const handleSaveResult = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase().from('lab_requests').update({
                result: resultData.result,
                comments: resultData.comments,
                status: 'Completed',
                technician_id: profile?.id,
                completed_at: new Date().toISOString()
            }).eq('id', selectedRequest.id);

            if (error) throw error;
            toast.success("Lab result saved successfully");
            setSelectedRequest(null);
            setResultData({result: '', comments: ''});
            refetch();
        } catch(error: any) {
            toast.error(error.message);
        }
    };

    const handleGeneratePDF = (req: any) => {
        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.text("Ashok Private Laboratory and Dispensary", 105, 20, { align: "center" });
        doc.setFontSize(16);
        doc.text("Laboratory Report", 105, 30, { align: "center" });
        
        doc.setFontSize(12);
        doc.text(`Patient: ${req.patients?.first_name} ${req.patients?.last_name} (${req.patients?.patient_number})`, 14, 50);
        doc.text(`Date Requested: ${format(new Date(req.created_at), 'PPP')}`, 14, 58);
        doc.text(`Test Name: ${req.lab_test_catalog?.name}`, 14, 66);
        
        doc.text(`Status: ${req.status}`, 14, 80);
        doc.text(`Result: ${req.result || 'Pending'}`, 14, 88);
        doc.text(`Comments: ${req.comments || 'N/A'}`, 14, 96);
        
        doc.text("Authorized Signature", 140, 130);
        doc.line(135, 125, 190, 125);
        
        doc.save(`Lab_Report_${req.patients?.patient_number}.pdf`);
    };

    if (loading) return <div>Loading laboratory...</div>;

    const renderBadge = (status: string) => {
        if (status === 'Completed') return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
        if (status === 'In Progress') return <Badge className="bg-yellow-500 hover:bg-yellow-600">In Progress</Badge>;
        return <Badge className="bg-slate-500 hover:bg-slate-600">Pending</Badge>;
    };

    const chartData = [
        { name: 'Pending', count: requests?.filter(r => r.status === 'Pending')?.length || 0, color: '#64748b' },
        { name: 'In Progress', count: requests?.filter(r => r.status === 'In Progress')?.length || 0, color: '#eab308' },
        { name: 'Completed', count: requests?.filter(r => r.status === 'Completed')?.length || 0, color: '#22c55e' }
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight flex items-center"><FlaskConical className="mr-2"/> Laboratory Desk</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Test Status Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{fill: 'transparent'}} />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Test Requests</CardTitle>
                    </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Patient</TableHead>
                                <TableHead>Test Name</TableHead>
                                <TableHead>Requested By</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!requests || requests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                        No laboratory requests found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                requests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{format(new Date(req.created_at), 'PPp')}</TableCell>
                                        <TableCell>{req.patients?.first_name} {req.patients?.last_name}</TableCell>
                                        <TableCell className="font-semibold">{req.lab_test_catalog?.name}</TableCell>
                                        <TableCell>{req.profiles?.full_name}</TableCell>
                                        <TableCell>{renderBadge(req.status)}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                {req.status === 'Pending' && (profile?.roles?.name === 'Laboratory Technician' || profile?.roles?.name === 'Administrator') && (
                                                    <Dialog open={selectedRequest?.id === req.id} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                                                        <DialogTrigger asChild>
                                                            <Button size="sm" variant="outline" onClick={() => setSelectedRequest(req)}>
                                                                <FileCheck2 className="w-4 h-4 mr-2"/> Enter Result
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <form onSubmit={handleSaveResult}>
                                                                <DialogHeader>
                                                                    <DialogTitle>Enter Result: {req.lab_test_catalog?.name}</DialogTitle>
                                                                    <DialogDescription>Patient: {req.patients?.first_name} {req.patients?.last_name}</DialogDescription>
                                                                </DialogHeader>
                                                                <div className="space-y-4 py-4">
                                                                    <div className="space-y-2">
                                                                        <Label>Result value</Label>
                                                                        <Textarea required value={resultData.result} onChange={e => setResultData({...resultData, result: e.target.value})} placeholder="e.g. Negative, Positive, 5.5 mmol/L" />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label>Additional Comments</Label>
                                                                        <Textarea value={resultData.comments} onChange={e => setResultData({...resultData, comments: e.target.value})} />
                                                                    </div>
                                                                </div>
                                                                <DialogFooter>
                                                                    <Button type="submit">Save and Complete</Button>
                                                                </DialogFooter>
                                                            </form>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                                {req.status === 'Completed' && (
                                                    <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => handleGeneratePDF(req)}>
                                                        <FileText className="w-4 h-4 mr-2"/> PDF Report
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            </div>
        </div>
    );
}

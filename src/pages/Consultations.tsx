import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Stethoscope, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const Consultations = () => {
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchVisits = async () => {
            const { data, error } = await supabase()
                .from('visits')
                .select(`
                    *,
                    patients(first_name, last_name, patient_number),
                    profiles(full_name)
                `)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setVisits(data);
            }
            setLoading(false);
        };
        fetchVisits();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Stethoscope className="h-6 w-6 text-indigo-600"/> Consultations
                </h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Consultations</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Patient</TableHead>
                                <TableHead>Doctor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4">Loading...</TableCell>
                                </TableRow>
                            ) : visits.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4 text-slate-500">No consultations found.</TableCell>
                                </TableRow>
                            ) : (
                                visits.map(v => (
                                    <TableRow key={v.id}>
                                        <TableCell>
                                            <div className="flex items-center text-sm">
                                                <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                                                {format(new Date(v.visit_date), 'MMM dd, yyyy HH:mm')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{v.patients?.first_name} {v.patients?.last_name}</div>
                                            <div className="text-xs text-slate-500">{v.patients?.patient_number}</div>
                                        </TableCell>
                                        <TableCell>{v.profiles?.full_name || 'Unassigned'}</TableCell>
                                        <TableCell>
                                            {v.status === 'Completed' 
                                                ? <Badge className="bg-emerald-500 hover:bg-emerald-600">Completed</Badge>
                                                : <Badge className="bg-blue-500 hover:bg-blue-600">Active</Badge>
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="outline" size="sm" onClick={() => navigate(`/patients/${v.patient_id}`)}>
                                                View Profile
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

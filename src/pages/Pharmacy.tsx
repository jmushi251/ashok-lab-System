import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Pill, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export const Pharmacy = () => {
    const { profile } = useAuth();
    const [dispensing, setDispensing] = useState<string | null>(null);

    const { data: prescriptions, loading, refetch } = useQuery(async () => {
        return await supabase().from('prescriptions').select(`
            *, 
            patients(first_name, last_name, patient_number), 
            profiles!prescriptions_doctor_id_fkey(full_name),
            prescription_items(*, medicines(id, name, quantity_available))
        `).order('created_at', { ascending: false });
    }, []);

    const handleDispense = async (prescriptionId: string, items: any[]) => {
        setDispensing(prescriptionId);
        try {
            // Check stock first
            for (const item of items) {
                if (item.medicines.quantity_available < item.quantity) {
                    throw new Error(`Insufficient stock for ${item.medicines.name}. Available: ${item.medicines.quantity_available}, Requested: ${item.quantity}`);
                }
            }

            // Reduce inventory & log transactions & update prescription status
            for (const item of items) {
                const newQty = item.medicines.quantity_available - item.quantity;
                const { error: medErr } = await supabase().from('medicines').update({ quantity_available: newQty }).eq('id', item.medicines.id);
                if (medErr) throw medErr;

                await supabase().from('inventory_transactions').insert([{
                    medicine_id: item.medicines.id,
                    transaction_type: 'Dispensed',
                    quantity: -item.quantity,
                    reference_id: item.id,
                    performed_by: profile?.id
                }]);
            }

            const { error: prescErr } = await supabase().from('prescriptions').update({
                status: 'Dispensed',
                pharmacist_id: profile?.id,
                dispensed_at: new Date().toISOString()
            }).eq('id', prescriptionId);

            if (prescErr) throw prescErr;

            toast.success("Medications dispensed successfully");
            refetch();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setDispensing(null);
        }
    };

    if (loading) return <div>Loading pharmacy...</div>;

    const pending = prescriptions?.filter(p => p.status === 'Pending') || [];
    const dispensed = prescriptions?.filter(p => p.status === 'Dispensed') || [];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight flex items-center"><Pill className="mr-2"/> Pharmacy Counter</h2>

            <Card className="border-blue-200">
                <CardHeader className="bg-blue-50">
                    <CardTitle className="text-blue-900">Pending Prescriptions</CardTitle>
                    <CardDescription>Prescriptions waiting to be dispensed</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        {pending.map(presc => (
                            <Card key={presc.id} className="shadow-sm">
                                <CardHeader className="pb-3 border-b">
                                    <div className="flex justify-between">
                                        <div>
                                            <CardTitle className="text-lg">{presc.patients?.first_name} {presc.patients?.last_name}</CardTitle>
                                            <p className="text-sm text-muted-foreground">{presc.patients?.patient_number}</p>
                                        </div>
                                        <Badge variant="outline" className="h-6">Pending</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">Dr. {presc.profiles?.full_name} • {format(new Date(presc.created_at), 'PPp')}</p>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="space-y-2">
                                        {presc.prescription_items?.map((item: any) => (
                                            <div key={item.id} className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                                                <div>
                                                    <p className="font-semibold text-sm">{item.medicines?.name}</p>
                                                    <p className="text-xs text-slate-500">{item.dosage} • {item.frequency} • {item.duration}</p>
                                                </div>
                                                <div className="text-right">
                                                    <Badge variant="secondary">Qty: {item.quantity}</Badge>
                                                    {item.medicines.quantity_available < item.quantity && <p className="text-xs text-red-500 font-bold mt-1">Out of Stock</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Button 
                                        className="w-full" 
                                        onClick={() => handleDispense(presc.id, presc.prescription_items)}
                                        disabled={dispensing === presc.id || (profile?.roles?.name !== 'Pharmacist' && profile?.roles?.name !== 'Administrator')}
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" /> 
                                        {dispensing === presc.id ? 'Dispensing...' : 'Dispense All Items'}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {pending.length === 0 && <p className="text-center py-8 text-muted-foreground">No pending prescriptions</p>}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Recently Dispensed</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {dispensed.slice(0, 10).map(presc => (
                            <div key={presc.id} className="flex justify-between items-center border-b pb-3">
                                <div>
                                    <p className="font-semibold">{presc.patients?.first_name} {presc.patients?.last_name} <span className="text-sm font-normal text-slate-500 ml-2">{presc.patients?.patient_number}</span></p>
                                    <p className="text-sm text-slate-500 mt-1">{presc.prescription_items?.map((i: any) => i.medicines?.name).join(', ')}</p>
                                </div>
                                <div className="text-right">
                                    <Badge className="bg-green-500">Dispensed</Badge>
                                    <p className="text-xs text-slate-400 mt-1">{format(new Date(presc.dispensed_at || presc.updated_at), 'PPp')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

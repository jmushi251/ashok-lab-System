import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import { Trash2 } from 'lucide-react';

export const PatientProfile = () => {
    const { id } = useParams<{id: string}>();
    const { profile } = useAuth();
    
    // Data Fetching
    const { data: patient, loading: patientLoading } = useQuery(async () => supabase().from('patients').select('*').eq('id', id).single(), [id]);
    const { data: visits, refetch: refetchVisits } = useQuery(async () => supabase().from('visits').select('*, profiles(full_name)').eq('patient_id', id).order('visit_date', { ascending: false }), [id]);
    const { data: tests } = useQuery(async () => supabase().from('lab_test_catalog').select('*').order('name'), []);
    const { data: medicines } = useQuery(async () => supabase().from('medicines').select('*').order('name'), []);
    const { data: labHistory, refetch: refetchLabs } = useQuery(async () => supabase().from('lab_requests').select('*, lab_test_catalog(name), profiles!lab_requests_requested_by_fkey(full_name)').eq('patient_id', id).order('created_at', { ascending: false }), [id]);
    const { data: prescriptionsHistory, refetch: refetchPrescriptions } = useQuery(async () => supabase().from('prescriptions').select('*, visits(visit_date), profiles!prescriptions_doctor_id_fkey(full_name), prescription_items(*, medicines(name))').eq('patient_id', id).order('created_at', { ascending: false }), [id]);

    // Modals state
    const [openConsultation, setOpenConsultation] = useState(false);
    const [consultForm, setConsultForm] = useState({ symptoms: '', diagnosis: '', notes: '' });
    
    const [openLabRequest, setOpenLabRequest] = useState(false);
    const [selectedTestId, setSelectedTestId] = useState('');
    const [selectedVisitId, setSelectedVisitId] = useState('');

    const [openPrescription, setOpenPrescription] = useState(false);
    const [prescVisitId, setPrescVisitId] = useState('');
    const [prescItems, setPrescItems] = useState([{ medicine_id: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' }]);

    // Handlers
    const handleCreateConsultation = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase().from('visits').insert([{ ...consultForm, patient_id: id, doctor_id: profile?.id }]);
            if (error) throw error;
            toast.success("Consultation started successfully");
            setOpenConsultation(false);
            setConsultForm({symptoms: '', diagnosis: '', notes: ''});
            refetchVisits();
        } catch(err: any) { toast.error(err.message); }
    };

    const handleRequestLab = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTestId || !selectedVisitId) return toast.error("Select a test and visit");
        try {
            const { error } = await supabase().from('lab_requests').insert([{ patient_id: id, visit_id: selectedVisitId, requested_by: profile?.id, test_id: selectedTestId }]);
            if (error) throw error;
            toast.success("Lab requested successfully");
            setOpenLabRequest(false);
            refetchLabs();
        } catch(err: any) { toast.error(err.message); }
    };

    const handleCreatePrescription = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prescVisitId) return toast.error("Select a visit for the prescription");
        if (prescItems.some(item => !item.medicine_id)) return toast.error("All rows must have a medicine selected");
        
        try {
            const { data: presc, error: prescError } = await supabase().from('prescriptions').insert([{
                patient_id: id,
                visit_id: prescVisitId,
                doctor_id: profile?.id
            }]).select().single();

            if (prescError) throw prescError;

            const itemsToInsert = prescItems.map(item => ({
                ...item,
                prescription_id: presc.id
            }));

            const { error: itemsError } = await supabase().from('prescription_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            toast.success("Prescription generated successfully");
            setOpenPrescription(false);
            setPrescItems([{ medicine_id: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' }]);
            refetchPrescriptions();
        } catch (err: any) { toast.error(err.message); }
    };

    if (patientLoading) return <div>Loading patient...</div>;
    if (!patient) return <div>Patient not found</div>;

    const patientName = `${patient.first_name} ${patient.middle_name || ''} ${patient.last_name}`.trim();

    return (
        <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-100">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-blue-900">{patientName}</h2>
                            <p className="text-sm text-blue-700 font-medium mt-1">ID: {patient.patient_number}</p>
                            <div className="mt-4 flex gap-6 text-sm text-blue-800">
                                <div><span className="font-semibold text-blue-900">Gender:</span> {patient.gender}</div>
                                <div><span className="font-semibold text-blue-900">DOB:</span> {patient.dob}</div>
                                <div><span className="font-semibold text-blue-900">Phone:</span> {patient.phone_number}</div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="consultations" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
                    <TabsTrigger value="consultations">Consultations</TabsTrigger>
                    <TabsTrigger value="labs">Lab History</TabsTrigger>
                    <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
                    <TabsTrigger value="billing">Billing</TabsTrigger>
                </TabsList>
                
                <TabsContent value="consultations" className="mt-6 space-y-4">
                    <div className="flex justify-end gap-2">
                        {(profile?.roles?.name === 'Administrator' || profile?.roles?.name === 'Doctor') && (
                            <Dialog open={openConsultation} onOpenChange={setOpenConsultation}>
                                <DialogTrigger asChild><Button>New Consultation</Button></DialogTrigger>
                                <DialogContent>
                                    <form onSubmit={handleCreateConsultation}>
                                        <DialogHeader><DialogTitle>Start Consultation</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2"><Label>Symptoms</Label><Textarea value={consultForm.symptoms} onChange={e => setConsultForm({...consultForm, symptoms: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Diagnosis</Label><Textarea value={consultForm.diagnosis} onChange={e => setConsultForm({...consultForm, diagnosis: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Notes</Label><Textarea value={consultForm.notes} onChange={e => setConsultForm({...consultForm, notes: e.target.value})} /></div>
                                        </div>
                                        <DialogFooter><Button type="submit">Save Consultation</Button></DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>

                    {visits?.map(visit => (
                        <Card key={visit.id}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-lg">Visit on {format(new Date(visit.visit_date), 'PPP')}</CardTitle>
                                    <CardDescription>Attended by {visit.profiles?.full_name}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm mt-2 border-t pt-4">
                                <div><h4 className="font-semibold text-slate-800">Symptoms</h4><p className="text-slate-600">{visit.symptoms || 'None recorded'}</p></div>
                                <div><h4 className="font-semibold text-slate-800">Diagnosis</h4><p className="text-slate-600">{visit.diagnosis || 'None recorded'}</p></div>
                                <div><h4 className="font-semibold text-slate-800">Notes</h4><p className="text-slate-600">{visit.notes || 'None recorded'}</p></div>
                            </CardContent>
                        </Card>
                    ))}
                    {visits?.length === 0 && <p className="text-muted-foreground text-center py-8">No consultations found.</p>}
                </TabsContent>

                <TabsContent value="labs" className="mt-6 space-y-4">
                    <div className="flex justify-end">
                       {(profile?.roles?.name === 'Doctor' || profile?.roles?.name === 'Administrator') && visits?.length ? (
                           <Dialog open={openLabRequest} onOpenChange={setOpenLabRequest}>
                               <DialogTrigger asChild><Button>Request Lab Test</Button></DialogTrigger>
                               <DialogContent>
                                    <form onSubmit={handleRequestLab}>
                                        <DialogHeader><DialogTitle>Request Lab Test</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Select Visit</Label>
                                                <Select value={selectedVisitId} onValueChange={setSelectedVisitId}>
                                                    <SelectTrigger><SelectValue placeholder="Select visit date" /></SelectTrigger>
                                                    <SelectContent>{visits.map(v => <SelectItem key={v.id} value={v.id}>{format(new Date(v.visit_date), 'PPP')}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Select Test</Label>
                                                <Select value={selectedTestId} onValueChange={setSelectedTestId}>
                                                    <SelectTrigger><SelectValue placeholder="Select test" /></SelectTrigger>
                                                    <SelectContent>{tests?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <DialogFooter><Button type="submit">Submit Request</Button></DialogFooter>
                                    </form>
                               </DialogContent>
                           </Dialog>
                       ) : null}
                    </div>
                    <Card>
                        <CardHeader><CardTitle>Laboratory History</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Test Name</TableHead><TableHead>Requested By</TableHead><TableHead>Status</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {labHistory?.map(lab => (
                                        <TableRow key={lab.id}>
                                            <TableCell>{format(new Date(lab.created_at), 'PPp')}</TableCell>
                                            <TableCell className="font-semibold">{lab.lab_test_catalog?.name}</TableCell>
                                            <TableCell>{lab.profiles?.full_name}</TableCell>
                                            <TableCell><Badge className={lab.status === 'Completed' ? 'bg-green-500' : 'bg-slate-500'}>{lab.status}</Badge></TableCell>
                                            <TableCell className="max-w-[200px] truncate">{lab.result || '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {labHistory?.length === 0 && <p className="text-center py-4 text-muted-foreground">No lab history</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="prescriptions" className="mt-6 space-y-4">
                    <div className="flex justify-end">
                       {(profile?.roles?.name === 'Doctor' || profile?.roles?.name === 'Administrator') && visits?.length ? (
                           <Dialog open={openPrescription} onOpenChange={setOpenPrescription}>
                               <DialogTrigger asChild><Button>Create Prescription</Button></DialogTrigger>
                               <DialogContent className="max-w-3xl">
                                    <form onSubmit={handleCreatePrescription}>
                                        <DialogHeader><DialogTitle>New Prescription</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Select Visit</Label>
                                                <Select value={prescVisitId} onValueChange={setPrescVisitId}>
                                                    <SelectTrigger><SelectValue placeholder="Select visit date" /></SelectTrigger>
                                                    <SelectContent>{visits.map(v => <SelectItem key={v.id} value={v.id}>{format(new Date(v.visit_date), 'PPP')}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-4 pt-4 border-t">
                                                <Label>Medication Items</Label>
                                                {prescItems.map((item, index) => (
                                                    <div key={index} className="grid grid-cols-6 gap-2 items-end bg-slate-50 p-3 rounded-lg border">
                                                        <div className="col-span-2 space-y-1">
                                                            <Label className="text-xs">Medicine</Label>
                                                            <Select value={item.medicine_id} onValueChange={v => { const n = [...prescItems]; n[index].medicine_id = v; setPrescItems(n); }}>
                                                                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                                                <SelectContent>{medicines?.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1"><Label className="text-xs">Dosage</Label><Input placeholder="1 Tab" value={item.dosage} onChange={e => { const n = [...prescItems]; n[index].dosage = e.target.value; setPrescItems(n); }} /></div>
                                                        <div className="space-y-1"><Label className="text-xs">Frequency</Label><Input placeholder="TDS" value={item.frequency} onChange={e => { const n = [...prescItems]; n[index].frequency = e.target.value; setPrescItems(n); }} /></div>
                                                        <div className="space-y-1"><Label className="text-xs">Duration</Label><Input placeholder="5 Days" value={item.duration} onChange={e => { const n = [...prescItems]; n[index].duration = e.target.value; setPrescItems(n); }} /></div>
                                                        <div className="space-y-1"><Label className="text-xs">Qty</Label><Input type="number" min="1" value={item.quantity} onChange={e => { const n = [...prescItems]; n[index].quantity = parseInt(e.target.value); setPrescItems(n); }} /></div>
                                                        <div className="col-span-5 space-y-1"><Input placeholder="Special instructions (optional)" value={item.instructions} onChange={e => { const n = [...prescItems]; n[index].instructions = e.target.value; setPrescItems(n); }} /></div>
                                                        <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => { if(prescItems.length > 1) { const n = [...prescItems]; n.splice(index, 1); setPrescItems(n); } }}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" size="sm" onClick={() => setPrescItems([...prescItems, { medicine_id: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' }])}>
                                                    Add Medicine Row
                                                </Button>
                                            </div>
                                        </div>
                                        <DialogFooter><Button type="submit">Save Prescription</Button></DialogFooter>
                                    </form>
                               </DialogContent>
                           </Dialog>
                       ) : null}
                    </div>
                    <Card>
                        <CardHeader><CardTitle>Prescription History</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {prescriptionsHistory?.map(presc => (
                                    <div key={presc.id} className="border rounded-lg p-4 bg-white">
                                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                                            <div>
                                                <p className="font-semibold text-slate-800">Date: {format(new Date(presc.created_at), 'PPP')}</p>
                                                <p className="text-sm text-slate-500">Doctor: {presc.profiles?.full_name}</p>
                                            </div>
                                            <Badge className={presc.status === 'Dispensed' ? 'bg-green-500' : 'bg-slate-500'}>{presc.status}</Badge>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="font-medium text-sm">Medications:</p>
                                            {presc.prescription_items?.map((item: any) => (
                                                <div key={item.id} className="flex flex-col text-sm bg-slate-50 p-2 rounded">
                                                    <span className="font-semibold">{item.medicines?.name} <span className="font-normal border-l pl-2 ml-2">Qty: {item.quantity}</span></span>
                                                    <span className="text-slate-600">{item.dosage} • {item.frequency} • {item.duration}</span>
                                                    {item.instructions && <span className="text-muted-foreground text-xs italic mt-1">{item.instructions}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {prescriptionsHistory?.length === 0 && <p className="text-center py-4 text-muted-foreground">No prescriptions found.</p>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="billing" className="mt-6">
                    <Card>
                        <CardHeader><CardTitle>Billing History</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Billing module integration upcoming.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

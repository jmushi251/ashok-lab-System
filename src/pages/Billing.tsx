import { useState, useEffect } from 'react';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Receipt, Banknote, Printer } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Billing = () => {
    const { profile } = useAuth();
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [openPayment, setOpenPayment] = useState(false);

    const { data: invoices, loading, refetch } = useQuery(async () => {
        return await supabase().from('invoices').select(`
            *,
            patients(first_name, last_name, patient_number),
            invoice_items(*)
        `).order('created_at', { ascending: false });
    }, []);

    const [openGenerate, setOpenGenerate] = useState(false);
    const [generatePatientId, setGeneratePatientId] = useState('');
    const [generateVisitId, setGenerateVisitId] = useState('');
    
    const { data: patientsList } = useQuery(async () => supabase().from('patients').select('id, first_name, last_name, patient_number'), []);
    
    const [patientVisits, setPatientVisits] = useState<any[]>([]);
    const [invoicePreview, setInvoicePreview] = useState<{items: any[], total: number} | null>(null);

    useEffect(() => {
        if (generatePatientId) {
            supabase().from('visits').select('*').eq('patient_id', generatePatientId).order('visit_date', {ascending: false})
                .then(({data}) => setPatientVisits(data || []));
        } else {
            setPatientVisits([]);
            setGenerateVisitId('');
        }
    }, [generatePatientId]);

    useEffect(() => {
        const fetchPreview = async () => {
            if (!generateVisitId) {
                setInvoicePreview(null);
                return;
            }
            
            const items = [];
            let total = 0;

            // Fetch Lab Tests for this visit
            const { data: labs } = await supabase().from('lab_requests')
                .select('id, lab_test_catalog(name, price)')
                .eq('visit_id', generateVisitId);
            
            if (labs) {
                for (const lab of labs) {
                    const price = lab.lab_test_catalog?.price || 0;
                    items.push({
                        description: `Lab: ${lab.lab_test_catalog?.name}`,
                        quantity: 1,
                        unit_price: price,
                        total_price: price,
                        reference_type: 'Lab Test',
                        reference_id: lab.id
                    });
                    total += price;
                }
            }

            // Fetch Prescriptions for this visit
            const { data: prescs } = await supabase().from('prescriptions')
                .select('id, prescription_items(id, quantity, medicines(name, selling_price))')
                .eq('visit_id', generateVisitId);
            
            if (prescs) {
                for (const p of prescs) {
                    for (const item of p.prescription_items) {
                        const price = item.medicines?.selling_price || 0;
                        const lineTotal = price * item.quantity;
                        items.push({
                            description: `Med: ${item.medicines?.name}`,
                            quantity: item.quantity,
                            unit_price: price,
                            total_price: lineTotal,
                            reference_type: 'Medicine',
                            reference_id: item.id
                        });
                        total += lineTotal;
                    }
                }
            }
            
            setInvoicePreview({ items, total });
        };
        fetchPreview();
    }, [generateVisitId]);

    const handleGenerateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoicePreview || invoicePreview.items.length === 0) {
            return toast.error("No billable items found for this visit.");
        }

        try {
            const countRes = await supabase().from('invoices').select('id', { count: 'exact', head: true });
            const invNumber = `INV-${new Date().getFullYear()}-${String((countRes.count || 0) + 1).padStart(5, '0')}`;
            
            const { data: inv, error } = await supabase().from('invoices').insert([{
                patient_id: generatePatientId,
                visit_id: generateVisitId,
                invoice_number: invNumber,
                total_amount: invoicePreview.total
            }]).select().single();

            if (error) throw error;

            const itemsToInsert = invoicePreview.items.map(item => ({
                ...item,
                invoice_id: inv.id
            }));

            const { error: itemErr } = await supabase().from('invoice_items').insert(itemsToInsert);

            if (itemErr) throw itemErr;

            toast.success("Invoice generated automatically");
            setOpenGenerate(false);
            setGeneratePatientId(''); setGenerateVisitId(''); setInvoicePreview(null);
            refetch();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!paymentMethod) return toast.error("Select payment method");
        try {
            const rcptNumber = `RCPT-${Date.now().toString().slice(-6)}`;
            
            const { error: pErr } = await supabase().from('payments').insert([{
                invoice_id: selectedInvoice.id,
                amount: selectedInvoice.total_amount,
                payment_method: paymentMethod,
                recorded_by: profile?.id,
                receipt_number: rcptNumber
            }]);
            if (pErr) throw pErr;

            const { error: iErr } = await supabase().from('invoices').update({ status: 'Paid' }).eq('id', selectedInvoice.id);
            if (iErr) throw iErr;

            toast.success("Payment recorded successfully");
            setOpenPayment(false);
            setSelectedInvoice(null);
            refetch();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const printReceipt = async (inv: any) => {
        const { data: payments } = await supabase().from('payments').select('*').eq('invoice_id', inv.id).single();
        
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text("Ashok Private Laboratory and Dispensary", 105, 20, { align: "center" });
        doc.setFontSize(16);
        doc.text("Payment Receipt", 105, 30, { align: "center" });
        
        doc.setFontSize(12);
        doc.text(`Receipt No: ${payments?.receipt_number || 'N/A'}`, 14, 50);
        doc.text(`Invoice No: ${inv.invoice_number}`, 14, 58);
        doc.text(`Patient: ${inv.patients?.first_name} ${inv.patients?.last_name}`, 14, 66);
        doc.text(`Date: ${format(new Date(), 'PPP')}`, 14, 74);
        
        const tableData = inv.invoice_items?.map((item: any) => [
            item.description,
            item.quantity,
            item.unit_price.toLocaleString(),
            item.total_price.toLocaleString()
        ]) || [];

        autoTable(doc, {
            startY: 90,
            head: [['Description', 'Qty', 'Unit Price (TZS)', 'Total (TZS)']],
            body: tableData,
            foot: [['', '', 'Total Paid:', inv.total_amount.toLocaleString()]]
        });

        doc.text(`Payment Method: ${payments?.payment_method || 'N/A'}`, 14, (doc as any).lastAutoTable.finalY + 20);
        
        doc.save(`Receipt_${inv.invoice_number}.pdf`);
    };

    if (loading) return <div>Loading billing...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight flex items-center"><Receipt className="mr-2"/> Billing & Payments</h2>
                {(profile?.roles?.name === 'Receptionist' || profile?.roles?.name === 'Administrator') && (
                    <Dialog open={openGenerate} onOpenChange={setOpenGenerate}>
                        <DialogTrigger asChild><Button>Generate Invoice</Button></DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <form onSubmit={handleGenerateInvoice}>
                                <DialogHeader><DialogTitle>Automated Invoice Generation</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Select Patient</Label>
                                            <Select value={generatePatientId} onValueChange={setGeneratePatientId}>
                                                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                                                <SelectContent>
                                                    {patientsList?.map(p => <SelectItem key={p.id} value={p.id}>{p.patient_number} - {p.first_name} {p.last_name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Select Visit</Label>
                                            <Select value={generateVisitId} onValueChange={setGenerateVisitId} disabled={!generatePatientId}>
                                                <SelectTrigger><SelectValue placeholder="Select visit" /></SelectTrigger>
                                                <SelectContent>
                                                    {patientVisits?.map(v => <SelectItem key={v.id} value={v.id}>{format(new Date(v.visit_date), 'PPP')}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    
                                    {invoicePreview && (
                                        <div className="border rounded-md mt-4">
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Unit</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {invoicePreview.items.map((it, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>{it.description}</TableCell>
                                                            <TableCell>{it.quantity}</TableCell>
                                                            <TableCell>{it.unit_price.toLocaleString()}</TableCell>
                                                            <TableCell>{it.total_price.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {invoicePreview.items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No billable services found for this visit.</TableCell></TableRow>}
                                                </TableBody>
                                            </Table>
                                            <div className="p-4 bg-slate-50 flex justify-end font-bold border-t">
                                                Total Due: TZS {invoicePreview.total.toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter><Button type="submit" disabled={!invoicePreview || invoicePreview.items.length === 0}>Create Invoice</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Patient</TableHead>
                                <TableHead>Amount (TZS)</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices?.map(inv => (
                                <TableRow key={inv.id}>
                                    <TableCell>{format(new Date(inv.created_at), 'PPp')}</TableCell>
                                    <TableCell className="font-medium text-slate-800">{inv.invoice_number}</TableCell>
                                    <TableCell>{inv.patients?.first_name} {inv.patients?.last_name}</TableCell>
                                    <TableCell className="font-semibold">{inv.total_amount?.toLocaleString()}</TableCell>
                                    <TableCell>
                                        {inv.status === 'Paid' ? <Badge className="bg-green-500">Paid</Badge> : <Badge className="bg-orange-500">Unpaid</Badge>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            {inv.status !== 'Paid' && (profile?.roles?.name === 'Receptionist' || profile?.roles?.name === 'Administrator') && (
                                                <Dialog open={openPayment && selectedInvoice?.id === inv.id} onOpenChange={(o) => {setOpenPayment(o); setSelectedInvoice(o ? inv : null);}}>
                                                    <DialogTrigger asChild><Button size="sm"><Banknote className="mr-2 h-4 w-4"/> Pay</Button></DialogTrigger>
                                                    <DialogContent>
                                                        <form onSubmit={handleRecordPayment}>
                                                            <DialogHeader>
                                                                <DialogTitle>Process Payment</DialogTitle>
                                                                <DialogDescription>Invoice {inv.invoice_number} for {inv.patients?.first_name}</DialogDescription>
                                                            </DialogHeader>
                                                            <div className="py-6 space-y-4">
                                                                <div className="text-2xl font-bold text-center">TZS {inv.total_amount?.toLocaleString()}</div>
                                                                <div className="space-y-2">
                                                                    <Label>Payment Method</Label>
                                                                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                                                        <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="Cash">Cash</SelectItem>
                                                                            <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                                                                            <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                                                                            <SelectItem value="Tigo Pesa">Tigo Pesa</SelectItem>
                                                                            <SelectItem value="Card">Card</SelectItem>
                                                                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                            <DialogFooter><Button type="submit" className="w-full">Confirm Payment</Button></DialogFooter>
                                                        </form>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                            {inv.status === 'Paid' && (
                                                <Button size="sm" variant="outline" onClick={() => printReceipt(inv)}>
                                                    <Printer className="mr-2 h-4 w-4" /> Receipt
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}


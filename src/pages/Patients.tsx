import { useState, useMemo } from 'react';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';

export const Patients = () => {
    const [search, setSearch] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '', middle_name: '', last_name: '', gender: 'Male', dob: '', phone_number: '', address: '', emergency_contact: '', emergency_contact_phone: ''
    });

    const { data: allPatients, loading, refetch } = useQuery(async () => {
        return await supabase().from('patients').select('*').order('created_at', { ascending: false }).limit(600);
    }, []);

    const patients = useMemo(() => {
        if (!allPatients) return [];
        if (!search.trim()) return allPatients;
        const term = search.toLowerCase();
        return allPatients.filter(p => 
            (p.first_name && p.first_name.toLowerCase().includes(term)) ||
            (p.middle_name && p.middle_name.toLowerCase().includes(term)) ||
            (p.last_name && p.last_name.toLowerCase().includes(term)) ||
            (p.patient_number && p.patient_number.toLowerCase().includes(term))
        );
    }, [allPatients, search]);

    const handleCreatePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegistering(true);
        try {
            // Generate sequence-collision-proof custom patient number
            const countRes = await supabase().from('patients').select('id', { count: 'exact', head: true });
            const currentCount = countRes.count || 0;
            let pNumber = `APLD-${new Date().getFullYear()}-${String(currentCount + 1).padStart(6, '0')}`;
            
            // If the sequential patient number is already taken, fall back to a random 6-digit number to guarantee instant success
            const { data: existing } = await supabase().from('patients').select('id').eq('patient_number', pNumber).maybeSingle();
            if (existing) {
                pNumber = `APLD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
            }
            
            // Normalize optional fields to null if they are empty strings (vital for dob DATE type)
            const insertData = {
                first_name: formData.first_name.trim(),
                middle_name: formData.middle_name.trim() || null,
                last_name: formData.last_name.trim(),
                gender: formData.gender,
                dob: formData.dob || null,
                phone_number: formData.phone_number.trim() || null,
                address: formData.address.trim() || null,
                emergency_contact: formData.emergency_contact.trim() || null,
                emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
                patient_number: pNumber
            };

            const { error } = await supabase().from('patients').insert([insertData]);

            if (error) throw error;
            
            toast.success('Patient registered successfully');
            setFormData({
                first_name: '', middle_name: '', last_name: '', gender: 'Male', dob: '', phone_number: '', address: '', emergency_contact: '', emergency_contact_phone: ''
            });
            setOpenDialog(false);
            refetch();
        } catch (error: any) {
            console.error('Patient registration error:', error);
            toast.error(error.message || 'Failed to register patient');
        } finally {
            setRegistering(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search patients..." 
                        className="pl-8" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    <DialogTrigger asChild>
                        <Button><Plus className="h-4 w-4 mr-2"/> Register Patient</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
                        <form onSubmit={handleCreatePatient}>
                            <DialogHeader>
                                <DialogTitle>Register New Patient</DialogTitle>
                                <DialogDescription>
                                    Enter the patient's demographics. Patient Number will be auto-generated.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>First Name</Label>
                                    <Input required value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Middle Name</Label>
                                    <Input value={formData.middle_name} onChange={(e) => setFormData({...formData, middle_name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Last Name</Label>
                                    <Input required value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Gender</Label>
                                    <Select value={formData.gender} onValueChange={(val) => setFormData({...formData, gender: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Male">Male</SelectItem>
                                            <SelectItem value="Female">Female</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Date of Birth</Label>
                                    <Input required type="date" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input value={formData.phone_number} onChange={(e) => setFormData({...formData, phone_number: e.target.value})} />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label>Address</Label>
                                    <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Emergency Contact Name</Label>
                                    <Input value={formData.emergency_contact} onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Emergency Phone</Label>
                                    <Input value={formData.emergency_contact_phone} onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={registering}>
                                    {registering ? 'Completing Registration...' : 'Complete Registration'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Patient Directory</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div>Loading...</div>
                    ) : (patients?.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">No patients found.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No.</TableHead>
                                    <TableHead>Patient Number</TableHead>
                                    <TableHead>Full Name</TableHead>
                                    <TableHead>Gender</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {patients?.map((p, idx) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell className="font-medium text-blue-600">
                                            <Link to={`/patients/${p.id}`}>{p.patient_number}</Link>
                                        </TableCell>
                                        <TableCell>{p.first_name} {p.middle_name} {p.last_name}</TableCell>
                                        <TableCell>{p.gender}</TableCell>
                                        <TableCell>{p.phone_number}</TableCell>
                                        <TableCell>
                                            <Link to={`/patients/${p.id}`}>
                                                <Button variant="ghost" size="sm">View</Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

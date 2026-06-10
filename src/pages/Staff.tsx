import { useState } from 'react';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription as DialogDesc } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/store/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Settings as SettingsIcon, UserX, UserCheck, Plus, UserPlus } from 'lucide-react';
import { format } from 'date-fns';

export const Staff = () => {
    const { profile } = useAuth();
    
    const { data: staffList, loading, refetch } = useQuery(async () => {
        return await supabase().from('profiles').select('*, roles(name)').order('created_at', { ascending: false });
    }, []);

    const { data: roles } = useQuery(async () => supabase().from('roles').select('*').order('name'), []);

    const [openAdd, setOpenAdd] = useState(false);
    const [addForm, setAddForm] = useState({ fullName: '', username: '', phone: '', email: '', roleId: '', password: '' });
    const [isCreating, setIsCreating] = useState(false);

    const toggleStaffStatus = async (staffId: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
            const { error } = await supabase().from('profiles').update({ status: newStatus }).eq('id', staffId);
            if (error) throw error;
            toast.success(`Staff status updated to ${newStatus}`);
            refetch();
        } catch (err: any) {
            toast.error("Failed to update staff status: " + err.message);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            // Note: In a real production environment, creating users securely requires a backend with a Service Role key.
            // For MVP frontend-only, this attempts to use the standard signUp (assuming email confirmations are disabled in Supabase).
            // A secondary client is used to prevent the current admin from being logged out/session hijacked.
            const secondarySupabase = (await import('@supabase/supabase-js')).createClient(
                import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '',
                import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_KEY') || ''
            );

            const authEmail = `${addForm.username.toLowerCase().trim()}@apldms.local`;
            
            const { data: authData, error: authError } = await secondarySupabase.auth.signUp({
                email: authEmail,
                password: addForm.password,
            });

            if (authError) throw authError;

            // Check if profile exists (via trigger) or insert manually
            if (authData.user) {
                const { error: profileError } = await supabase().from('profiles').upsert({
                    id: authData.user.id,
                    email: authEmail,
                    full_name: addForm.fullName,
                    phone_number: addForm.phone,
                    role_id: addForm.roleId,
                    status: 'Active'
                });
                
                if (profileError) throw profileError;
            }

            toast.success("User created successfully. Temporary password assigned.");
            setOpenAdd(false);
            setAddForm({ fullName: '', username: '', phone: '', email: '', roleId: '', password: '' });
            refetch();
        } catch (err: any) {
            toast.error(err.message || 'Failed to create user');
        } finally {
            setIsCreating(false);
        }
    };

    if (profile?.roles?.name !== 'Administrator') {
        return <div className="flex items-center justify-center h-[60vh] text-center text-red-500 font-medium bg-red-50 rounded-lg border border-red-100 p-8 shadow-sm">
            Access Denied. Only Administrators can access the Staff Configuration module.
        </div>;
    }

    if (loading) return <div>Loading staff directory...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight flex items-center"><SettingsIcon className="mr-2"/> Staff & Administration</h2>
                
                <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                    <DialogTrigger asChild>
                        <Button><UserPlus className="mr-2 w-4 h-4" /> Create User</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleCreateUser}>
                            <DialogHeader>
                                <DialogTitle>Create Staff Account</DialogTitle>
                                <DialogDesc>Only administrators can create staff accounts. Self-signup is disabled.</DialogDesc>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input required value={addForm.fullName} onChange={e => setAddForm({...addForm, fullName: e.target.value})} placeholder="e.g. Dr. John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <Label>System Username</Label>
                                    <Input required value={addForm.username} onChange={e => setAddForm({...addForm, username: e.target.value})} placeholder="e.g. doctor_john" autoCapitalize="none" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Temporary Password</Label>
                                    <Input required type="password" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Role Assignment</Label>
                                    <Select required value={addForm.roleId} onValueChange={v => setAddForm({...addForm, roleId: v})}>
                                        <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                                        <SelectContent>
                                            {roles?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number (Optional)</Label>
                                    <Input value={addForm.phone} onChange={e => setAddForm({...addForm, phone: e.target.value})} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating ? 'Creating...' : 'Create Staff Member'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Staff Directory</CardTitle>
                    <CardDescription>Manage your clinic users, roles, and system access</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Username (Internal Email)</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffList?.map(staff => (
                                <TableRow key={staff.id}>
                                    <TableCell className="font-semibold">{staff.full_name}</TableCell>
                                    <TableCell className="text-slate-500">{staff.email}</TableCell>
                                    <TableCell><Badge variant="outline">{staff.roles?.name}</Badge></TableCell>
                                    <TableCell>
                                        <Badge className={staff.status === 'Active' ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-500 hover:bg-slate-600'}>{staff.status}</Badge>
                                    </TableCell>
                                    <TableCell>{format(new Date(staff.created_at), 'MMM d, yyyy')}</TableCell>
                                    <TableCell>
                                        {staff.id !== profile.id && (
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => toggleStaffStatus(staff.id, staff.status)}
                                                className={staff.status === 'Active' ? "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" : "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"}
                                            >
                                                {staff.status === 'Active' ? (
                                                    <><UserX className="h-4 w-4 mr-2" /> Disable Access</>
                                                ) : (
                                                    <><UserCheck className="h-4 w-4 mr-2" /> Enable Access</>
                                                )}
                                            </Button>
                                        )}
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

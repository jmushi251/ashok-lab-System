import { useState, useMemo } from 'react';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package, Plus, Search, AlertTriangle, AlertOctagon, Pill, TrendingDown } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';

export const Inventory = () => {
    const { profile } = useAuth();
    const { data: medicines, loading, refetch } = useQuery(async () => {
        return await supabase().from('medicines').select('*').order('name');
    }, []);

    const [openAdd, setOpenAdd] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [addForm, setAddForm] = useState({ name: '', category: '', buying_price: 0, selling_price: 0, min_stock_level: 10, quantity_available: 0 });

    const handleAddMedicine = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase().from('medicines').insert([addForm]);
            if (error) throw error;
            toast.success("Medicine added successfully");
            setOpenAdd(false);
            setAddForm({ name: '', category: '', buying_price: 0, selling_price: 0, min_stock_level: 10, quantity_available: 0 });
            refetch();
        } catch(err: any) {
            toast.error(err.message);
        }
    };

    const stats = useMemo(() => {
        if (!medicines) return { total: 0, lowStock: 0, outOfStock: 0, expiring: 0 };
        const now = new Date();
        const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        return {
            total: medicines.length,
            lowStock: medicines.filter(m => m.quantity_available > 0 && m.quantity_available <= m.min_stock_level).length,
            outOfStock: medicines.filter(m => m.quantity_available === 0).length,
            expiring: medicines.filter(m => m.expiry_date && new Date(m.expiry_date) < ninetyDays).length
        };
    }, [medicines]);

    const filteredMedicines = useMemo(() => {
        if (!medicines) return [];
        return medicines.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || (m.category && m.category.toLowerCase().includes(searchTerm.toLowerCase())));
    }, [medicines, searchTerm]);

    if (loading) return <div className="flex h-40 items-center justify-center text-slate-500">Loading inventory data...</div>;

    const getStockStatusBadge = (qty: number, min: number) => {
        if (qty === 0) return <Badge variant="destructive">Out of Stock</Badge>;
        if (qty <= min) return <Badge className="bg-orange-500 hover:bg-orange-600">Low Stock</Badge>;
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none">In Stock</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold tracking-tight flex items-center text-slate-800">
                    <Package className="mr-2 h-6 w-6 text-indigo-600"/> Inventory Management
                </h2>
                {(profile?.roles?.name === 'Pharmacist' || profile?.roles?.name === 'Administrator') && (
                    <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                        <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/> Add Medicine</Button></DialogTrigger>
                        <DialogContent>
                            <form onSubmit={handleAddMedicine}>
                                <DialogHeader><DialogTitle>Add New Medicine</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4 grid grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-2">
                                        <Label>Name</Label>
                                        <Input required value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <Label>Category</Label>
                                        <Input value={addForm.category} onChange={e => setAddForm({...addForm, category: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Buying Price (TZS)</Label>
                                        <Input type="number" required value={addForm.buying_price} onChange={e => setAddForm({...addForm, buying_price: Number(e.target.value)})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Selling Price (TZS)</Label>
                                        <Input type="number" required value={addForm.selling_price} onChange={e => setAddForm({...addForm, selling_price: Number(e.target.value)})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Initial Quantity</Label>
                                        <Input type="number" required value={addForm.quantity_available} onChange={e => setAddForm({...addForm, quantity_available: Number(e.target.value)})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Min Stock Level</Label>
                                        <Input type="number" required value={addForm.min_stock_level} onChange={e => setAddForm({...addForm, min_stock_level: Number(e.target.value)})} />
                                    </div>
                                </div>
                                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total Medicines</p>
                                <h3 className="text-2xl font-bold text-slate-800">{stats.total}</h3>
                            </div>
                            <div className="h-10 w-10 bg-indigo-100 rounded-full flex justify-center items-center">
                                <Pill className="h-5 w-5 text-indigo-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Low Stock</p>
                                <h3 className="text-2xl font-bold text-orange-600">{stats.lowStock}</h3>
                            </div>
                            <div className="h-10 w-10 bg-orange-100 rounded-full flex justify-center items-center">
                                <AlertTriangle className="h-5 w-5 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Out of Stock</p>
                                <h3 className="text-2xl font-bold text-red-600">{stats.outOfStock}</h3>
                            </div>
                            <div className="h-10 w-10 bg-red-100 rounded-full flex justify-center items-center">
                                <AlertOctagon className="h-5 w-5 text-red-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Expiring Soon</p>
                                <h3 className="text-2xl font-bold text-slate-800">{stats.expiring}</h3>
                            </div>
                            <div className="h-10 w-10 bg-slate-100 rounded-full flex justify-center items-center">
                                <TrendingDown className="h-5 w-5 text-slate-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-3 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Medicine Catalogue</CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Search inventory..." 
                                className="pl-8" 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="pl-6 w-1/4">Medicine Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Buy Price (TZS)</TableHead>
                                    <TableHead>Sell Price (TZS)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMedicines.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">No medicines found.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMedicines.map((med) => (
                                        <TableRow key={med.id}>
                                            <TableCell className="pl-6 font-medium">{med.name}</TableCell>
                                            <TableCell><Badge variant="outline" className="bg-white">{med.category || 'General'}</Badge></TableCell>
                                            <TableCell className={med.quantity_available <= med.min_stock_level ? "text-orange-600 font-semibold" : ""}>
                                                {med.quantity_available}
                                            </TableCell>
                                            <TableCell>{Number(med.buying_price).toLocaleString()}</TableCell>
                                            <TableCell>{Number(med.selling_price).toLocaleString()}</TableCell>
                                            <TableCell>
                                                {getStockStatusBadge(med.quantity_available, med.min_stock_level)}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">Stock In</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

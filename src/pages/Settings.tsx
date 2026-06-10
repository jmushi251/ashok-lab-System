import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/store/AuthContext';
import { supabase, getSupabaseUrl, getSupabaseKey } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useTheme } from '@/store/ThemeContext';
import { 
  Camera, 
  UploadCloud, 
  User, 
  Phone, 
  Mail, 
  Shield, 
  Trash2,
  Sun,
  Moon,
  Layers,
  Database,
  Key,
  RefreshCw
} from 'lucide-react';

export const Settings = () => {
    const { user, profile, refreshProfile } = useAuth();
    const { theme, setTheme } = useTheme();
    const [fullName, setFullName] = useState(profile?.full_name || '');
    const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
    const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'database'>('profile');
    
    const [dbUrl, setDbUrl] = useState(getSupabaseUrl() || '');
    const [dbKey, setDbKey] = useState(getSupabaseKey() || '');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '');
            setPhoneNumber(profile.phone_number || '');
            setAvatarUrl(profile.avatar_url || '');
        }
    }, [profile]);

    const compressAndGetBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 200;
                    const MAX_HEIGHT = 200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.85)); // 85% compression
                    } else {
                        resolve(e.target?.result as string);
                    }
                };
                img.onerror = () => reject(new Error('Failed to parse image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file (PNG, JPG, WebP)');
            return;
        }

        try {
            const base64Str = await compressAndGetBase64(file);
            setAvatarUrl(base64Str);
            toast.success("Photo selected! Click 'Save Changes' to apply.");
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to process image');
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);

        const localAvatarKey = `avatar_${user.id}`;

        try {
            // 1. Try to update all fields including avatar_url in database
            const { error: dbError } = await supabase()
                .from('profiles')
                .update({
                    full_name: fullName,
                    phone_number: phoneNumber,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (dbError) {
                // If it is due to missing avatar_url column
                if (dbError.message?.includes('avatar_url') || dbError.code === 'PGRST204') {
                    // Update only full_name and phone_number
                    const { error: fallbackError } = await supabase()
                        .from('profiles')
                        .update({
                            full_name: fullName,
                            phone_number: phoneNumber,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', user.id);

                    if (fallbackError) throw fallbackError;

                    // Store avatar in Local Storage as dynamic fallback
                    if (avatarUrl) {
                        localStorage.setItem(localAvatarKey, avatarUrl);
                    } else {
                        localStorage.removeItem(localAvatarKey);
                    }

                    toast.success("Profile updated! Avatar saved locally.");
                } else {
                    throw dbError;
                }
            } else {
                // It successfully saved in Supabase! Mirror or clear localStorage
                if (avatarUrl) {
                    localStorage.setItem(localAvatarKey, avatarUrl);
                } else {
                    localStorage.removeItem(localAvatarKey);
                }
                toast.success("Profile and photo synced successfully!");
            }

            // Reload user session profile
            await refreshProfile();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleRemovePhoto = () => {
        setAvatarUrl('');
        if (user) {
            localStorage.removeItem(`avatar_${user.id}`);
        }
        toast.info("Photo cleared. Remember to hit 'Save Changes'.");
    };

    const [checkingConnection, setCheckingConnection] = useState(false);
    
    const handleCheckAndSaveConnection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dbUrl || !dbKey) {
            toast.error("Both URL and Anon key are required.");
            return;
        }
        setCheckingConnection(true);
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const testClient = createClient(dbUrl, dbKey);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timed out. Please verify host is reachable.')), 30000)
            );
            const checkPromise = testClient.from('roles').select('id').limit(1);
            const { error: testError } = await Promise.race([checkPromise, timeoutPromise]) as any;
            
            if (testError) {
                throw new Error(testError.message || 'Verification query failed.');
            }
            
            localStorage.setItem('SUPABASE_URL', dbUrl);
            localStorage.setItem('SUPABASE_KEY', dbKey);
            toast.success("Database connection verified and updated successfully! Reloading configuration...");
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err: any) {
            setCheckingConnection(false);
            console.error(err);
            toast.error(`Database verification failed: ${err.message || 'Unknown error'}. Please verify URL and credentials.`);
        }
    };

    const handleResetConnection = () => {
        if (window.confirm("Are you sure you want to reset the database configuration? This will clear all saved Supabase credentials and re-open the initial setup screen.")) {
            localStorage.removeItem('SUPABASE_URL');
            localStorage.removeItem('SUPABASE_KEY');
            toast.success("Connection cleared! Redirecting...");
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    };



    return (
        <div className="max-w-4xl mx-auto space-y-8" id="settings_container">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Staff settings</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your administrator details, personal profile photo, and theme appearance.</p>
            </div>

            {/* Custom Interactive Tab Controls */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-nowrap">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`py-3 px-6 font-semibold text-sm border-b-2 transition-all ${
                        activeTab === 'profile' 
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold bg-blue-50/10' 
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    👤 My Profile Details
                </button>
                <button
                    onClick={() => setActiveTab('appearance')}
                    className={`py-3 px-6 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'appearance' 
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold bg-blue-50/10' 
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Layers className="w-4 h-4" /> 🌓 Theme Appearance
                </button>
                <button
                    onClick={() => setActiveTab('database')}
                    className={`py-3 px-6 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'database' 
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold bg-blue-50/10' 
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Database className="w-4 h-4" /> 🌐 Database Connection
                </button>
            </div>

            {activeTab === 'profile' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Column 1: Interactive Avatar Media Box */}
                    <div className="md:col-span-1 space-y-6">
                        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                            <CardHeader className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-center py-6">
                                <CardTitle className="text-base text-slate-800 dark:text-slate-200">Profile Photo</CardTitle>
                                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">This photo appears across consultations, invoices, and status counters.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                                <div className="relative group rounded-full overflow-hidden w-32 h-32 border-4 border-white dark:border-slate-800 shadow-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    {avatarUrl ? (
                                        <img 
                                            src={avatarUrl} 
                                            alt="Current profile avatar" 
                                            className="w-full h-full object-cover" 
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <div className="bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 w-full h-full flex items-center justify-center font-bold text-3xl animate-fade-in">
                                            {fullName ? fullName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : 'AD'}
                                        </div>
                                    )}
                                    <div 
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer animate-fade-in"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Camera className="w-8 h-8 text-white animate-pulse" />
                                    </div>
                                </div>

                                {avatarUrl && (
                                    <Button 
                                        variant="outline" 
                                        size="xs" 
                                        type="button"
                                        onClick={handleRemovePhoto} 
                                        className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200 dark:border-red-900/30 dark:hover:bg-red-950/30"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove photo
                                    </Button>
                                )}

                                <div className="text-center">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{profile?.full_name}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{profile?.roles?.name || 'Authorized Staff'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Column 2: Profile Update Details and Drag-and-Drop Area */}
                    <div className="md:col-span-2">
                        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                            <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-6">
                                <CardTitle className="text-xl text-slate-900 dark:text-slate-100">Update Personal Details</CardTitle>
                                <CardDescription className="text-slate-500 dark:text-slate-400">Refresh your system identification attributes and profile avatar instantly.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                                <form onSubmit={handleSave} className="space-y-6">
                                    
                                    {/* Drag-and-Drop Photo Uploader Box */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Upload Profile Photo</label>
                                        <div 
                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                            onDragLeave={() => setIsDragging(false)}
                                            onDrop={onDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-lg p-6 py-8 text-center cursor-pointer transition-all ${
                                                isDragging 
                                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]' 
                                                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-950/10 hover:bg-slate-50'
                                            }`}
                                        >
                                            <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Drag & drop your photo file here or click to browse</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Supports PNG, JPEG or WebP images.</p>
                                            <input 
                                                type="file" 
                                                ref={fileInputRef}
                                                onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                                                accept="image/*"
                                                className="hidden" 
                                            />
                                        </div>
                                    </div>

                                    {/* Text Input Details inside grid spacing */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 w-fit">
                                                <User className="w-3.5 h-3.5 text-slate-400" /> Full Name
                                            </label>
                                            <Input 
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                placeholder="Enter full display name"
                                                required
                                                className="bg-white dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 w-fit">
                                                <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone number
                                            </label>
                                            <Input 
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                placeholder="Enter phone contact"
                                                className="bg-white dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 px-2 rounded w-fit text-slate-500 dark:text-slate-400 cursor-not-allowed">
                                                <Mail className="w-3.5 h-3.5 text-slate-400" /> Registered Email Address
                                            </label>
                                            <Input 
                                                value={profile?.email || ''}
                                                disabled
                                                className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 select-none cursor-not-allowed"
                                            />
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">Security: email edits must go through administrative processes.</span>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 px-2 rounded w-fit text-slate-500 dark:text-slate-400 cursor-not-allowed">
                                                <Shield className="w-3.5 h-3.5 text-slate-400" /> User Role
                                            </label>
                                            <Input 
                                                value={profile?.roles?.name || 'Staff User'}
                                                disabled
                                                className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 select-none cursor-not-allowed font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                        <Button 
                                            type="submit" 
                                            disabled={saving}
                                            className="px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all"
                                        >
                                            {saving ? 'Saving changes...' : 'Save Changes'}
                                        </Button>
                                    </div>

                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : activeTab === 'appearance' ? (
                <div className="space-y-6">
                    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 animate-fade-in">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-6">
                            <CardTitle className="text-xl text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-blue-600 dark:text-blue-455" />
                                Color Theme Customization
                            </CardTitle>
                            <CardDescription className="text-slate-500 dark:text-slate-400">
                                Personalize your viewing experience. Select from standard Light Mode or highly optimized Eye-Safe Dark Mode presets.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                {/* Light Mode Block */}
                                <div 
                                    onClick={() => {
                                        setTheme('light');
                                        toast.success("Switched to clean Light appearance!");
                                    }}
                                    className={`group border rounded-xl p-5 cursor-pointer transition-all ${
                                        theme === 'light' 
                                        ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10 dark:border-blue-500 shadow-sm ring-2 ring-blue-500/20' 
                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-lg bg-yellow-105 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400">
                                                <Sun className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Light Theme</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Clean, crisp, high-contrast</p>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                            theme === 'light' 
                                            ? 'border-blue-500 bg-blue-500' 
                                            : 'border-slate-300 dark:border-slate-600 bg-transparent'
                                        }`}>
                                            {theme === 'light' && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                    </div>
                                    
                                    {/* Miniature Card Mockup Preview */}
                                    <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2 pointer-events-none shadow-xs select-none">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                                            <div className="h-2 w-12 bg-slate-200 rounded" />
                                        </div>
                                        <div className="h-3 w-full bg-slate-100 rounded" />
                                        <div className="h-4 w-4/5 bg-slate-100 rounded" />
                                    </div>
                                </div>

                                {/* Dark Mode Block */}
                                <div 
                                    onClick={() => {
                                        setTheme('dark');
                                        toast.success("Switched to high-contrast Dark Slate representation!");
                                    }}
                                    className={`group border rounded-xl p-5 cursor-pointer transition-all ${
                                        theme === 'dark' 
                                        ? 'border-blue-500 bg-blue-950/20 dark:bg-blue-950/20 dark:border-blue-400 shadow-sm ring-2 ring-blue-500/20' 
                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-lg bg-indigo-110 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                                <Moon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Dark Theme</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Eye-safe, modern cosmic slate</p>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                            theme === 'dark' 
                                            ? 'border-blue-500 bg-blue-500' 
                                            : 'border-slate-300 dark:border-slate-600 bg-transparent'
                                        }`}>
                                            {theme === 'dark' && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                    </div>

                                    {/* Miniature Dark Card Mockup Preview */}
                                    <div className="border border-slate-800 rounded-lg p-3 bg-slate-950 space-y-2 pointer-events-none shadow-xs select-none">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-slate-700" />
                                            <div className="h-2 w-12 bg-slate-800 rounded" />
                                        </div>
                                        <div className="h-3 w-full bg-slate-900 rounded" />
                                        <div className="h-4 w-4/5 bg-slate-900 rounded" />
                                    </div>
                                </div>

                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : activeTab === 'database' ? (
                <div className="space-y-6">
                    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm animate-fade-in">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-6">
                            <CardTitle className="text-xl text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                Supabase Database Settings
                            </CardTitle>
                            <CardDescription className="text-slate-500 dark:text-slate-400">
                                View or reconfigure active connection parameters to the Supabase Cloud Database.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <form onSubmit={handleCheckAndSaveConnection} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Database className="w-3.5 h-3.5 text-slate-400" /> Supabase Project URL
                                        </label>
                                        <Input 
                                            value={dbUrl}
                                            onChange={(e) => setDbUrl(e.target.value)}
                                            placeholder="https://your-project.supabase.co"
                                            required
                                            className="bg-white dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800 font-mono text-sm"
                                        />
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                            The API endpoint URL found in your Supabase Project Settings under Settings &gt; API.
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Key className="w-3.5 h-3.5 text-slate-400" /> Supabase Anon Key
                                        </label>
                                        <Input 
                                            value={dbKey}
                                            onChange={(e) => setDbKey(e.target.value)}
                                            placeholder="eyJhbGciOi..."
                                            type="password"
                                            required
                                            className="bg-white dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800 font-mono text-sm"
                                        />
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                            The anonymous public API key found in your Supabase Project Settings under Settings &gt; API.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between gap-4">
                                    <Button 
                                        type="button" 
                                        onClick={handleResetConnection}
                                        variant="outline"
                                        className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200 dark:border-red-900/30 dark:hover:bg-red-950/20 order-2 sm:order-1"
                                    >
                                        Reset Configuration
                                    </Button>

                                    <Button 
                                        type="submit" 
                                        disabled={checkingConnection}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all flex items-center gap-2 order-1 sm:order-2"
                                    >
                                        {checkingConnection ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Verifying Connection...
                                            </>
                                        ) : (
                                            'Verify & Save Settings'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Connection Diagnostic Helper Box */}
                    <Card className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 shadow-xs">
                        <CardContent className="p-6">
                            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                                🔧 Connection Diagnostics
                            </h3>
                            <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed">
                                <li><strong>Hanging on load?</strong> System metrics and lists time out after 8 seconds if connection settings are incorrect or database is unresponsive.</li>
                                <li><strong>Database active check:</strong> Go to your Supabase project dashboard to verify that your cluster is active and has not entered a paused state.</li>
                                <li><strong>Security:</strong> All credentials entered here remain 100% private to your browser's local sandbox storage context.</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            ) : null}
        </div>
    );
};

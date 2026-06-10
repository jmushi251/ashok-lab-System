import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Stethoscope, Eye, EyeOff, ShieldAlert, Key, Copy, Check, X } from 'lucide-react';

export const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSystemEmpty, setIsSystemEmpty] = useState(false);
    const [bootstrapping, setBootstrapping] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    
    // Password Reset State
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [sendingReset, setSendingReset] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const checkSystemStatus = async () => {
            try {
                // Check if any profiles exist
                const { count, error } = await supabase().from('profiles').select('*', { count: 'exact', head: true });
                if (!error && count === 0) {
                    setIsSystemEmpty(true);
                } else if (error && (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST205')) {
                    // System is empty because tables don't exist yet!
                    setIsSystemEmpty(true);
                }
            } catch (err) {
                console.error("Setup check failed", err);
            }
        };
        checkSystemStatus();
    }, []);

    const handleBootstrap = async () => {
        setBootstrapping(true);
        try {
            // Find Administrator role
            const { data: adminRole } = await supabase().from('roles').select('id').eq('name', 'Administrator').single();
            
            if (!adminRole) {
                toast.error("Database schema missing 'Administrator' role. Please run the seed SQL script in your Supabase dashboard.");
                setBootstrapping(false);
                return;
            }

            const email = "admin@apldms.local";
            const pass = "admin123";

            let user = null;

            // Try to sign in first in case user already exists from a previous failed bootstrap
            const { data: signInData } = await supabase().auth.signInWithPassword({
                email,
                password: pass,
            });

            if (signInData?.user) {
                user = signInData.user;
            } else {
                // Create Supabase Auth User
                const { data: authData, error: authError } = await supabase().auth.signUp({
                    email,
                    password: pass,
                });

                if (authError) {
                    if (authError.message.includes('rate limit')) {
                        toast.error("Rate limit exceeded. Try signing in normally with admin and admin123, or wait a few minutes.", { duration: 10000 });
                    } else if (authError.message.includes('email')) {
                        toast.error("Signup failed because email confirmations are enabled in Supabase. Please see instructions below to disable it.", { duration: 10000 });
                    }
                    setShowInstructions(true);
                    throw authError;
                }
                user = authData.user;
            }

            if (user) {
                // Create Profile
                const { error: profileError } = await supabase().from('profiles').upsert({
                    id: user.id,
                    email,
                    full_name: "System Administrator",
                    role_id: adminRole.id,
                    status: 'Active'
                });

                if (profileError) throw profileError;
                
                toast.success("System initialized! You can now log in with username: admin and password: admin123", { duration: 8000 });
                setIsSystemEmpty(false);
            }
        } catch (err: any) {
            if (err.message?.includes('row-level security') || err.message?.includes('violates row-level security')) {
                toast.error("RLS policy is blocking profile creation! See 'Troubleshooting' instructions below to disable RLS.", { duration: 12000 });
            } else {
                toast.error(err.message || 'Bootstrap failed');
            }
            setShowInstructions(true);
        } finally {
            setBootstrapping(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const email = `${username.toLowerCase().trim()}@apldms.local`;
            const { error } = await supabase().auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            navigate('/dashboard');
        } catch (error: any) {
            if (error.message?.includes('Email not confirmed')) {
                toast.error('Sign-in failed: Email not confirmed. You must disable "Confirm email" in Supabase Auth settings to log in.', { duration: 10000 });
                setShowInstructions(true);
            } else if (error.message?.includes('Invalid login credentials')) {
                toast.error('Invalid login credentials. If you have not created the administrator account yet, please use the First Time Setup bootstrap below.', { duration: 10000 });
            } else {
                toast.error(error.message || 'Invalid username or password');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendPasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail) {
            toast.error("Please enter a valid email address.");
            return;
        }
        setSendingReset(true);
        try {
            const { error } = await supabase().auth.resetPasswordForEmail(forgotEmail.trim(), {
                redirectTo: `${window.location.origin}/login`,
            });
            if (error) throw error;
            toast.success("Password reset email sent successfully! Please check your inbox for instructions.", { duration: 6000 });
            setShowForgotModal(false);
        } catch (err: any) {
            console.error("Password reset error:", err);
            toast.error(err.message || "Failed to initiate password reset. Please verify your connection or registered email.");
        } finally {
            setSendingReset(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 py-12 px-4 transition-colors duration-300">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto bg-blue-100 dark:bg-blue-950/50 p-3 rounded-full w-16 h-16 flex items-center justify-center">
                        <Stethoscope className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-50">Ashok Private Laboratory and Dispensary</CardTitle>
                        <CardDescription className="text-md mt-2 font-medium text-slate-500 dark:text-slate-400">
                            Secure Staff Access Only
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    {isSystemEmpty && (
                        <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-lg flex flex-col gap-3 text-sm text-orange-800 dark:text-orange-300">
                            <div className="flex items-center font-semibold text-orange-950 dark:text-orange-200">
                                <ShieldAlert className="w-4 h-4 mr-2 text-orange-600 dark:text-orange-400" /> First Time Setup Required
                            </div>
                            <p className="text-orange-700 dark:text-orange-300 leading-relaxed">
                                The database has no user accounts. Click the button below to initialize the system administrator credentials (**admin** / **admin123**).
                            </p>
                            
                            <Button 
                                variant="outline" 
                                className="bg-white dark:bg-slate-850 border-orange-300 dark:border-orange-850 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/50 font-medium" 
                                onClick={handleBootstrap}
                                disabled={bootstrapping}
                            >
                                {bootstrapping ? 'Initializing...' : 'Bootstrap Administrator Account'}
                            </Button>

                            <div className="border-t border-orange-200 dark:border-orange-900/40 pt-3 mt-1">
                                <button 
                                    type="button"
                                    onClick={() => setShowInstructions(!showInstructions)}
                                    className="text-orange-700 dark:text-orange-300 font-medium hover:underline flex items-center justify-between w-full"
                                >
                                    <span>💡 Troubleshooting: "Email not confirmed" or "Signup failed"</span>
                                    <span>{showInstructions ? '[-] Hide Steps' : '[+] Show Steps'}</span>
                                </button>
                                
                                {showInstructions && (
                                    <div className="mt-3 bg-white dark:bg-slate-950 p-3 rounded border border-orange-200 dark:border-orange-900/40 text-xs text-orange-900 dark:text-orange-200 space-y-2.5 leading-relaxed">
                                        <p className="font-semibold text-orange-950 dark:text-orange-200">
                                            To let dummy emails (like admin@apldms.local) log in without needing verification:
                                        </p>
                                        <ol className="list-decimal pl-4.5 space-y-1.5">
                                            <li>Go to your **Supabase Project Dashboard** (at supabase.com).</li>
                                            <li>In the left-hand sidebar, click the **Authentication** 🔑 (Key icon) menu.</li>
                                            <li>Under Authentication settings, click on **Providers**.</li>
                                            <li>Expand the **Email** provider row.</li>
                                            <li>Toggle **OFF** the **Confirm email** switch (this disables sign-up confirmation).</li>
                                            <li>Scroll down and click the **Save** button.</li>
                                        </ol>

                                        <div className="border-t border-orange-200/60 dark:border-orange-900/30 pt-2.5 mt-2 space-y-2">
                                            <p className="font-semibold text-orange-950 dark:text-orange-200">
                                                To fix "violates row-level security policy" (RLS) errors:
                                            </p>
                                            <p>
                                                Supabase enables Row Level Security by default. You can disable it for this local demo by copying and running this SQL block in your Supabase **SQL Editor** (under the "SQL Editor" tab ⚡ in the sidebar):
                                            </p>
                                            <pre className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[10px] whitespace-pre overflow-x-auto max-h-36 border border-slate-800 select-all">
{`ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_test_catalog DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results DISABLE ROW LEVEL SECURITY;`}
                                            </pre>
                                            <p className="font-medium text-orange-950 dark:text-orange-200">
                                                Click **Run** in the SQL Editor, then click **Bootstrap Administrator Account** above again!
                                            </p>
                                        </div>

                                        <p className="text-orange-800/90 dark:text-orange-300 italic pt-2.5 border-t border-orange-100 dark:border-orange-900/30">
                                            Once set up, sign in with:
                                            <br />
                                            <strong className="font-semibold text-orange-950 dark:text-orange-200 text-xs">Username:</strong> admin
                                            <br />
                                            <strong className="font-semibold text-orange-950 dark:text-orange-200 text-xs">Password:</strong> admin123
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-slate-700 dark:text-slate-300 font-medium">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="e.g. admin, doctor1"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoCapitalize="none"
                                autoComplete="username"
                                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="pr-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="remember" className="border-slate-300 dark:border-slate-750" />
                                <label
                                    htmlFor="remember"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-600 dark:text-slate-400 cursor-pointer"
                                >
                                    Remember Me
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const val = username.trim();
                                    if (val.includes('@')) {
                                        setForgotEmail(val);
                                    } else if (val) {
                                        setForgotEmail(`${val.toLowerCase()}@apldms.local`);
                                    } else {
                                        setForgotEmail('');
                                    }
                                    setShowForgotModal(true);
                                }}
                                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 hover:underline bg-transparent border-0 cursor-pointer"
                            >
                                Forgot password?
                            </button>
                        </div>
                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={loading}>
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Password Recovery Assistant Modal */}
            {showForgotModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl relative animate-scale-in">
                        <button 
                            type="button"
                            onClick={() => setShowForgotModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center space-x-3 mb-4">
                            <div className="bg-blue-100 dark:bg-blue-950/80 p-2.5 rounded-lg text-blue-600 dark:text-blue-400">
                                <Key className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">Reset Password</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Request account recovery email link</p>
                            </div>
                        </div>

                        <form onSubmit={handleSendPasswordReset} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="forgotEmail" className="text-slate-700 dark:text-slate-300 font-medium">Email Address</Label>
                                <Input
                                    id="forgotEmail"
                                    type="email"
                                    placeholder="Enter your registered email address"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    required
                                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                                />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                                    We will trigger a secure password reset link to this email address via your active Supabase database configured in your settings.
                                </p>
                            </div>

                            <div className="pt-2 border-t border-slate-150 dark:border-slate-850 flex justify-end gap-3">
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={() => setShowForgotModal(false)}
                                    className="text-xs h-9 px-4"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={sendingReset}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-4"
                                >
                                    {sendingReset ? 'Sending Link...' : 'Send Reset Link'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

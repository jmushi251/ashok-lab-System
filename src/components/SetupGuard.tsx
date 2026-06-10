import { useEffect, useState } from 'react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Database, AlertTriangle, Copy } from 'lucide-react';
import { toast } from 'sonner';

export const SetupGuard = ({ children }: { children: React.ReactNode }) => {
    const [isChecking, setIsChecking] = useState(true);
    const [schemaError, setSchemaError] = useState<string | null>(null);

    useEffect(() => {
        const checkSchema = async () => {
            if (!hasSupabaseConfig()) {
                // If there's no supabase config, we'll let other parts handle it (or just pass through)
                setIsChecking(false);
                return;
            }

            try {
                // Timeout after 25 seconds to not leave the user hanging
                const timeoutProm = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000));
                
                const tables = ['roles', 'profiles', 'patients', 'visits', 'prescriptions', 'inventory_transactions', 'invoices'];
                
                // Do checks concurrently
                const promises = tables.map(table => supabase().from(table).select('id').limit(1));
                const results = await Promise.race([Promise.all(promises), timeoutProm]) as any[];
                
                for (let i = 0; i < tables.length; i++) {
                    const res = results[i];
                    // Also check for PGRST205 which is PostgREST missing table cache
                    if (res?.error && (res.error.code === '42P01' || res.error.code === 'PGRST116' || res.error.code === 'PGRST205')) {
                        setSchemaError(tables[i]);
                        setIsChecking(false);
                        return;
                    }
                }
                
                setSchemaError(null);
            } catch (err: any) {
                console.warn("Schema check warning/timeout", err);
                // We'll proceed anyway if it timed out to not block the app permanently and let actual errors surface where they occur
            } finally {
                setIsChecking(false);
            }
        };

        checkSchema();
    }, []);

    const copySchema = () => {
        // Find schema.sql via fetch
        fetch('/supabase/schema.sql')
            .then(res => res.text())
            .then(text => {
                navigator.clipboard.writeText(text);
                toast.success("Schema copied to clipboard!");
            })
            .catch(() => toast.error("Failed to load schema file."));
    };

    if (isChecking) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="animate-pulse flex flex-col items-center">
                    <Database className="h-12 w-12 text-slate-400 mb-4" />
                    <p className="text-slate-500 font-medium">Verifying database schema...</p>
                </div>
            </div>
        );
    }

    if (schemaError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <Card className="w-full max-w-2xl border-orange-200 shadow-lg">
                    <CardHeader className="bg-orange-50 border-b border-orange-100 pb-6 rounded-t-lg">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                                <CardTitle className="text-xl text-orange-900">Database Schema Incomplete</CardTitle>
                                <CardDescription className="text-orange-700 mt-1">
                                    The table <strong>public.{schemaError}</strong> is missing.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4 text-slate-600">
                        <p>
                            We've detected that the required PostgreSQL tables have not been created in your Supabase project. 
                            The application cannot run safely without them.
                        </p>
                        <div className="bg-slate-900 rounded-lg p-4 flex items-start justify-between">
                            <div className="text-sm font-mono text-slate-300">
                                <div>-- To fix this, run the provided schema:</div>
                                <div className="mt-2 text-white">1. Go to your Supabase Dashboard</div>
                                <div className="text-white">2. Open the SQL Editor</div>
                                <div className="text-white">3. Paste and run the <code>schema.sql</code> file</div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={copySchema} className="shrink-0 gap-2">
                                <Copy className="w-4 h-4" /> Copy SQL
                            </Button>
                        </div>
                        <p className="text-sm">
                            Once executed, refresh this page to continue. The system is designed to never query tables that do not exist to prevent data corruption.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
};

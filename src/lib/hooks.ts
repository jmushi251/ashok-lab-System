import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { toast } from 'sonner';

export function useQuery<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>,
    dependencies: any[] = []
) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = async () => {
        setLoading(true);
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timed out after 30 seconds. Please verify your Supabase database server is active and credentials are correct.')), 30000)
            );
            const result = await Promise.race([queryFn(), timeoutPromise]) as any;
            if (result.error) throw result.error;
            setData(result.data);
            setError(null);
        } catch (err: any) {
            console.error('Query error:', err);
            setError(err);
            toast.error(err.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, dependencies);

    return { data, loading, error, refetch };
}

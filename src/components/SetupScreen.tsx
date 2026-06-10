import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export const SetupScreen = () => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  const handleSave = () => {
    if (url && key) {
      localStorage.setItem('SUPABASE_URL', url);
      localStorage.setItem('SUPABASE_KEY', key);
      window.location.reload();
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Welcome to APLDMS</CardTitle>
          <CardDescription>
            Please configure your Supabase Project settings. Or set them in the environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Supabase URL</Label>
            <Input 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              placeholder="https://your-project.supabase.co" 
            />
          </div>
          <div className="space-y-2">
            <Label>Supabase Anon Key</Label>
            <Input 
              value={key} 
              onChange={(e) => setKey(e.target.value)} 
              type="password"
              placeholder="eyJh..." 
            />
          </div>
          <Button onClick={handleSave} className="w-full">Save Configuration</Button>
          <div className="text-sm text-gray-500 mt-4">
             <p>Dont forget to run the `schema.sql` code located in `/supabase/schema.sql` in your Supabase SQL editor!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

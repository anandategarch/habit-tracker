'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon,
  User,
  Palette,
  Globe,
  Target,
  Save,
  AlertTriangle,
  Database,
  Trash2,
} from 'lucide-react';

interface AppSettings {
  id: string;
  userName: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  weekStart: string;
  language: string;
  targetCompletion: number;
  createdAt: string;
  updatedAt: string;
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-green-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function FormRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="sm:w-64 shrink-0">{children}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-4">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex justify-between items-center">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-9 w-64" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbStats, setDbStats] = useState<{ habits: number; logs: number; days: number } | null>(null);

  // Local form state
  const [form, setForm] = useState({
    userName: '',
    theme: 'light',
    primaryColor: '#22c55e',
    secondaryColor: '#10b981',
    weekStart: 'monday',
    language: 'en',
    targetCompletion: 80,
  });

  const updateField = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setSettings(d);
          setForm({
            userName: d.userName || '',
            theme: d.theme || 'light',
            primaryColor: d.primaryColor || '#22c55e',
            secondaryColor: d.secondaryColor || '#10b981',
            weekStart: d.weekStart || 'monday',
            language: d.language || 'en',
            targetCompletion: d.targetCompletion ?? 80,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Fetch DB stats
    Promise.allSettled([
      fetch('/api/habits').then((r) => r.json()),
      fetch('/api/daily-logs').then((r) => r.json()),
    ]).then(([habitsRes, logsRes]) => {
      if (cancelled) return;
      const habitsCount = habitsRes.status === 'fulfilled' ? (Array.isArray(habitsRes.value) ? habitsRes.value.length : habitsRes.value?.habits?.length ?? 0) : 0;
      const logsCount = logsRes.status === 'fulfilled' ? (Array.isArray(logsRes.value) ? logsRes.value.length : logsRes.value?.logs?.length ?? 0) : 0;
      setDbStats({ habits: habitsCount, logs: logsCount, days: 0 });
    });

    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/50">
          <SettingsIcon className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Customize your habit tracker experience</p>
        </div>
      </div>

      <Separator />

      {/* Profile Section */}
      <SectionCard icon={User} title="Profile">
        <FormRow label="User Name" description="Display name for your account">
          <Input
            value={form.userName}
            onChange={(e) => updateField('userName', e.target.value)}
            placeholder="Enter your name"
            className="h-9"
          />
        </FormRow>
      </SectionCard>

      {/* Appearance Section */}
      <SectionCard icon={Palette} title="Appearance">
        <FormRow label="Theme" description="Choose your preferred theme">
          <Select value={form.theme} onValueChange={(v) => updateField('theme', v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>

        <Separator className="my-2" />

        <FormRow label="Primary Color" description="Main accent color">
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={form.primaryColor}
              onChange={(e) => updateField('primaryColor', e.target.value)}
              className="h-9 w-12 p-1 cursor-pointer"
            />
            <Input
              value={form.primaryColor}
              onChange={(e) => updateField('primaryColor', e.target.value)}
              placeholder="#22c55e"
              className="h-9 font-mono text-sm"
            />
          </div>
        </FormRow>

        <FormRow label="Secondary Color" description="Supporting accent color">
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={form.secondaryColor}
              onChange={(e) => updateField('secondaryColor', e.target.value)}
              className="h-9 w-12 p-1 cursor-pointer"
            />
            <Input
              value={form.secondaryColor}
              onChange={(e) => updateField('secondaryColor', e.target.value)}
              placeholder="#10b981"
              className="h-9 font-mono text-sm"
            />
          </div>
        </FormRow>
      </SectionCard>

      {/* Preferences Section */}
      <SectionCard icon={Globe} title="Preferences">
        <FormRow label="Week Start" description="First day of the week">
          <Select value={form.weekStart} onValueChange={(v) => updateField('weekStart', v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monday">Monday</SelectItem>
              <SelectItem value="sunday">Sunday</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>

        <Separator className="my-2" />

        <FormRow label="Language" description="Interface language">
          <Select value={form.language} onValueChange={(v) => updateField('language', v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="id">Bahasa Indonesia</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>

        <Separator className="my-2" />

        <FormRow label="Target Completion" description="Daily completion target percentage">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.targetCompletion}
              onChange={(e) => updateField('targetCompletion', Math.min(100, Math.max(0, Number(e.target.value))))}
              className="h-9 w-20 text-center"
            />
            <span className="text-sm text-muted-foreground font-medium">%</span>
          </div>
        </FormRow>
      </SectionCard>

      {/* Data Section */}
      <SectionCard icon={Database} title="Data">
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{dbStats?.habits ?? '-'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Habits</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{dbStats?.logs ?? '-'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Logs</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{dbStats?.days ?? '-'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Days Tracked</p>
            </div>
          </div>

          <Separator className="my-2" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-red-600 dark:text-red-400">Reset All Data</Label>
              <p className="text-xs text-muted-foreground">Permanently delete all habits and logs</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/50 dark:text-red-400 dark:hover:text-red-300"
              onClick={() => {
                toast.error('Data reset is not available in this version');
              }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Reset
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Last updated */}
      {settings?.updatedAt && (
        <p className="text-xs text-center text-muted-foreground">
          Last updated: {new Date(settings.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
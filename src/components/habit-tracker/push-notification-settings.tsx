'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff, Check, Loader2, Send, Clock, Wallet, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
type PS = 'default'|'granted'|'denied'|'unsupported';
// Decode base64url VAPID public key into a 65-byte Uint8Array (P-256 uncompressed point).
// Uint8Array is a valid BufferSource; no need to wrap/copy the underlying ArrayBuffer.
// Previous impl `new Uint8Array(o.buffer.slice(0))` worked but was confusing and could
// return wrong length if `o` were ever a view onto a larger buffer.
function b64(t:string){const p='='.repeat((4-(t.length%4))%4);const b=(t+p).replace(/-/g,'+').replace(/_/g,'/');const r=atob(b);const o=new Uint8Array(r.length);for(let i=0;i<r.length;i++)o[i]=r.charCodeAt(i);return o;}
export function PushNotificationSettings(){
  const [perm,setPerm]=useState<PS>('default');const [sub,setSub]=useState(false);const [load,setLoad]=useState(false);const [test,setTest]=useState(false);const [sav,setSav]=useState(false);
  const vk=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [he,setHe]=useState(true);const[ht,setHt]=useState('08:00');const[be,setBe]=useState(true);const[bt,setBt]=useState('12:00');const[se,setSe]=useState(true);const[st,setSt]=useState('20:00');
  useEffect(()=>{if(typeof window==='undefined')return;if(!('serviceWorker'in navigator)||!('PushManager'in window)){setPerm('unsupported');return;}const p=Notification.permission;if(p==='granted'||p==='denied'||p==='default')setPerm(p);navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(s=>setSub(!!s)).catch(()=>{});fetch('/api/settings').then(r=>r.json()).then(d=>{if(d.pushHabitTime)setHt(d.pushHabitTime);if(d.pushHabitEnabled!==undefined)setHe(d.pushHabitEnabled);if(d.pushBudgetTime)setBt(d.pushBudgetTime);if(d.pushBudgetEnabled!==undefined)setBe(d.pushBudgetEnabled);if(d.pushSpendingTime)setSt(d.pushSpendingTime);if(d.pushSpendingEnabled!==undefined)setSe(d.pushSpendingEnabled);}).catch(()=>{});},[]);
  const save=useCallback(async()=>{setSav(true);try{const r=await fetch('/api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pushHabitEnabled:he,pushHabitTime:ht,pushBudgetEnabled:be,pushBudgetTime:bt,pushSpendingEnabled:se,pushSpendingTime:st})});if(!r.ok)throw new Error('f');toast.success('Jadwal disimpan!');}catch{toast.error('Gagal simpan.');}finally{setSav(false);}},[he,ht,be,bt,se,st]);
  const subFn=useCallback(async()=>{setLoad(true);try{
    // 1. Validate VAPID key on client
    if(!vk||vk.length<50){toast.error('VAPID key belum dikonfigurasi.');return;}
    // Pre-flight: ensure PushManager + content encodings are usable. Chrome Android
    // sometimes returns true for `('PushManager' in window)` but has no usable
    // content encoding (e.g. broken profile) → subscribe() would throw AbortError.
    if(typeof PushManager!=='undefined'&&PushManager.supportedContentEncodings&&PushManager.supportedContentEncodings.length===0){toast.error('Browser tidak mendukung push encoding. Coba update Chrome/Firefox ke versi terbaru.');return;}
    // 2. Explicitly register SW FIRST, then wait for `.ready`. Avoids the race
    // where `navigator.serviceWorker.ready` hangs forever because no SW has been
    // registered yet (e.g. when sw-register.tsx's `load` event hasn't fired or
    // failed). The previous 5s-timeout-then-register fallback was flaky on slow
    // Android devices where the timeout fired before the SW finished installing.
    await navigator.serviceWorker.register('/sw.js');
    const r=await navigator.serviceWorker.ready;
    // 3. Request notification permission
    const p=await Notification.requestPermission();
    if(p!=='granted'){toast.error('Permission ditolak.');setPerm('denied');return;}setPerm('granted');
    // 4. Clean up any stale local subscription whose endpoint may no longer be
    // valid at FCM. A stale local sub can cause pushManager.subscribe() to throw
    // AbortError 'Registration failed - push service error' on Chrome Android.
    // (Re-subscribing creates a fresh endpoint; we send the new one to the server.)
    try{const old=await r.pushManager.getSubscription();if(old)await old.unsubscribe();}catch{}
    // 5. Subscribe (with one retry on AbortError, which Chrome Android sometimes
    // throws transiently due to FCM registration race on first attempt).
    let s:PushSubscription|undefined;let lastErr:unknown='';let attempt=0;
    while(attempt<2){try{const key=b64(vk);s=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});break;}catch(e){lastErr=e;attempt++;const m=e instanceof Error?e.message:String(e);
      // Retry only on the FCM/push-service error (AbortError). Other errors (permission,
      // VAPID key format) won't be fixed by retrying.
      if(!m.includes('push service error')&&!m.includes('Registration failed')&&!m.includes('AbortError'))break;
      if(attempt<2){try{const old=await r.pushManager.getSubscription();if(old)await old.unsubscribe();}catch{}await new Promise(res=>setTimeout(res,500));}}}
    if(!s){throw lastErr;}
    // 6. Send subscription to server
    const sj=s.toJSON();const res=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sj.endpoint,keys:sj.keys,userAgent:navigator.userAgent})});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||`S${res.status}`);}
    setSub(true);toast.success('Aktif! Klik Test.');
  }catch(e){try{const r=await navigator.serviceWorker.ready;const s=await r.pushManager.getSubscription();if(s)await s.unsubscribe();}catch{}setSub(false);console.error('Push subscribe failed:',e);const m=e instanceof Error?e.message:String(e);
    // Android-specific advice: Chrome Android's 'push service error' is most often
    // caused by OS-level notification block, Chrome site-quieting, or incognito mode.
    if(m.includes('push service error')||m.includes('Registration failed'))toast.error('Gagal daftar ke push service. Coba: (1) refresh halaman lalu klik Aktifkan lagi, (2) pastikan tidak di mode incognito, (3) cek Settings > Apps > Chrome > Notifications aktif, (4) coba install sebagai PWA (Add to Home Screen). Jika tetap gagal, coba browser lain.');
    else if(m.includes('VAPID')||m.includes('key'))toast.error('VAPID bermasalah. Hubungi admin.');
    else if(m.includes('permission')||m.includes('denied')||m.includes('NotAllowed'))toast.error('Permission notifikasi ditolak. Aktifkan di pengaturan browser.');
    else toast.error(`Gagal: ${m}`);
  }finally{setLoad(false);}},[vk]);
  const unsub=useCallback(async()=>{setLoad(true);try{const r=await navigator.serviceWorker.ready;const s=await r.pushManager.getSubscription();if(s){await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(s.endpoint)}`,{method:'DELETE'});await s.unsubscribe();}setSub(false);toast.success('Dinonaktifkan.');}catch{toast.error('Gagal.');}finally{setLoad(false);}},[]);
  const testFn=useCallback(async()=>{setTest(true);try{const r=await fetch('/api/push/test',{method:'POST'});const d=await r.json();if(d.success)toast.success(`Terkirim ke ${d.sent} device!`);else toast.error(d.error||'Gagal.');}catch(e){toast.error(`Gagal: ${e instanceof Error?e.message:''}`);}finally{setTest(false);}},[]);
  if(perm==='unsupported')return(<Card className="border-dashed"><CardContent className="p-4 flex items-center gap-3"><BellOff className="h-5 w-5 text-muted-foreground shrink-0"/><div><p className="text-sm font-medium">Notifikasi Push</p><p className="text-xs text-muted-foreground mt-0.5">Tidak didukung. Coba Chrome Android atau PWA iOS 16.4+.</p></div></CardContent></Card>);
  return(<Card><CardContent className="p-4 space-y-3"><div className="flex items-center gap-3"><div className="shrink-0">{sub?<div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center"><Check className="h-5 w-5 text-success"/></div>:<div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center"><Bell className="h-5 w-5 text-muted-foreground"/></div>}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium">Notifikasi Push</p><p className="text-xs text-muted-foreground mt-0.5">{sub?'Aktif. Klik Test untuk cek.':'Aktifkan untuk reminder harian.'}</p></div><Button size="sm" variant={sub?'outline':'default'} onClick={sub?unsub:subFn} disabled={load||perm==='denied'} className="shrink-0">{load&&<Loader2 className="h-4 w-4 mr-1 animate-spin"/>}{sub?'Nonaktifkan':'Aktifkan'}</Button></div>{sub&&(<><div className="flex gap-2 pt-1 border-t border-border/50"><Button size="sm" variant="outline" onClick={testFn} disabled={test} className="w-full">{test?<Loader2 className="h-4 w-4 mr-1.5 animate-spin"/>:<Send className="h-4 w-4 mr-1.5"/>}{test?'Mengirim...':'Test Notifikasi'}</Button></div><div className="space-y-3 pt-2 border-t border-border/50"><div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground"/><p className="text-xs font-semibold text-muted-foreground uppercase">Jadwal Notifikasi</p></div><div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"><Bell className="h-4 w-4 text-primary shrink-0"/><div className="flex-1 min-w-0"><p className="text-xs font-medium">Reminder Habit</p><p className="text-[10px] text-muted-foreground">Habit belum selesai</p></div><Input type="time" value={ht} onChange={e=>setHt(e.target.value)} className="w-24 h-8 text-xs" disabled={!he}/><Switch checked={he} onCheckedChange={setHe}/></div><div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"><Wallet className="h-4 w-4 text-warning shrink-0"/><div className="flex-1 min-w-0"><p className="text-xs font-medium">Alert Budget</p><p className="text-[10px] text-muted-foreground">Budget mendekati limit</p></div><Input type="time" value={bt} onChange={e=>setBt(e.target.value)} className="w-24 h-8 text-xs" disabled={!be}/><Switch checked={be} onCheckedChange={setBe}/></div><div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"><TrendingDown className="h-4 w-4 text-destructive shrink-0"/><div className="flex-1 min-w-0"><p className="text-xs font-medium">Spending</p><p className="text-[10px] text-muted-foreground">Pengeluaran hari ini</p></div><Input type="time" value={st} onChange={e=>setSt(e.target.value)} className="w-24 h-8 text-xs" disabled={!se}/><Switch checked={se} onCheckedChange={setSe}/></div><Button size="sm" onClick={save} disabled={sav} className="w-full">{sav&&<Loader2 className="h-4 w-4 mr-1.5 animate-spin"/>}Simpan Jadwal</Button></div></>)}</CardContent></Card>);
}

import { useEffect, useState } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useStandaloneMode } from "@/hooks/useStandaloneMode";
import { supabase } from "@/integrations/supabase/client";
import InstallAppButton from "@/components/InstallAppButton";

type Prefs = {
  workshop_reminders: boolean;
  class_reminders: boolean;
  live_class_alerts: boolean;
  assignment_due: boolean;
  new_messages: boolean;
  marketing: boolean;
};

const DEFAULTS: Prefs = {
  workshop_reminders: true,
  class_reminders: true,
  live_class_alerts: true,
  assignment_due: true,
  new_messages: true,
  marketing: false,
};

const LABELS: Record<keyof Prefs, { title: string; desc: string }> = {
  workshop_reminders: { title: "Workshop reminders", desc: "Get notified before workshops you registered for begin." },
  class_reminders: { title: "Class reminders", desc: "Daily class schedule and last-minute changes." },
  live_class_alerts: { title: "Live class starting", desc: "Alert when an instructor goes live." },
  assignment_due: { title: "Assignment due soon", desc: "24h and 2h reminders before deadline." },
  new_messages: { title: "New messages", desc: "When you receive a new private message or reply." },
  marketing: { title: "Promotions", desc: "Course launches, discount codes and events." },
};

const NotificationSettingsCard = () => {
  const { user } = useAuth();
  const standalone = useStandaloneMode();
  const { eligible, subscribed, busy, enable, disable, permission } = usePushNotifications();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          workshop_reminders: data.workshop_reminders,
          class_reminders: data.class_reminders,
          live_class_alerts: data.live_class_alerts,
          assignment_due: data.assignment_due,
          new_messages: data.new_messages,
          marketing: data.marketing,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const update = async (key: keyof Prefs, value: boolean) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    if (error) {
      setPrefs(prefs);
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading font-bold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> App Notifications
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time push reminders for classes, workshops and assignments. Available only inside the installed
            app.
          </p>
        </div>
      </div>

      {!standalone && (
        <div className="rounded-lg border border-dashed bg-muted/40 p-4 flex items-start gap-3">
          <Smartphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Install the app to enable push notifications</p>
            <p className="text-xs text-muted-foreground mt-1">
              Browser tabs cannot deliver advanced reminders. Install the app to your home screen — you will receive
              notifications even when the app is closed.
            </p>
            <div className="mt-3">
              <InstallAppButton />
            </div>
          </div>
        </div>
      )}

      {standalone && eligible && (
        <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">
              {subscribed ? "Push notifications are ON" : "Push notifications are OFF"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {permission === "denied"
                ? "Permission was blocked. Enable notifications for this app from your device settings."
                : subscribed
                  ? "This device will receive reminders even when the app is closed."
                  : "Turn on to start receiving reminders on this device."}
            </p>
          </div>
          {subscribed ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => disable()}>
              <BellOff className="h-4 w-4 mr-1.5" /> Turn off
            </Button>
          ) : (
            <Button size="sm" disabled={busy || permission === "denied"} onClick={() => enable()}>
              <Bell className="h-4 w-4 mr-1.5" /> Turn on
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3 pt-1">
        {(Object.keys(LABELS) as (keyof Prefs)[]).map((key) => (
          <div key={key} className="flex items-start justify-between gap-4 py-1">
            <div className="min-w-0">
              <p className="text-sm font-medium">{LABELS[key].title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{LABELS[key].desc}</p>
            </div>
            <Switch
              checked={prefs[key]}
              disabled={loading}
              onCheckedChange={(v) => update(key, v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationSettingsCard;

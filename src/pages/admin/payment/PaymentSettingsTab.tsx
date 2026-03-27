import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Save, Smartphone, Building2, CreditCard } from 'lucide-react';

interface GatewayConfig {
  gateway_name: string;
  display_name: string;
  icon: React.ReactNode;
  supportsSendMoney: boolean;
  merchantFields: { key: string; label: string; type?: string; placeholder?: string }[];
  sendMoneyFields: { key: string; label: string; type?: string; placeholder?: string }[];
}

const GATEWAYS: GatewayConfig[] = [
  {
    gateway_name: 'bkash', display_name: 'bKash', icon: <Smartphone className="h-5 w-5 text-pink-600" />,
    supportsSendMoney: true,
    merchantFields: [
      { key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' },
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'api_secret', label: 'API Secret', type: 'password' },
    ],
    sendMoneyFields: [
      { key: 'phone_number', label: 'bKash Number', placeholder: '01XXXXXXXXX' },
      { key: 'account_type', label: 'Account Type', placeholder: 'Personal / Agent' },
    ],
  },
  {
    gateway_name: 'nagad', display_name: 'Nagad', icon: <Smartphone className="h-5 w-5 text-orange-600" />,
    supportsSendMoney: true,
    merchantFields: [
      { key: 'merchant_id', label: 'Merchant ID' },
      { key: 'public_key', label: 'Public Key', type: 'password' },
      { key: 'private_key', label: 'Private Key', type: 'password' },
    ],
    sendMoneyFields: [
      { key: 'phone_number', label: 'Nagad Number', placeholder: '01XXXXXXXXX' },
      { key: 'account_type', label: 'Account Type', placeholder: 'Personal / Agent' },
    ],
  },
  {
    gateway_name: 'rocket', display_name: 'Rocket', icon: <Smartphone className="h-5 w-5 text-purple-600" />,
    supportsSendMoney: true,
    merchantFields: [
      { key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' },
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'api_secret', label: 'API Secret', type: 'password' },
    ],
    sendMoneyFields: [
      { key: 'phone_number', label: 'Rocket Number', placeholder: '01XXXXXXXXX8' },
      { key: 'account_type', label: 'Account Type', placeholder: 'Personal / Agent' },
    ],
  },
  {
    gateway_name: 'bank', display_name: 'Bank Transfer', icon: <Building2 className="h-5 w-5 text-primary" />,
    supportsSendMoney: false,
    merchantFields: [
      { key: 'bank_name', label: 'Bank Name', placeholder: 'Sonali Bank' },
      { key: 'account_name', label: 'Account Name' },
      { key: 'account_number', label: 'Account Number' },
      { key: 'branch', label: 'Branch Name' },
      { key: 'routing_number', label: 'Routing Number' },
    ],
    sendMoneyFields: [],
  },
  {
    gateway_name: 'uddoktapay', display_name: 'UddoktaPay', icon: <CreditCard className="h-5 w-5 text-blue-600" />,
    supportsSendMoney: false,
    merchantFields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password' },
    ],
    sendMoneyFields: [],
  },
  {
    gateway_name: 'sslcommerz', display_name: 'SSLCommerz', icon: <CreditCard className="h-5 w-5 text-green-600" />,
    supportsSendMoney: false,
    merchantFields: [
      { key: 'store_id', label: 'Store ID' },
      { key: 'store_password', label: 'Store Password', type: 'password' },
    ],
    sendMoneyFields: [],
  },
];

const PaymentSettingsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<Record<string, { credentials: Record<string, string>; is_active: boolean; sandbox: boolean; payment_mode: string }>>({});

  const { data: gateways, isLoading } = useQuery({
    queryKey: ['payment-gateways'],
    queryFn: async () => {
      const { data } = await supabase.from('payment_gateways' as any).select('*');
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    if (gateways) {
      const state: typeof formState = {};
      GATEWAYS.forEach(gw => {
        const existing = gateways.find((g: any) => g.gateway_name === gw.gateway_name);
        const creds = existing?.credentials || {};
        state[gw.gateway_name] = {
          credentials: typeof creds === 'object' ? creds as Record<string, string> : {},
          is_active: existing?.is_active || false,
          sandbox: (typeof creds === 'object' && (creds as any).sandbox) || false,
          payment_mode: (typeof creds === 'object' && (creds as any).payment_mode) || 'merchant',
        };
      });
      setFormState(state);
    }
  }, [gateways]);

  const saveMutation = useMutation({
    mutationFn: async (gatewayName: string) => {
      const state = formState[gatewayName];
      if (!state) return;
      const credentials = { ...state.credentials, sandbox: state.sandbox, payment_mode: state.payment_mode };
      const existing = gateways?.find((g: any) => g.gateway_name === gatewayName);
      const config = GATEWAYS.find(g => g.gateway_name === gatewayName)!;

      if (existing) {
        await supabase.from('payment_gateways' as any).update({ credentials, is_active: state.is_active } as any).eq('id', existing.id);
      } else {
        await supabase.from('payment_gateways' as any).insert({ gateway_name: gatewayName, display_name: config.display_name, credentials, is_active: state.is_active } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast({ title: 'Gateway settings saved' });
    },
    onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
  });

  const updateField = (gateway: string, field: string, value: string) => {
    setFormState(prev => ({
      ...prev,
      [gateway]: { ...prev[gateway], credentials: { ...prev[gateway]?.credentials, [field]: value } },
    }));
  };

  const toggleActive = (gateway: string, active: boolean) => {
    setFormState(prev => ({ ...prev, [gateway]: { ...prev[gateway], is_active: active } }));
  };

  const toggleSandbox = (gateway: string, sandbox: boolean) => {
    setFormState(prev => ({ ...prev, [gateway]: { ...prev[gateway], sandbox } }));
  };

  const setPaymentMode = (gateway: string, mode: string) => {
    setFormState(prev => ({ ...prev, [gateway]: { ...prev[gateway], payment_mode: mode } }));
  };

  if (isLoading) return <div className="text-muted-foreground">Loading payment gateways...</div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Configure payment gateways. For bKash, Nagad, Rocket you can choose Merchant API or Send Money (manual payment) mode.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {GATEWAYS.map(gw => {
          const state = formState[gw.gateway_name] || { credentials: {}, is_active: false, sandbox: false, payment_mode: 'merchant' };
          const hasSandbox = ['bkash', 'nagad', 'sslcommerz'].includes(gw.gateway_name);
          const currentMode = state.payment_mode || 'merchant';
          const fields = gw.supportsSendMoney && currentMode === 'send_money' ? gw.sendMoneyFields : gw.merchantFields;

          return (
            <Card key={gw.gateway_name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {gw.icon}
                    {gw.display_name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{state.is_active ? 'Active' : 'Inactive'}</span>
                    <Switch checked={state.is_active} onCheckedChange={v => toggleActive(gw.gateway_name, v)} />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {hasSandbox && (
                    <CardDescription className="flex items-center gap-2">
                      <Switch checked={state.sandbox} onCheckedChange={v => toggleSandbox(gw.gateway_name, v)} className="scale-75" />
                      <span className="text-xs">Sandbox</span>
                    </CardDescription>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Mode toggle for mobile banking */}
                {gw.supportsSendMoney && (
                  <div className="space-y-1">
                    <Label className="text-xs">Payment Mode</Label>
                    <Tabs value={currentMode} onValueChange={v => setPaymentMode(gw.gateway_name, v)}>
                      <TabsList className="h-8">
                        <TabsTrigger value="merchant" className="text-xs px-3 h-6">Merchant API</TabsTrigger>
                        <TabsTrigger value="send_money" className="text-xs px-3 h-6">Send Money</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    {currentMode === 'send_money' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Customers will see your number and send money manually. You verify with Transaction ID.
                      </p>
                    )}
                  </div>
                )}

                {fields.map(field => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      type={field.type || 'text'}
                      placeholder={field.placeholder || ''}
                      value={state.credentials[field.key] || ''}
                      onChange={e => updateField(gw.gateway_name, field.key, e.target.value)}
                    />
                  </div>
                ))}
                <Button size="sm" onClick={() => saveMutation.mutate(gw.gateway_name)} disabled={saveMutation.isPending}>
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentSettingsTab;

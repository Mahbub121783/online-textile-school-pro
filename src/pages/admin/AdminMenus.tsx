import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, Save, ChevronDown, ChevronUp } from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  url: string;
  children?: MenuItem[];
}

const AdminMenus = () => {
  const [selectedLocation, setSelectedLocation] = useState('header');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const queryClient = useQueryClient();

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ['admin-menus'],
    queryFn: async () => {
      const { data } = await supabase.from('menus' as any).select('*');
      return data ?? [];
    },
  });

  const loadMenu = (location: string) => {
    setSelectedLocation(location);
    const menu = menus.find((m: any) => m.location === location) as any;
    if (menu) {
      setMenuId(menu.id);
      setMenuName(menu.name);
      setMenuItems((menu.items as MenuItem[]) || []);
    } else {
      setMenuId(null);
      setMenuName(`${location.charAt(0).toUpperCase() + location.slice(1)} Menu`);
      setMenuItems([]);
    }
  };

  useState(() => { if (menus.length) loadMenu('header'); });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: menuName, location: selectedLocation, items: menuItems as any };
      if (menuId) {
        await supabase.from('menus' as any).update(payload).eq('id', menuId);
      } else {
        await supabase.from('menus' as any).insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menus'] });
      toast.success('Menu saved');
    },
    onError: () => toast.error('Failed to save menu'),
  });

  const addItem = () => {
    setMenuItems([...menuItems, { id: crypto.randomUUID(), label: '', url: '' }]);
  };

  const updateItem = (id: string, field: string, value: string) => {
    setMenuItems(menuItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id: string) => {
    setMenuItems(menuItems.filter(item => item.id !== id));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...menuItems];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newItems.length) return;
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setMenuItems(newItems);
  };

  const addChild = (parentId: string) => {
    setMenuItems(menuItems.map(item => {
      if (item.id === parentId) {
        return { ...item, children: [...(item.children || []), { id: crypto.randomUUID(), label: '', url: '' }] };
      }
      return item;
    }));
  };

  const updateChild = (parentId: string, childId: string, field: string, value: string) => {
    setMenuItems(menuItems.map(item => {
      if (item.id === parentId && item.children) {
        return { ...item, children: item.children.map(c => c.id === childId ? { ...c, [field]: value } : c) };
      }
      return item;
    }));
  };

  const removeChild = (parentId: string, childId: string) => {
    setMenuItems(menuItems.map(item => {
      if (item.id === parentId && item.children) {
        return { ...item, children: item.children.filter(c => c.id !== childId) };
      }
      return item;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-2xl font-bold">Menu Builder</h2>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" /> Save Menu
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <Label>Menu Location:</Label>
        <Select value={selectedLocation} onValueChange={loadMenu}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="header">Header</SelectItem>
            <SelectItem value="footer">Footer</SelectItem>
            <SelectItem value="sidebar">Sidebar</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1">
          <Input value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Menu name" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Menu Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {menuItems.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">No menu items. Click "Add Item" to start.</p>
          )}
          {menuItems.map((item, index) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input value={item.label} onChange={(e) => updateItem(item.id, 'label', e.target.value)} placeholder="Label" className="flex-1" />
                <Input value={item.url} onChange={(e) => updateItem(item.id, 'url', e.target.value)} placeholder="/url" className="flex-1" />
                <Button variant="ghost" size="icon" onClick={() => moveItem(index, 'up')} disabled={index === 0}><ChevronUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => moveItem(index, 'down')} disabled={index === menuItems.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => addChild(item.id)}><Plus className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {item.children?.map(child => (
                <div key={child.id} className="flex items-center gap-2 ml-8 bg-muted/30 rounded-lg p-2">
                  <span className="text-muted-foreground text-xs">↳</span>
                  <Input value={child.label} onChange={(e) => updateChild(item.id, child.id, 'label', e.target.value)} placeholder="Sub-label" className="flex-1" />
                  <Input value={child.url} onChange={(e) => updateChild(item.id, child.id, 'url', e.target.value)} placeholder="/url" className="flex-1" />
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeChild(item.id, child.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMenus;

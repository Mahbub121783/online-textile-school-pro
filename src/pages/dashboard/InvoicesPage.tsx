import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { FileText, Download, Loader2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useState } from 'react';
import jsPDF from 'jspdf';

const InvoicesPage = () => {
  const { user } = useAuth();
  const { data: settingsMap } = useSettings();
  const siteName = settingsMap?.site_name || 'Online Textile School';
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['my-invoices', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, user_id, order_id, invoice_number, total_amount, status, currency, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch order items for all invoices
  const orderIds = (invoices ?? []).map((inv: any) => inv.order_id).filter(Boolean);
  const { data: allOrderItems = [] } = useQuery({
    queryKey: ['invoice-order-items', orderIds.join(',')],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('order_items')
        .select('id, order_id, item_type, item_id, quantity, price')
        .in('order_id', orderIds)
        .limit(500);
      return data ?? [];
    },
  });

  // Fetch course/ebook names
  const courseIds = [...new Set(allOrderItems.filter((i: any) => i.item_type === 'course').map((i: any) => i.item_id))];
  const ebookIds = [...new Set(allOrderItems.filter((i: any) => i.item_type === 'ebook').map((i: any) => i.item_id))];

  const { data: courses = [] } = useQuery({
    queryKey: ['invoice-courses', courseIds.join(',')],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').in('id', courseIds);
      return data ?? [];
    },
  });

  const { data: ebooks = [] } = useQuery({
    queryKey: ['invoice-ebooks', ebookIds.join(',')],
    enabled: ebookIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('ebooks').select('id, title').in('id', ebookIds);
      return data ?? [];
    },
  });

  const getItemName = (item: any) => {
    if (item.item_type === 'course') return courses.find((c: any) => c.id === item.item_id)?.title || 'Course';
    return ebooks.find((e: any) => e.id === item.item_id)?.title || 'eBook';
  };

  const getOrderItems = (orderId: string) => allOrderItems.filter((i: any) => i.order_id === orderId);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge variant="default">Paid</Badge>;
      case 'pending': return <Badge variant="secondary">Pending</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const generateInvoicePDF = async (inv: any) => {
    setDownloading(inv.id);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = doc.internal.pageSize.getWidth();
      const items = getOrderItems(inv.order_id);

      let y = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(siteName, 15, y);
      y += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text('Dhaka, Bangladesh', 15, y);
      y += 12;

      // INVOICE title
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('INVOICE', w - 15, 20, { align: 'right' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Invoice #: ${inv.invoice_number}`, w - 15, 30, { align: 'right' });
      doc.text(`Date: ${inv.created_at ? format(new Date(inv.created_at), 'dd MMM yyyy') : '—'}`, w - 15, 36, { align: 'right' });
      doc.text(`Status: ${(inv.payment_status || 'pending').toUpperCase()}`, w - 15, 42, { align: 'right' });

      // Divider
      y += 4;
      doc.setDrawColor(200);
      doc.line(15, y, w - 15, y);
      y += 10;

      // Bill To
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Bill To:', 15, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      doc.text(inv.billing_name || '—', 15, y); y += 5;
      doc.text(inv.billing_email || '—', 15, y); y += 5;
      doc.text(`Phone: ${inv.billing_phone || '—'}`, 15, y); y += 5;
      doc.text(`District: ${inv.billing_district || '—'}`, 15, y); y += 10;

      // Payment Info
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Payment Method:', 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(inv.payment_method?.replace(/_/g, ' ') || '—', 55, y);
      y += 10;

      // Table header
      doc.setFillColor(240, 240, 240);
      doc.rect(15, y, w - 30, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('#', 18, y + 5.5);
      doc.text('Product', 28, y + 5.5);
      doc.text('Type', 120, y + 5.5);
      doc.text('Amount', w - 18, y + 5.5, { align: 'right' });
      y += 12;

      // Table rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      items.forEach((item: any, idx: number) => {
        doc.setTextColor(40);
        doc.text(`${idx + 1}`, 18, y);
        doc.text(getItemName(item), 28, y);
        doc.text(item.item_type === 'course' ? 'Course' : 'eBook', 120, y);
        doc.text(`৳${Number(item.price).toLocaleString()}`, w - 18, y, { align: 'right' });
        y += 7;
      });

      if (items.length === 0) {
        doc.setTextColor(120);
        doc.text('No items', 28, y);
        y += 7;
      }

      // Divider
      y += 3;
      doc.setDrawColor(200);
      doc.line(15, y, w - 15, y);
      y += 8;

      // Totals
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text('Subtotal:', 120, y);
      doc.text(`৳${Number(inv.subtotal).toLocaleString()}`, w - 18, y, { align: 'right' });
      y += 6;

      if (inv.discount_amount > 0) {
        doc.text('Discount:', 120, y);
        doc.text(`-৳${Number(inv.discount_amount).toLocaleString()}`, w - 18, y, { align: 'right' });
        y += 6;
      }

      if (inv.coupon_code) {
        doc.text('Coupon:', 120, y);
        doc.text(inv.coupon_code, w - 18, y, { align: 'right' });
        y += 6;
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.text('Total:', 120, y);
      doc.text(`৳${Number(inv.total).toLocaleString()}`, w - 18, y, { align: 'right' });
      y += 15;

      // Footer
      doc.setDrawColor(200);
      doc.line(15, y, w - 15, y);
      y += 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120);
      doc.text('This is an auto-generated invoice. No signature required.', w / 2, y, { align: 'center' });
      y += 5;
      doc.text(`${siteName} — Dhaka, Bangladesh`, w / 2, y, { align: 'center' });

      doc.save(`${inv.invoice_number}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
        <FileText className="h-6 w-6" /> My Invoices
      </h2>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Coupon</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : invoices?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No invoices yet.</TableCell></TableRow>
                ) : (
                  invoices?.map((inv: any) => {
                    const items = getOrderItems(inv.order_id);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono font-medium text-xs">{inv.invoice_number}</TableCell>
                        <TableCell className="text-sm">{inv.created_at ? format(new Date(inv.created_at), 'MMM d, yyyy') : '—'}</TableCell>
                        <TableCell className="max-w-[160px]">
                          <div className="flex flex-wrap gap-1">
                            {items.map((item: any) => (
                              <Badge key={item.id} variant="outline" className="text-xs truncate max-w-[120px]">
                                {getItemName(item)}
                              </Badge>
                            ))}
                            {items.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">৳{Number(inv.total).toLocaleString()}</span>
                            {inv.discount_amount > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">(saved ৳{Number(inv.discount_amount).toLocaleString()})</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(inv.payment_status ?? 'pending')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{inv.payment_method?.replace(/_/g, ' ') || '—'}</TableCell>
                        <TableCell className="text-xs">{inv.coupon_code || '—'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generateInvoicePDF(inv)}
                            disabled={downloading === inv.id}
                            title="Download Invoice"
                          >
                            {downloading === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicesPage;

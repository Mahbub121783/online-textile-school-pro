import { useCurrencies, useCurrencyStore } from '@/hooks/useCurrency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CurrencySelector = () => {
  const { data: currencies = [] } = useCurrencies();
  const { selectedCurrency, setSelectedCurrency } = useCurrencyStore();

  if (currencies.length <= 1) return null;

  return (
    <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
      <SelectTrigger className="w-20 h-8 text-xs border-none bg-transparent">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((c: any) => (
          <SelectItem key={c.code} value={c.code}>
            {c.symbol} {c.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CurrencySelector;

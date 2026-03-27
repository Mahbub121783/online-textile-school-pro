import { Star, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';

const MOCK_EBOOKS = [
  { id: 'e1', title: 'Fundamentals of Spinning', author: 'Dr. Rahman', price: 500, rating: 4.7, cover: '' },
  { id: 'e2', title: 'Weaving Technology Handbook', author: 'Prof. Karim', price: 750, rating: 4.5, cover: '' },
  { id: 'e3', title: 'Color Chemistry for Textiles', author: 'Dr. Fatema', price: 600, rating: 4.9, cover: '' },
  { id: 'e4', title: 'Textile Quality Standards', author: 'Mr. Alam', price: 450, rating: 4.6, cover: '' },
];

const EbookShowcase = () => {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <section className="py-12 md:py-16 bg-secondary">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">eBook Library</h2>
          <p className="text-muted-foreground">Digital textbooks from textile industry experts</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {MOCK_EBOOKS.map((book) => (
            <div key={book.id} className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-all group">
              <div className="aspect-[2/3] bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
                <div className="text-center text-primary-foreground">
                  <span className="text-3xl mb-2 block">📚</span>
                  <p className="font-heading font-semibold text-sm leading-tight">{book.title}</p>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <h3 className="font-heading font-semibold text-sm line-clamp-1">{book.title}</h3>
                <p className="text-xs text-muted-foreground">{book.author}</p>
                <div className="flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3 fill-warning text-warning" />{book.rating}
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-heading font-bold text-sm">৳{book.price}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => addItem({ id: book.id, type: 'ebook', title: book.title, price: book.price })}
                  >
                    <ShoppingCart className="h-3 w-3 mr-1" />Buy
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EbookShowcase;

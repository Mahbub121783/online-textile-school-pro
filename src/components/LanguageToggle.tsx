import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

const LanguageToggle = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'bn' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('preferred_language', newLang);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="gap-1 text-xs font-medium h-8 px-2"
      title={i18n.language === 'en' ? 'বাংলায় পরিবর্তন করুন' : 'Switch to English'}
    >
      <Globe className="h-3.5 w-3.5" />
      {i18n.language === 'en' ? 'বাং' : 'EN'}
    </Button>
  );
};

export default LanguageToggle;

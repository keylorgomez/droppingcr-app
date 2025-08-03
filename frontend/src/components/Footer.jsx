import React from 'react';
import { useTranslation } from 'react-i18next';
import { Instagram } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { SOCIAL_LINKS } from '../constants/socialLinks';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { t: footerTranslate } = useTranslation('footerFlow');

  return (
    <footer className="bg-[#1e1e1e] text-white pt-10 pb-6 mt-10">
      <div className="max-w-screen-lg mx-auto px-4 flex flex-col items-center">
        
        <div className="flex items-center space-x-3 mb-6 font-poppins text-xl font-semibold">
          <img
            src="/droppingCR.png"
            alt="Dropping Logo"
            className="h-6 w-auto"
          />
          <span>{footerTranslate('appName')}</span>
        </div>

        <div className="flex space-x-3 mb-6">
          <a
            href=
            {SOCIAL_LINKS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors duration-200"
            aria-label="Instagram"
          >
            <Instagram className="w-6 h-6" />
          </a>
          <a
            href={SOCIAL_LINKS.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors duration-200"
            aria-label="WhatsApp"
          >
            <FaWhatsapp className="w-6 h-6" />
          </a>
        </div>

        <hr className="w-full border-t border-white/20 border-2 mb-4" />

        <p className="text-sm text-center font-light">
          © {currentYear} {footerTranslate('appName')}.
        </p>
        <p className="text-sm text-center font-light">
          {footerTranslate('rights')}
        </p>
      </div>
    </footer>
  );
}

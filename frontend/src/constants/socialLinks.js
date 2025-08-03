//Message constants for whatsapp
const phoneNumber = '50670489611';
const message = 'Hola👋, me gustaría obtener más información sobre una prenda vista en la web 📦';
const encodedMessage = encodeURIComponent(message);

export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/dropping.cr/',
  whatsapp: `https://api.whatsapp.com/send/?phone=${phoneNumber}&text=${encodedMessage}&app_absent=0`,
};

import Header from './components/Header';
import Footer from './components/Footer';
import TypewriterBanner from './components/TypewriterBanner';
import DropTitle from './components/DropTitle';
function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <TypewriterBanner />
      <DropTitle dropNumber="001" />

      <main className="flex-grow">
        {/* tu contenido va aquí */}
      </main>

      <Footer />
    </div>
  );
}

export default App;

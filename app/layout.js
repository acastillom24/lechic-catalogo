import "../styles/globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { SeleccionProvider } from "../lib/SelectionContext";
import SelectionPanel from "../components/SelectionPanel";

export const metadata = {
  title: "Le Chic · Catálogo de fragancias y belleza",
  description:
    "Catálogo Le Chic: Ésika, L'Bel, Cyzone, Yanbal, Natura, Avon, Dupree, Oriflame e importaciones.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SeleccionProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <SelectionPanel />
        </SeleccionProvider>
      </body>
    </html>
  );
}

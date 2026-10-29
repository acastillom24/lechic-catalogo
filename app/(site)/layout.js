import "../../styles/globals.css";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { SeleccionProvider } from "../../lib/SelectionContext";
import SelectionPanel from "../../components/SelectionPanel";
import { ConfigProvider } from "../../lib/ConfigContext";
import { getConfigSitio } from "../../lib/config";

export async function generateMetadata() {
  const { seo } = await getConfigSitio();
  return { title: seo.titulo, description: seo.descripcion };
}

export default async function RootLayout({ children }) {
  const config = await getConfigSitio();
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
        <ConfigProvider valor={config}>
          <SeleccionProvider>
            <Navbar />
            <main>{children}</main>
            <Footer />
            <SelectionPanel />
          </SeleccionProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}

// pages/_app.js
import '@/styles/globals.css'; // Adjust path if your globals.css is elsewhere

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;

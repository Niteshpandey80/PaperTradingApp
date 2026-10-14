import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PriceProvider } from './context/PriceContext.jsx';
import { TradingProvider } from './context/TradingContext.jsx';
import Login from './pages/Login.jsx';
import Terminal from './pages/Terminal.jsx';

function Gate() {
  const { user } = useAuth();
  if (!user) return <Login />;
  return (
    <TradingProvider key={user}>
      <Terminal />
    </TradingProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PriceProvider>
        <Gate />
      </PriceProvider>
    </AuthProvider>
  );
}

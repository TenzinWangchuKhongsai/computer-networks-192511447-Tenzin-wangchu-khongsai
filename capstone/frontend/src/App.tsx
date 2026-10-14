import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Overview from './pages/Overview';
import LiveCamera from './pages/LiveCamera';
import LiveMonitoring from './pages/LiveMonitoring';
import Rooms from './pages/Rooms';
import RoomDetailPage from './pages/RoomDetailPage';
import Sensors from './pages/Sensors';
import Devices from './pages/Devices';
import Automation from './pages/Automation';
import EnergyAnalytics from './pages/EnergyAnalytics';
import EventsAlerts from './pages/EventsAlerts';
import SimulationControl from './pages/SimulationControl';
import About from './pages/About';
import RealDevices from './pages/RealDevices';
import Architecture from './pages/Architecture';
import TestMode from './pages/TestMode';
import NetworkAccess from './pages/NetworkAccess';
import SystemHealth from './pages/SystemHealth';


function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Overview />} />
          <Route path="/camera" element={<LiveCamera />} />
          <Route path="/live-camera" element={<Navigate to="/camera" replace />} />
          <Route path="/real-devices" element={<RealDevices />} />
          <Route path="/network" element={<NetworkAccess />} />
          <Route path="/system-health" element={<SystemHealth />} />
          <Route path="/monitoring" element={<LiveMonitoring />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:id" element={<RoomDetailPage />} />
          <Route path="/sensors" element={<Sensors />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/energy" element={<EnergyAnalytics />} />
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/test-mode" element={<TestMode />} />
          <Route path="/events" element={<EventsAlerts />} />
          <Route path="/simulation" element={<SimulationControl />} />
          <Route path="/about" element={<About />} />
          <Route path="/settings" element={<Navigate to="/about" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

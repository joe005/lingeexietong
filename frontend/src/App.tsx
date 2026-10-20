import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import AppLayout from './components/AppLayout';
import MallsPage from './pages/MallsPage';
import MallDetailPage from './pages/MallDetailPage';
import FloorDetailPage from './pages/FloorDetailPage';
import RobotDetailPage from './pages/RobotDetailPage';
import MonitorPage from './pages/MonitorPage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import MaintenancePage from './pages/MaintenancePage';
import AnalyticsPage from './pages/AnalyticsPage';
import RobotSimPage from './pages/RobotSimPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/malls" replace />} />
            <Route path="/malls" element={<MallsPage />} />
            <Route path="/malls/:id" element={<MallDetailPage />} />
            <Route path="/malls/:mallId/floors/:floorId" element={<FloorDetailPage />} />
            <Route path="/robots/:id" element={<RobotDetailPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/robot-sim" element={<RobotSimPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

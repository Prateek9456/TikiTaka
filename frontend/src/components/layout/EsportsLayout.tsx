import { Outlet } from 'react-router-dom';
import { DashboardProvider } from '../../context/DashboardContext';
import { AppShell } from './AppShell';

export function EsportsLayout() {
  return (
    <DashboardProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </DashboardProvider>
  );
}

import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/context';
import { Spinner } from '@/components/ui';
import { AttendancePage, CalendarPage, EmployeesPage, NotesPage, NotificationsPage, ReportsPage, SalaryPage, SettingsPage } from '@/pages/company';
import { DashboardDetailPage, DashboardPage, SearchPage } from '@/pages/Dashboard';
import { LoginPage } from '@/pages/Login';
import { BankDetailPage, BanksPage, ExpensesPage, FounderDetailPage, FounderFinancePage, FoundersPage, IncomePage, LedgerDetailPage, LedgerPage } from '@/pages/records';
import { MarketingPage } from '@/pages/marketing';
import { PersonalPage } from '@/pages/personal';
import { TargetsPage } from '@/pages/Targets';
import { WorksPage } from '@/pages/Works';
import { ClientDetailPage, ClientsPage, InvoiceDetailPage, InvoicesPage, PaymentsPage, ProjectsPage } from '@/pages/work';

function Guard({ children, permission }: { children: ReactNode; permission?: string }) {
  const { user, ready, can } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) return <div className="rounded-3xl border border-line p-8"><h1 className="text-xl font-semibold">You do not have access to this section.</h1></div>;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route path="/" element={<Guard permission="dashboard.view"><DashboardPage /></Guard>} />
        <Route path="/dashboard/:metric" element={<Guard permission="dashboard.view"><DashboardDetailPage /></Guard>} />
        <Route path="/targets" element={<Guard permission="dashboard.view"><TargetsPage /></Guard>} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/founders" element={<Guard permission="founders.view"><FoundersPage /></Guard>} />
        <Route path="/founders/:id" element={<Guard permission="founders.view"><FounderDetailPage /></Guard>} />
        <Route path="/founder-finance" element={<Guard permission="founderFinance.view"><FounderFinancePage /></Guard>} />
        <Route path="/clients" element={<Guard permission="clients.view"><ClientsPage /></Guard>} />
        <Route path="/marketing" element={<Guard permission="clients.view"><MarketingPage /></Guard>} />
        <Route path="/clients/:id" element={<Guard permission="clients.view"><ClientDetailPage /></Guard>} />
        <Route path="/projects" element={<Guard permission="projects.view"><ProjectsPage /></Guard>} />
        <Route path="/works" element={<Guard permission="dashboard.view"><WorksPage /></Guard>} />
        <Route path="/payments" element={<Guard permission="payments.view"><PaymentsPage /></Guard>} />
        <Route path="/income" element={<Guard permission="income.view"><IncomePage /></Guard>} />
        <Route path="/expenses" element={<Guard permission="expenses.view"><ExpensesPage /></Guard>} />
        <Route path="/personal" element={<Guard permission="founderFinance.view"><PersonalPage /></Guard>} />
        <Route path="/banks" element={<Guard permission="banks.view"><BanksPage /></Guard>} />
        <Route path="/banks/:id" element={<Guard permission="banks.view"><BankDetailPage /></Guard>} />
        <Route path="/ledger" element={<Guard permission="ledger.view"><LedgerPage /></Guard>} />
        <Route path="/ledger/:id" element={<Guard permission="ledger.view"><LedgerDetailPage /></Guard>} />
        <Route path="/invoices" element={<Guard permission="invoices.view"><InvoicesPage /></Guard>} />
        <Route path="/invoices/:id" element={<Guard permission="invoices.view"><InvoiceDetailPage /></Guard>} />
        <Route path="/employees" element={<Guard permission="employees.view"><EmployeesPage /></Guard>} />
        <Route path="/attendance" element={<Guard permission="attendance.view"><AttendancePage /></Guard>} />
        <Route path="/salary" element={<Guard permission="salary.view"><SalaryPage /></Guard>} />
        <Route path="/calendar" element={<Guard permission="calendar.view"><CalendarPage /></Guard>} />
        <Route path="/notes" element={<Guard permission="notes.view"><NotesPage /></Guard>} />
        <Route path="/reports" element={<Guard permission="reports.view"><ReportsPage /></Guard>} />
        <Route path="/notifications" element={<Guard permission="notifications.view"><NotificationsPage /></Guard>} />
        <Route path="/settings" element={<Guard permission="settings.view"><SettingsPage /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

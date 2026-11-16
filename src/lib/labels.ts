export const INCOME_CATEGORIES = [
  'Website Development', 'Software Development', 'Digital Marketing', 'Video Editing', 'Branding',
  'Freelance Work', 'Maintenance', 'Client Payments', 'Other Income',
];

export const EXPENSE_CATEGORIES = [
  'Food', 'Rent', 'Employee Salary', 'Electricity', 'Internet', 'Software Subscription',
  'ads Marketing', 'Other Expenses',
];

export const PAYMENT_METHODS = [
  ['cash', 'Cash'],
  ['bank_transfer', 'Bank transfer'],
] as const;

export const EVENT_TYPES = ['Client Meeting', 'Project Deadline', 'Payment Due', 'Employee Event', 'Business Meeting', 'Personal Reminder'];

export const PROJECT_STATUSES = ['Planning', 'Not Started', 'In Progress', 'Review', 'Completed', 'On Hold'];
export const TASK_STATUSES = ['To Do', 'In Progress', 'Review', 'Completed'];

export const PERMISSIONS = [
  'dashboard.view', 'founders.view', 'founders.manage', 'clients.view', 'clients.manage',
  'projects.view', 'projects.manage', 'payments.view', 'payments.manage', 'income.view', 'income.manage',
  'expenses.view', 'expenses.manage', 'banks.view', 'banks.manage', 'ledger.view', 'ledger.post',
  'founderFinance.view', 'founderFinance.manage', 'invoices.view', 'invoices.manage',
  'employees.view', 'employees.manage', 'attendance.view', 'attendance.manage', 'salary.view', 'salary.manage',
  'calendar.view', 'calendar.manage', 'notes.view', 'notes.manage', 'reports.view', 'reports.export',
  'notifications.view', 'settings.view', 'settings.manage', 'users.manage',
];

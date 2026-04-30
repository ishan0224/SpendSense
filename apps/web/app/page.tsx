export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
      <div className="w-full rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">SpendSense</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manual expense tracker is ready for Phase 02 flows.
        </p>
        <div className="mt-4">
          <a className="text-sm font-medium text-slate-900 underline" href="/dashboard">
            Go to Dashboard
          </a>
        </div>
        <div className="mt-2">
          <a className="text-sm font-medium text-slate-900 underline" href="/import">
            Import Statement
          </a>
        </div>
        <div className="mt-2">
          <a className="text-sm font-medium text-slate-900 underline" href="/rules">
            Manage Rules
          </a>
        </div>
        <div className="mt-2">
          <a className="text-sm font-medium text-slate-900 underline" href="/budgets">
            Manage Budgets
          </a>
        </div>
        <div className="mt-2">
          <a className="text-sm font-medium text-slate-900 underline" href="/logs">
            View Logs
          </a>
        </div>
        <div className="mt-2">
          <a className="text-sm font-medium text-slate-900 underline" href="/settings">
            Settings
          </a>
        </div>
      </div>
    </main>
  );
}

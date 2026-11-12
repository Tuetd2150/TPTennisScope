import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Activity, Menu, X, BarChart3, Users, Trophy } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: Activity },
  { path: '/rankings', label: 'Rankings', icon: Trophy },
  { path: '/compare', label: 'Compare', icon: Users },
];

export function AppLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-surface-elevated/95 backdrop-blur-sm border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
                <BarChart3 className="w-4 h-4 text-accent" />
              </div>
              <div>
                <span className="text-lg font-bold text-text-primary">Tennis<span className="text-accent">Scope</span></span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ path, label, icon: Icon }) => {
                const isActive = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-badge text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-accent/15 text-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Toggle */}
            <button
              className="md:hidden p-2 text-text-secondary hover:text-text-primary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-surface-border bg-surface-elevated">
            <div className="px-4 py-3 space-y-1">
              {navItems.map(({ path, label, icon: Icon }) => {
                const isActive = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-badge text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-accent/15 text-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border bg-surface-elevated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text-primary">Tennis<span className="text-accent">Scope</span></span>
            </div>
            <p className="text-xs text-text-muted text-center">
              ATP analytics, clearly understood. Data provided by Tennis API.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

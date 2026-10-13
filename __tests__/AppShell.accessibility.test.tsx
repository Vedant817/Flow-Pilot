import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AppShell from '@/components/AppShell';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/orders',
}));
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: null }),
  UserButton: () => <button>Account</button>,
}));

beforeEach(() => {
  mockPush.mockClear();
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn(),
  });
});

test('navigation contains keyboard focus, closes with Escape and restores its opener', () => {
  render(<AppShell><button>Page action</button></AppShell>);
  const opener = screen.getByRole('button', { name: 'Open navigation' });
  opener.focus();
  fireEvent.click(opener);
  const drawer = screen.getByRole('dialog', { name: 'Navigation' });
  const close = within(drawer).getByRole('button', { name: 'Close navigation' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(within(drawer).getByRole('button', { name: 'Close sidebar' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test('navigation link closes the drawer', () => {
  render(<AppShell>Content</AppShell>);
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  const link = within(screen.getByRole('dialog')).getByRole('link', { name: 'Orders' });
  expect(link).toHaveAttribute('aria-current', 'page');
  fireEvent.click(link);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test.each([
  ['Email Drafts', '/email-drafts'],
  ['Email Reviews', '/email-reviews'],
])('email navigation %s is available in the drawer and palette', (label, href) => {
  render(<AppShell><span>Unique page content</span></AppShell>);
  expect(screen.getAllByText('Unique page content')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  const drawer = screen.getByRole('dialog', { name: 'Navigation' });
  const link = within(drawer).getByRole('link', { name: label });
  expect(link).toHaveAttribute('href', href);
  fireEvent.click(link);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const input = screen.getByRole('combobox', { name: 'Search commands' });
  fireEvent.change(input, { target: { value: label } });
  expect(screen.getByRole('option', { name: label })).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mockPush).toHaveBeenCalledWith(href);
});

test('palette exposes selected commands, contains focus and restores focus', () => {
  render(<AppShell>Content</AppShell>);
  const opener = screen.getByRole('button', { name: /Jump to/ });
  opener.focus();
  fireEvent.click(opener);
  expect(screen.getByRole('dialog', { name: 'Command palette' })).toHaveAttribute('aria-modal', 'true');
  const input = screen.getByRole('combobox', { name: 'Search commands' });
  expect(input).toHaveFocus();
  expect(screen.getByRole('option', { name: 'Orders' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(screen.getByRole('option', { name: 'Inventory' })).toHaveAttribute('aria-selected', 'true');
  expect(input).toHaveAttribute('aria-activedescendant', 'command-1');
  fireEvent.keyDown(input, { key: 'Tab' });
  expect(input).toHaveFocus();
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(opener).toHaveFocus();
});

test('palette filtering and Enter navigate; empty results are announced', () => {
  render(<AppShell>Content</AppShell>);
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'not-a-command' } });
  expect(screen.getByRole('status')).toHaveTextContent('No matches');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(input).not.toHaveAttribute('aria-activedescendant');
  fireEvent.change(input, { target: { value: 'Analytics' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mockPush).toHaveBeenCalledWith('/analytics');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

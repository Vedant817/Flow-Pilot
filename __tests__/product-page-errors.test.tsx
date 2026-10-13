import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import InventoryPage from '@/app/(app)/inventory/page';
import OrdersPage from '@/app/(app)/orders/page';
import NetworkPage from '@/app/(app)/network/page';

jest.mock('axios');
jest.mock('@/components/AddProductDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/EditProductDialog', () => ({ __esModule: true, default: () => null }));

const get = axios.get as jest.Mock;
const put = axios.put as jest.Mock;
const fetchMock = global.fetch as jest.Mock;
const response = (data: unknown) => ({ ok: true, json: async () => data });
const overview = {
  available: true,
  source: { name: 'UCI', license: 'CC BY 4.0' },
  summary: {
    dealers: 0, active: 0, revenue: 0, outstanding: 0, overdue: 0,
    avgServiceLevel: 0, highRisk: 0, returnRate: 0, returnValue: 0, creditUtilization: 0,
  },
  trend: [], territories: [], topProducts: [], riskQueue: [], recentReturns: [],
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  delete process.env.NEXT_PUBLIC_API_URL;
});

afterEach(() => jest.restoreAllMocks());

test('inventory failure hides zero KPIs and onboarding, and retry loads the empty state', async () => {
  get.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({
    data: {
      data: [], pagination: { total: 0, totalPages: 1 },
      summary: { totalProducts: 0, lowStock: 0, totalValue: 0, categories: 0 },
    },
  });
  render(<InventoryPage />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText('Get started by adding your first product')).not.toBeInTheDocument();
  expect(screen.queryByText('Total Products')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Get started by adding your first product')).toBeInTheDocument();
});

test('network failure is not import onboarding and retry can show a genuinely unimported warehouse', async () => {
  fetchMock.mockImplementation((url: string) => url.startsWith('/api/network/overview')
    ? Promise.resolve({ ok: false })
    : Promise.resolve(response({ data: [], filters: { countries: [] }, pagination: { total: 0, totalPages: 1 } })));
  render(<NetworkPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load network overview');
  expect(screen.queryByText('Public demo warehouse is ready to import')).not.toBeInTheDocument();
  fetchMock.mockResolvedValue(response({ available: false }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Public demo warehouse is ready to import')).toBeInTheDocument();
});

test('dealer failure shows retry instead of a false empty result', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(url.startsWith('/api/network/overview')
    ? response(overview) : { ok: false }));
  render(<NetworkPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'accounts' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load dealer accounts');
  expect(screen.queryByText('No dealer accounts match these filters.')).not.toBeInTheDocument();
  expect(screen.queryByText('0 accounts')).not.toBeInTheDocument();
  fetchMock.mockResolvedValue(response({
    data: [], filters: { countries: [] }, pagination: { total: 0, totalPages: 1 },
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry dealer accounts' }));
  expect(await screen.findByText('No dealer accounts match these filters.')).toBeInTheDocument();
});

test.each([undefined, 'https://example.test/api/'])('order status uses the configured base or /api and exposes failure (%s)', async (base) => {
  if (base) process.env.NEXT_PUBLIC_API_URL = base;
  get.mockResolvedValue({ data: {
    data: [{
      _id: 'order12345678', status: 'pending', products: [],
      name: 'Test customer', email: 'test@example.test', date: '2026-01-01', time: '12:00',
    }],
    pagination: { total: 100, totalPages: 12 },
  } });
  put.mockRejectedValue(new Error('offline'));
  render(<OrdersPage />);
  await screen.findByText('#12345678');
  expect(screen.getByText('Completed on current page')).toBeInTheDocument();
  expect(screen.getByText('Pending on current page')).toBeInTheDocument();
  expect(screen.getByText('Partial on current page')).toBeInTheDocument();
  const statusSelect = screen.getAllByRole('combobox').find((element) => (element as HTMLSelectElement).value === 'pending');
  expect(statusSelect).toBeDefined();
  fireEvent.change(statusSelect!, { target: { value: 'pending fulfillment' } });
  await waitFor(() => expect(put).toHaveBeenCalledWith(
    `${base ? base.replace(/\/$/, '') : '/api'}/orders`,
    { orderId: 'order12345678', status: 'pending fulfillment', expectedStatus: 'pending' },
  ));
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update order status');
  expect(statusSelect).toHaveValue('pending');
});

test('cancellation requires an explicit reason and confirmation', async () => {
  get.mockResolvedValue({ data: {
    data: [{
      _id: 'order12345678', status: 'pending fulfillment', products: [],
      name: 'Test customer', email: 'test@example.test', date: '2026-01-01', time: '12:00',
    }],
    pagination: { total: 1, totalPages: 1 },
  } });
  put.mockResolvedValue({ data: { order: { status: 'canceled' } } });
  render(<OrdersPage />);
  const select = await screen.findByRole('combobox', { name: 'Status for order 12345678' });
  fireEvent.change(select, { target: { value: 'canceled' } });
  expect(put).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Confirm cancellation' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: 'Customer requested cancellation' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  await waitFor(() => expect(put).toHaveBeenCalledWith('/api/orders', {
    orderId: 'order12345678', expectedStatus: 'pending fulfillment', status: 'canceled',
    reason: 'Customer requested cancellation',
  }));
});

test('fulfilled orders do not offer a status reversal', async () => {
  get.mockResolvedValue({ data: {
    data: [{
      _id: 'order12345678', status: 'fulfilled', products: [],
      name: 'Test customer', email: 'test@example.test', date: '2026-01-01', time: '12:00',
    }],
    pagination: { total: 1, totalPages: 1 },
  } });
  render(<OrdersPage />);
  const select = await screen.findByRole('combobox', { name: 'Status for order 12345678' });
  expect(select).toBeDisabled();
  expect(select.querySelectorAll('option')).toHaveLength(1);
});

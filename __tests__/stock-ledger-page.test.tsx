import React, { Suspense } from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StockLedgerPage from '../app/(app)/inventory/[id]/stock/page';

const fetchMock = global.fetch as jest.Mock;
const response = (body: unknown) => ({ ok: true, json: async () => body });
const stock = { name: 'Widget', quantity: 10, reservedQuantity: 4 };

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(window.crypto, 'randomUUID', { configurable: true, value: () => 'stock:12345678' });
  fetchMock.mockImplementation((url: string) => Promise.resolve(response(
    url.endsWith('/movements') ? { data: [], nextCursor: null } : stock
  )));
});

async function mount() {
  const params = Promise.resolve({ id: 'sku-a' });
  await act(async () => {
    render(<Suspense fallback={<p>Loading page</p>}><StockLedgerPage params={params} /></Suspense>);
  });
  await screen.findByText('Widget — stock ledger');
}

test('distinguishes reserved units from physical and available stock', async () => {
  await mount();
  expect(screen.getByText('On hand: 10 · Reserved: 4 · Available: 6')).toBeInTheDocument();
});

test('retries an uncertain write with the same frozen intent key and payload', async () => {
  let attempts = 0;
  fetchMock.mockImplementation((url: string, options?: { method?: string }) => {
    if (options?.method === 'POST') {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('network interrupted'))
        : Promise.resolve(response({ dedup: true }));
    }
    return Promise.resolve(response(url.endsWith('/movements') ? { data: [], nextCursor: null } : stock));
  });
  await mount();
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Received shipment PO-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record movement' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('network interrupted');
  expect(screen.getByLabelText('Reason')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry same movement' }));
  await waitFor(() => expect(attempts).toBe(2));
  const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(posts[0][1].headers['Idempotency-Key']).toBe(posts[1][1].headers['Idempotency-Key']);
  expect(posts[0][1].body).toBe(posts[1][1].body);
  expect(await screen.findByRole('status')).toHaveTextContent('Original movement confirmed');
});

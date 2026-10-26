import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import AdminReportLinkSearchResults from './AdminReportLinkSearchResults';
import { applyReportLinkSelection } from './reportLinkSelection';

afterEach(cleanup);

describe('AdminReportLinkSearchResults', () => {
  it('renders results and selecting a product fills the seller and product fields', () => {
    const options = {
      sellers: [],
      products: [{
        id: 16,
        title: 'Laptop',
        seller_id: 'seller-1',
        seller_name: 'Reported Seller',
        seller_products: [{ id: 16, title: 'Laptop' }],
      }],
      orders: [],
    };
    function SelectionHarness() {
      const [selection, setSelection] = useState({ seller_id: '', product_id: '', order_id: '' });
      return (
        <>
        <AdminReportLinkSearchResults
          options={options}
          onSelect={(type, target) => {
            setSelection((current) => applyReportLinkSelection(current, type, target));
          }}
        />
        <output data-testid="selected-report-targets">{JSON.stringify(selection)}</output>
        </>
      );
    }
    render(<SelectionHarness />);

    expect(screen.getByRole('button', { name: /Laptop.*Reported Seller/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Laptop.*Reported Seller/ }));

    expect(JSON.parse(screen.getByTestId('selected-report-targets').textContent)).toEqual({
      seller_id: 'seller-1',
      product_id: '16',
      order_id: '',
    });
  });
});

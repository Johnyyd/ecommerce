import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddressBook } from './AddressBook';
import * as locations from '@/lib/locations';
import { useAddressStore } from '@/store/useAddressStore';

vi.mock('@/lib/locations', () => ({
  fetchProvinces: vi.fn(),
  fetchDistricts: vi.fn(),
  fetchWards: vi.fn(),
}));

vi.mock('@/store/useAddressStore', () => ({
  useAddressStore: vi.fn(),
}));

describe('AddressBook Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAddressStore as any).mockReturnValue({
      addresses: [],
      isLoading: false,
      error: null,
      fetchAddresses: vi.fn(),
      createAddress: vi.fn(),
      deleteAddress: vi.fn(),
    });

    (locations.fetchProvinces as any).mockResolvedValue([
      { code: 1, name: 'Thành phố Hà Nội' },
      { code: 79, name: 'Thành phố Hồ Chí Minh' }
    ]);

    (locations.fetchDistricts as any).mockResolvedValue([
      { code: 1, name: 'Quận Ba Đình' }
    ]);
  });

  it('fetches provinces on mount and districts on province selection', async () => {
    render(<AddressBook />);
    
    // Click add new address to show the form
    const addButton = screen.getByText('Add New Address');
    fireEvent.click(addButton);

    // Verify fetchProvinces was called
    await waitFor(() => {
      expect(locations.fetchProvinces).toHaveBeenCalled();
    });

    // Find the province select and choose a province
    const provinceSelect = await screen.findByRole('combobox', { name: /Province \/ City/i });
    
    // Wait for the options to be populated
    await waitFor(() => {
      expect(screen.getByText('Thành phố Hà Nội')).toBeInTheDocument();
    });

    fireEvent.change(provinceSelect, { target: { value: '1' } });

    // Verify fetchDistricts was called with province code 1
    await waitFor(() => {
      expect(locations.fetchDistricts).toHaveBeenCalledWith(1);
    });
  });
});

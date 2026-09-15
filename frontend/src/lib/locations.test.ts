import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProvinces, fetchDistricts, fetchWards } from './locations';

describe('locations API', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('fetches provinces from the open API', async () => {
    const mockProvinces = [
      { code: 1, name: 'Thành phố Hà Nội' },
      { code: 79, name: 'Thành phố Hồ Chí Minh' }
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProvinces
    });

    const result = await fetchProvinces();

    expect(global.fetch).toHaveBeenCalledWith('https://provinces.open-api.vn/api/p/');
    expect(result).toEqual(mockProvinces);
  });
});

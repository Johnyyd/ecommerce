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

  it('fetches districts for a province from the open API', async () => {
    const mockDistricts = [
      { code: 1, name: 'Quận Ba Đình' }
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ districts: mockDistricts })
    });

    const result = await fetchDistricts(1);

    expect(global.fetch).toHaveBeenCalledWith('https://provinces.open-api.vn/api/p/1?depth=2');
    expect(result).toEqual(mockDistricts);
  });

  it('fetches wards for a district from the open API', async () => {
    const mockWards = [
      { code: 1, name: 'Phường Phúc Xá' }
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ wards: mockWards })
    });

    const result = await fetchWards(1);

    expect(global.fetch).toHaveBeenCalledWith('https://provinces.open-api.vn/api/d/1?depth=2');
    expect(result).toEqual(mockWards);
  });
});

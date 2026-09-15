export interface Ward {
  code: number;
  name: string;
}

export interface District {
  code: number;
  name: string;
  wards?: Ward[];
}

export interface Province {
  code: number;
  name: string;
  districts?: District[];
}

const API_BASE = 'https://provinces.open-api.vn/api';

export const fetchProvinces = async (): Promise<Province[]> => {
  const res = await fetch(`${API_BASE}/p/`);
  if (!res.ok) throw new Error('Failed to fetch provinces');
  return res.json();
};

export const fetchDistricts = async (provinceCode: number): Promise<District[]> => {
  const res = await fetch(`${API_BASE}/p/${provinceCode}?depth=2`);
  if (!res.ok) throw new Error('Failed to fetch districts');
  const data = await res.json();
  return data.districts || [];
};

export const fetchWards = async (districtCode: number): Promise<Ward[]> => {
  const res = await fetch(`${API_BASE}/d/${districtCode}?depth=2`);
  if (!res.ok) throw new Error('Failed to fetch wards');
  const data = await res.json();
  return data.wards || [];
};

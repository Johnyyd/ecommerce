import { useState, useEffect } from 'react';
import { useAddressStore, AddressCreate } from '@/store/useAddressStore';
import { fetchProvinces, fetchDistricts, fetchWards, Province, District, Ward } from '@/lib/locations';

function CustomSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled
}: {
  id: string;
  value: string | number;
  onChange: (val: string | number) => void;
  options: { value: string | number, label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`#select-container-${id}`)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, id]);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div id={`select-container-${id}`} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-zinc-900 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={value === '' ? 'text-zinc-500' : 'text-zinc-900'}>{selectedLabel}</span>
        <svg className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-4 py-2 text-zinc-500 text-sm">No options available</div>
          ) : (
            options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-4 py-2 text-sm cursor-pointer hover:bg-zinc-100 ${value === opt.value ? 'bg-zinc-50 font-medium text-zinc-900' : 'text-zinc-700'}`}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function AddressBook() {
  const token = localStorage.getItem('access_token');
  const { addresses, isLoading, error, fetchAddresses, createAddress, deleteAddress } = useAddressStore();
  const [isAdding, setIsAdding] = useState(false);
  
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);

  const [selectedProv, setSelectedProv] = useState<number | ''>('');
  const [selectedDist, setSelectedDist] = useState<number | ''>('');
  const [selectedWard, setSelectedWard] = useState<number | ''>('');
  
  const [street, setStreet] = useState('');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (token) fetchAddresses(token);
    fetchProvinces().then(setProvinces).catch(console.error);
  }, [token, fetchAddresses]);

  useEffect(() => {
    if (selectedProv) {
      fetchDistricts(Number(selectedProv)).then(setDistricts).catch(console.error);
      setSelectedDist('');
      setSelectedWard('');
      setWards([]);
    } else {
      setDistricts([]);
      setWards([]);
      setSelectedDist('');
      setSelectedWard('');
    }
  }, [selectedProv]);

  useEffect(() => {
    if (selectedDist) {
      fetchWards(Number(selectedDist)).then(setWards).catch(console.error);
      setSelectedWard('');
    } else {
      setWards([]);
      setSelectedWard('');
    }
  }, [selectedDist]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    const provName = provinces.find(p => p.code === selectedProv)?.name || '';
    const distName = districts.find(d => d.code === selectedDist)?.name || '';
    const wardName = wards.find(w => w.code === selectedWard)?.name || '';

    if (!selectedProv || !selectedDist || !selectedWard) {
      // Basic form validation for custom selects
      return;
    }

    const newAddress: AddressCreate = {
      province: provName,
      district: distName,
      ward: wardName,
      street_detail: street,
      phone_number: phone,
      is_default: isDefault || addresses.length === 0,
    };

    await createAddress(token, newAddress);
    setIsAdding(false);
    setSelectedProv('');
    setSelectedDist('');
    setSelectedWard('');
    setStreet('');
    setPhone('');
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium tracking-tight text-zinc-900">Address Book</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="text-sm font-medium bg-zinc-900 text-white px-4 py-2 rounded-full hover:bg-zinc-800 transition-colors"
        >
          {isAdding ? 'Cancel' : 'Add New Address'}
        </button>
      </div>

      {error && <div className="text-red-500 text-sm bg-red-50 p-4 rounded-xl">{error}</div>}

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-sm font-medium text-zinc-700">Phone Number</label>
              <input id="phone" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="0912345678" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="province" className="text-sm font-medium text-zinc-700">Province / City</label>
              <CustomSelect
                id="province"
                value={selectedProv}
                onChange={val => setSelectedProv(Number(val) || '')}
                placeholder="Select Province"
                options={provinces.map(p => ({ value: p.code, label: p.name }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="district" className="text-sm font-medium text-zinc-700">District</label>
              <CustomSelect
                id="district"
                disabled={!selectedProv}
                value={selectedDist}
                onChange={val => setSelectedDist(Number(val) || '')}
                placeholder="Select District"
                options={districts.map(d => ({ value: d.code, label: d.name }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ward" className="text-sm font-medium text-zinc-700">Ward</label>
              <CustomSelect
                id="ward"
                disabled={!selectedDist}
                value={selectedWard}
                onChange={val => setSelectedWard(Number(val) || '')}
                placeholder="Select Ward"
                options={wards.map(w => ({ value: w.code, label: w.name }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="street" className="text-sm font-medium text-zinc-700">Street Detail</label>
            <input id="street" required value={street} onChange={e => setStreet(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="123 Nguyen Van Linh" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="default-addr" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900" />
            <label htmlFor="default-addr" className="text-sm text-zinc-700">Set as default address</label>
          </div>
          <button type="submit" disabled={isLoading} className="mt-4 bg-zinc-900 text-white font-medium py-3 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50">
            {isLoading ? 'Saving...' : 'Save Address'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addresses.length === 0 && !isAdding ? (
          <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-200 rounded-2xl">
            You don't have any addresses yet.
          </div>
        ) : (
          addresses.map((addr) => (
            <div key={addr.id} className={`p-5 rounded-2xl border ${addr.is_default ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white'} flex flex-col gap-3 relative`}>
              {addr.is_default && (
                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-zinc-900 bg-zinc-200 px-2 py-1 rounded-sm">Default</span>
              )}
              <p className="font-medium text-zinc-900">{addr.phone_number}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {addr.street_detail}<br />
                {addr.ward}, {addr.district}<br />
                {addr.province}
              </p>
              <button 
                onClick={() => token && deleteAddress(token, addr.id)}
                className="text-xs font-medium text-red-500 hover:text-red-600 mt-2 self-start"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

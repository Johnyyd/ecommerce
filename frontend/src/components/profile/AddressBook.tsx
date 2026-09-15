import { useState, useEffect } from 'react';
import { useAddressStore, AddressCreate } from '@/store/useAddressStore';
import { fetchProvinces, fetchDistricts, fetchWards, Province, District, Ward } from '@/lib/locations';

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
              <select id="province" required value={selectedProv} onChange={e => setSelectedProv(Number(e.target.value) || '')} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white">
                <option value="">Select Province</option>
                {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="district" className="text-sm font-medium text-zinc-700">District</label>
              <select id="district" required disabled={!selectedProv} value={selectedDist} onChange={e => setSelectedDist(Number(e.target.value) || '')} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white">
                <option value="">Select District</option>
                {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ward" className="text-sm font-medium text-zinc-700">Ward</label>
              <select id="ward" required disabled={!selectedDist} value={selectedWard} onChange={e => setSelectedWard(Number(e.target.value) || '')} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white">
                <option value="">Select Ward</option>
                {wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
              </select>
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

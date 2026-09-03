import React, { useState } from 'react';
import {
  Truck,
  Car,
  Bike,
  MapPin,
  Clock,
  ShieldCheck,
  Package,
  ArrowRight,
  Sparkles,
  Phone,
  CheckCircle2,
  DollarSign,
  Search,
  Plus,
  X,
  FileText,
  Lock,
  ChevronRight,
  Send,
  Radio
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface InterCountyRoute {
  id: string;
  driverName: string;
  driverPhone: string;
  vehicleType: 'Car Trunk' | 'Van / Pickup' | 'Motorbike (Long Range)' | 'Light Truck';
  plateNumber: string;
  hasLogbookVerified: boolean;
  fromCounty: string;
  fromHub: string;
  toCounty: string;
  toHub: string;
  departureDate: string;
  departureTime: string;
  availableCapacityKg: number;
  pricePerKgKes: number;
  baseFeeKes: number;
  status: 'scheduled' | 'boarding' | 'in_transit' | 'completed';
  reputationRating: number;
  totalTrips: number;
}

export interface ParcelBooking {
  id: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  itemDescription: string;
  weightKg: number;
  routeId: string;
  fromCounty: string;
  toCounty: string;
  feeKes: number;
  escrowStatus: 'held_in_escrow' | 'in_transit' | 'delivered_and_released';
  pinCode: string;
}

const INITIAL_ROUTES: InterCountyRoute[] = [
  {
    id: 'route-msa-1',
    driverName: 'Captain James Mwaura',
    driverPhone: '0722 *** 891',
    vehicleType: 'Car Trunk',
    plateNumber: 'KDG 492A',
    hasLogbookVerified: true,
    fromCounty: 'Nairobi',
    fromHub: 'CBD Kencom / Railways Hub',
    toCounty: 'Mombasa',
    toHub: 'Nyali Cinemax Drop-point',
    departureDate: 'Today, 6:00 PM',
    departureTime: '18:00',
    availableCapacityKg: 35,
    pricePerKgKes: 25,
    baseFeeKes: 500,
    status: 'scheduled',
    reputationRating: 4.95,
    totalTrips: 84
  },
  {
    id: 'route-ksm-2',
    driverName: 'Otieno Collins (Kisumu Express)',
    driverPhone: '0711 *** 420',
    vehicleType: 'Van / Pickup',
    plateNumber: 'KCS 109W',
    hasLogbookVerified: true,
    fromCounty: 'Nairobi',
    fromHub: 'Westlands Sarit Hub',
    toCounty: 'Kisumu',
    toHub: 'Mega City Mall Hub',
    departureDate: 'Tomorrow, 5:30 AM',
    departureTime: '05:30',
    availableCapacityKg: 220,
    pricePerKgKes: 20,
    baseFeeKes: 650,
    status: 'scheduled',
    reputationRating: 4.91,
    totalTrips: 142
  },
  {
    id: 'route-eld-3',
    driverName: 'Kiprono David',
    driverPhone: '0703 *** 772',
    vehicleType: 'Car Trunk',
    plateNumber: 'KDH 881L',
    hasLogbookVerified: true,
    fromCounty: 'Nairobi',
    fromHub: 'Industrial Area Enterprise Rd',
    toCounty: 'Eldoret',
    toHub: 'Rupa Mills Complex Hub',
    departureDate: 'Tomorrow, 7:00 AM',
    departureTime: '07:00',
    availableCapacityKg: 50,
    pricePerKgKes: 22,
    baseFeeKes: 550,
    status: 'scheduled',
    reputationRating: 4.88,
    totalTrips: 63
  },
  {
    id: 'route-nkr-4',
    driverName: 'Wanjohi Evans',
    driverPhone: '0798 *** 314',
    vehicleType: 'Motorbike (Long Range)',
    plateNumber: 'KMDG 501M',
    hasLogbookVerified: false,
    fromCounty: 'Nairobi',
    fromHub: 'Kangemi / Uthiru Staging',
    toCounty: 'Nakuru',
    toHub: 'Nakuru CBD Posta',
    departureDate: 'Today, 2:00 PM',
    departureTime: '14:00',
    availableCapacityKg: 15,
    pricePerKgKes: 30,
    baseFeeKes: 400,
    status: 'boarding',
    reputationRating: 4.79,
    totalTrips: 29
  }
];

export function InterCountyDesk({
  onClose,
  onBookingComplete
}: {
  onClose?: () => void;
  onBookingComplete?: (booking: ParcelBooking) => void;
}) {
  const [activeTab, setActiveTab] = useState<'routes' | 'post_trip' | 'my_bookings' | 'logbook_info'>('routes');
  const [routes, setRoutes] = useState<InterCountyRoute[]>(INITIAL_ROUTES);
  const [selectedRoute, setSelectedRoute] = useState<InterCountyRoute | null>(null);

  // Filter state
  const [filterCounty, setFilterCounty] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Booking modal form state
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [senderName, setSenderName] = useState('Dennis Kimani');
  const [senderPhone, setSenderPhone] = useState('0712345678');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [weightKg, setWeightKg] = useState<number>(5);

  // Post Trip form state
  const [driverNameInput, setDriverNameInput] = useState('');
  const [plateInput, setPlateInput] = useState('');
  const [vehicleTypeInput, setVehicleTypeInput] = useState<'Car Trunk' | 'Van / Pickup' | 'Motorbike (Long Range)' | 'Light Truck'>('Car Trunk');
  const [fromCountyInput, setFromCountyInput] = useState('Nairobi');
  const [fromHubInput, setFromHubInput] = useState('CBD Kencom');
  const [toCountyInput, setToCountyInput] = useState('Mombasa');
  const [toHubInput, setToHubInput] = useState('Nyali Centre');
  const [departureDateInput, setDepartureDateInput] = useState('Tomorrow, 6:00 AM');
  const [capacityKgInput, setCapacityKgInput] = useState<number>(40);
  const [hasLogbookInput, setHasLogbookInput] = useState(true);

  // Active bookings list
  const [bookings, setBookings] = useState<ParcelBooking[]>([
    {
      id: 'BKG-7712',
      senderName: 'Dennis Kimani',
      senderPhone: '0712345678',
      recipientName: 'Fatma Ali',
      recipientPhone: '0722119933',
      itemDescription: 'Electronics & Spare Parts (Box)',
      weightKg: 8,
      routeId: 'route-msa-1',
      fromCounty: 'Nairobi',
      toCounty: 'Mombasa',
      feeKes: 700,
      escrowStatus: 'held_in_escrow',
      pinCode: '7419'
    }
  ]);

  const [enteredPin, setEnteredPin] = useState('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');

  // Filtered routes
  const filteredRoutes = routes.filter(r => {
    if (filterCounty !== 'All' && r.toCounty !== filterCounty && r.fromCounty !== filterCounty) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.toCounty.toLowerCase().includes(q) ||
        r.fromCounty.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.plateNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleOpenBooking = (route: InterCountyRoute) => {
    soundEngine.play('heavyTap');
    setSelectedRoute(route);
    setIsBookingOpen(true);
  };

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) return;
    soundEngine.play('victory');

    const totalFee = selectedRoute.baseFeeKes + (weightKg * selectedRoute.pricePerKgKes);
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();

    const newBooking: ParcelBooking = {
      id: `BKG-${Math.floor(1000 + Math.random() * 9000)}`,
      senderName,
      senderPhone,
      recipientName: recipientName || 'Recipient',
      recipientPhone: recipientPhone || '0700000000',
      itemDescription: itemDescription || 'General Cargo',
      weightKg,
      routeId: selectedRoute.id,
      fromCounty: selectedRoute.fromCounty,
      toCounty: selectedRoute.toCounty,
      feeKes: totalFee,
      escrowStatus: 'held_in_escrow',
      pinCode: newPin
    };

    setBookings(prev => [newBooking, ...prev]);
    setIsBookingOpen(false);
    setActiveTab('my_bookings');
    onBookingComplete?.(newBooking);
  };

  const handlePostTrip = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.play('victory');

    const newRoute: InterCountyRoute = {
      id: `route-${Date.now()}`,
      driverName: driverNameInput || 'Registered Driver',
      driverPhone: '0712 *** 000',
      vehicleType: vehicleTypeInput,
      plateNumber: plateInput || 'KDA 000X',
      hasLogbookVerified: hasLogbookInput,
      fromCounty: fromCountyInput,
      fromHub: fromHubInput,
      toCounty: toCountyInput,
      toHub: toHubInput,
      departureDate: departureDateInput,
      departureTime: '06:00',
      availableCapacityKg: capacityKgInput,
      pricePerKgKes: 25,
      baseFeeKes: 500,
      status: 'scheduled',
      reputationRating: 5.0,
      totalTrips: 1
    };

    setRoutes(prev => [newRoute, ...prev]);
    setActiveTab('routes');
  };

  const handleVerifyDeliveryPin = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    if (enteredPin === booking.pinCode) {
      soundEngine.play('victory');
      setPinSuccessMsg(`PIN Verified! KES ${booking.feeKes * 0.9} released to driver M-Pesa immediately.`);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, escrowStatus: 'delivered_and_released' } : b));
      setEnteredPin('');
    } else {
      soundEngine.play('defeat');
      setPinSuccessMsg('Invalid 4-Digit PIN. Please check recipient SMS.');
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-3xl overflow-hidden shadow-2xl text-[#0D1117] max-w-4xl mx-auto">
      
      {/* ================= HEADER ================= */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A101D] text-white p-5 sm:p-6 relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-[#00BFEF] text-[#0D1117] uppercase tracking-wider">
                INTER-COUNTY CROSS-DOCKING
              </span>
              <span className="text-xs text-indigo-200 font-bold flex items-center space-x-1">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>Nairobi • Mombasa • Nakuru • Kisumu • Eldoret</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black mt-2 text-white tracking-tight flex items-center space-x-2">
              <span>Long-Distance Traveler & Cargo Matching</span>
              <Sparkles className="w-5 h-5 text-[#FF5A1F]" />
            </h2>
            <p className="text-xs text-indigo-200/80 mt-0.5 max-w-xl">
              Turn empty car boots, pickup beds, and long-distance passenger trips into vetted, high-paying cargo routes with 4-digit PIN escrow security.
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); onClose(); }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1.5 mt-5 border-t border-white/10 pt-3 overflow-x-auto">
          {[
            { id: 'routes', label: 'Available Routes', count: routes.length },
            { id: 'post_trip', label: 'Post Your Trip (Earn 90%)' },
            { id: 'my_bookings', label: 'My Cargo Bookings', count: bookings.length },
            { id: 'logbook_info', label: 'Logbook Ownership Boost' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { soundEngine.play('tap'); setActiveTab(tab.id as any); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === tab.id
                  ? 'bg-white text-[#0D1117] shadow-md font-black'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === tab.id ? 'bg-[#FF5A1F] text-white' : 'bg-white/20 text-white'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ================= TAB 1: AVAILABLE ROUTES ================= */}
      {activeTab === 'routes' && (
        <div className="p-5 sm:p-6 space-y-4">
          
          {/* Controls Bar: County Filter & Search */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['All', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { soundEngine.play('tap'); setFilterCounty(c); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    filterCounty === c
                      ? 'bg-[#0D1117] text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search driver, county, plate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#2563EB] w-full sm:w-56"
              />
            </div>
          </div>

          {/* Routes Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredRoutes.map((route) => (
              <div
                key={route.id}
                className="bg-white border border-[#E5E8EC] hover:border-[#00BFEF] rounded-2xl p-4 transition-all shadow-xs space-y-3 relative group"
              >
                {/* Header row: Driver info & Verified badge */}
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-xs text-[#0D1117]">{route.driverName}</span>
                      {route.hasLogbookVerified && (
                        <span className="inline-flex items-center space-x-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-200" title="Verified Logbook">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                          <span>LOGBOOK VERIFIED</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-mono">
                      <span>{route.plateNumber}</span>
                      <span>•</span>
                      <span>{route.vehicleType}</span>
                      <span>•</span>
                      <span className="text-amber-600 font-bold">★ {route.reputationRating}</span>
                    </div>
                  </div>

                  <span className="text-xs font-black font-mono text-[#0D1117] bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                    KES {route.baseFeeKes}+
                  </span>
                </div>

                {/* Route Path Indicator */}
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-gray-400 uppercase block">From</span>
                    <span className="font-bold text-[#0D1117]">{route.fromCounty}</span>
                    <span className="text-[10px] text-gray-500 block">{route.fromHub}</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#00BFEF] shrink-0" />

                  <div className="space-y-0.5 text-right">
                    <span className="text-[10px] font-mono text-gray-400 uppercase block">To</span>
                    <span className="font-bold text-[#0D1117]">{route.toCounty}</span>
                    <span className="text-[10px] text-gray-500 block">{route.toHub}</span>
                  </div>
                </div>

                {/* Footer details & Action */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1 text-gray-600 text-[11px]">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>{route.departureDate}</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold block">
                      {route.availableCapacityKg} kg spare boot space
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenBooking(route)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0D1117] hover:bg-[#1E293B] text-white font-bold text-xs cursor-pointer transition-all shadow-xs active:scale-95 flex items-center space-x-1"
                  >
                    <Package className="w-3.5 h-3.5 text-[#00BFEF]" />
                    <span>Send Cargo</span>
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* ================= TAB 2: POST YOUR TRIP ================= */}
      {activeTab === 'post_trip' && (
        <form onSubmit={handlePostTrip} className="p-5 sm:p-6 space-y-4 max-w-xl mx-auto text-xs">
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Earn 90% Commission on Unused Luggage Capacity</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Traveling between counties? Fill your trunk or roof rack with parcels heading to the same destination. Verified logbook holders get priority matching.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-gray-700">Driver / Traveler Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Dennis Kimani"
                value={driverNameInput}
                onChange={(e) => setDriverNameInput(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-gray-700">Vehicle Number Plate</label>
              <input
                type="text"
                required
                placeholder="e.g. KDF 123Z"
                value={plateInput}
                onChange={(e) => setPlateInput(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-gray-700">Origin County & Hub</label>
              <select
                value={fromCountyInput}
                onChange={(e) => {
                  setFromCountyInput(e.target.value);
                  setFromHubInput(`${e.target.value} Main Hub`);
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
              >
                <option value="Nairobi">Nairobi (Kencom / Westlands)</option>
                <option value="Mombasa">Mombasa (Nyali / Posta)</option>
                <option value="Nakuru">Nakuru (CBD / Westside)</option>
                <option value="Kisumu">Kisumu (Mega City)</option>
                <option value="Eldoret">Eldoret (Rupa Mall)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-gray-700">Destination County & Hub</label>
              <select
                value={toCountyInput}
                onChange={(e) => {
                  setToCountyInput(e.target.value);
                  setToHubInput(`${e.target.value} Central Hub`);
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
              >
                <option value="Mombasa">Mombasa (Nyali / Posta)</option>
                <option value="Kisumu">Kisumu (Mega City)</option>
                <option value="Nakuru">Nakuru (CBD / Westside)</option>
                <option value="Eldoret">Eldoret (Rupa Mall)</option>
                <option value="Nairobi">Nairobi (Kencom / Westlands)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-gray-700">Vehicle Type</label>
              <select
                value={vehicleTypeInput}
                onChange={(e) => setVehicleTypeInput(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
              >
                <option value="Car Trunk">Car Trunk (Saloons)</option>
                <option value="Van / Pickup">Van / Pickup</option>
                <option value="Motorbike (Long Range)">Motorbike (Long Range)</option>
                <option value="Light Truck">Light Truck</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-gray-700">Spare Boot Space (kg)</label>
              <input
                type="number"
                min="5"
                max="500"
                value={capacityKgInput}
                onChange={(e) => setCapacityKgInput(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-gray-700">Departure Schedule</label>
              <input
                type="text"
                placeholder="e.g. Tomorrow 6:00 AM"
                value={departureDateInput}
                onChange={(e) => setDepartureDateInput(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center space-x-2">
            <input
              type="checkbox"
              id="logbookCheck"
              checked={hasLogbookInput}
              onChange={(e) => setHasLogbookInput(e.target.checked)}
              className="rounded text-[#2563EB] focus:ring-0 cursor-pointer"
            />
            <label htmlFor="logbookCheck" className="text-gray-700 cursor-pointer text-xs">
              <strong>I have a valid NTSA vehicle logbook / ownership certificate</strong> (Grants 90% payout & verified badge)
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-[#FF5A1F] hover:bg-[#ff6f3b] text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Publish Inter-County Route</span>
          </button>
        </form>
      )}

      {/* ================= TAB 3: MY CARGO BOOKINGS & PIN ESCROW ================= */}
      {activeTab === 'my_bookings' && (
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-wider text-[#0D1117]">
              Active Parcel Escrow & Verification PINs
            </h3>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
              Escrow Secured via M-Pesa
            </span>
          </div>

          {bookings.map(b => (
            <div key={b.id} className="bg-white border border-[#E5E8EC] rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-black text-xs text-[#0D1117]">{b.id}</span>
                    <span className="text-[10px] bg-blue-50 text-[#2563EB] font-bold px-2 py-0.5 rounded border border-blue-200">
                      {b.fromCounty} ➔ {b.toCounty}
                    </span>
                  </div>
                  <p className="font-bold text-xs mt-1 text-[#0D1117]">{b.itemDescription}</p>
                  <p className="text-[10px] text-gray-500">Weight: {b.weightKg} kg • Fee: KES {b.feeKes}</p>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-full uppercase ${
                    b.escrowStatus === 'delivered_and_released'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {b.escrowStatus === 'delivered_and_released' ? 'Delivered & Released' : 'Held in Escrow'}
                  </span>
                </div>
              </div>

              {/* 4-digit PIN verification card */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">
                    Recipient Drop-off Release PIN:
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-black font-mono tracking-widest text-[#0D1117] bg-white px-3 py-1 rounded-lg border border-gray-300">
                      {b.pinCode}
                    </span>
                    <span className="text-[10px] text-gray-500">Share with driver upon parcel collection</span>
                  </div>
                </div>

                {b.escrowStatus !== 'delivered_and_released' && (
                  <div className="flex items-center space-x-1.5 w-full sm:w-auto">
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="Enter PIN"
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      className="w-24 bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 font-mono text-xs text-center outline-none focus:border-[#2563EB]"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyDeliveryPin(b.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      Release Escrow
                    </button>
                  </div>
                )}
              </div>

              {pinSuccessMsg && (
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                  {pinSuccessMsg}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ================= TAB 4: LOGBOOK INFO ================= */}
      {activeTab === 'logbook_info' && (
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-2">
            <h4 className="font-black text-sm flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Why We Reward Vehicle Ownership in Kenya</span>
            </h4>
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              In standard ride-hailing and gig delivery models, middleman vehicle leasing companies drain over 40% of courier earnings. Brief & Wairo prioritize independent drivers who own their motorbikes, cars, or vans.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
              <span className="font-bold text-[#0D1117] block">1. 90% Direct Payout</span>
              <p className="text-[10px] text-gray-600 font-sans">You keep KES 90 out of every KES 100 paid by shippers.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
              <span className="font-bold text-[#0D1117] block">2. Priority Matching</span>
              <p className="text-[10px] text-gray-600 font-sans">Logbook-verified drivers appear at the top of shipper searches.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
              <span className="font-bold text-[#0D1117] block">3. Zero Fleet Leases</span>
              <p className="text-[10px] text-gray-600 font-sans">No daily vehicle rental targets eating into your profits.</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= BOOKING MODAL ================= */}
      {isBookingOpen && selectedRoute && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-gray-200 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-[#00BFEF] font-bold uppercase">Booking Parcel Transport</span>
                <h3 className="font-black text-base text-[#0D1117]">{selectedRoute.fromCounty} ➔ {selectedRoute.toCounty}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBookingOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-gray-700">Parcel Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2 Cartons of avocado, Spare parts box"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Estimated Weight (kg)</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedRoute.availableCapacityKg}
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Calculated Fee</label>
                  <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#0D1117]">
                    KES {selectedRoute.baseFeeKes + (weightKg * selectedRoute.pricePerKgKes)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Recipient Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Recipient Name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Recipient Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="07..."
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] space-y-1">
                <div className="flex items-center space-x-1 font-bold">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Escrow Hold via M-Pesa</span>
                </div>
                <p>Funds remain securely in escrow until recipient gives the driver the 4-digit PIN upon arrival.</p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-[#00BFEF] hover:bg-[#00a8d6] text-[#0D1117] font-black text-xs shadow-md cursor-pointer transition-all"
              >
                Confirm Booking & Deposit Escrow
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

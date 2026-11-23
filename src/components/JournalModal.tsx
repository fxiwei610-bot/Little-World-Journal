import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  BookingPaymentStatus,
  ContinentName,
  Country,
  ExpenseCategory,
  ModalContext,
  Trip,
  WishPriority,
  WishStatus,
} from '../types/journal';

interface JournalModalProps {
  modal: ModalContext;
  countries: Country[];
  trips: Trip[];
  currentBudget: number;
  onClose: () => void;
  onSaveTrip: (data: { name: string; country: string; date: string; days: number }) => void;
  onSaveActivity: (data: { tripId: string; title: string }) => void;
  onSaveWish: (data: {
    name: string;
    country: string;
    priority: WishPriority;
    status: WishStatus;
    note: string;
  }) => void;
  onSaveJournal: (data: {
    title: string;
    country: string;
    date: string;
    text: string;
    photoUrl?: string;
  }) => void;
  onSaveBooking: (data: {
    name: string;
    provider: string;
    ref: string;
    date: string;
    status: BookingPaymentStatus;
    amount: number;
    link?: string;
  }) => void;
  onSaveExpense: (data: {
    name: string;
    country: string;
    destination?: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
  }) => void;
  onSaveBudget: (newBudget: number) => void;
  onSaveCountry: (data: {
    name: string;
    continent: ContinentName;
    flag: string;
    capital: string;
  }) => void;
  onSaveDestination: (data: { name: string; country: string; kind: string }) => void;
}

const MODAL_TITLES: Record<NonNullable<ModalContext['type']>, string> = {
  trip: 'Plan a new trip',
  activity: 'Add an itinerary activity',
  wish: 'Add a bucket list destination',
  journal: 'Write a new journal entry',
  booking: 'Save a booking record',
  expense: 'Add a travel expense',
  budget: 'Update trip budget',
  country: 'Add a country',
  destination: 'Add a destination',
};

const CONTINENT_OPTIONS: ContinentName[] = [
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Africa',
  'Oceania',
  'Antarctica',
];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Flights',
  'Accommodation',
  'Food',
  'Transportation',
  'Activities',
  'Shopping',
  'Insurance',
  'Other',
];

export const JournalModal: React.FC<JournalModalProps> = ({
  modal,
  countries,
  trips,
  currentBudget,
  onClose,
  onSaveTrip,
  onSaveActivity,
  onSaveWish,
  onSaveJournal,
  onSaveBooking,
  onSaveExpense,
  onSaveBudget,
  onSaveCountry,
  onSaveDestination,
}) => {
  const defaultCountry = modal.countryName || countries[0]?.name || 'Japan';
  const defaultTripId = modal.tripId || trips[0]?.id || '';
  const todayStr = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [country, setCountry] = useState(defaultCountry);
  const [date, setDate] = useState(todayStr);
  const [days, setDays] = useState('5');
  const [tripId, setTripId] = useState(defaultTripId);
  const [priority, setPriority] = useState<WishPriority>('High');
  const [wishStatus, setWishStatus] = useState<WishStatus>('Dream destination');
  const [note, setNote] = useState('');
  const [text, setText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [provider, setProvider] = useState('');
  const [refCode, setRefCode] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<BookingPaymentStatus>('Paid');
  const [amount, setAmount] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Accommodation');
  const [destination, setDestination] = useState('');
  const [budgetInput, setBudgetInput] = useState(String(currentBudget));
  const [continent, setContinent] = useState<ContinentName>('Asia');
  const [flag, setFlag] = useState('🏳️');
  const [capital, setCapital] = useState('');
  const [destKind, setDestKind] = useState('City');

  useEffect(() => {
    setName('');
    setCountry(modal.countryName || countries[0]?.name || 'Japan');
    setDate(todayStr);
    setDays('5');
    setTripId(modal.tripId || trips[0]?.id || '');
    setPriority('High');
    setWishStatus('Dream destination');
    setNote('');
    setText('');
    setPhotoUrl('');
    setProvider('');
    setRefCode('');
    setPaymentStatus('Paid');
    setAmount('');
    setLink('');
    setCategory('Accommodation');
    setDestination('');
    setBudgetInput(String(currentBudget));
    setContinent('Asia');
    setFlag('🏳️');
    setCapital('');
    setDestKind('City');
  }, [modal, countries, trips, currentBudget, todayStr]);

  useEffect(() => {
    if (!modal.type) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal.type, onClose]);

  if (!modal.type) return null;

  const inputCls =
    'w-full border border-[#f0e9dc] rounded-[11px] bg-white px-3.5 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e] transition-colors';
  const labelCls = 'block text-[11px] font-bold text-[#5a6578] mb-1';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    switch (modal.type) {
      case 'trip':
        if (!name.trim()) return;
        onSaveTrip({
          name: name.trim(),
          country,
          date: date || todayStr,
          days: Math.max(1, Number(days) || 1),
        });
        break;
      case 'activity':
        if (!name.trim() || !tripId) return;
        onSaveActivity({ tripId, title: name.trim() });
        break;
      case 'wish':
        if (!name.trim()) return;
        onSaveWish({
          name: name.trim(),
          country,
          priority,
          status: wishStatus,
          note: note.trim(),
        });
        break;
      case 'journal':
        if (!name.trim()) return;
        onSaveJournal({
          title: name.trim(),
          country,
          date: date || todayStr,
          text: text.trim() || 'A lovely moment tucked away in my travel journal.',
          photoUrl: photoUrl.trim() || undefined,
        });
        break;
      case 'booking':
        if (!name.trim()) return;
        onSaveBooking({
          name: name.trim(),
          provider: provider.trim() || 'Direct Provider',
          ref: refCode.trim(),
          date: date || todayStr,
          status: paymentStatus,
          amount: Math.max(0, Number(amount) || 0),
          link: link.trim() || undefined,
        });
        break;
      case 'expense':
        if (!name.trim()) return;
        onSaveExpense({
          name: name.trim(),
          country,
          destination: destination.trim() || undefined,
          category,
          amount: Math.max(0, Number(amount) || 0),
          date: date || todayStr,
        });
        break;
      case 'budget':
        onSaveBudget(Math.max(0, Number(budgetInput) || 0));
        break;
      case 'country':
        if (!name.trim()) return;
        onSaveCountry({
          name: name.trim(),
          continent,
          flag: flag.trim() || '🏳️',
          capital: capital.trim() || 'Capital city',
        });
        break;
      case 'destination':
        if (!name.trim()) return;
        onSaveDestination({
          name: name.trim(),
          country,
          kind: destKind.trim() || 'Destination',
        });
        break;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-[#1d273b]/40 z-50 flex items-center justify-center p-5 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="journal-modal-title"
    >
      <div className="bg-[#fffdf8] border border-[#f0e9dc] rounded-[20px] p-6 w-full max-w-[500px] max-h-[90vh] overflow-y-auto shadow-[0_20px_70px_rgba(24,34,53,0.25)]">
        <div className="flex items-center justify-between mb-4">
          <h3 id="journal-modal-title" className="font-[900] text-[19px] text-[#27334b]">
            {MODAL_TITLES[modal.type]}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-[10px] bg-[#f5eee6] text-[#27334b] grid place-items-center hover:bg-[#eadfd3] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {modal.type === 'trip' && (
            <>
              <div>
                <label className={labelCls}>Trip name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Spring in Kyoto"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                  {countries.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Number of days</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </>
          )}

          {modal.type === 'activity' && (
            <>
              <div>
                <label className={labelCls}>Trip</label>
                <select value={tripId} onChange={(e) => setTripId(e.target.value)} className={inputCls}>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Activity</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Visit the bamboo grove"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {modal.type === 'wish' && (
            <>
              <div>
                <label className={labelCls}>Destination</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Place or attraction"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                  {countries.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as WishPriority)}
                    className={inputCls}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={wishStatus}
                    onChange={(e) => setWishStatus(e.target.value as WishStatus)}
                    className={inputCls}
                  >
                    <option value="Dream destination">Dream destination</option>
                    <option value="Planning">Planning</option>
                    <option value="Preparing">Preparing</option>
                    <option value="Booked">Booked</option>
                    <option value="Travelling">Travelling</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Personal note</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why do you want to go?"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {modal.type === 'journal' && (
            <>
              <div>
                <label className={labelCls}>Entry title</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="A day to remember"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Country</label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                    {countries.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Travel date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Your story</label>
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write about the little moments..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Photo URL (optional)</label>
                <input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Leave blank to use the destination illustration"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {modal.type === 'booking' && (
            <>
              <div>
                <label className={labelCls}>Booking name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Hotel, flight or activity"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Provider</label>
                  <input
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="e.g. Agoda, ANA, Klook"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Booking reference</label>
                  <input
                    value={refCode}
                    onChange={(e) => setRefCode(e.target.value)}
                    placeholder="Confirmation number"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Travel date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Payment status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as BookingPaymentStatus)}
                    className={inputCls}
                  >
                    <option value="Paid">Paid</option>
                    <option value="Partially paid">Partially paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Amount (PHP)</label>
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Confirmation link (optional)</label>
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {modal.type === 'expense' && (
            <>
              <div>
                <label className={labelCls}>Expense name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Airport transfer"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={inputCls}
                  >
                    {countries.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Destination / city (optional)</label>
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Tokyo, Kyoto"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className={inputCls}
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Amount (PHP)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </>
          )}

          {modal.type === 'budget' && (
            <div>
              <label className={labelCls}>Total trip budget (PHP)</label>
              <input
                type="number"
                min="0"
                required
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {modal.type === 'country' && (
            <>
              <div>
                <label className={labelCls}>Country name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Switzerland"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Continent</label>
                  <select
                    value={continent}
                    onChange={(e) => setContinent(e.target.value as ContinentName)}
                    className={inputCls}
                  >
                    {CONTINENT_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Flag emoji</label>
                  <input
                    value={flag}
                    onChange={(e) => setFlag(e.target.value)}
                    placeholder="🇨🇭"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Capital city</label>
                <input
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  placeholder="e.g. Bern"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {modal.type === 'destination' && (
            <>
              <div>
                <label className={labelCls}>Place name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="City, island or attraction"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Country</label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                    {countries.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <input
                    value={destKind}
                    onChange={(e) => setDestKind(e.target.value)}
                    placeholder="City, beach, museum..."
                    className={inputCls}
                  />
                </div>
              </div>
            </>
          )}

          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[13px] font-bold hover:bg-[#fff9ed] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all"
            >
              Save to journal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

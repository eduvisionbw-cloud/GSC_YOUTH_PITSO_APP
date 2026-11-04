import React, { useState, useEffect } from 'react';
import { 
  Users, Award, BookOpen, Search, MapPin, 
  Clock, CheckCircle2, Sparkles, Download, 
  Building2, ShieldCheck, LogOut, Lock, AlertCircle, Menu, X,
  TrendingUp, ArrowDownRight, Brain
} from 'lucide-react';
import { db, auth } from './firebase';
import { 
  collection, addDoc, getDocs, query, where, serverTimestamp,
  doc, getDoc, setDoc, increment
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';

const WARDS = ['Babusi', 'Boitshoko', 'Bontleng', 'Dilalelo', 'Mophato', 'Old Industrial', 'Old Naledi', 'Selemela', 'Village', 'White City', 'Other'];
const SECTORS = ['Services', 'Retail', 'Wholesale', 'Education', 'Construction', 'Manufacturing', 'Mining', 'Agriculture', 'ICT', 'Public sector', 'Other'];

type RegistrationType = 'individual' | 'company' | 'institution' | 'organisation';

interface Registration {
  id?: string;
  type: RegistrationType;
  name?: string;
  companyName?: string;
  contactPerson?: string;
  phone: string;
  email: string;
  ward: string;
  plotNumber?: string;
  idNumber?: string;
  profession?: string;
  sector?: string;
  skills?: string;
  goodsAndServices?: string;
  numberOfEmployees?: number;
  consent: boolean;
  createdAt: any;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'register' | 'resources' | 'admin'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Registration Form State: Individual, Company, Institution, Organisation
  const [regType, setRegType] = useState<RegistrationType>('individual');
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    contactPerson: '',
    phone: '+267',
    email: '',
    ward: 'Babusi',
    plotNumber: '',
    idNumber: '',
    profession: '',
    sector: 'Services',
    skills: '',
    goodsAndServices: '',
    numberOfEmployees: 1,
    consent: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState<string | null>(null);

  // Admin Auth & Data State
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [registrationsList, setRegistrationsList] = useState<Registration[]>([]);
  const [programmeDownloadsCount, setProgrammeDownloadsCount] = useState<number>(0);
  const [adminSearch, setAdminSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterWard, setFilterWard] = useState<string>('all');
  const [filterSector, setFilterSector] = useState<string>('all');

  // Track Auth State & Fetch Stats
  useEffect(() => {
    fetchStats();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      if (user) {
        fetchRegistrations();
      }
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const fetchStats = async () => {
    try {
      const docRef = doc(db, 'stats', 'programmeDownloads');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProgrammeDownloadsCount(docSnap.data().count || 0);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleDownloadProgramme = async () => {
    try {
      const statRef = doc(db, 'stats', 'programmeDownloads');
      await setDoc(statRef, { count: increment(1) }, { merge: true });
      setProgrammeDownloadsCount(prev => prev + 1);
    } catch (err) {
      console.error('Error incrementing download count:', err);
    }
    const link = document.createElement('a');
    link.href = '/Gaborone-South-Youth-Symposium-Programme.pdf';
    link.download = 'Gaborone-South-Youth-Symposium-Programme.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Programme PDF downloaded successfully!');
  };

  // Fetch Registrations for Admin
  const fetchRegistrations = async () => {
    try {
      const q = query(collection(db, 'registrations'));
      const snapshot = await getDocs(q);
      const list: Registration[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Registration);
      });
      setRegistrationsList(list);
    } catch (err: any) {
      console.error('Error fetching registrations:', err);
    }
  };

  // Handle Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg(null);
    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      showToast('Admin logged in successfully!');
      setActiveTab('admin');
      fetchRegistrations();
    } catch (err: any) {
      showError(err.message || 'Failed to login. Please check credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
    setAdminUser(null);
    setActiveTab('overview');
    showToast('Logged out successfully.');
  };

  // Handle Registration Submit
  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate consent
    if (!formData.consent) {
      showError('You must agree to the data consent terms to register.');
      return;
    }

    // Validate phone number (+267 followed by 7 or 8 digits)
    const phoneRegex = /^\+267\d{7,8}$/;
    const cleanPhone = formData.phone.trim().replace(/\s+/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      showError('Invalid Botswana phone number. Must start with +267 followed by 7 or 8 digits (e.g. +26771234567).');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check duplicate phone number in Firestore
      const q = query(collection(db, 'registrations'), where('phone', '==', cleanPhone));
      const existingQuery = await getDocs(q);
      if (!existingQuery.empty) {
        showError('A registration with this phone number already exists.');
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        type: regType,
        phone: cleanPhone,
        email: formData.email.trim(),
        ward: formData.ward,
        consent: formData.consent,
        createdAt: serverTimestamp()
      };

      if (regType === 'individual') {
        payload.name = formData.name.trim();
        payload.idNumber = formData.idNumber.trim();
        payload.profession = formData.profession.trim();
        payload.skills = formData.skills.trim();
      } else {
        payload.companyName = formData.companyName.trim();
        payload.contactPerson = formData.contactPerson.trim();
        payload.plotNumber = formData.plotNumber.trim();
        payload.sector = formData.sector;
        payload.goodsAndServices = formData.goodsAndServices.trim();
        payload.numberOfEmployees = Number(formData.numberOfEmployees) || 1;
      }

      const docRef = await addDoc(collection(db, 'registrations'), payload);
      const ticketNum = `GS-ECON-2026-${docRef.id.substring(0, 6).toUpperCase()}`;
      setTicketResult(ticketNum);
      showToast('Registration submitted successfully!');
      
      // Reset form
      setFormData({
        name: '',
        companyName: '',
        contactPerson: '',
        phone: '+267',
        email: '',
        ward: 'Babusi',
        plotNumber: '',
        idNumber: '',
        profession: '',
        sector: 'Services',
        skills: '',
        goodsAndServices: '',
        numberOfEmployees: 1,
        consent: false
      });
    } catch (err: any) {
      console.error('Registration Error:', err);
      showError(err.message || 'Failed to submit registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // CSV Export
  const exportToCSV = () => {
    if (registrationsList.length === 0) {
      showError('No registrations to export.');
      return;
    }

    const headers = ['ID', 'Type', 'Name / Entity', 'Contact Person', 'Phone', 'Email', 'Ward', 'ID Number', 'Plot Number', 'Profession / Sector', 'Skills / Services & Mandate', 'Staff / Employees', 'Created At'];
    const rows = registrationsList.map(r => [
      r.id || '',
      r.type,
      r.type === 'individual' ? r.name || '' : r.companyName || '',
      r.contactPerson || '',
      r.phone,
      r.email,
      r.ward,
      r.idNumber || '',
      r.plotNumber || '',
      r.type === 'individual' ? r.profession || '' : r.sector || '',
      r.type === 'individual' ? r.skills || '' : r.goodsAndServices || '',
      r.numberOfEmployees || '',
      r.createdAt?.toDate?.() ? r.createdAt.toDate().toISOString() : 'Recent'
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gaborone_south_economic_initiatives_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV export downloaded successfully!');
  };

  // Filtered registrations for admin table
  const filteredRegistrations = registrationsList.filter(r => {
    const matchesType = filterType === 'all' || r.type === filterType;
    const matchesWard = filterWard === 'all' || r.ward === filterWard;
    const matchesSector = filterSector === 'all' || r.sector === filterSector;
    
    const searchLower = adminSearch.toLowerCase();
    const nameMatch = (r.name || r.companyName || '').toLowerCase().includes(searchLower);
    const phoneMatch = r.phone.toLowerCase().includes(searchLower);
    const emailMatch = r.email.toLowerCase().includes(searchLower);
    const matchesSearch = !adminSearch || nameMatch || phoneMatch || emailMatch;

    return matchesType && matchesWard && matchesSector && matchesSearch;
  });

  // Calculate sector chart stats with accent & primary highlight
  const sectorCounts = SECTORS.map(sec => ({
    sector: sec,
    count: registrationsList.filter(r => r.sector === sec).length
  }));
  const maxSectorCount = Math.max(...sectorCounts.map(s => s.count), 1);

  // 4-way type breakdown
  const individualCount = registrationsList.filter(r => r.type === 'individual').length;
  const companyCount = registrationsList.filter(r => r.type === 'company').length;
  const institutionCount = registrationsList.filter(r => r.type === 'institution').length;
  const organisationCount = registrationsList.filter(r => r.type === 'organisation').length;
  const totalCount = registrationsList.length;

  return (
    <div className="min-h-screen bg-[#EAF5FC] text-[#1F2328] flex flex-col font-['Outfit']">
      
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-[#2E6DA4] text-white px-6 py-3 rounded-xl shadow-xl flex items-center space-x-3 animate-fade-in border border-[#72BEE7]">
          <CheckCircle2 className="w-6 h-6 shrink-0 text-[#72BEE7]" />
          <span className="font-medium text-sm">{successToast}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="fixed top-20 right-5 z-50 bg-[#BA1A1A] text-white px-6 py-3 rounded-xl shadow-xl flex items-center space-x-3 animate-fade-in border border-red-400 max-w-md">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}

      {/* Top Banner with Theme */}
      <div className="bg-[#2E6DA4] text-white text-xs sm:text-sm py-2 px-4 text-center font-medium flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
        <span>Babusi Community Hall, Gaborone South • Friday, 6th November 2026</span>
        <span className="hidden md:inline text-white/50">•</span>
        <span className="text-white/95 font-semibold">Theme: Youth at the Centre of a Thriving Economy, Reduced Import Bill and Healthy Minds</span>
      </div>

      {/* Header Navigation */}
      <header className="bg-white border-b border-[#C9CCD1] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 sm:h-24 flex items-center justify-between">
          
          {/* Logo with responsive scaling */}
          <div 
            className="flex items-center cursor-pointer group py-1" 
            onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }}
            title="Gaborone South Constituency Office"
          >
            <img 
              src="/assets/aistudio/gaborone-south-logo-transparent_07b83a00.png" 
              alt="Gaborone South Constituency Office"
              className="h-[46px] xs:h-[54px] sm:h-[64px] md:h-[74px] w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1 bg-[#EAF5FC] p-1.5 rounded-xl border border-[#C9CCD1]">
            {[
              { id: 'overview', label: 'Overview', icon: Users },
              { id: 'programme', label: 'Programme', icon: Clock, onClick: () => { setActiveTab('overview'); setTimeout(() => document.getElementById('programme-section')?.scrollIntoView({ behavior: 'smooth' }), 100); } },
              { id: 'register', label: 'Registration', icon: Award },
              { id: 'resources', label: 'Resources', icon: BookOpen }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.onClick) {
                      tab.onClick();
                    } else {
                      setActiveTab(tab.id as any);
                    }
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isActive ? 'bg-[#2E6DA4] text-white shadow-xs' : 'text-[#55565A] hover:bg-white hover:text-[#2E6DA4]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#72BEE7]' : 'text-[#55565A]'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Action Buttons & Mobile Hamburger Toggle */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Admin Button */}
            {adminUser ? (
              <button
                onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                title="Admin Dashboard"
              >
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden sm:inline">Admin Dashboard</span>
                <span className="sm:hidden">Admin</span>
              </button>
            ) : (
              <button
                onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                className="bg-white hover:bg-[#EAF5FC] text-[#2E6DA4] border border-[#C9CCD1] font-semibold px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                title="Admin Login"
              >
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2E6DA4] shrink-0" />
                <span className="hidden sm:inline">Admin Login</span>
                <span className="sm:hidden">Login</span>
              </button>
            )}

            {/* Register Button */}
            <button
              onClick={() => { setActiveTab('register'); setMobileMenuOpen(false); }}
              className="bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-sm transition flex items-center space-x-1 sm:space-x-1.5 cursor-pointer text-xs sm:text-sm shrink-0"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
              <span className="hidden xs:inline">Register Now</span>
              <span className="xs:hidden">Register</span>
            </button>

            {/* Hamburger Menu Toggle (Mobile & Tablet) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 sm:p-2 rounded-lg text-[#1F2328] hover:bg-[#EAF5FC] border border-[#C9CCD1] transition-colors cursor-pointer shrink-0"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-[#2E6DA4]" />
              ) : (
                <Menu className="w-5 h-5 text-[#1F2328]" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Hamburger Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-[#C9CCD1] px-4 pt-3 pb-5 space-y-2 shadow-lg animate-fade-in">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#55565A] px-2 pb-1">
              Navigation Menu
            </div>
            {[
              { id: 'overview', label: 'Overview', icon: Users, desc: 'Constituency info & key event dates' },
              { id: 'programme', label: 'Event Programme', icon: Clock, desc: 'Download symposium schedule PDF', onClick: () => { setActiveTab('overview'); setMobileMenuOpen(false); setTimeout(() => document.getElementById('programme-section')?.scrollIntoView({ behavior: 'smooth' }), 100); } },
              { id: 'register', label: 'Registration Form', icon: Award, desc: 'Individual, Company, Institution & Organisation' },
              { id: 'resources', label: 'Resource Library', icon: BookOpen, desc: 'Download official guidelines & guides' }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.onClick) {
                      tab.onClick();
                    } else {
                      setActiveTab(tab.id as any);
                      setMobileMenuOpen(false);
                    }
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer ${
                    isActive 
                      ? 'bg-[#2E6DA4] text-white shadow-xs' 
                      : 'text-[#1F2328] hover:bg-[#EAF5FC]'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-[#EAF5FC] text-[#2E6DA4]'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{tab.label}</div>
                    <div className={`text-xs ${isActive ? 'text-white/80' : 'text-[#55565A]'}`}>{tab.desc}</div>
                  </div>
                </button>
              );
            })}

            <div className="pt-2 border-t border-[#C9CCD1] mt-2">
              <button
                onClick={() => {
                  setActiveTab('admin');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'admin' 
                    ? 'bg-[#2E6DA4] text-white shadow-xs' 
                    : 'text-[#1F2328] hover:bg-[#EAF5FC]'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${activeTab === 'admin' ? 'bg-white/20 text-white' : 'bg-[#EAF5FC] text-[#2E6DA4]'}`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm">{adminUser ? 'Admin Dashboard (Logged In)' : 'Admin Portal Login'}</div>
                  <div className={`text-xs ${activeTab === 'admin' ? 'text-white/80' : 'text-[#55565A]'}`}>
                    {adminUser ? adminUser.email : 'Authorized constituency administrators'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="flex-grow w-full">
        
        {/* ================= OVERVIEW TAB ================= */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in">
            {/* Hero section: Full Width Edge-to-Edge */}
            <div className="relative w-full bg-[#EAF5FC] border-b border-[#C9CCD1] text-[#1F2328] overflow-hidden min-h-[440px] sm:min-h-[500px] flex items-center">
              {/* Background Hero Image with enhanced visibility */}
              <img
                src="https://images.pexels.com/photos/27935664/pexels-photo-27935664.jpeg"
                alt="Gaborone South Constituency Community"
                className="absolute inset-0 w-full h-full object-cover object-center sm:object-[center_30%] opacity-85"
              />
              {/* Readable Scrim Overlay: Visible photo on the right, high contrast text on the left */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#EAF5FC] via-[#EAF5FC]/85 via-45% to-[#EAF5FC]/20 sm:to-transparent"></div>

              <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
                <div className="max-w-2xl lg:max-w-3xl space-y-5">
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-[#1F2328]">
                    Youth at the Centre of a Thriving Economy, Reduced Import Bill and Healthy Minds
                  </h1>
                  <p className="text-base sm:text-lg text-[#1F2328] font-normal leading-relaxed">
                    Join constituency leadership, young entrepreneurs, community institutions, and organisations at Babusi Community Hall to debate policies, unlock economic grants, and build self-reliant local industries.
                  </p>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-4 pt-2">
                    <button
                      onClick={() => setActiveTab('register')}
                      className="bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold px-6 py-3 rounded-lg shadow-sm transition flex items-center space-x-2 cursor-pointer"
                    >
                      <Users className="w-5 h-5 text-white" />
                      <span>Register</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('resources')}
                      className="bg-white hover:bg-[#EAF5FC] text-[#2E6DA4] border border-[#C9CCD1] font-semibold px-6 py-3 rounded-lg transition flex items-center space-x-2 cursor-pointer shadow-2xs"
                    >
                      <BookOpen className="w-5 h-5 text-[#2E6DA4]" />
                      <span>Resource Library</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats: Inside max-w-7xl */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: 'Official Venue', value: 'Babusi Community Hall', desc: 'Broadhurst, Gaborone South', icon: MapPin },
                  { label: 'Event Date', value: '6th November 2026', desc: '08:30 AM - 17:00 PM', icon: Clock },
                  { label: 'Economic Fund', value: 'P4.5 Million', desc: 'Allocated for Micro-Grants & Support', icon: Award }
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className="bg-white p-6 rounded-xl border border-[#C9CCD1] shadow-xs hover:border-[#72BEE7] transition">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-[#EAF5FC] text-[#2E6DA4] flex items-center justify-center font-bold">
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-semibold bg-[#EAF5FC] text-[#2E6DA4] px-2.5 py-1 rounded-full border border-[#72BEE7]/40">
                          Active
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold text-[#1F2328]">{stat.value}</div>
                      <div className="text-sm font-semibold text-[#1F2328] mt-1">{stat.label}</div>
                      <div className="text-xs text-[#55565A] mt-1">{stat.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Programme Section */}
              <div id="programme-section" className="bg-white rounded-2xl border border-[#C9CCD1] p-6 sm:p-10 shadow-xs space-y-6">
                <div className="max-w-3xl space-y-2">
                  <span className="text-xs font-bold text-[#2E6DA4] bg-[#EAF5FC] border border-[#72BEE7]/40 px-3 py-1 rounded-full uppercase tracking-wider">
                    Official Schedule
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328]">
                    Event Programme
                  </h2>
                  <p className="text-sm sm:text-base text-[#55565A]">
                    Download the full programme for the Youth Symposium, 6 November 2026, Babusi Community Hall
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={handleDownloadProgramme}
                    className="bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold px-6 py-3 rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer h-12 text-sm"
                  >
                    <Download className="w-5 h-5 text-white" />
                    <span>Download Programme (PDF)</span>
                  </button>
                  <a
                    href="/Gaborone-South-Youth-Symposium-Programme.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white hover:bg-[#EAF5FC] text-[#2E6DA4] border border-[#C9CCD1] font-semibold px-6 py-3 rounded-xl transition flex items-center space-x-2 cursor-pointer shadow-2xs h-12 text-sm items-center justify-center"
                  >
                    <span>View online →</span>
                  </a>
                </div>
              </div>

              {/* Vision, Mission, Strategy & Set Goals */}
              <div className="bg-white rounded-2xl border border-[#C9CCD1] p-6 sm:p-10 shadow-xs space-y-8">
                <div className="max-w-3xl space-y-2">
                  <span className="text-xs font-bold text-[#2E6DA4] bg-[#EAF5FC] border border-[#72BEE7]/40 px-3 py-1 rounded-full uppercase tracking-wider">
                    Constituency Framework
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328]">
                    Vision, Mission, Strategy & Set Goals
                  </h2>
                  <p className="text-sm sm:text-base text-[#55565A]">
                    Guiding principles for the Gaborone South Constituency Economic Initiatives and ecosystem development.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Our Vision */}
                  <div className="bg-[#EAF5FC]/50 hover:bg-[#EAF5FC] rounded-xl p-6 border border-[#C9CCD1] hover:border-[#2E6DA4] transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-[#2E6DA4] text-white flex items-center justify-center font-bold shadow-xs">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#2E6DA4] uppercase tracking-wider">Our Vision</div>
                      <h3 className="text-lg font-bold text-[#1F2328]">Center of Excellence & Flagship Township Economy</h3>
                      <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                        Gaborone South Constituency should be a center of Excellence and Brilliance, Business, Tourism, Cultural, Heritage Activities and a Flagship for Township Economy.
                      </p>
                    </div>
                  </div>

                  {/* Mission */}
                  <div className="bg-[#EAF5FC]/50 hover:bg-[#EAF5FC] rounded-xl p-6 border border-[#C9CCD1] hover:border-[#2E6DA4] transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-[#2E6DA4] text-white flex items-center justify-center font-bold shadow-xs">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#2E6DA4] uppercase tracking-wider">Mission</div>
                      <h3 className="text-lg font-bold text-[#1F2328]">Eradication of Unemployment & Poverty</h3>
                      <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                        The eradication of Unemployment, Poverty and Destitution in the Constituency.
                      </p>
                    </div>
                  </div>

                  {/* Strategy */}
                  <div className="bg-[#EAF5FC]/50 hover:bg-[#EAF5FC] rounded-xl p-6 border border-[#C9CCD1] hover:border-[#2E6DA4] transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-[#2E6DA4] text-white flex items-center justify-center font-bold shadow-xs">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#2E6DA4] uppercase tracking-wider">Strategy</div>
                      <h3 className="text-lg font-bold text-[#1F2328]">Constituency Ecosystem Alignment</h3>
                      <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                        Alignment of the important Key Stakeholders namely Communities, Companies, Institutions and Organisations as one Constituency Ecosystem.
                      </p>
                    </div>
                  </div>

                  {/* Set Goals */}
                  <div className="bg-[#EAF5FC]/50 hover:bg-[#EAF5FC] rounded-xl p-6 border border-[#C9CCD1] hover:border-[#2E6DA4] transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-[#2E6DA4] text-white flex items-center justify-center font-bold shadow-xs">
                        <Award className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#2E6DA4] uppercase tracking-wider">Set Goals</div>
                      <h3 className="text-lg font-bold text-[#1F2328]">Clustering Models & Production Hubs</h3>
                      <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                        Implementation of Clustering Models and Productions Hubs for the optimization of all Employment Opportunities and Wealth Creation Platforms in the Constituency.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ================= REGISTRATION TAB ================= */}
        {activeTab === 'register' && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-6">
              
              <div className="text-center space-y-2">
                <span className="text-xs font-bold text-[#2E6DA4] bg-[#EAF5FC] border border-[#72BEE7]/40 px-3 py-1 rounded-full uppercase tracking-wider">
                  Gaborone South Constituency Economic Initiatives
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328]">Official Registration Portal</h2>
                <p className="text-sm text-[#55565A]">Register as an Individual, Company, Institution, or Organisation.</p>
              </div>

              {ticketResult ? (
                <div className="bg-[#EAF5FC] border border-[#72BEE7] p-6 rounded-xl text-center space-y-4">
                  <div className="w-16 h-16 bg-white text-[#2E6DA4] rounded-full flex items-center justify-center mx-auto shadow-xs border border-[#72BEE7]">
                    <CheckCircle2 className="w-10 h-10 text-[#2E6DA4]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1F2328]">Registration Successful!</h3>
                  <p className="text-xs text-[#55565A]">Your information has been securely saved to Firestore. Your official reference number is:</p>
                  <div className="bg-white py-3 px-4 rounded-lg border border-[#72BEE7] text-lg font-mono font-bold text-[#2E6DA4] shadow-2xs">
                    {ticketResult}
                  </div>
                  <p className="text-xs text-[#55565A]">Present this reference number on Friday, 6th November 2026 at Babusi Community Hall.</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      onClick={handleDownloadProgramme}
                      className="w-full sm:w-auto bg-[#2E6DA4] hover:bg-[#245885] text-white px-6 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-colors flex items-center justify-center gap-2 h-12 shadow-sm"
                    >
                      <Download className="w-4 h-4 text-white" />
                      <span>Download Programme (PDF)</span>
                    </button>
                    <button
                      onClick={() => { setTicketResult(null); }}
                      className="w-full sm:w-auto bg-white hover:bg-[#EAF5FC] text-[#2E6DA4] border border-[#C9CCD1] px-6 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-colors h-12 shadow-2xs"
                    >
                      Register Another Entry
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegistrationSubmit} className="space-y-6">
                  
                  {/* 3. Four-Option Category Toggle: Individual, Company, Institution, Organisation */}
                  <div>
                    <label className="block text-xs font-bold text-[#1F2328] uppercase mb-2">Registration Category *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: 'individual', label: 'Individual', sub: 'Citizen / Youth', icon: Users },
                        { id: 'company', label: 'Company', sub: 'Private Business', icon: Building2 },
                        { id: 'institution', label: 'Institution', sub: 'Public / Academic', icon: Award },
                        { id: 'organisation', label: 'Organisation', sub: 'NGO / Community', icon: ShieldCheck }
                      ].map(item => {
                        const Icon = item.icon;
                        const isSelected = regType === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setRegType(item.id as RegistrationType)}
                            className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              isSelected 
                                ? 'bg-[#2E6DA4] text-white border-[#2E6DA4] shadow-xs' 
                                : 'bg-white text-[#55565A] border-[#C9CCD1] hover:bg-[#EAF5FC]'
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-[#2E6DA4]'}`} />
                            <span className="font-bold text-xs">{item.label}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[#55565A]'}`}>{item.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4 pt-2 border-t border-[#C9CCD1]">
                    
                    {/* Dynamic Name / Entity Fields */}
                    {regType === 'individual' ? (
                      <div>
                        <label className="block text-xs font-semibold text-[#1F2328] mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Kagiso Modisa"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                            {regType === 'company' && 'Company Name *'}
                            {regType === 'institution' && 'Institution Name *'}
                            {regType === 'organisation' && 'Organisation Name *'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={
                              regType === 'company' ? 'e.g. Broadhurst Tech Solutions (Pty) Ltd' :
                              regType === 'institution' ? 'e.g. Gaborone South Vocational Institute' :
                              'e.g. Tsholofelo Youth Development Trust'
                            }
                            value={formData.companyName}
                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                            {regType === 'company' && 'Contact Person / Representative *'}
                            {regType === 'institution' && 'Liaison Contact Person *'}
                            {regType === 'organisation' && 'Coordinator / Executive Contact *'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Lesego Tau"
                            value={formData.contactPerson}
                            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                          />
                        </div>
                      </div>
                    )}

                    {/* Phone & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#1F2328] mb-1">Phone Number (+267...) *</label>
                        <input
                          type="tel"
                          required
                          placeholder="+26771234567"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                        />
                        <span className="text-[10px] text-[#55565A] mt-0.5 block">Format: +267 followed by 7 or 8 digits</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1F2328] mb-1">Email Address *</label>
                        <input
                          type="email"
                          required
                          placeholder="contact@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                        />
                      </div>
                    </div>

                    {/* Ward & ID or Plot Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#1F2328] mb-1">Ward *</label>
                        <select
                          value={formData.ward}
                          onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                        >
                          {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>

                      <div>
                        {regType === 'individual' ? (
                          <>
                            <label className="block text-xs font-semibold text-[#1F2328] mb-1">ID Number (Omang / Passport) *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 123456789 (Omang or Passport)"
                              value={formData.idNumber}
                              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                              className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                            />
                          </>
                        ) : (
                          <>
                            <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                              Plot Number <span className="text-[#55565A] font-normal">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Plot 4521, Broadhurst (Optional)"
                              value={formData.plotNumber}
                              onChange={(e) => setFormData({ ...formData, plotNumber: e.target.value })}
                              className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {/* Specific details by Category */}
                    {regType === 'individual' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#1F2328] mb-1">Profession / Occupation *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Software Developer / Farmer / Student"
                            value={formData.profession}
                            onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#1F2328] mb-1">Key Skills & Talents *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Web Dev, Carpentry, Accounting"
                            value={formData.skills}
                            onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2328] mb-1">Sector *</label>
                            <select
                              value={formData.sector}
                              onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                              className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328]"
                            >
                              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                              {regType === 'company' ? 'Number of Employees *' :
                               regType === 'institution' ? 'Number of Staff / Employees *' :
                               'Number of Members / Staff *'}
                            </label>
                            <input
                              type="number"
                              required
                              min={1}
                              value={formData.numberOfEmployees}
                              onChange={(e) => setFormData({ ...formData, numberOfEmployees: Number(e.target.value) })}
                              className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328]"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                            {regType === 'company' ? 'Goods & Services Offered *' :
                             regType === 'institution' ? 'Programs, Mandate & Public Services *' :
                             'Community Programs & Services Offered *'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={
                              regType === 'company' ? 'e.g. Solar panel installation, grocery supplies' :
                              regType === 'institution' ? 'e.g. Technical education, healthcare, civic training' :
                              'e.g. Youth mentoring, community sports, food hampers'
                            }
                            value={formData.goodsAndServices}
                            onChange={(e) => setFormData({ ...formData, goodsAndServices: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Consent Checkbox */}
                    <div className="pt-2">
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          required
                          checked={formData.consent}
                          onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                          className="w-5 h-5 mt-0.5 rounded border-[#C9CCD1] text-[#2E6DA4] focus:ring-[#2E6DA4]"
                        />
                        <span className="text-xs text-[#55565A] leading-relaxed">
                          I consent to the collection and secure storage of my registration details by the Gaborone South Constituency Office for Constituency Economic Initiatives analytics, micro-grant evaluation, and communications. *
                        </span>
                      </label>
                    </div>

                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center gap-2 text-base"
                  >
                    {isSubmitting ? 'Saving to Database...' : 'Submit Registration'}
                  </button>

                </form>
              )}

            </div>
          </div>
        )}

        {/* ================= RESOURCES TAB ================= */}
        {activeTab === 'resources' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
            <div className="bg-white p-6 sm:p-8 rounded-xl border border-[#C9CCD1] shadow-xs">
              <span className="text-xs font-bold text-[#2E6DA4] bg-[#EAF5FC] border border-[#72BEE7]/40 px-3 py-1 rounded-full">Official Center</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328] mt-2">Resource Library</h2>
              <p className="text-sm text-[#55565A] mt-1">Download official Gaborone South Constituency Economic Initiatives guidelines and formalization guides.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Constituency Economic Initiatives Guidelines 2026', size: '2.4 MB', desc: 'Eligibility, grant frameworks, and evaluation rubrics.' },
                { title: 'Theme Framework & Policy Action Plan 2026', size: '3.1 MB', desc: 'Youth Enterprise, Import Reduction, and Mental Health Strategic Action Plan for Gaborone South.' },
                { title: 'CIPA Company & NGO Formalization Guide', size: '1.8 MB', desc: 'Fast-track handbook for registering township enterprises and civil organisations in Botswana.' }
              ].map((res, i) => (
                <div key={i} className="bg-white p-6 rounded-xl border border-[#C9CCD1] shadow-xs flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[#1F2328] text-base">{res.title}</h3>
                    <p className="text-xs text-[#55565A] mt-1">{res.desc}</p>
                    <span className="text-xs text-[#2E6DA4] font-semibold mt-2 block">{res.size} • PDF Document</span>
                  </div>
                  <button 
                    onClick={() => showToast(`Downloading ${res.title}...`)}
                    className="bg-[#EAF5FC] hover:bg-[#2E6DA4] text-[#2E6DA4] hover:text-white p-3 rounded-xl transition cursor-pointer shrink-0 border border-[#C9CCD1]"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= ADMIN TAB ================= */}
        {activeTab === 'admin' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
            {!adminUser ? (
              <div className="max-w-md mx-auto bg-white p-8 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-[#EAF5FC] text-[#2E6DA4] rounded-xl flex items-center justify-center mx-auto border border-[#72BEE7]">
                    <Lock className="w-6 h-6 text-[#2E6DA4]" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#1F2328]">Admin Login</h3>
                  <p className="text-xs text-[#55565A]">Sign in with your Firebase admin account to view live registrations and analytics.</p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1F2328] mb-1">Admin Email</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@gaboronesouth.gov.bw"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1F2328] mb-1">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold rounded-xl shadow-sm transition cursor-pointer text-sm"
                  >
                    {authLoading ? 'Signing in...' : 'Sign In to Dashboard'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Admin Header: White with sky-blue bottom border */}
                <div className="bg-white p-6 rounded-xl border border-[#C9CCD1] border-b-4 border-b-[#72BEE7] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#EAF5FC] text-[#2E6DA4] border border-[#72BEE7]/50 text-xs px-2.5 py-0.5 rounded-full font-bold">Authenticated Admin</span>
                      <span className="text-xs text-[#55565A]">{adminUser.email}</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#1F2328] mt-1">Economic Initiatives Registration Dashboard</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={exportToCSV}
                      className="bg-[#2E6DA4] hover:bg-[#245885] text-white font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                    >
                      <Download className="w-4 h-4 text-white" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={handleAdminLogout}
                      className="bg-white hover:bg-red-50 text-red-700 font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center gap-2 cursor-pointer border border-[#C9CCD1] transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>

                {/* Live Stats: 5-Way Split including Programme Downloads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-[#C9CCD1] shadow-xs">
                    <div className="text-xs font-bold text-[#55565A] uppercase tracking-wider">Total Registrations</div>
                    <div className="text-3xl font-extrabold text-[#2E6DA4] mt-2">{totalCount}</div>
                    <p className="text-xs text-[#55565A] mt-1">Live Firestore records</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#C9CCD1] shadow-xs">
                    <div className="text-xs font-bold text-[#55565A] uppercase tracking-wider">Programme Downloads</div>
                    <div className="text-3xl font-extrabold text-[#2E6DA4] mt-2">{programmeDownloadsCount}</div>
                    <p className="text-xs text-[#55565A] mt-1">PDF downloads tracked live</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#C9CCD1] shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#55565A] uppercase tracking-wider">Individuals</span>
                      <span className="text-xs font-bold bg-[#EAF5FC] text-[#2E6DA4] px-2 py-0.5 rounded">
                        {totalCount > 0 ? Math.round((individualCount / totalCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-[#1F2328] mt-2">{individualCount}</div>
                    <p className="text-xs text-[#55565A] mt-1">Youth & individual delegates</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#C9CCD1] shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#55565A] uppercase tracking-wider">Companies</span>
                      <span className="text-xs font-bold bg-[#2E6DA4]/10 text-[#2E6DA4] px-2 py-0.5 rounded">
                        {totalCount > 0 ? Math.round((companyCount / totalCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-[#2E6DA4] mt-2">{companyCount}</div>
                    <p className="text-xs text-[#55565A] mt-1">Private businesses & startups</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#C9CCD1] shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#55565A] uppercase tracking-wider">Institutions & Orgs</span>
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                        {totalCount > 0 ? Math.round(((institutionCount + organisationCount) / totalCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-indigo-700 mt-2">{institutionCount + organisationCount}</div>
                    <p className="text-xs text-[#55565A] mt-1">{institutionCount} Institutions, {organisationCount} Orgs</p>
                  </div>
                </div>

                {/* Multi-Segmented Ratio Chart */}
                <div className="bg-white p-5 rounded-xl border border-[#C9CCD1] shadow-xs space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-[#55565A]">
                    <span>Category Representation Distribution</span>
                    <span>{totalCount} Total Entries</span>
                  </div>
                  <div className="w-full bg-[#EAF5FC] h-3.5 rounded-full overflow-hidden flex border border-[#C9CCD1]/60">
                    <div className="bg-[#72BEE7] h-full transition-all duration-500" style={{ width: `${totalCount > 0 ? (individualCount / totalCount) * 100 : 25}%` }} title={`Individuals: ${individualCount}`}></div>
                    <div className="bg-[#2E6DA4] h-full transition-all duration-500" style={{ width: `${totalCount > 0 ? (companyCount / totalCount) * 100 : 25}%` }} title={`Companies: ${companyCount}`}></div>
                    <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${totalCount > 0 ? (institutionCount / totalCount) * 100 : 25}%` }} title={`Institutions: ${institutionCount}`}></div>
                    <div className="bg-emerald-600 h-full transition-all duration-500" style={{ width: `${totalCount > 0 ? (organisationCount / totalCount) * 100 : 25}%` }} title={`Organisations: ${organisationCount}`}></div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs pt-1">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#72BEE7]"></span> Individuals ({individualCount})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#2E6DA4]"></span> Companies ({companyCount})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-600"></span> Institutions ({institutionCount})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-600"></span> Organisations ({organisationCount})</span>
                  </div>
                </div>

                {/* Sector Bar Chart: Accent with Primary Highlight */}
                <div className="bg-white p-6 rounded-xl border border-[#C9CCD1] shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[#1F2328]">Sector Distribution</h3>
                      <p className="text-xs text-[#55565A]">Live breakdown across Companies, Institutions & Organisations (Accent with Primary highlight)</p>
                    </div>
                    <span className="text-xs font-bold bg-[#EAF5FC] text-[#2E6DA4] px-3 py-1 rounded-full border border-[#72BEE7]/40">
                      Live Chart
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 pt-2">
                    {sectorCounts.map(({ sector, count }) => {
                      const percentage = Math.round((count / maxSectorCount) * 100);
                      const isTopSector = count > 0 && count === maxSectorCount;

                      return (
                        <div key={sector} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className={isTopSector ? 'text-[#2E6DA4] font-bold' : 'text-[#1F2328]'}>{sector}</span>
                            <span className={isTopSector ? 'text-[#2E6DA4] font-bold' : 'text-[#55565A]'}>{count} registered</span>
                          </div>
                          <div className="w-full bg-[#EAF5FC] h-3.5 rounded-full overflow-hidden border border-[#C9CCD1]/50">
                            <div 
                              className={`h-full transition-all duration-500 rounded-full ${isTopSector ? 'bg-[#2E6DA4]' : 'bg-[#72BEE7]'}`}
                              style={{ width: `${Math.max(percentage, count > 0 ? 8 : 0)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Search & Filters */}
                <div className="bg-white p-4 rounded-xl border border-[#C9CCD1] flex flex-col lg:flex-row gap-4 items-center justify-between shadow-2xs">
                  <div className="relative w-full lg:w-80">
                    <Search className="w-4 h-4 text-[#55565A] absolute left-3 top-3.5" />
                    <input
                      type="text"
                      placeholder="Search name, phone, email..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-[#C9CCD1] rounded-lg text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    {/* Category Filter for all 4 types */}
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-2 bg-white border border-[#C9CCD1] rounded-lg text-xs font-semibold text-[#1F2328] focus:border-[#2E6DA4]"
                    >
                      <option value="all">All Categories</option>
                      <option value="individual">Individuals Only</option>
                      <option value="company">Companies Only</option>
                      <option value="institution">Institutions Only</option>
                      <option value="organisation">Organisations Only</option>
                    </select>

                    <select
                      value={filterWard}
                      onChange={(e) => setFilterWard(e.target.value)}
                      className="px-3 py-2 bg-white border border-[#C9CCD1] rounded-lg text-xs font-semibold text-[#1F2328] focus:border-[#2E6DA4]"
                    >
                      <option value="all">All Wards</option>
                      {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>

                    <select
                      value={filterSector}
                      onChange={(e) => setFilterSector(e.target.value)}
                      className="px-3 py-2 bg-white border border-[#C9CCD1] rounded-lg text-xs font-semibold text-[#1F2328] focus:border-[#2E6DA4]"
                    >
                      <option value="all">All Sectors</option>
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Registrations Table */}
                <div className="bg-white rounded-xl border border-[#C9CCD1] shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#EAF5FC] text-[#1F2328] border-b border-[#C9CCD1] uppercase font-bold">
                        <tr>
                          <th className="p-4">Type</th>
                          <th className="p-4">Name / Entity</th>
                          <th className="p-4">Contact / Phone</th>
                          <th className="p-4">Ward / ID or Plot</th>
                          <th className="p-4">Profession / Sector</th>
                          <th className="p-4">Skills / Details & Mandate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#C9CCD1]">
                        {filteredRegistrations.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-[#55565A]">
                              No registrations match the selected filters.
                            </td>
                          </tr>
                        ) : (
                          filteredRegistrations.map((r, idx) => (
                            <tr key={r.id || idx} className="hover:bg-[#EAF5FC]/50 transition-colors">
                              <td className="p-4">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  r.type === 'individual' ? 'bg-[#EAF5FC] text-[#2E6DA4] border border-[#72BEE7]/40' :
                                  r.type === 'company' ? 'bg-[#2E6DA4]/10 text-[#2E6DA4] border border-[#2E6DA4]/30' :
                                  r.type === 'institution' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                  'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {r.type}
                                </span>
                              </td>
                              <td className="p-4 font-bold text-[#1F2328]">
                                {r.type === 'individual' ? r.name : r.companyName}
                                {r.contactPerson && <span className="block text-[10px] text-[#55565A]">Contact: {r.contactPerson}</span>}
                              </td>
                              <td className="p-4 text-[#1F2328]">
                                <div>{r.phone}</div>
                                <div className="text-[10px] text-[#55565A]">{r.email}</div>
                              </td>
                              <td className="p-4 text-[#1F2328]">
                                <div>{r.ward}</div>
                                <div className="text-[10px] text-[#55565A]">
                                  {r.type === 'individual' 
                                    ? (r.idNumber ? `ID: ${r.idNumber}` : (r.plotNumber ? `Plot: ${r.plotNumber}` : ''))
                                    : (r.plotNumber ? `Plot: ${r.plotNumber}` : (r.idNumber ? `ID: ${r.idNumber}` : ''))
                                  }
                                </div>
                              </td>
                              <td className="p-4 text-[#1F2328]">
                                {r.type === 'individual' ? r.profession : r.sector}
                                {r.numberOfEmployees && <span className="block text-[10px] text-[#55565A]">{r.numberOfEmployees} staff/members</span>}
                              </td>
                              <td className="p-4 text-[#55565A] max-w-xs truncate">
                                {r.type === 'individual' ? r.skills : r.goodsAndServices}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer on clean white background */}
      <footer className="bg-white text-[#1F2328] mt-16 border-t border-[#C9CCD1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <img 
                src="/assets/aistudio/gaborone-south-logo-transparent_07b83a00.png" 
                alt="Gaborone South Constituency Office"
                className="h-[54px] w-auto object-contain"
              />
              <p className="text-xs text-[#55565A] leading-relaxed">
                Gaborone South Constituency Economic Initiatives — Empowering the next generation of township entrepreneurs, innovators, institutions, and civic organizations under the theme: <span className="font-semibold text-[#1F2328]">“Youth at the Centre of a Thriving Economy, Reduced Import Bill and Healthy Minds”</span>.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#2E6DA4] uppercase tracking-wider mb-4">Quick Navigation</h4>
              <ul className="space-y-2 text-xs text-[#55565A]">
                <li><button onClick={() => setActiveTab('overview')} className="hover:text-[#2E6DA4] cursor-pointer transition-colors">Overview & Stats</button></li>
                <li><button onClick={() => { setActiveTab('overview'); setTimeout(() => document.getElementById('programme-section')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-[#2E6DA4] cursor-pointer transition-colors">Event Programme</button></li>
                <li><button onClick={() => setActiveTab('register')} className="hover:text-[#2E6DA4] cursor-pointer transition-colors">Registration Form</button></li>
                <li><button onClick={() => setActiveTab('resources')} className="hover:text-[#2E6DA4] cursor-pointer transition-colors">Resource Library</button></li>
                <li><button onClick={() => setActiveTab('admin')} className="hover:text-[#2E6DA4] cursor-pointer transition-colors">Admin Dashboard</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#2E6DA4] uppercase tracking-wider mb-4">Venues & Precincts</h4>
              <ul className="space-y-2 text-xs text-[#55565A]">
                <li>Babusi Community Hall (Main Arena)</li>
                <li>Tsholofelo Park Hall</li>
                <li>Broadhurst Innovation Center</li>
                <li>Block 3 Constituency Office</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#2E6DA4] uppercase tracking-wider mb-4">Secretariat Support</h4>
              <p className="text-xs text-[#55565A] mb-2">Need assistance with your registration?</p>
              <p className="text-xs font-semibold text-[#1F2328]">+267 391 2026</p>
              <p className="text-xs text-[#55565A] mt-1">initiatives@gaboronesouth.gov.bw</p>
            </div>
          </div>

          <div className="border-t border-[#C9CCD1] pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#55565A]">
            <p>© 2026 Gaborone South Constituency Office. All rights reserved.</p>
            <p className="mt-2 sm:mt-0">Republic of Botswana • Dedicated to Economic Inclusion & Community Development</p>
          </div>
        </div>
      </footer>

    </div>
  );
}

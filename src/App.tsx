import React, { useState, useEffect } from 'react';
import { 
  Users, Award, Search, MapPin, 
  Clock, CheckCircle2, Download, Sparkles,
  Building2, ShieldCheck, LogOut, Lock, AlertCircle, Menu, X,
  TrendingUp, Filter, RefreshCw
} from 'lucide-react';
import { 
  db, auth, isFirebaseConfigured, mapFirebaseAuthError 
} from './firebase';
import { 
  collection, addDoc, onSnapshot, serverTimestamp,
  doc, setDoc, increment, getDoc
} from 'firebase/firestore';
import { 
  signOut, onAuthStateChanged, User,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword
} from 'firebase/auth';

const WARDS = ['Babusi', 'Boitshoko', 'Bontleng', 'Dilalelo', 'Mophato', 'Old Industrial', 'Old Naledi', 'Selemela', 'Village', 'White City', 'Other'];
const SECTORS = ['Services', 'Retail', 'Wholesale', 'Education', 'Construction', 'Manufacturing', 'Mining', 'Agriculture', 'ICT', 'Public sector', 'Other'];

type RegistrationType = 'individual' | 'company';

interface Registration {
  id?: string;
  type: RegistrationType;
  fullName?: string;
  companyName?: string;
  contactPerson?: string;
  phone: string;
  email: string;
  ward: string;
  plotNumber?: string;
  profession?: string;
  sector?: string;
  skillsOrServices?: string;
  employeeCount?: number;
  consentGiven: boolean;
  createdAt: any;
}

const HERO_SLIDES = [
  {
    url: 'https://images.pexels.com/photos/27935664/pexels-photo-27935664.jpeg',
    alt: 'Gaborone South Youth Delegation & Community Leaders'
  },
  {
    url: 'https://images.pexels.com/photos/33679979/pexels-photo-33679979.jpeg',
    alt: 'Youth Innovation & Entrepreneurship Showcase'
  },
  {
    url: 'https://images.pexels.com/photos/5934217/pexels-photo-5934217.jpeg',
    alt: 'Township Economy & Industry Workshop'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'register' | 'resources' | 'admin'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hero Slideshow state
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);

  // Registration Form State
  const [regType, setRegType] = useState<RegistrationType>('individual');
  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    contactPerson: '',
    phone: '+267',
    email: '',
    ward: 'Babusi',
    plotNumber: '',
    profession: '',
    sector: 'Services',
    skillsOrServices: '',
    employeeCount: 1,
    consentGiven: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState<string | null>(null);

  // Admin Auth & Data State
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [registrationsList, setRegistrationsList] = useState<Registration[]>([]);
  const [programmeDownloadsCount, setProgrammeDownloadsCount] = useState<number>(0);
  const [adminSearch, setAdminSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterWard, setFilterWard] = useState<string>('all');
  const [filterSector, setFilterSector] = useState<string>('all');

  // Auto-advance hero slideshow every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Track Auth State & Live Programme Download Stats
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    // Live listener for programmeStats/downloads
    const unsubStats = onSnapshot(doc(db, 'programmeStats', 'downloads'), (snap) => {
      if (snap.exists() && typeof snap.data()?.count === 'number') {
        setProgrammeDownloadsCount(snap.data()!.count);
      }
    }, (err) => console.error('Stats snapshot error:', err));

    // Handle Google redirect sign-in result
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await verifyAdminAccess(result.user);
        }
      })
      .catch((err) => {
        console.error('Redirect sign-in error:', err);
        showError(mapFirebaseAuthError(err));
      });

    // Auth state observer
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await verifyAdminAccess(user);
      } else {
        setAdminUser(null);
      }
    });

    return () => {
      unsubStats();
      unsubscribeAuth();
    };
  }, []);

  // Live snapshot listener for registrations when admin is authenticated
  useEffect(() => {
    if (!adminUser || !isFirebaseConfigured) return;

    setIsRefreshingData(true);
    const unsubRegs = onSnapshot(collection(db, 'registrations'), (snapshot) => {
      const list: Registration[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Registration);
      });
      // Sort newest first
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt?.toMillis?.() || 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt?.toMillis?.() || 0);
        return timeB - timeA;
      });
      setRegistrationsList(list);
      setIsRefreshingData(false);
    }, (err) => {
      console.error('Registrations snapshot error:', err);
      showError('Failed to stream live registrations from database.');
      setIsRefreshingData(false);
    });

    return () => unsubRegs();
  }, [adminUser]);

  // Helper to verify if the authenticated user has a document in 'admins'
  const verifyAdminAccess = async (user: User) => {
    const userEmail = user.email ? user.email.toLowerCase() : '';
    if (!userEmail) {
      await signOut(auth);
      setAdminUser(null);
      showError('Not authorised');
      return;
    }

    try {
      const envAdmins = (import.meta.env.VITE_ADMIN_EMAILS || '')
        .split(',')
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);
      const isEnvAdmin = envAdmins.includes(userEmail);

      let isAdminDoc = false;
      try {
        const adminDocRef = doc(db, 'admins', userEmail);
        const adminSnap = await getDoc(adminDocRef);
        isAdminDoc = adminSnap.exists();
      } catch (e) {
        console.warn('Admin doc check skipped or offline:', e);
      }

      if (!isAdminDoc && !isEnvAdmin) {
        await signOut(auth);
        setAdminUser(null);
        showError('Not authorised');
        return;
      }
      setAdminUser(user);
      showToast(`Welcome Admin ${user.email}!`);
      setActiveTab('admin');
    } catch (err: any) {
      console.error('Admin verification error:', err);
      await signOut(auth);
      setAdminUser(null);
      showError('Not authorised');
    }
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
  };

  // Programme PDF Download - Background Increment
  const handleDownloadProgramme = () => {
    // Non-blocking background increment
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'programmeStats', 'downloads'), { count: increment(1) }, { merge: true })
        .then(() => setProgrammeDownloadsCount(prev => prev + 1))
        .catch((err) => console.error('Programme download increment error:', err));
    }

    const link = document.createElement('a');
    link.href = '/Gaborone-South-Youth-Symposium-Programme.pdf';
    link.download = 'Gaborone-South-Youth-Symposium-Programme.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Programme PDF downloaded successfully!');
  };

  // Admin Login via Email & Password
  const handleEmailAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmailInput.trim() || !adminPasswordInput) {
      showError('Please enter both admin email and password.');
      return;
    }

    setAuthLoading(true);
    setErrorMsg(null);

    try {
      const cred = await signInWithEmailAndPassword(auth, adminEmailInput.trim(), adminPasswordInput);
      await verifyAdminAccess(cred.user);
    } catch (err: any) {
      console.error('Email login error:', err);
      showError(mapFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  // Admin Login via Google (Popup with Redirect Fallback)
  const handleGoogleAdminLogin = async () => {
    if (!isFirebaseConfigured) {
      showError('Firebase is not configured.');
      return;
    }
    setAuthLoading(true);
    setErrorMsg(null);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      await verifyAdminAccess(result.user);
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        showToast('Popup blocked by browser. Redirecting to sign in...');
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          console.error('Google Redirect error:', redirectErr);
          showError(mapFirebaseAuthError(redirectErr));
        }
      } else if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Google Sign-In error:', err);
        showError(mapFirebaseAuthError(err));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
    setAdminUser(null);
    setActiveTab('overview');
    showToast('Signed out successfully.');
  };

  // Handle Public Registration Submit
  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.consentGiven) {
      showError('You must agree to the data consent terms to register.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        type: regType,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        ward: formData.ward,
        consentGiven: formData.consentGiven,
        createdAt: serverTimestamp()
      };

      if (regType === 'individual') {
        payload.fullName = formData.fullName.trim();
        payload.profession = formData.profession.trim();
        payload.skillsOrServices = formData.skillsOrServices.trim();
      } else {
        payload.companyName = formData.companyName.trim();
        payload.contactPerson = formData.contactPerson.trim();
        if (formData.plotNumber.trim()) {
          payload.plotNumber = formData.plotNumber.trim();
        }
        payload.sector = formData.sector;
        payload.skillsOrServices = formData.skillsOrServices.trim();
        payload.employeeCount = Number(formData.employeeCount) || 1;
      }

      let docId: string | null = null;

      // Single addDoc attempt with 5s timeout guard, falling back to REST endpoint if stalled
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), 5000)
        );
        const addPromise = addDoc(collection(db, 'registrations'), payload);
        const docRef = (await Promise.race([addPromise, timeoutPromise])) as any;
        docId = docRef.id;
      } catch (clientErr: any) {
        console.warn('Client Firestore SDK save delayed or offline, using API fallback:', clientErr);
        const restRes = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            createdAt: new Date().toISOString()
          })
        });
        if (!restRes.ok) {
          const errBody = await restRes.json().catch(() => ({}));
          throw new Error(errBody.error || 'Failed to complete registration save');
        }
        const restData = await restRes.json();
        docId = restData.id;
      }

      setTicketResult(docId);
      showToast('Registration saved to database successfully!');

      // Reset form
      setFormData({
        fullName: '',
        companyName: '',
        contactPerson: '',
        phone: '+267',
        email: '',
        ward: 'Babusi',
        plotNumber: '',
        profession: '',
        sector: 'Services',
        skillsOrServices: '',
        employeeCount: 1,
        consentGiven: false
      });
    } catch (err: any) {
      console.error('Registration submission error:', err);
      showError(err?.message || 'Unable to complete registration. Please try again.');
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

    const headers = [
      'Document ID', 'Type', 'Full Name / Company', 'Contact Person',
      'Phone', 'Email', 'Ward', 'Plot Number', 'Profession / Sector',
      'Skills or Services', 'Employee Count', 'Consent Given', 'Created At'
    ];

    const rows = filteredRegistrations.map(r => [
      r.id || '',
      r.type,
      r.type === 'individual' ? r.fullName || '' : r.companyName || '',
      r.contactPerson || '',
      r.phone || '',
      r.email || '',
      r.ward || '',
      r.plotNumber || '',
      r.type === 'individual' ? r.profession || '' : r.sector || '',
      r.skillsOrServices || '',
      r.employeeCount || '',
      r.consentGiven ? 'Yes' : 'No',
      r.createdAt?.toDate?.() ? r.createdAt.toDate().toISOString() : 'Recent'
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gaborone_south_registrations_${new Date().toISOString().split('T')[0]}.csv`);
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
    const nameMatch = (r.fullName || r.companyName || '').toLowerCase().includes(searchLower);
    const phoneMatch = (r.phone || '').toLowerCase().includes(searchLower);
    const emailMatch = (r.email || '').toLowerCase().includes(searchLower);
    const matchesSearch = !adminSearch || nameMatch || phoneMatch || emailMatch;

    return matchesType && matchesWard && matchesSector && matchesSearch;
  });

  // Analytics breakdowns
  const individualCount = registrationsList.filter(r => r.type === 'individual').length;
  const companyCount = registrationsList.filter(r => r.type === 'company').length;
  const totalCount = registrationsList.length;

  const sectorCounts = SECTORS.map(sec => ({
    sector: sec,
    count: registrationsList.filter(r => r.sector === sec).length
  }));
  const maxSectorCount = Math.max(...sectorCounts.map(s => s.count), 1);

  return (
    <div className="min-h-screen bg-[#EAF5FC] text-[#1F2328] flex flex-col font-['Outfit'] antialiased">
      
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 sm:top-5 sm:right-5 z-50 bg-[#2E6DA4] text-white px-4 py-3 sm:px-6 sm:py-3 rounded-xl shadow-xl flex items-center space-x-3 border border-[#72BEE7]">
          <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-[#72BEE7]" />
          <span className="font-medium text-xs sm:text-sm">{successToast}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="fixed top-16 right-4 sm:top-20 sm:right-5 z-50 bg-[#BA1A1A] text-white px-4 py-3 sm:px-5 sm:py-3 rounded-xl shadow-xl flex items-center justify-between gap-3 border border-red-400 max-w-sm sm:max-w-md animate-fade-in">
          <div className="flex items-center space-x-2.5 min-w-0">
            <AlertCircle className="w-5 h-5 shrink-0 text-white" />
            <span className="font-medium text-xs sm:text-sm break-words">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-white hover:text-white/80 p-1 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header / Navigation */}
      <header className="bg-white border-b border-[#C9CCD1] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            
            {/* Branding */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
              <img 
                src="/assets/aistudio/gaborone-south-logo-transparent_07b83a00.png" 
                alt="Gaborone South Logo" 
                className="h-10 sm:h-12 w-auto object-contain shrink-0"
              />
              <div>
                <h1 className="text-base sm:text-lg font-extrabold text-[#1F2328] leading-tight tracking-tight">
                  Gaborone South Economic Initiatives
                </h1>
                <p className="text-[11px] sm:text-xs text-[#55565A] font-medium hidden sm:block">
                  Theme: Youth at the Centre of a Thriving Economy, Reduced Import Bill and Healthy Minds
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1 sm:space-x-2">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'register', label: 'Register Entry' },
                { id: 'resources', label: 'Resource Center' },
                { id: 'admin', label: adminUser ? 'Admin Dashboard' : 'Admin Login' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[40px] ${
                    activeTab === tab.id
                      ? 'bg-[#2E6DA4] text-white shadow-xs'
                      : 'text-[#55565A] hover:bg-[#EAF5FC] hover:text-[#2E6DA4]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Mobile Hamburger Button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2.5 rounded-xl text-[#55565A] hover:bg-[#EAF5FC] transition cursor-pointer border border-[#C9CCD1]/60"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-[#C9CCD1] px-4 pt-2 pb-4 space-y-1 animate-fade-in">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'register', label: 'Register Entry' },
              { id: 'resources', label: 'Resource Center' },
              { id: 'admin', label: adminUser ? 'Admin Dashboard' : 'Admin Login' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#2E6DA4] text-white'
                    : 'text-[#55565A] hover:bg-[#EAF5FC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">

        {/* ================= OVERVIEW TAB ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-8 sm:space-y-12 pb-12">
            
            {/* Hero Section with Dynamic Slideshow */}
            <section className="relative bg-[#245885] text-white min-h-[380px] sm:min-h-[460px] flex items-center overflow-hidden">
              {HERO_SLIDES.map((slide, index) => (
                <div 
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                    index === currentHeroSlide ? 'opacity-35' : 'opacity-0'
                  }`}
                >
                  <img 
                    src={slide.url} 
                    alt={slide.alt}
                    className="w-full h-full object-cover hero-slide-image animate-kenburns"
                  />
                </div>
              ))}
              
              <div className="absolute inset-0 bg-gradient-to-r from-[#245885]/95 via-[#2E6DA4]/85 to-transparent"></div>

              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 z-10 w-full">
                <div className="max-w-3xl space-y-4 sm:space-y-6">
                  <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-xs sm:text-sm font-medium">
                    <Sparkles className="w-4 h-4 text-[#72BEE7]" />
                    <span>Official Constituency Empowerment Initiative</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                    Youth at the Centre of a Thriving Economy
                  </h1>

                  <p className="text-sm sm:text-lg text-white/90 leading-relaxed font-normal">
                    Gaborone South Constituency Economic Initiatives — Dedicated to enterprise innovation, reduced import reliance, healthy minds, and community growth across Babusi, Bontleng, Old Naledi, White City, and all wards.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <button
                      onClick={() => setActiveTab('register')}
                      className="bg-[#72BEE7] hover:bg-[#5aaedc] text-[#1F2328] font-bold px-6 py-3.5 rounded-xl shadow-lg transition cursor-pointer text-center text-sm sm:text-base min-h-[48px] flex items-center justify-center gap-2"
                    >
                      <span>Register Entry / Company</span>
                    </button>

                    <button
                      onClick={handleDownloadProgramme}
                      className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3.5 rounded-xl border border-white/30 backdrop-blur-md transition cursor-pointer text-center text-sm sm:text-base min-h-[48px] flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Symposium Programme PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Key Pillars */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328]">Initiative Focus Pillars</h2>
                <p className="text-xs sm:text-sm text-[#55565A] mt-2">Empowering youth enterprises and township economic transformation.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-3">
                  <div className="w-12 h-12 bg-[#EAF5FC] text-[#2E6DA4] rounded-xl flex items-center justify-center border border-[#72BEE7]">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1F2328]">Thriving Township Economy</h3>
                  <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                    Unlocking potential across all Gaborone South wards with structured micro-grants, enterprise incubation, and technical development.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-3">
                  <div className="w-12 h-12 bg-[#EAF5FC] text-[#2E6DA4] rounded-xl flex items-center justify-center border border-[#72BEE7]">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1F2328]">Reduced Import Bill</h3>
                  <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                    Supporting local manufacturing, urban agriculture, and service production to foster self-reliance and reduce reliance on imported goods.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-3">
                  <div className="w-12 h-12 bg-[#EAF5FC] text-[#2E6DA4] rounded-xl flex items-center justify-center border border-[#72BEE7]">
                    <Award className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1F2328]">Healthy Minds & Community</h3>
                  <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                    Holistic development addressing youth wellness, mentorship, leadership training, and active economic participation.
                  </p>
                </div>
              </div>
            </section>

          </div>
        )}

        {/* ================= REGISTER TAB ================= */}
        {activeTab === 'register' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fade-in">
            <div className="bg-white rounded-3xl border border-[#C9CCD1] p-6 sm:p-10 shadow-md space-y-8">
              
              <div className="text-center max-w-xl mx-auto space-y-2">
                <span className="text-xs font-bold text-[#2E6DA4] bg-[#EAF5FC] border border-[#72BEE7]/40 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                  Registration Portal
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328]">
                  Register Entry or Enterprise
                </h2>
                <p className="text-xs sm:text-sm text-[#55565A]">
                  Submit your details to participate in economic grants, incubation, and constituency support initiatives.
                </p>
              </div>

              {ticketResult ? (
                <div className="bg-[#EAF5FC] border-2 border-[#72BEE7] rounded-2xl p-6 sm:p-8 text-center space-y-4 animate-scale-up">
                  <div className="w-16 h-16 bg-[#2E6DA4] text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-10 h-10 text-[#72BEE7]" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#1F2328]">Registration Successful!</h3>
                  <p className="text-xs sm:text-sm text-[#55565A]">Your registration has been successfully saved to the database. Reference ID:</p>
                  <div className="bg-white py-3 px-4 rounded-xl border border-[#72BEE7] text-base sm:text-xl font-mono font-bold text-[#2E6DA4] shadow-2xs select-all break-all">
                    {ticketResult}
                  </div>
                  <p className="text-xs text-[#55565A]">Stored in collection <code className="bg-white/80 px-1.5 py-0.5 rounded text-[#2E6DA4] font-mono font-semibold border border-[#72BEE7]/40">registrations</code>.</p>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      onClick={handleDownloadProgramme}
                      className="w-full sm:w-auto bg-[#2E6DA4] hover:bg-[#245885] text-white px-6 py-3.5 rounded-xl font-bold text-sm cursor-pointer transition-colors flex items-center justify-center gap-2 min-h-[48px] shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Programme PDF</span>
                    </button>
                    <button
                      onClick={() => setTicketResult(null)}
                      className="w-full sm:w-auto bg-white hover:bg-[#EAF5FC] text-[#2E6DA4] border border-[#C9CCD1] px-6 py-3.5 rounded-xl font-bold text-sm cursor-pointer transition-colors min-h-[48px] shadow-2xs"
                    >
                      Register Another Entry
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegistrationSubmit} className="space-y-6">
                  
                  {/* Category Segmented Control */}
                  <div>
                    <label className="block text-xs font-bold text-[#1F2328] uppercase mb-2">Registration Category *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'individual', label: 'Individual', sub: 'Citizen / Youth', icon: Users },
                        { id: 'company', label: 'Company / Enterprise', sub: 'Private Business', icon: Building2 }
                      ].map(item => {
                        const Icon = item.icon;
                        const isSelected = regType === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setRegType(item.id as RegistrationType)}
                            className={`p-4 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 min-h-[64px] ${
                              isSelected 
                                ? 'bg-[#2E6DA4] text-white border-[#2E6DA4] shadow-xs' 
                                : 'bg-white text-[#55565A] border-[#C9CCD1] hover:bg-[#EAF5FC]'
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-[#2E6DA4]'}`} />
                            <span className="font-bold text-xs sm:text-sm">{item.label}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[#55565A]'}`}>{item.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4 pt-2 border-t border-[#C9CCD1]">
                    
                    {/* Dynamic Name Fields */}
                    {regType === 'individual' ? (
                      <div>
                        <label className="block text-xs font-semibold text-[#1F2328] mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Kagiso Modisa"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#1F2328] mb-1">Company Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Broadhurst Tech Solutions (Pty) Ltd"
                            value={formData.companyName}
                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#1F2328] mb-1">Contact Person / Representative *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Lesego Tau"
                            value={formData.contactPerson}
                            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
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
                          className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
                        />
                        <span className="text-[11px] text-[#55565A] mt-1 block">7 to 25 characters (e.g. +26771234567)</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1F2328] mb-1">Email Address *</label>
                        <input
                          type="email"
                          required
                          placeholder="contact@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
                        />
                      </div>
                    </div>

                    {/* Ward & Plot Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#1F2328] mb-1">Ward *</label>
                        <select
                          value={formData.ward}
                          onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
                        >
                          {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>

                      <div>
                        {regType === 'company' ? (
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2328] mb-1">Plot Number (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. Plot 4521, Broadhurst"
                              value={formData.plotNumber}
                              onChange={(e) => setFormData({ ...formData, plotNumber: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2328] mb-1">Profession / Occupation *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Software Developer / Farmer / Student"
                              value={formData.profession}
                              onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Category Specific Details */}
                    {regType === 'individual' ? (
                      <div>
                        <label className="block text-xs font-semibold text-[#1F2328] mb-1">Skills & Talents *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Web Development, Carpentry, Agriculture"
                          value={formData.skillsOrServices}
                          onChange={(e) => setFormData({ ...formData, skillsOrServices: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2328] mb-1">Sector *</label>
                            <select
                              value={formData.sector}
                              onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
                            >
                              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2328] mb-1">Employee Count *</label>
                            <input
                              type="number"
                              required
                              min={1}
                              value={formData.employeeCount}
                              onChange={(e) => setFormData({ ...formData, employeeCount: Number(e.target.value) })}
                              className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#1F2328] mb-1">Goods & Services Offered *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Solar panel installation, catering supplies"
                            value={formData.skillsOrServices}
                            onChange={(e) => setFormData({ ...formData, skillsOrServices: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
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
                          checked={formData.consentGiven}
                          onChange={(e) => setFormData({ ...formData, consentGiven: e.target.checked })}
                          className="w-5 h-5 mt-0.5 rounded border-[#C9CCD1] text-[#2E6DA4] focus:ring-[#2E6DA4] shrink-0"
                        />
                        <span className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                          I consent to the collection and secure storage of my registration details by the Gaborone South Constituency Office for Economic Initiatives analytics, micro-grant evaluation, and communications. *
                        </span>
                      </label>
                    </div>

                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 text-base min-h-[48px]"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Saving Registration...</span>
                      </div>
                    ) : (
                      'Submit Registration'
                    )}
                  </button>

                </form>
              )}

            </div>
          </div>
        )}

        {/* ================= RESOURCES TAB ================= */}
        {activeTab === 'resources' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 animate-fade-in">
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-[#C9CCD1] shadow-xs">
              <span className="text-xs font-bold text-[#2E6DA4] bg-[#EAF5FC] border border-[#72BEE7]/40 px-3 py-1 rounded-full inline-block">Official Center</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328] mt-2">Resource Library</h2>
              <p className="text-sm text-[#55565A] mt-1">Download official Gaborone South Constituency Economic Initiatives guidelines and formalization guides.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {[
                { title: 'Constituency Economic Initiatives Guidelines 2026', size: '2.4 MB', desc: 'Eligibility, grant frameworks, and evaluation rubrics.' },
                { title: 'Theme Framework & Policy Action Plan 2026', size: '3.1 MB', desc: 'Youth Enterprise, Import Reduction, and Mental Health Strategic Action Plan for Gaborone South.' },
                { title: 'CIPA Company & NGO Formalization Guide', size: '1.8 MB', desc: 'Fast-track handbook for registering township enterprises in Botswana.' }
              ].map((res, i) => (
                <div key={i} className="bg-white p-5 sm:p-6 rounded-2xl border border-[#C9CCD1] shadow-xs flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-[#1F2328] text-base sm:text-lg">{res.title}</h3>
                    <p className="text-xs sm:text-sm text-[#55565A] mt-1">{res.desc}</p>
                    <span className="text-xs text-[#2E6DA4] font-semibold mt-2 block">{res.size} • PDF Document</span>
                  </div>
                  <button 
                    onClick={() => showToast(`Downloading ${res.title}...`)}
                    className="w-full bg-[#EAF5FC] hover:bg-[#2E6DA4] text-[#2E6DA4] hover:text-white py-3 px-4 rounded-xl transition cursor-pointer font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-[#C9CCD1] min-h-[44px]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Resource</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= ADMIN TAB ================= */}
        {activeTab === 'admin' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 animate-fade-in">
            {!adminUser ? (
              <div className="max-w-md mx-auto bg-white p-6 sm:p-8 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-[#EAF5FC] text-[#2E6DA4] rounded-xl flex items-center justify-center mx-auto border border-[#72BEE7]">
                    <Lock className="w-6 h-6 text-[#2E6DA4]" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#1F2328]">Admin Portal Login</h3>
                  <p className="text-xs text-[#55565A] leading-relaxed">
                    Sign in with an authorized admin account (registered in admins collection).
                  </p>
                </div>

                {/* Email / Password Sign In Form */}
                <form onSubmit={handleEmailAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1F2328] mb-1">Admin Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@example.com"
                      value={adminEmailInput}
                      onChange={(e) => setAdminEmailInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-xl text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1F2328] mb-1">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#C9CCD1] rounded-xl text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[44px]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px] text-sm disabled:opacity-60"
                  >
                    {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Sign In with Password'}
                  </button>
                </form>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-[#C9CCD1]"></div>
                  <span className="flex-shrink mx-3 text-xs text-[#55565A] font-semibold uppercase">Or</span>
                  <div className="flex-grow border-t border-[#C9CCD1]"></div>
                </div>

                {/* Google Sign-In */}
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={handleGoogleAdminLogin}
                    disabled={authLoading}
                    className="w-full py-3 px-4 bg-white hover:bg-[#EAF5FC] text-[#1F2328] font-bold rounded-xl border-2 border-[#C9CCD1] hover:border-[#2E6DA4] shadow-xs transition flex items-center justify-center gap-3 cursor-pointer min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  >
                    {authLoading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#2E6DA4]" />
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      <>
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.36 7.34 24 12 24z"/>
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#55565A] text-center">
                    <ShieldCheck className="w-4 h-4 text-[#2E6DA4] shrink-0" />
                    <span>Restricted to authorized admins in <code className="bg-slate-100 px-1 py-0.5 rounded text-[#2E6DA4] font-mono">admins</code> collection</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                
                {/* Admin Header Card */}
                <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#C9CCD1] border-l-8 border-l-[#2E6DA4] shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden">
                  <div className="space-y-1.5 z-10">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="bg-[#EAF5FC] text-[#2E6DA4] border border-[#72BEE7]/60 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#2E6DA4]" />
                        <span>Authenticated Admin</span>
                      </span>
                      <span className="text-xs font-mono text-[#55565A] bg-slate-50 px-2.5 py-1 rounded-md border border-[#C9CCD1]/60">
                        {adminUser.email}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Live onSnapshot Active</span>
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328] tracking-tight pt-1">
                      Economic Initiatives Admin Dashboard
                    </h2>
                    <p className="text-xs sm:text-sm text-[#55565A]">
                      Live streaming records from collection <code className="bg-slate-100 px-1 py-0.5 rounded text-[#2E6DA4] font-mono">registrations</code>.
                    </p>
                  </div>

                  {/* Logout Button */}
                  <div className="flex items-center gap-2.5 z-10 shrink-0">
                    <button
                      onClick={handleAdminLogout}
                      className="w-full sm:w-auto bg-[#BA1A1A] hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors min-h-[44px]"
                      title="Logout from Admin Portal"
                    >
                      <LogOut className="w-4 h-4 text-white" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>

                {/* Stat Cards Stack */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] border-t-4 border-t-[#2E6DA4] shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold text-[#55565A] uppercase tracking-wider">
                      <span>Total Registrations</span>
                      <Users className="w-4 h-4 text-[#2E6DA4]" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-[#2E6DA4] mt-2">{totalCount}</div>
                    <p className="text-xs text-[#55565A] mt-1 font-medium">Live onSnapshot records</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] border-t-4 border-t-indigo-500 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold text-[#55565A] uppercase tracking-wider">
                      <span>Individuals</span>
                      <Users className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-600 mt-2">{individualCount}</div>
                    <p className="text-xs text-[#55565A] mt-1 font-medium">Citizen entries</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] border-t-4 border-t-teal-500 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold text-[#55565A] uppercase tracking-wider">
                      <span>Companies</span>
                      <Building2 className="w-4 h-4 text-teal-500" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-teal-600 mt-2">{companyCount}</div>
                    <p className="text-xs text-[#55565A] mt-1 font-medium">Enterprise entries</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] border-t-4 border-t-[#72BEE7] shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold text-[#55565A] uppercase tracking-wider">
                      <span>Programme Downloads</span>
                      <Download className="w-4 h-4 text-[#72BEE7]" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-[#2E6DA4] mt-2">{programmeDownloadsCount}</div>
                    <p className="text-xs text-[#55565A] mt-1 font-medium">Background stat counter</p>
                  </div>
                </div>

                {/* Sector Breakdown Chart */}
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#C9CCD1] shadow-2xs space-y-4">
                  <h3 className="text-base font-bold text-[#1F2328] flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#2E6DA4]" />
                    <span>Sector Breakdown</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sectorCounts.map(s => (
                      <div key={s.sector} className="bg-[#EAF5FC]/50 p-3 rounded-xl border border-[#C9CCD1]/60 space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-[#1F2328]">{s.sector}</span>
                          <span className="text-[#2E6DA4]">{s.count}</span>
                        </div>
                        <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-[#C9CCD1]/40">
                          <div 
                            className="bg-[#2E6DA4] h-full rounded-full transition-all duration-500"
                            style={{ width: `${(s.count / maxSectorCount) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Search & Filters */}
                <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] shadow-2xs space-y-4">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="relative flex-1">
                      <Search className="w-5 h-5 text-[#55565A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search by Name, Company, Email, or Phone..."
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#C9CCD1] rounded-xl text-sm focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[44px]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-2 bg-white border border-[#C9CCD1] rounded-xl text-xs font-semibold text-[#1F2328] min-h-[40px]"
                      >
                        <option value="all">All Types</option>
                        <option value="individual">Individual</option>
                        <option value="company">Company</option>
                      </select>

                      <select
                        value={filterWard}
                        onChange={(e) => setFilterWard(e.target.value)}
                        className="px-3 py-2 bg-white border border-[#C9CCD1] rounded-xl text-xs font-semibold text-[#1F2328] min-h-[40px]"
                      >
                        <option value="all">All Wards</option>
                        {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>

                      <select
                        value={filterSector}
                        onChange={(e) => setFilterSector(e.target.value)}
                        className="px-3 py-2 bg-white border border-[#C9CCD1] rounded-xl text-xs font-semibold text-[#1F2328] min-h-[40px]"
                      >
                        <option value="all">All Sectors</option>
                        {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>

                      <button
                        onClick={exportToCSV}
                        className="bg-[#2E6DA4] hover:bg-[#245885] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer min-h-[40px] shadow-2xs"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Registrations Table */}
                  <div className="overflow-x-auto border border-[#C9CCD1] rounded-xl">
                    <table className="w-full text-left text-xs text-[#1F2328]">
                      <thead className="bg-[#EAF5FC] text-[#2E6DA4] font-bold border-b border-[#C9CCD1]">
                        <tr>
                          <th className="p-3">Doc ID</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Full Name / Company</th>
                          <th className="p-3">Contact</th>
                          <th className="p-3">Ward</th>
                          <th className="p-3">Profession / Sector</th>
                          <th className="p-3">Skills / Services</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#C9CCD1]">
                        {filteredRegistrations.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-[#55565A]">
                              No registrations match the selected filters.
                            </td>
                          </tr>
                        ) : (
                          filteredRegistrations.map((r, idx) => (
                            <tr key={r.id || idx} className="hover:bg-[#EAF5FC]/50 transition-colors">
                              <td className="p-3 font-mono font-bold text-[#2E6DA4] select-all">{r.id}</td>
                              <td className="p-3 uppercase font-semibold text-[10px]">{r.type}</td>
                              <td className="p-3 font-bold">{r.type === 'individual' ? r.fullName : r.companyName}</td>
                              <td className="p-3 space-y-0.5">
                                <div>{r.phone}</div>
                                <div className="text-[10px] text-[#55565A]">{r.email}</div>
                              </td>
                              <td className="p-3">{r.ward}</td>
                              <td className="p-3">{r.type === 'individual' ? r.profession : r.sector}</td>
                              <td className="p-3 text-[#55565A]">{r.skillsOrServices || '-'}</td>
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

      {/* Footer */}
      <footer className="bg-[#245885] text-white py-8 border-t border-white/10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="text-xs sm:text-sm font-semibold">
            Gaborone South Constituency Economic Initiatives Portal
          </p>
          <p className="text-[11px] text-white/70">
            Dedicated to Youth Empowerment, reduced import reliance, and healthy minds.
          </p>
        </div>
      </footer>

    </div>
  );
}

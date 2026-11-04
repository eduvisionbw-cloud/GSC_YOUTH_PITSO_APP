import React, { useState, useEffect } from 'react';
import { 
  Users, Award, BookOpen, Search, MapPin, 
  Clock, CheckCircle2, Sparkles, Download, 
  Building2, ShieldCheck, LogOut, Lock, AlertCircle, Menu, X,
  TrendingUp, ChevronLeft, ChevronRight, Filter, SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { 
  db, auth, isFirebaseConfigured, missingFirebaseEnvVars,
  mapFirebaseAuthError, isAuthorizedAdminEmail, getAdminEmails
} from './firebase';
import { 
  collection, addDoc, getDocs, query, where, serverTimestamp,
  doc, getDoc, setDoc, increment
} from 'firebase/firestore';
import { 
  signOut, onAuthStateChanged, User,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult
} from 'firebase/auth';

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
  const [authLoading, setAuthLoading] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [registrationsList, setRegistrationsList] = useState<Registration[]>([]);
  const [programmeDownloadsCount, setProgrammeDownloadsCount] = useState<number>(0);
  const [adminSearch, setAdminSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterWard, setFilterWard] = useState<string>('all');
  const [filterSector, setFilterSector] = useState<string>('all');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Auto-advance slideshow every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Track Auth State, Redirect Result & Fetch Stats
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    fetchStats();

    // Check redirect sign-in result (for popup fallback)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          if (!isAuthorizedAdminEmail(result.user.email)) {
            const unauthorizedEmail = result.user.email || 'User';
            await signOut(auth);
            setAdminUser(null);
            showError(`Not authorised: ${unauthorizedEmail} is not on the authorized admin list.`);
          } else {
            setAdminUser(result.user);
            showToast(`Welcome Admin ${result.user.email}!`);
            setActiveTab('admin');
            fetchRegistrations();
          }
        }
      })
      .catch((err) => {
        showError(mapFirebaseAuthError(err));
      });

    // Guard admin state: allow only emails on VITE_ADMIN_EMAILS whitelist
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (!isAuthorizedAdminEmail(user.email)) {
          const unauthorizedEmail = user.email || 'User';
          await signOut(auth);
          setAdminUser(null);
          showError(`Not authorised: ${unauthorizedEmail} is not on the authorized admin list.`);
        } else {
          setAdminUser(user);
          fetchRegistrations();
        }
      } else {
        setAdminUser(null);
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
    setTimeout(() => setErrorMsg(null), 6000);
  };

  const fetchStats = async () => {
    if (!isFirebaseConfigured || !db) return;
    try {
      const docRef = doc(db, 'stats', 'programmeDownloads');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const count = docSnap.data().count;
        if (typeof count === 'number') {
          setProgrammeDownloadsCount(count);
        }
      }
    } catch (err: any) {
      // Gracefully handle network warming / offline state without loud errors
      console.warn('Programme download stats currently unavailable:', err?.message || err);
    }
  };

  const handleDownloadProgramme = async () => {
    if (isFirebaseConfigured && db) {
      try {
        const statRef = doc(db, 'stats', 'programmeDownloads');
        await setDoc(statRef, { count: increment(1) }, { merge: true });
        setProgrammeDownloadsCount(prev => prev + 1);
      } catch (err: any) {
        console.warn('Could not record download stat:', err?.message || err);
      }
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
    if (!isFirebaseConfigured) return;
    setIsRefreshingData(true);
    try {
      const q = query(collection(db, 'registrations'));
      const snapshot = await getDocs(q);
      const list: Registration[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Registration);
      });
      // Sort newest first if createdAt is available
      list.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setRegistrationsList(list);
    } catch (err: any) {
      console.warn('Error fetching registrations:', err?.message || err);
      showError(err?.message || 'Failed to fetch registrations from the database.');
    } finally {
      setIsRefreshingData(false);
    }
  };

  // Handle Admin Login with Google (Popup with Redirect Fallback)
  const handleGoogleAdminLogin = async () => {
    if (!isFirebaseConfigured) {
      showError('Firebase configuration is not configured.');
      return;
    }
    setAuthLoading(true);
    setErrorMsg(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, provider);
      if (!isAuthorizedAdminEmail(result.user.email)) {
        const unauthorizedEmail = result.user.email || 'User';
        await signOut(auth);
        setAdminUser(null);
        showError(`Not authorised: ${unauthorizedEmail} is not on the authorized admin list.`);
        return;
      }
      setAdminUser(result.user);
      showToast(`Welcome Admin ${result.user.email || 'User'}!`);
      setActiveTab('admin');
      fetchRegistrations();
    } catch (err: any) {
      // If popup was blocked by browser, automatically fall back to signInWithRedirect
      if (err.code === 'auth/popup-blocked') {
        showToast('Sign-in popup blocked by browser. Redirecting...');
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          showError(mapFirebaseAuthError(redirectErr));
          return;
        }
      }
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User closed the popup window
        return;
      }
      showError(mapFirebaseAuthError(err));
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

  // Handle Registration Submit (Recognizable naming convention: REG-2026-[CATEGORY]-[PHONE])
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
      // Human-readable, recognizable document ID format (No random strings!):
      // Example: REG-2026-INDIVIDUAL-26771234567
      const phoneDigits = cleanPhone.replace(/\D/g, '');
      const categoryTag = regType.toUpperCase();
      let docId = `REG-2026-${categoryTag}-${phoneDigits}`;

      const payload: any = {
        id: docId,
        ticketNumber: docId,
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

      // Save directly to Firestore with the recognizable document ID
      try {
        await setDoc(doc(db, 'registrations', docId), payload);
      } catch (writeErr: any) {
        // If the document already exists and updates without auth are restricted,
        // create a unique recognizable sequence sub-id so the registration is never lost
        if (writeErr.code === 'permission-denied') {
          const timestampCode = Date.now().toString().slice(-4);
          docId = `REG-2026-${categoryTag}-${phoneDigits}-${timestampCode}`;
          payload.id = docId;
          payload.ticketNumber = docId;
          await setDoc(doc(db, 'registrations', docId), payload);
        } else {
          throw writeErr;
        }
      }

      setTicketResult(docId);
      showToast(`Registration saved to database successfully! Ref: ${docId}`);
      
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
      console.warn('Registration Error:', err?.message || err);
      showError(err?.message || 'Failed to submit registration. Please try again.');
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

  // Calculate sector chart stats
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

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-[#EAF5FC] text-[#1F2328] flex items-center justify-center p-4 font-['Outfit'] antialiased">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-[#C9CCD1] p-6 sm:p-10 shadow-lg space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-200">
              <AlertCircle className="w-8 h-8" />
            </div>
            <span className="text-xs font-bold text-red-700 bg-red-100/70 border border-red-200 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              Configuration Missing
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328]">
              Firebase Setup Required
            </h1>
            <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
              This application reads Firebase configuration strictly from environment variables. The following required variables were not found:
            </p>
          </div>

          <div className="bg-red-50/60 border border-red-200 rounded-2xl p-4 sm:p-5 space-y-2">
            <div className="text-xs font-bold text-red-900 uppercase tracking-wider">Missing Variables:</div>
            <ul className="space-y-1.5">
              {missingFirebaseEnvVars.map(v => (
                <li key={v} className="flex items-center space-x-2 text-xs font-mono font-bold text-red-700">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 bg-[#EAF5FC]/60 border border-[#C9CCD1] rounded-2xl p-4 sm:p-5 text-xs text-[#1F2328]">
            <h2 className="font-bold text-sm text-[#1F2328]">How to resolve:</h2>
            <ol className="list-decimal list-inside space-y-1.5 text-[#55565A]">
              <li><strong>On Vercel:</strong> Open your project dashboard &gt; <strong>Settings &gt; Environment Variables</strong>.</li>
              <li>Add the missing variables with values from Firebase Console (Project Settings &gt; General &gt; Your apps &gt; SDK setup).</li>
              <li><strong>Local Development:</strong> Copy <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#C9CCD1]">.env.example</code> to <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#C9CCD1]">.env</code> and supply the values.</li>
              <li>Redeploy your Vercel deployment or restart the dev server.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

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
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-[#2E6DA4] text-white text-[11px] sm:text-xs md:text-sm py-2 px-3 sm:px-4 text-center font-medium flex items-center justify-center">
        <span>Babusi Community Hall, Gaborone South • Friday, 6th November 2026</span>
      </div>

      {/* Sticky Header Navigation */}
      <header className="bg-white/95 backdrop-blur-md border-b border-[#C9CCD1]/60 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 md:h-24 flex items-center justify-between">
          
          {/* Logo with mobile 36px rule */}
          <div 
            className="flex items-center cursor-pointer group py-1" 
            onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }}
            title="Gaborone South Constituency Office"
          >
            <img 
              src="/assets/aistudio/gaborone-south-logo-transparent_07b83a00.png" 
              alt="Gaborone South Constituency Office"
              className="h-9 sm:h-12 md:h-16 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </div>

          {/* Desktop Navigation */}
          {adminUser ? (
            <div className="hidden lg:flex items-center space-x-2 bg-[#EAF5FC] p-1.5 rounded-xl border border-[#C9CCD1]">
              <button
                onClick={() => { setActiveTab('register'); setMobileMenuOpen(false); }}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[40px] ${
                  activeTab === 'register' 
                    ? 'bg-[#2E6DA4] text-white shadow-2xs' 
                    : 'bg-white hover:bg-[#2E6DA4] text-[#2E6DA4] hover:text-white border border-[#C9CCD1]'
                }`}
                title="Register New Applicant"
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Register</span>
              </button>

              <button
                onClick={fetchRegistrations}
                disabled={isRefreshingData}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-white hover:bg-slate-100 text-[#1F2328] border border-[#C9CCD1] transition-all cursor-pointer min-h-[40px]"
                title="Refresh Database Records"
              >
                <RefreshCw className={`w-4 h-4 text-[#2E6DA4] ${isRefreshingData ? 'animate-spin' : ''}`} />
                <span>{isRefreshingData ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              <button
                onClick={exportToCSV}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-[#2E6DA4] hover:bg-[#245885] text-white shadow-2xs transition-all cursor-pointer min-h-[40px]"
                title="Export Registrations to CSV"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Export CSV</span>
              </button>
            </div>
          ) : (
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
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer min-h-[40px] ${
                      isActive ? 'bg-[#2E6DA4] text-white shadow-xs' : 'text-[#55565A] hover:bg-white hover:text-[#2E6DA4]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#72BEE7]' : 'text-[#55565A]'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Action Buttons & Mobile Hamburger Toggle */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Admin Dashboard / Login Button */}
            {adminUser ? (
              <>
                <button
                  onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0 min-h-[44px]"
                  title="Admin Dashboard"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Admin Dashboard</span>
                  <span className="sm:hidden">Admin</span>
                </button>

                {/* Red Logout Button on the Right */}
                <button
                  onClick={handleAdminLogout}
                  className="bg-[#BA1A1A] hover:bg-red-700 text-white font-bold px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm shrink-0 min-h-[44px]"
                  title="Logout Administrator"
                >
                  <LogOut className="w-4 h-4 shrink-0 text-white" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                  className="bg-white hover:bg-[#EAF5FC] text-[#2E6DA4] border border-[#C9CCD1] font-semibold px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0 min-h-[44px]"
                  title="Admin Login"
                >
                  <Lock className="w-4 h-4 text-[#2E6DA4] shrink-0" />
                  <span className="hidden sm:inline">Admin Login</span>
                  <span className="sm:hidden">Login</span>
                </button>

                {/* Persistent Register Button for Public */}
                <button
                  onClick={() => { setActiveTab('register'); setMobileMenuOpen(false); }}
                  className="bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer text-xs sm:text-sm shrink-0 min-h-[44px]"
                >
                  <Users className="w-4 h-4 text-white shrink-0" />
                  <span>Register</span>
                </button>
              </>
            )}

            {/* Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#1F2328] hover:bg-[#EAF5FC] border border-[#C9CCD1] transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-[#2E6DA4]" />
              ) : (
                <Menu className="w-6 h-6 text-[#1F2328]" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Hamburger Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-[#C9CCD1] px-4 pt-3 pb-5 space-y-2 shadow-xl animate-fade-in">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#55565A] px-2 pb-1">
              Navigation Menu
            </div>
            {[
              { id: 'overview', label: 'Overview', icon: Users, desc: 'Constituency info & key event details' },
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
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer min-h-[48px] ${
                    isActive 
                      ? 'bg-[#2E6DA4] text-white shadow-xs' 
                      : 'text-[#1F2328] hover:bg-[#EAF5FC]'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-[#EAF5FC] text-[#2E6DA4]'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{tab.label}</div>
                    <div className={`text-xs ${isActive ? 'text-white/80' : 'text-[#55565A]'}`}>{tab.desc}</div>
                  </div>
                </button>
              );
            })}

            {adminUser && (
              <div className="pt-2 border-t border-[#C9CCD1] space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#2E6DA4] px-2 pt-1">
                  Admin Tools
                </div>
                <button
                  onClick={() => { setActiveTab('register'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-sm font-bold bg-[#EAF5FC] text-[#2E6DA4] hover:bg-[#2E6DA4] hover:text-white transition-colors"
                >
                  <Users className="w-5 h-5" />
                  <span>Register New Applicant</span>
                </button>
                <button
                  onClick={() => { fetchRegistrations(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-sm font-bold bg-slate-100 text-[#1F2328] hover:bg-slate-200 transition-colors"
                >
                  <RefreshCw className="w-5 h-5 text-[#2E6DA4]" />
                  <span>Refresh Database</span>
                </button>
                <button
                  onClick={() => { exportToCSV(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-sm font-bold bg-[#2E6DA4] text-white hover:bg-[#245885] transition-colors"
                >
                  <Download className="w-5 h-5" />
                  <span>Export CSV</span>
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-[#C9CCD1] mt-2">
              <button
                onClick={() => {
                  if (adminUser) {
                    handleAdminLogout();
                    setMobileMenuOpen(false);
                  } else {
                    setActiveTab('admin');
                    setMobileMenuOpen(false);
                  }
                }}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-left text-sm font-semibold transition-colors cursor-pointer min-h-[48px] ${
                  adminUser 
                    ? 'bg-[#BA1A1A] text-white shadow-xs hover:bg-red-700' 
                    : activeTab === 'admin'
                    ? 'bg-[#2E6DA4] text-white shadow-xs' 
                    : 'text-[#1F2328] hover:bg-[#EAF5FC]'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${adminUser ? 'bg-white/20 text-white' : activeTab === 'admin' ? 'bg-white/20 text-white' : 'bg-[#EAF5FC] text-[#2E6DA4]'}`}>
                  {adminUser ? <LogOut className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                </div>
                <div>
                  <div className="font-bold text-sm">{adminUser ? 'Logout Admin' : 'Admin Portal Login'}</div>
                  <div className={`text-xs ${adminUser || activeTab === 'admin' ? 'text-white/80' : 'text-[#55565A]'}`}>
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
            
            {/* Parallax Slideshow Hero Section */}
            <div className="relative w-full bg-[#EAF5FC] border-b border-[#C9CCD1] text-[#1F2328] overflow-hidden min-h-[500px] sm:min-h-[560px] lg:min-h-[620px] flex items-center">
              
              {/* Slideshow Background Images with Smooth Crossfade & Ken Burns Effect */}
              {HERO_SLIDES.map((slide, idx) => {
                const isActive = idx === currentHeroSlide;
                return (
                  <div
                    key={idx}
                    className={`absolute inset-0 transition-all duration-[1400ms] ease-in-out transform-gpu hero-slide-image ${
                      isActive 
                        ? 'opacity-100 scale-100 z-0' 
                        : 'opacity-0 scale-[1.03] z-0 pointer-events-none'
                    }`}
                  >
                    <img
                      src={slide.url}
                      alt={slide.alt}
                      className="w-full h-full object-cover object-center animate-kenburns hero-slide-image"
                    />
                    {/* Gradient Scrim for Contrast & Legibility */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#EAF5FC] via-[#EAF5FC]/90 via-50% to-[#EAF5FC]/30 lg:to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#EAF5FC] via-transparent to-transparent opacity-80 sm:hidden"></div>
                  </div>
                );
              })}

              {/* Hero Foreground Content */}
              <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
                <div className="max-w-2xl lg:max-w-3xl space-y-4 sm:space-y-6">
                  
                  <h1 className="text-fluid-hero font-extrabold tracking-tight leading-tight text-[#1F2328]">
                    Youth at the Centre of a Thriving Economy, Reduced Import Bill and Healthy Minds
                  </h1>

                  <p className="text-base sm:text-lg text-[#1F2328] font-normal leading-relaxed">
                    Join constituency leadership, young entrepreneurs, community institutions, and organisations at Babusi Community Hall to debate policies, unlock economic grants, and build self-reliant local industries.
                  </p>
                  
                  {/* Hero Action CTAs */}
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-2">
                    <button
                      onClick={() => setActiveTab('register')}
                      className="w-full sm:w-auto bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold px-6 py-3.5 sm:py-3 rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer min-h-[48px] text-base"
                    >
                      <Users className="w-5 h-5 text-white" />
                      <span>Register Now</span>
                    </button>
                    
                    <button
                      onClick={handleDownloadProgramme}
                      className="w-full sm:w-auto bg-white hover:bg-[#EAF5FC] text-[#2E6DA4] border border-[#C9CCD1] font-bold px-6 py-3.5 sm:py-3 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer shadow-2xs min-h-[48px] text-base"
                    >
                      <Download className="w-5 h-5 text-[#2E6DA4]" />
                      <span>Download Programme (PDF)</span>
                    </button>
                  </div>

                  {/* Slideshow Controls & Indicators */}
                  <div className="flex items-center justify-between sm:justify-start gap-4 pt-4 border-t border-[#C9CCD1]/40">
                    <div className="flex items-center gap-2">
                      {HERO_SLIDES.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentHeroSlide(idx)}
                          className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                            idx === currentHeroSlide ? 'w-8 bg-[#2E6DA4]' : 'w-2.5 bg-[#C9CCD1] hover:bg-[#72BEE7]'
                          }`}
                          aria-label={`Go to slide ${idx + 1}`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentHeroSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
                        className="p-2 rounded-lg bg-white/80 hover:bg-white border border-[#C9CCD1] text-[#1F2328] transition-colors cursor-pointer shadow-2xs"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentHeroSlide((prev) => (prev + 1) % HERO_SLIDES.length)}
                        className="p-2 rounded-lg bg-white/80 hover:bg-white border border-[#C9CCD1] text-[#1F2328] transition-colors cursor-pointer shadow-2xs"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[
                  { label: 'Official Venue', value: 'Babusi Community Hall', desc: 'Broadhurst, Gaborone South', icon: MapPin },
                  { label: 'Event Date', value: '6th November 2026', desc: '08:30 AM - 17:00 PM', icon: Clock },
                  { label: 'Economic Fund', value: 'P4.5 Million', desc: 'Allocated for Micro-Grants & Support', icon: Award }
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className="bg-white p-5 sm:p-6 rounded-2xl border border-[#C9CCD1] shadow-xs hover:border-[#72BEE7] transition">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#EAF5FC] text-[#2E6DA4] flex items-center justify-center font-bold">
                          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
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
              <div id="programme-section" className="bg-white rounded-2xl border border-[#C9CCD1] p-5 sm:p-8 lg:p-10 shadow-xs space-y-6">
                <div className="max-w-3xl space-y-2">
                  <span className="text-xs font-bold text-[#2E6DA4] bg-[#EAF5FC] border border-[#72BEE7]/40 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                    Official Schedule
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328]">
                    Event Programme
                  </h2>
                  <p className="text-sm sm:text-base text-[#55565A]">
                    Download the full programme for the Youth Symposium, 6 November 2026, Babusi Community Hall
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
                  <button
                    onClick={handleDownloadProgramme}
                    className="w-full sm:w-auto bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold px-6 py-3.5 rounded-xl shadow-sm transition flex items-center justify-center space-x-2 cursor-pointer min-h-[48px] text-sm"
                  >
                    <Download className="w-5 h-5 text-white" />
                    <span>Download Programme (PDF)</span>
                  </button>
                  <a
                    href="/Gaborone-South-Youth-Symposium-Programme.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto bg-white hover:bg-[#EAF5FC] text-[#2E6DA4] border border-[#C9CCD1] font-semibold px-6 py-3.5 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer shadow-2xs min-h-[48px] text-sm"
                  >
                    <span>View online →</span>
                  </a>
                </div>
              </div>

              {/* Vision, Mission, Strategy & Set Goals */}
              <div className="bg-white rounded-2xl border border-[#C9CCD1] p-5 sm:p-8 lg:p-10 shadow-xs space-y-6 sm:space-y-8">
                <div className="max-w-3xl space-y-2">
                  <span className="text-xs font-bold text-[#2E6DA4] bg-[#EAF5FC] border border-[#72BEE7]/40 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                    Constituency Framework
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328]">
                    Vision, Mission, Strategy & Set Goals
                  </h2>
                  <p className="text-sm sm:text-base text-[#55565A]">
                    Guiding principles for the Gaborone South Constituency Economic Initiatives and ecosystem development.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Our Vision */}
                  <div className="bg-[#EAF5FC]/50 hover:bg-[#EAF5FC] rounded-2xl p-5 sm:p-6 border border-[#C9CCD1] hover:border-[#2E6DA4] transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#2E6DA4] text-white flex items-center justify-center font-bold shadow-xs">
                        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#2E6DA4] uppercase tracking-wider">Our Vision</div>
                      <h3 className="text-base sm:text-lg font-bold text-[#1F2328]">Center of Excellence & Flagship Township Economy</h3>
                      <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                        Gaborone South Constituency should be a center of Excellence and Brilliance, Business, Tourism, Cultural, Heritage Activities and a Flagship for Township Economy.
                      </p>
                    </div>
                  </div>

                  {/* Mission */}
                  <div className="bg-[#EAF5FC]/50 hover:bg-[#EAF5FC] rounded-2xl p-5 sm:p-6 border border-[#C9CCD1] hover:border-[#2E6DA4] transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#2E6DA4] text-white flex items-center justify-center font-bold shadow-xs">
                        <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#2E6DA4] uppercase tracking-wider">Mission</div>
                      <h3 className="text-base sm:text-lg font-bold text-[#1F2328]">Eradication of Unemployment & Poverty</h3>
                      <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                        The eradication of Unemployment, Poverty and Destitution in the Constituency.
                      </p>
                    </div>
                  </div>

                  {/* Strategy */}
                  <div className="bg-[#EAF5FC]/50 hover:bg-[#EAF5FC] rounded-2xl p-5 sm:p-6 border border-[#C9CCD1] hover:border-[#2E6DA4] transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#2E6DA4] text-white flex items-center justify-center font-bold shadow-xs">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#2E6DA4] uppercase tracking-wider">Strategy</div>
                      <h3 className="text-base sm:text-lg font-bold text-[#1F2328]">Constituency Ecosystem Alignment</h3>
                      <p className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                        Alignment of the important Key Stakeholders namely Communities, Companies, Institutions and Organisations as one Constituency Ecosystem.
                      </p>
                    </div>
                  </div>

                  {/* Set Goals */}
                  <div className="bg-[#EAF5FC]/50 hover:bg-[#EAF5FC] rounded-2xl p-5 sm:p-6 border border-[#C9CCD1] hover:border-[#2E6DA4] transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#2E6DA4] text-white flex items-center justify-center font-bold shadow-xs">
                        <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#2E6DA4] uppercase tracking-wider">Set Goals</div>
                      <h3 className="text-base sm:text-lg font-bold text-[#1F2328]">Clustering Models & Production Hubs</h3>
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
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 animate-fade-in">
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-6">
              
              <div className="text-center space-y-2">
                <span className="text-xs font-bold text-[#2E6DA4] bg-[#EAF5FC] border border-[#72BEE7]/40 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                  Gaborone South Constituency Economic Initiatives
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328]">Official Registration Portal</h2>
                <p className="text-sm text-[#55565A]">Register as an Individual, Company, Institution, or Organisation.</p>
              </div>

              {ticketResult ? (
                <div className="bg-[#EAF5FC] border border-[#72BEE7] p-6 sm:p-8 rounded-2xl text-center space-y-4">
                  <div className="w-16 h-16 bg-white text-[#2E6DA4] rounded-full flex items-center justify-center mx-auto shadow-xs border border-[#72BEE7]">
                    <CheckCircle2 className="w-10 h-10 text-[#2E6DA4]" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#1F2328]">Registration Successful!</h3>
                  <p className="text-xs sm:text-sm text-[#55565A]">Your registration has been successfully saved to the database under the recognizable document ID:</p>
                  <div className="bg-white py-3 px-4 rounded-xl border border-[#72BEE7] text-base sm:text-xl font-mono font-bold text-[#2E6DA4] shadow-2xs select-all break-all">
                    {ticketResult}
                  </div>
                  <p className="text-xs text-[#55565A]">Stored directly in database path <code className="bg-white/80 px-1.5 py-0.5 rounded text-[#2E6DA4] font-mono font-semibold border border-[#72BEE7]/40">registrations/{ticketResult}</code>. Please present this reference on Friday, 6th November 2026 at Babusi Community Hall.</p>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      onClick={handleDownloadProgramme}
                      className="w-full sm:w-auto bg-[#2E6DA4] hover:bg-[#245885] text-white px-6 py-3.5 rounded-xl font-bold text-sm cursor-pointer transition-colors flex items-center justify-center gap-2 min-h-[48px] shadow-sm"
                    >
                      <Download className="w-5 h-5 text-white" />
                      <span>Download Programme (PDF)</span>
                    </button>
                    <button
                      onClick={() => { setTicketResult(null); }}
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                            className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 min-h-[56px] ${
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
                          autoComplete="name"
                          placeholder="e.g. Kagiso Modisa"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
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
                            autoComplete="organization"
                            placeholder={
                              regType === 'company' ? 'e.g. Broadhurst Tech Solutions (Pty) Ltd' :
                              regType === 'institution' ? 'e.g. Gaborone South Vocational Institute' :
                              'e.g. Tsholofelo Youth Development Trust'
                            }
                            value={formData.companyName}
                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
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
                            autoComplete="name"
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
                          inputMode="tel"
                          required
                          autoComplete="tel"
                          placeholder="+26771234567"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
                        />
                        <span className="text-[11px] text-[#55565A] mt-1 block">Format: +267 followed by 7 or 8 digits</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1F2328] mb-1">Email Address *</label>
                        <input
                          type="email"
                          inputMode="email"
                          required
                          autoComplete="email"
                          placeholder="contact@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
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
                          className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
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
                              className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
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
                              className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[48px]"
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {/* Category Specific Details */}
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
                            className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
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
                            className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
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
                              className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
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
                              inputMode="numeric"
                              value={formData.numberOfEmployees}
                              onChange={(e) => setFormData({ ...formData, numberOfEmployees: Number(e.target.value) })}
                              className="w-full px-4 py-3 bg-white border border-[#C9CCD1] rounded-xl text-base text-[#1F2328] min-h-[48px]"
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
                          checked={formData.consent}
                          onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                          className="w-5 h-5 mt-0.5 rounded border-[#C9CCD1] text-[#2E6DA4] focus:ring-[#2E6DA4] shrink-0"
                        />
                        <span className="text-xs sm:text-sm text-[#55565A] leading-relaxed">
                          I consent to the collection and secure storage of my registration details by the Gaborone South Constituency Office for Constituency Economic Initiatives analytics, micro-grant evaluation, and communications. *
                        </span>
                      </label>
                    </div>

                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-[#2E6DA4] hover:bg-[#245885] text-white font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 text-base min-h-[48px]"
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
                { title: 'CIPA Company & NGO Formalization Guide', size: '1.8 MB', desc: 'Fast-track handbook for registering township enterprises and civil organisations in Botswana.' }
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
                    Sign in with your authorized administrator Google account to access registrations and analytics.
                  </p>
                </div>

                {/* Google Sign-In */}
                <div className="space-y-4 pt-1">
                  <button
                    type="button"
                    onClick={handleGoogleAdminLogin}
                    disabled={authLoading}
                    className="w-full py-3.5 px-4 bg-white hover:bg-[#EAF5FC] text-[#1F2328] font-bold rounded-xl border-2 border-[#C9CCD1] hover:border-[#2E6DA4] shadow-xs transition flex items-center justify-center gap-3 cursor-pointer min-h-[50px] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {authLoading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#2E6DA4]" />
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
                    <span>Restricted to authorized constituency administrators</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                
                {/* Robust Admin Header Card */}
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
                        <span>Database Live & Syncing</span>
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2328] tracking-tight pt-1">
                      Economic Initiatives Admin Dashboard
                    </h2>
                    <p className="text-xs sm:text-sm text-[#55565A]">
                      Centralized command center for managing constituency registrations, PDF analytics, and report exports.
                    </p>
                  </div>

                  {/* Red Logout Button on the Right */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                  <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] border-t-4 border-t-[#2E6DA4] shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between text-xs font-bold text-[#55565A] uppercase tracking-wider">
                      <span>Total Registrations</span>
                      <Users className="w-4 h-4 text-[#2E6DA4]" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-[#2E6DA4] mt-2">{totalCount}</div>
                    <p className="text-xs text-[#55565A] mt-1 font-medium">Live database records</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] border-t-4 border-t-[#72BEE7] shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between text-xs font-bold text-[#55565A] uppercase tracking-wider">
                      <span>Programme Downloads</span>
                      <Download className="w-4 h-4 text-[#72BEE7]" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-[#2E6DA4] mt-2">{programmeDownloadsCount}</div>
                    <p className="text-xs text-[#55565A] mt-1 font-medium">PDF downloads tracked live</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] border-t-4 border-t-sky-500 shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#55565A] uppercase tracking-wider">Individuals</span>
                      <span className="text-xs font-bold bg-[#EAF5FC] text-[#2E6DA4] px-2 py-0.5 rounded border border-[#72BEE7]/40">
                        {totalCount > 0 ? Math.round((individualCount / totalCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-[#1F2328] mt-2">{individualCount}</div>
                    <p className="text-xs text-[#55565A] mt-1 font-medium">Youth & individual delegates</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] border-t-4 border-t-[#2E6DA4] shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#55565A] uppercase tracking-wider">Companies</span>
                      <span className="text-xs font-bold bg-[#2E6DA4]/10 text-[#2E6DA4] px-2 py-0.5 rounded border border-[#2E6DA4]/30">
                        {totalCount > 0 ? Math.round((companyCount / totalCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-[#2E6DA4] mt-2">{companyCount}</div>
                    <p className="text-xs text-[#55565A] mt-1 font-medium">Private businesses & startups</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] border-t-4 border-t-indigo-600 shadow-2xs hover:shadow-xs transition-shadow sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#55565A] uppercase tracking-wider">Institutions & Orgs</span>
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                        {totalCount > 0 ? Math.round(((institutionCount + organisationCount) / totalCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-700 mt-2">{institutionCount + organisationCount}</div>
                    <p className="text-xs text-[#55565A] mt-1 font-medium">{institutionCount} Inst., {organisationCount} Orgs</p>
                  </div>
                </div>

                {/* Multi-Segmented Ratio Progress Bar */}
                <div className="bg-white p-5 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-2">
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
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs pt-1">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#72BEE7]"></span> Individuals ({individualCount})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#2E6DA4]"></span> Companies ({companyCount})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-600"></span> Institutions ({institutionCount})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-600"></span> Organisations ({organisationCount})</span>
                  </div>
                </div>

                {/* Responsive Sector Horizontal Bars */}
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[#1F2328]">Sector Distribution</h3>
                      <p className="text-xs text-[#55565A]">Live breakdown across Companies, Institutions & Organisations</p>
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

                {/* Search & Collapsible Filters for Mobile */}
                <div className="bg-white p-4 rounded-2xl border border-[#C9CCD1] space-y-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 text-[#55565A] absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        placeholder="Search name, phone, email..."
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#C9CCD1] rounded-xl text-sm text-[#1F2328] focus:border-[#2E6DA4] focus:ring-2 focus:ring-[#72BEE7]/30 min-h-[44px]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowFiltersMobile(!showFiltersMobile)}
                      className="sm:hidden w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#EAF5FC] border border-[#C9CCD1] text-[#2E6DA4] font-bold text-xs rounded-xl min-h-[44px]"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-[#2E6DA4]" />
                      <span>{showFiltersMobile ? 'Hide Filter Controls' : 'Show Filter Controls'}</span>
                    </button>

                    <div className="hidden sm:flex flex-wrap gap-2">
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-2 bg-white border border-[#C9CCD1] rounded-xl text-xs font-semibold text-[#1F2328] focus:border-[#2E6DA4] min-h-[40px]"
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
                        className="px-3 py-2 bg-white border border-[#C9CCD1] rounded-xl text-xs font-semibold text-[#1F2328] focus:border-[#2E6DA4] min-h-[40px]"
                      >
                        <option value="all">All Wards</option>
                        {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>

                      <select
                        value={filterSector}
                        onChange={(e) => setFilterSector(e.target.value)}
                        className="px-3 py-2 bg-white border border-[#C9CCD1] rounded-xl text-xs font-semibold text-[#1F2328] focus:border-[#2E6DA4] min-h-[40px]"
                      >
                        <option value="all">All Sectors</option>
                        {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Collapsible Mobile Filters */}
                  {showFiltersMobile && (
                    <div className="sm:hidden pt-3 border-t border-[#C9CCD1] grid grid-cols-1 gap-2 animate-fade-in">
                      <div>
                        <label className="block text-[11px] font-bold text-[#55565A] mb-1">Category</label>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#C9CCD1] rounded-xl text-xs font-semibold text-[#1F2328] min-h-[44px]"
                        >
                          <option value="all">All Categories</option>
                          <option value="individual">Individuals Only</option>
                          <option value="company">Companies Only</option>
                          <option value="institution">Institutions Only</option>
                          <option value="organisation">Organisations Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#55565A] mb-1">Ward</label>
                        <select
                          value={filterWard}
                          onChange={(e) => setFilterWard(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#C9CCD1] rounded-xl text-xs font-semibold text-[#1F2328] min-h-[44px]"
                        >
                          <option value="all">All Wards</option>
                          {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#55565A] mb-1">Sector</label>
                        <select
                          value={filterSector}
                          onChange={(e) => setFilterSector(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#C9CCD1] rounded-xl text-xs font-semibold text-[#1F2328] min-h-[44px]"
                        >
                          <option value="all">All Sectors</option>
                          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile View: Stacked Cards View (block md:hidden) */}
                <div className="block md:hidden space-y-4">
                  {filteredRegistrations.length === 0 ? (
                    <div className="bg-white p-6 rounded-2xl border border-[#C9CCD1] text-center text-[#55565A] text-sm">
                      No registrations match the selected filters.
                    </div>
                  ) : (
                    filteredRegistrations.map((r, idx) => (
                      <div key={r.id || idx} className="bg-white p-5 rounded-2xl border border-[#C9CCD1] shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-[#C9CCD1]/60 pb-2 gap-2 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            r.type === 'individual' ? 'bg-[#EAF5FC] text-[#2E6DA4] border border-[#72BEE7]/40' :
                            r.type === 'company' ? 'bg-[#2E6DA4]/10 text-[#2E6DA4] border border-[#2E6DA4]/30' :
                            r.type === 'institution' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {r.type}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-[#2E6DA4] bg-[#EAF5FC] px-2 py-0.5 rounded border border-[#72BEE7]/50">
                            {r.id}
                          </span>
                          <span className="text-xs text-[#55565A] font-medium ml-auto">{r.ward}</span>
                        </div>

                        <div>
                          <h4 className="font-bold text-[#1F2328] text-base">
                            {r.type === 'individual' ? r.name : r.companyName}
                          </h4>
                          {r.contactPerson && (
                            <p className="text-xs text-[#55565A] mt-0.5">Contact: {r.contactPerson}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-[#EAF5FC]/60 p-3 rounded-xl border border-[#C9CCD1]/40">
                          <div>
                            <span className="text-[#55565A] block text-[10px] font-semibold uppercase">Phone</span>
                            <span className="font-medium text-[#1F2328]">{r.phone}</span>
                          </div>
                          <div>
                            <span className="text-[#55565A] block text-[10px] font-semibold uppercase">
                              {r.type === 'individual' ? 'ID Number' : 'Plot Number'}
                            </span>
                            <span className="font-medium text-[#1F2328]">
                              {r.type === 'individual' ? (r.idNumber || 'N/A') : (r.plotNumber || 'N/A')}
                            </span>
                          </div>
                          <div className="col-span-2 pt-1">
                            <span className="text-[#55565A] block text-[10px] font-semibold uppercase">Email</span>
                            <span className="font-medium text-[#1F2328] break-all">{r.email}</span>
                          </div>
                        </div>

                        <div className="text-xs space-y-1">
                          <div>
                            <span className="font-semibold text-[#1F2328]">
                              {r.type === 'individual' ? 'Profession: ' : 'Sector: '}
                            </span>
                            <span className="text-[#55565A]">{r.type === 'individual' ? r.profession : r.sector}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-[#1F2328]">
                              {r.type === 'individual' ? 'Skills: ' : 'Services: '}
                            </span>
                            <span className="text-[#55565A]">{r.type === 'individual' ? r.skills : r.goodsAndServices}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Tablet / Desktop View: Registrations Table (hidden md:block) */}
                <div className="hidden md:block bg-white rounded-2xl border border-[#C9CCD1] shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#EAF5FC] text-[#1F2328] border-b border-[#C9CCD1] uppercase font-bold">
                        <tr>
                          <th className="p-4">Reference / Doc ID</th>
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
                            <td colSpan={7} className="p-8 text-center text-[#55565A]">
                              No registrations match the selected filters.
                            </td>
                          </tr>
                        ) : (
                          filteredRegistrations.map((r, idx) => (
                            <tr key={r.id || idx} className="hover:bg-[#EAF5FC]/50 transition-colors">
                              <td className="p-4 font-mono font-bold text-xs text-[#2E6DA4] whitespace-nowrap">
                                <span className="bg-[#EAF5FC] px-2.5 py-1 rounded-lg border border-[#72BEE7]/50 inline-block shadow-2xs">
                                  {r.id}
                                </span>
                              </td>
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
      <footer className="bg-white text-[#1F2328] mt-12 sm:mt-16 border-t border-[#C9CCD1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <img 
                src="/assets/aistudio/gaborone-south-logo-transparent_07b83a00.png" 
                alt="Gaborone South Constituency Office"
                className="h-10 sm:h-12 w-auto object-contain"
              />
              <p className="text-xs text-[#55565A] leading-relaxed">
                Gaborone South Constituency Economic Initiatives — Empowering the next generation of township entrepreneurs, innovators, institutions, and civic organisations under the theme: <span className="font-semibold text-[#1F2328]">“Youth at the Centre of a Thriving Economy, Reduced Import Bill and Healthy Minds”</span>.
              </p>
            </div>

            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#2E6DA4] uppercase tracking-wider mb-3">Quick Navigation</h4>
              <ul className="space-y-2 text-xs text-[#55565A]">
                <li><button onClick={() => setActiveTab('overview')} className="hover:text-[#2E6DA4] cursor-pointer transition-colors min-h-[32px] flex items-center">Overview & Stats</button></li>
                <li><button onClick={() => { setActiveTab('overview'); setTimeout(() => document.getElementById('programme-section')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-[#2E6DA4] cursor-pointer transition-colors min-h-[32px] flex items-center">Event Programme</button></li>
                <li><button onClick={() => setActiveTab('register')} className="hover:text-[#2E6DA4] cursor-pointer transition-colors min-h-[32px] flex items-center">Registration Form</button></li>
                <li><button onClick={() => setActiveTab('resources')} className="hover:text-[#2E6DA4] cursor-pointer transition-colors min-h-[32px] flex items-center">Resource Library</button></li>
                <li><button onClick={() => setActiveTab('admin')} className="hover:text-[#2E6DA4] cursor-pointer transition-colors min-h-[32px] flex items-center">Admin Dashboard</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#2E6DA4] uppercase tracking-wider mb-3">Venues & Precincts</h4>
              <ul className="space-y-2 text-xs text-[#55565A]">
                <li>Babusi Community Hall (Main Arena)</li>
                <li>Tsholofelo Park Hall</li>
                <li>Broadhurst Innovation Center</li>
                <li>Block 3 Constituency Office</li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#2E6DA4] uppercase tracking-wider mb-3">Secretariat Support</h4>
              <p className="text-xs text-[#55565A] mb-2">Need assistance with your registration?</p>
              <p className="text-xs font-semibold text-[#1F2328]">+267 391 2026</p>
              <p className="text-xs text-[#55565A] mt-1">initiatives@gaboronesouth.gov.bw</p>
            </div>
          </div>

          <div className="border-t border-[#C9CCD1] pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#55565A] gap-2">
            <p>© 2026 Gaborone South Constituency Office. All rights reserved.</p>
            <p className="text-center sm:text-right font-medium text-[#2E6DA4]">Developed by Quinton @ IfThenElse (+267 72488754)</p>
          </div>
        </div>
      </footer>

    </div>
  );
}

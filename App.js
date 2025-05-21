import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { auth, db, storage } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  orderBy,
  limit,
  startAfter,
  deleteDoc,
  batch,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { format, isToday, isBefore, isAfter, addDays, subDays, differenceInHours } from 'date-fns';
import debounce from 'lodash/debounce';
import './App.css';

// Component imports
import NotificationSystem from './components/NotificationSystem';
import HomePage from './components/HomePage';
import CheckInForm from './components/CheckInForm';
import DailyDebrief from './components/DailyDebrief';
import TeamStrategy from './components/TeamStrategy';
import ManagerDashboard from './components/ManagerDashboard';
import ClearCareExport from './components/ClearCareExport';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import Modal from './components/Modal';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import UserProfile from './components/UserProfile';
import Settings from './components/Settings';
import Analytics from './components/Analytics';
import Calendar from './components/Calendar';
import Reports from './components/Reports';

// Type definitions for TypeScript support
interface User {
  uid: string;
  email: string;
  role: 'manager' | 'staff' | 'admin';
  name: string;
  department: string;
  lastLogin: Date;
  preferences: UserPreferences;
  pushToken?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'suspended';
  permissions: string[];
  metadata: {
    lastCheckIn?: Date;
    totalCheckIns: number;
    lastDebrief?: Date;
    totalDebriefs: number;
    strategiesSubmitted: number;
    strategiesApproved: number;
  };
}

[Continuing in next part... Let me know when you want me to proceed with the next section]
interface UserPreferences {
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
    frequency: 'immediate' | 'daily' | 'weekly' | 'never';
    types: {
      support: boolean;
      strategy: boolean;
      debrief: boolean;
      system: boolean;
    };
  };
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  accessibility: {
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large';
    reduceMotion: boolean;
    screenReader: boolean;
  };
  dashboard: {
    defaultView: string;
    widgets: string[];
    layout: any;
  };
  exports: {
    format: 'pdf' | 'excel' | 'csv';
    autoExport: boolean;
    recipients: string[];
  };
}

interface CheckIn {
  id?: string;
  userId: string;
  userEmail: string;
  timestamp: Date;
  mood: string;
  moodIntensity: string;
  energy: string;
  physical: string[];
  copingToday: string[];
  supportNeeded: string;
  notes: string;
  anonymous: boolean;
  handled: boolean;
  handledBy?: string;
  handledAt?: Date;
  followUp?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'resolved' | 'escalated';
  escalationReason?: string;
  escalatedTo?: string;
  resolution?: string;
  tags: string[];
  attachments: Attachment[];
  location?: string;
  shiftType?: 'day' | 'night' | 'other';
  metadata: {
    browser: string;
    platform: string;
    ipAddress: string;
    userAgent: string;
    deviceId: string;
    appVersion: string;
  };
  history: {
    action: string;
    timestamp: Date;
    userId: string;
    notes?: string;
  }[];
}

interface Attachment {
  id: string;
  type: 'image' | 'document' | 'audio' | 'video';
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
  };
  status: 'uploading' | 'complete' | 'error';
  progress: number;
  error?: string;
}

interface Debrief {
  id?: string;
  userId: string;
  userEmail: string;
  timestamp: Date;
  shiftSummary: string;
  incidents: Incident[];
  medications: MedicationRecord[];
  appointments: Appointment[];
  activities: Activity[];
  mood: MoodRecord[];
  sleep: SleepRecord;
  nutrition: NutritionRecord;
  behaviors: BehaviorRecord[];
  achievements: Achievement[];
  concerns: Concern[];
  followUp: FollowUpAction[];
  shareWithTeam: boolean;
  successStrategy?: SuccessStrategy;
  exported: boolean;
  exportedTo: string[];
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  status: 'draft' | 'submitted' | 'reviewed' | 'exported';
  version: number;
  lastModified: Date;
  attachments: Attachment[];
  tags: string[];
  location: string;
  shift: {
    type: 'day' | 'night' | 'other';
    start: Date;
    end: Date;
    handover: string;
  };
}

[Continuing in next part... Let me know when you want me to proceed]
interface Incident {
  id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  time: Date;
  location: string;
  involvedParties: string[];
  witnesses: string[];
  actionTaken: string[];
  reportedTo: string[];
  followUpRequired: boolean;
  followUpActions: {
    action: string;
    assignedTo: string;
    dueDate: Date;
    status: 'pending' | 'completed';
  }[];
  attachments: Attachment[];
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  reportNumber?: string;
}

interface MedicationRecord {
  id: string;
  name: string;
  dosage: string;
  route: string;
  time: Date;
  scheduled: boolean;
  administered: boolean;
  administeredBy: string;
  witness?: string;
  notes: string;
  reason?: string;
  effectiveness?: string;
  sideEffects?: string[];
  missed: boolean;
  missedReason?: string;
  followUp: boolean;
  stockLevel?: number;
  reorderRequired?: boolean;
}

interface Activity {
  id: string;
  name: string;
  type: string;
  category: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  location: string;
  participants: {
    userId: string;
    name: string;
    role: string;
    attendance: 'present' | 'absent' | 'late';
    engagement: number;
    notes: string;
  }[];
  objectives: string[];
  outcomes: string[];
  resources: string[];
  notes: string;
  attachments: Attachment[];
  feedback: {
    rating: number;
    comments: string;
    submittedBy: string;
    timestamp: Date;
  }[];
}

interface MoodRecord {
  timestamp: Date;
  primary: string;
  secondary?: string[];
  intensity: number;
  triggers?: string[];
  context: string;
  duration: string;
  impact: {
    sleep: number;
    appetite: number;
    energy: number;
    social: number;
  };
  copingStrategies: {
    strategy: string;
    effectiveness: number;
  }[];
  notes: string;
  trends?: {
    pattern: string;
    frequency: string;
    timeOfDay: string[];
  };
}

interface SleepRecord {
  date: Date;
  bedTime: Date;
  wakeTime: Date;
  duration: number;
  quality: number;
  disturbances: {
    type: string;
    time: Date;
    duration: number;
    notes: string;
  }[];
  medication?: {
    name: string;
    dosage: string;
    time: Date;
  };
  environment: {
    noise: number;
    light: number;
    temperature: number;
  };
  notes: string;
  patterns: {
    consistency: number;
    averageDuration: number;
    qualityTrend: 'improving' | 'declining' | 'stable';
  };
}

[Continuing in next part... Let me know when you want me to proceed]
interface NutritionRecord {
  date: Date;
  meals: {
    id: string;
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    time: Date;
    foods: {
      name: string;
      portion: string;
      category: string;
      allergies?: string[];
      preferences?: string[];
    }[];
    location: string;
    assistance: boolean;
    assistanceNotes?: string;
    completion: number;
    notes: string;
  }[];
  hydration: {
    intake: number;
    unit: 'ml' | 'oz';
    schedule: {
      time: Date;
      amount: number;
      completed: boolean;
    }[];
    notes: string;
  };
  concerns: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    action: string;
    followUp: boolean;
  }[];
  preferences: {
    likes: string[];
    dislikes: string[];
    restrictions: string[];
    allergies: string[];
  };
  goals: {
    description: string;
    progress: number;
    notes: string;
  }[];
}

interface BehaviorRecord {
  id: string;
  timestamp: Date;
  type: string;
  description: string;
  frequency: number;
  duration: number;
  intensity: number;
  location: string;
  triggers: {
    identified: string[];
    potential: string[];
    notes: string;
  };
  antecedent: {
    environmental: string[];
    social: string[];
    physiological: string[];
    other: string[];
  };
  intervention: {
    type: string;
    description: string;
    staff: string[];
    effectiveness: number;
    notes: string;
  }[];
  outcome: {
    immediate: string;
    longTerm: string;
    effectiveness: number;
    followUp: boolean;
  };
  patterns: {
    timeOfDay: string[];
    frequency: string;
    triggers: string[];
    effectiveness: {
      intervention: string;
      rating: number;
    }[];
  };
  riskLevel: 'low' | 'medium' | 'high';
  preventionStrategies: string[];
  supportPlan: {
    strategies: string[];
    updates: {
      date: Date;
      changes: string;
      reason: string;
      by: string;
    }[];
  };
}

interface Achievement {
  id: string;
  timestamp: Date;
  area: string;
  description: string;
  impact: string;
  contributors: string[];
  evidence: string[];
  attachments: Attachment[];
  goals: {
    related: string[];
    progress: number;
  };
  celebration: {
    type: string;
    planned: boolean;
    date?: Date;
    participants: string[];
    notes: string;
  };
  followUp: {
    required: boolean;
    actions: string[];
    timeline: Date;
    responsibility: string;
  };
}

[Continuing in next part... Let me know when you want me to proceed]
interface Concern {
  id: string;
  area: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'health' | 'safety' | 'wellbeing' | 'behavioral' | 'environmental';
  identified: {
    date: Date;
    by: string;
    role: string;
  };
  status: 'new' | 'investigating' | 'addressing' | 'monitoring' | 'resolved';
  risk: {
    level: 'low' | 'medium' | 'high';
    impact: string[];
    likelihood: string;
    mitigation: string[];
  };
  actions: {
    immediate: string[];
    planned: {
      action: string;
      assignedTo: string;
      dueDate: Date;
      status: 'pending' | 'in_progress' | 'completed';
      notes: string;
    }[];
  };
  notifications: {
    internal: string[];
    external: string[];
    date: Date;
    method: string;
    response?: string;
  }[];
  documentation: {
    type: string;
    location: string;
    date: Date;
    attachments: Attachment[];
  }[];
  resolution?: {
    date: Date;
    outcome: string;
    effectiveness: number;
    followUp: boolean;
    notes: string;
  };
}

interface FollowUpAction {
  id: string;
  task: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  assignedTo: string;
  assignedBy: string;
  dateAssigned: Date;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  progress: number;
  updates: {
    date: Date;
    by: string;
    note: string;
    status: string;
  }[];
  dependencies: string[];
  resources: {
    type: string;
    description: string;
    location: string;
  }[];
  notifications: {
    type: string;
    recipient: string;
    scheduled: Date;
    sent: boolean;
  }[];
  completion?: {
    date: Date;
    by: string;
    notes: string;
    effectiveness: number;
  };
}

interface SuccessStrategy {
  id: string;
  title: string;
  description: string;
  context: string;
  category: string[];
  implementation: {
    steps: string[];
    resources: string[];
    timeframe: string;
    considerations: string[];
  };
  outcomes: {
    expected: string[];
    actual: string[];
    metrics: {
      name: string;
      value: number;
      target: number;
    }[];
  };
  applicability: {
    situations: string[];
    limitations: string[];
    adaptations: string[];
  };
  evidence: {
    type: string;
    description: string;
    source: string;
    date: Date;
  }[];
  feedback: {
    user: string;
    rating: number;
    comments: string;
    date: Date;
  }[];
  status: 'draft' | 'submitted' | 'approved' | 'archived';
  version: number;
  history: {
    date: Date;
    user: string;
    changes: string[];
  }[];
}

[Continuing in next part... Let me know when you want me to proceed]
function App() {
  // Core State Management
  const [currentUser, setCurrentUser] = useState(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Application State
  const [currentPage, setCurrentPage] = useState('home');
  const [notifications, setNotifications] = useState([]);
  const [pendingSupport, setPendingSupport] = useState([]);
  const [handledTickets, setHandledTickets] = useState([]);
  const [currentOnCall, setCurrentOnCall] = useState({});
  const [monthlyFocus, setMonthlyFocus] = useState({});
  const [teamStrategies, setTeamStrategies] = useState([]);
  const [debriefs, setDebriefs] = useState([]);
  const [exportQueue, setExportQueue] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  // UI State
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Form States
  const [checkInData, setCheckInData] = useState({
    mood: '',
    moodIntensity: '3',
    energy: '',
    physical: [],
    copingToday: [],
    supportNeeded: '',
    notes: '',
    anonymous: false,
    timestamp: null,
    handled: false,
    attachments: [],
    tags: [],
    metadata: {
      browser: navigator.userAgent,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      deviceId: generateDeviceId(),
      appVersion: process.env.REACT_APP_VERSION
    }
  });

  // Refs for Event Handlers and Intervals
  const notificationSound = useRef(new Audio('/notification.mp3'));
  const syncInterval = useRef(null);
  const wsConnection = useRef(null);
  const fileUploadRefs = useRef({});
  const debounceTimeouts = useRef({});

  // Performance Monitoring
  const performanceMetrics = useRef({
    pageLoads: {},
    apiCalls: {},
    renderTimes: {},
    errors: []
  });

  // Cache Management
  const cache = useRef({
    users: new Map(),
    strategies: new Map(),
    debriefs: new Map(),
    lastUpdated: null
  });

  // Background Tasks Queue
  const taskQueue = useRef([]);
  const isProcessingTasks = useRef(false);

  // Offline Storage
  const offlineActions = useRef([]);
  const pendingUploads = useRef([]);

  // Analytics Tracking
  const analyticsEvents = useRef([]);
  const sessionStartTime = useRef(Date.now());

[Continuing in next part... Let me know when you want me to proceed]
  // Authentication and User Management
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        setLoading(true);
        if (user) {
          const userDoc = await getDocs(query(
            collection(db, 'users'),
            where('email', '==', user.email)
          ));

          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            setCurrentUser({
              ...user,
              ...userData,
              lastLogin: new Date()
            });
            setIsManager(userData.role === 'manager');

            // Initialize user session
            await initializeUserSession(user.uid);
            
            // Set up real-time listeners
            setupDataListeners(user.uid);
            
            // Initialize WebSocket connection
            setupWebSocket(user.uid);
            
            // Start background sync
            startBackgroundSync();
            
            // Track user activity
            trackUserActivity('login');
            
            // Update last login
            await updateDoc(doc(db, 'users', user.uid), {
              lastLogin: serverTimestamp(),
              lastLoginDevice: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                timestamp: new Date()
              }
            });
          }
        } else {
          await handleLogout(true);
        }
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    });

    // Set up online/offline detection
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    // Set up visibility change detection
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up before unload handler
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Initialize performance monitoring
    initializePerformanceMonitoring();

    return () => {
      unsubscribe();
      cleanup();
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const initializeUserSession = async (userId) => {
    try {
      // Load user preferences
      await loadUserPreferences(userId);
      
      // Restore cached data
      await restoreCachedData(userId);
      
      // Process offline actions
      await processOfflineActions();
      
      // Resume interrupted uploads
      await resumeInterruptedUploads();
      
      // Initialize push notifications
      await initializePushNotifications();
      
      // Set up activity tracking
      setupActivityTracking();
      
    } catch (error) {
      handleError(error);
    }
  };

  const setupWebSocket = (userId) => {
    try {
      const ws = new WebSocket(process.env.REACT_APP_WS_URL);
      
      ws.onopen = () => {
        console.log('WebSocket Connected');
        ws.send(JSON.stringify({
          type: 'auth',
          payload: {
            userId,
            token: auth.currentUser?.accessToken
          }
        }));
      };

[Continuing in next part... Let me know when you want me to proceed]
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onclose = () => {
        console.log('WebSocket Disconnected');
        // Attempt to reconnect after delay
        setTimeout(() => {
          if (currentUser) setupWebSocket(currentUser.uid);
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        handleError({
          type: 'websocket_error',
          message: 'Connection error occurred',
          error
        });
      };

      wsConnection.current = ws;
    } catch (error) {
      handleError(error);
    }
  };

  const handleWebSocketMessage = async (data) => {
    try {
      switch (data.type) {
        case 'support_request':
          await handleSupportRequestUpdate(data.payload);
          break;
        case 'strategy_update':
          await handleStrategyUpdate(data.payload);
          break;
        case 'debrief_export':
          await handleDebriefExportUpdate(data.payload);
          break;
        case 'user_status':
          await handleUserStatusUpdate(data.payload);
          break;
        case 'notification':
          await handleNotification(data.payload);
          break;
        case 'sync_required':
          await triggerSync();
          break;
        case 'error':
          handleError(data.payload);
          break;
        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      handleError(error);
    }
  };

  const startBackgroundSync = () => {
    // Clear any existing sync interval
    if (syncInterval.current) {
      clearInterval(syncInterval.current);
    }

    // Set up new sync interval
    syncInterval.current = setInterval(async () => {
      if (navigator.onLine && !isSyncing) {
        await triggerSync();
      }
    }, 300000); // Sync every 5 minutes

    // Initial sync
    if (navigator.onLine) {
      triggerSync();
    }
  };

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      const lastSyncTime = lastSync?.getTime() || 0;

      // Fetch updated data
      const [
        checkInsSnapshot,
        debriefsSnapshot,
        strategiesSnapshot,
        supportSnapshot
      ] = await Promise.all([
        getDocs(query(
          collection(db, 'checkIns'),
          where('timestamp', '>', lastSyncTime)
        )),
        getDocs(query(
          collection(db, 'debriefs'),
          where('timestamp', '>', lastSyncTime)
        )),
        getDocs(query(
          collection(db, 'teamStrategies'),
          where('timestamp', '>', lastSyncTime)
        )),
        getDocs(query(
          collection(db, 'supportRequests'),
          where('timestamp', '>', lastSyncTime)
        ))
      ]);

      // Process updates
      await processUpdates('checkIns', checkInsSnapshot);
      await processUpdates('debriefs', debriefsSnapshot);
      await processUpdates('strategies', strategiesSnapshot);
      await processUpdates('support', supportSnapshot);

      // Update cache
      updateCache();

      setLastSync(new Date());
      trackAnalyticsEvent('sync_completed', {
        duration: Date.now() - lastSyncTime,
        updatedRecords: {
          checkIns: checkInsSnapshot.size,
          debriefs: debriefsSnapshot.size,
          strategies: strategiesSnapshot.size,
          support: supportSnapshot.size
        }
      });

    } catch (error) {
      handleError({
        type: 'sync_error',
        message: 'Failed to sync data',
        error
      });
    } finally {
      setIsSyncing(false);
    }
  };

[Continuing in next part... Let me know when you want me to proceed]
  // Data Processing and Management
  const processUpdates = async (type, snapshot) => {
    const batch = db.batch();
    const updates = new Map();

    snapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      updates.set(doc.id, data);

      switch (type) {
        case 'checkIns':
          if (!data.handled) {
            setPendingSupport(prev => 
              updateArrayWithNewData(prev, data)
            );
          }
          break;

        case 'debriefs':
          setDebriefs(prev => 
            updateArrayWithNewData(prev, data)
          );
          if (data.exportToClearCare && !data.exported) {
            queueForExport(data);
          }
          break;

        case 'strategies':
          setTeamStrategies(prev => 
            updateArrayWithNewData(prev, data)
          );
          if (!data.approved && isManager) {
            setPendingApprovals(prev => 
              updateArrayWithNewData(prev, data)
            );
          }
          break;

        case 'support':
          if (data.handled) {
            setHandledTickets(prev => 
              updateArrayWithNewData(prev, data)
            );
          }
          break;
      }

      // Update cache
      cache.current[type].set(doc.id, {
        data,
        timestamp: Date.now()
      });
    });

    // Process any necessary background tasks
    await processBackgroundTasks(updates);

    try {
      await batch.commit();
    } catch (error) {
      handleError({
        type: 'batch_update_error',
        message: `Failed to process ${type} updates`,
        error
      });
    }
  };

  const updateArrayWithNewData = (prevArray, newData) => {
    const index = prevArray.findIndex(item => item.id === newData.id);
    if (index === -1) {
      return [...prevArray, newData];
    }
    const updatedArray = [...prevArray];
    updatedArray[index] = {
      ...updatedArray[index],
      ...newData
    };
    return updatedArray;
  };

  const processBackgroundTasks = async (updates) => {
    if (isProcessingTasks.current) return;
    
    try {
      isProcessingTasks.current = true;
      
      for (const task of taskQueue.current) {
        switch (task.type) {
          case 'export':
            await processExportTask(task);
            break;
          case 'notification':
            await processNotificationTask(task);
            break;
          case 'cleanup':
            await processCleanupTask(task);
            break;
          case 'analytics':
            await processAnalyticsTask(task);
            break;
        }
      }

      // Clear processed tasks
      taskQueue.current = taskQueue.current.filter(task => 
        task.status !== 'completed'
      );

    } catch (error) {
      handleError({
        type: 'background_task_error',
        message: 'Failed to process background tasks',
        error
      });
    } finally {
      isProcessingTasks.current = false;
    }
  };

  const queueForExport = async (debrief) => {
    try {
      const exportTask = {
        id: generateUniqueId(),
        type: 'export',
        data: debrief,
        status: 'pending',
        attempts: 0,
        created: Date.now()
      };

      await addDoc(collection(db, 'exportQueue'), exportTask);
      taskQueue.current.push(exportTask);

      // Trigger immediate processing if no active tasks
      if (!isProcessingTasks.current) {
        processBackgroundTasks(new Map());
      }
    } catch (error) {
      handleError({
        type: 'export_queue_error',
        message: 'Failed to queue export',
        error
      });
    }
  };

[Continuing in next part... Let me know when you want me to proceed]
  // Error Handling and Monitoring
  const handleError = (error) => {
    console.error('Error:', error);
    
    // Format error message
    const errorMessage = formatErrorMessage(error);
    setError(errorMessage);

    // Log error to monitoring service
    logErrorToMonitoring({
      type: error.type || 'unknown',
      message: errorMessage,
      stack: error.stack,
      timestamp: new Date(),
      user: currentUser?.email,
      context: {
        page: currentPage,
        action: error.action,
        component: error.component,
        browser: navigator.userAgent,
        platform: navigator.platform,
        lastSync: lastSync?.toISOString(),
        isOnline: navigator.onLine
      }
    });

    // Show error toast
    showToast('error', errorMessage);

    // Track error for analytics
    trackAnalyticsEvent('error_occurred', {
      type: error.type,
      message: errorMessage,
      timestamp: new Date()
    });

    // Clear error after timeout
    setTimeout(() => setError(null), 5000);

    // Handle specific error types
    switch (error.type) {
      case 'auth_error':
        handleAuthError(error);
        break;
      case 'network_error':
        handleNetworkError(error);
        break;
      case 'data_error':
        handleDataError(error);
        break;
      case 'export_error':
        handleExportError(error);
        break;
      default:
        // For unknown errors, attempt recovery
        attemptErrorRecovery(error);
    }
  };

  const formatErrorMessage = (error) => {
    if (typeof error === 'string') return error;
    
    if (error.code) {
      switch (error.code) {
        case 'auth/user-disabled':
          return 'Your account has been disabled. Please contact support.';
        case 'auth/invalid-email':
          return 'Invalid email address.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          return 'Invalid login credentials.';
        case 'auth/requires-recent-login':
          return 'Please log in again to continue.';
        default:
          return error.message || 'An unexpected error occurred.';
      }
    }

    return error.message || 'An unexpected error occurred.';
  };

  const logErrorToMonitoring = async (errorData) => {
    try {
      // Add to local error log
      performanceMetrics.current.errors.push({
        ...errorData,
        localTimestamp: Date.now()
      });

      // Send to monitoring service
      await addDoc(collection(db, 'errorLogs'), {
        ...errorData,
        timestamp: serverTimestamp()
      });

      // If critical error, notify admins
      if (isCriticalError(errorData)) {
        await notifyAdmins(errorData);
      }

    } catch (error) {
      console.error('Failed to log error:', error);
    }
  };

  const isCriticalError = (error) => {
    const criticalPatterns = [
      'authentication',
      'database',
      'connection',
      'permission',
      'security',
      'data_corruption',
      'sync_failure'
    ];

    return criticalPatterns.some(pattern => 
      error.type?.includes(pattern) || 
      error.message?.toLowerCase().includes(pattern)
    );
  };

[Continuing in next part... Let me know when you want me to proceed]
  // Notification Management
  const handleNotification = async (notification) => {
    try {
      // Add to notifications state
      setNotifications(prev => [notification, ...prev]);

      // Play sound if enabled
      if (shouldPlaySound(notification)) {
        await playNotificationSound();
      }

      // Show desktop notification if enabled
      if (shouldShowDesktopNotification(notification)) {
        await showDesktopNotification(notification);
      }

      // Update badge count
      updateBadgeCount();

      // Track notification
      trackAnalyticsEvent('notification_received', {
        type: notification.type,
        urgent: notification.urgent,
        timestamp: new Date()
      });

    } catch (error) {
      handleError({
        type: 'notification_error',
        message: 'Failed to process notification',
        error
      });
    }
  };

  const shouldPlaySound = (notification) => {
    return (
      notification.urgent ||
      currentUser?.preferences?.notifications?.sound &&
      document.hidden &&
      notification.type !== 'system'
    );
  };

  const playNotificationSound = async () => {
    try {
      if (!notificationSound.current) {
        notificationSound.current = new Audio('/notification.mp3');
      }
      await notificationSound.current.play();
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  };

  const shouldShowDesktopNotification = (notification) => {
    return (
      Notification.permission === 'granted' &&
      currentUser?.preferences?.notifications?.desktop &&
      document.hidden
    );
  };

  const showDesktopNotification = async (notification) => {
    try {
      const notif = new Notification('My Tribe Wellbeing Hub', {
        body: notification.message,
        icon: '/logo192.png',
        tag: notification.id,
        data: {
          url: window.location.origin,
          notificationId: notification.id
        }
      });

      notif.onclick = () => {
        window.focus();
        handleNotificationClick(notification);
      };
    } catch (error) {
      console.error('Failed to show desktop notification:', error);
    }
  };

  const updateBadgeCount = () => {
    const unreadCount = notifications.filter(n => !n.read).length;
    
    // Update document title
    document.title = unreadCount 
      ? `(${unreadCount}) My Tribe Wellbeing Hub` 
      : 'My Tribe Wellbeing Hub';

    // Update favicon badge if supported
    if (navigator.setAppBadge) {
      navigator.setAppBadge(unreadCount);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      await markNotificationAsRead(notification.id);

      // Navigate based on type
      switch (notification.type) {
        case 'support_request':
          handleSupportRequestNavigation(notification.data);
          break;
        case 'strategy_review':
          handleStrategyReviewNavigation(notification.data);
          break;
        case 'debrief_export':
          handleDebriefExportNavigation(notification.data);
          break;
        case 'monthly_focus':
          handleMonthlyFocusNavigation(notification.data);
          break;
        default:
          console.warn('Unknown notification type:', notification.type);
      }

      // Track interaction
      trackAnalyticsEvent('notification_clicked', {
        type: notification.type,
        notificationId: notification.id,
        timestamp: new Date()
      });

    } catch (error) {
      handleError({
        type: 'notification_interaction_error',
        message: 'Failed to process notification click',
        error
      });
    }
  };

[Continuing in next part... Let me know when you want me to proceed]
  // Support Request Management
  const handleSupportRequest = async (requestId, action) => {
    try {
      setLoading(true);
      const requestRef = doc(db, 'supportRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error('Support request not found');
      }

      const requestData = requestDoc.data();
      const batch = db.batch();

      // Update support request
      batch.update(requestRef, {
        handled: true,
        handledBy: currentUser.uid,
        handledAt: serverTimestamp(),
        action: action,
        status: action === 'escalate' ? 'escalated' : 'resolved',
        resolution: action === 'escalate' ? 'Escalated to senior management' : 'Handled by manager',
        handlerNotes: action === 'escalate' ? 'Requires senior management attention' : 'Resolved by manager'
      });

      // Create notification for requestor
      const notificationRef = doc(collection(db, 'notifications'));
      batch.set(notificationRef, {
        userId: requestData.userId,
        type: 'support_response',
        message: `Your support request has been ${action}`,
        timestamp: serverTimestamp(),
        read: false,
        urgent: false,
        data: {
          requestId,
          action,
          originalRequest: requestData
        }
      });

      // If escalated, create high-priority task
      if (action === 'escalate') {
        const taskRef = doc(collection(db, 'tasks'));
        batch.set(taskRef, {
          type: 'escalated_support',
          priority: 'high',
          status: 'pending',
          assignedTo: 'senior_management',
          requestId: requestId,
          userId: requestData.userId,
          createdAt: serverTimestamp(),
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          details: {
            originalRequest: requestData,
            escalationReason: 'Requires senior management attention',
            escalatedBy: currentUser.uid
          }
        });

        // Notify senior management
        const seniorManagementRef = doc(collection(db, 'notifications'));
        batch.set(seniorManagementRef, {
          type: 'escalated_support',
          message: `Urgent: Support request escalated by ${currentUser.email}`,
          timestamp: serverTimestamp(),
          read: false,
          urgent: true,
          data: {
            requestId,
            originalRequest: requestData
          }
        });
      }

      // Update metrics
      const metricsRef = doc(collection(db, 'metrics'), 'support_requests');
      batch.update(metricsRef, {
        [`${action}_count`]: increment(1),
        total_handled: increment(1),
        average_response_time: calculateAverageResponseTime(requestData.timestamp)
      });

      // Commit all changes
      await batch.commit();

      // Update local state
      setPendingSupport(prev => prev.filter(req => req.id !== requestId));
      setHandledTickets(prev => [...prev, {
        ...requestData,
        id: requestId,
        handledAt: new Date(),
        handledBy: currentUser.uid,
        action
      }]);

      // Track analytics
      trackAnalyticsEvent('support_request_handled', {
        requestId,
        action,
        responseTime: Date.now() - new Date(requestData.timestamp).getTime(),
        wasUrgent: requestData.supportNeeded === 'urgent'
      });

      setSuccess(`Support request ${action} successfully`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (error) {
      handleError({
        type: 'support_request_error',
        message: `Failed to ${action} support request`,
        error
      });
    } finally {
      setLoading(false);
    }
  };

[Continuing in next part... Let me know when you want me to proceed]
  // ClearCare Export Management
  const exportToClearCare = async (debriefId) => {
    try {
      setLoading(true);
      const debriefRef = doc(db, 'debriefs', debriefId);
      const debriefDoc = await getDoc(debriefRef);

      if (!debriefDoc.exists()) {
        throw new Error('Debrief not found');
      }

      const debriefData = debriefDoc.data();

      // Format data for ClearCare
      const formattedData = {
        date: formatDate(debriefData.timestamp),
        shift: {
          type: debriefData.shift.type,
          start: formatTime(debriefData.shift.start),
          end: formatTime(debriefData.shift.end)
        },
        staff: {
          name: currentUser.name,
          role: currentUser.role,
          email: currentUser.email
        },
        summary: debriefData.shiftSummary,
        medications: formatMedicationsForExport(debriefData.medications),
        activities: formatActivitiesForExport(debriefData.activities),
        behaviors: formatBehaviorsForExport(debriefData.behaviors),
        mood: formatMoodForExport(debriefData.mood),
        sleep: formatSleepForExport(debriefData.sleep),
        nutrition: formatNutritionForExport(debriefData.nutrition),
        incidents: formatIncidentsForExport(debriefData.incidents),
        achievements: formatAchievementsForExport(debriefData.achievements),
        concerns: formatConcernsForExport(debriefData.concerns),
        followUp: formatFollowUpForExport(debriefData.followUp)
      };

      // Create export record
      const exportRef = await addDoc(collection(db, 'exports'), {
        type: 'clearcare',
        debriefId,
        data: formattedData,
        exportedBy: currentUser.uid,
        exportedAt: serverTimestamp(),
        status: 'pending',
        attempts: 0
      });

      // Queue for processing
      await addDoc(collection(db, 'exportQueue'), {
        exportId: exportRef.id,
        type: 'clearcare',
        priority: debriefData.urgent ? 'high' : 'normal',
        created: serverTimestamp()
      });

      // Update debrief document
      await updateDoc(debriefRef, {
        exported: true,
        exportedTo: arrayUnion('clearcare'),
        lastExportAt: serverTimestamp(),
        exportHistory: arrayUnion({
          type: 'clearcare',
          timestamp: new Date(),
          exportedBy: currentUser.uid,
          exportId: exportRef.id
        })
      });

      // Track export attempt
      trackAnalyticsEvent('debrief_export_initiated', {
        debriefId,
        exportId: exportRef.id,
        timestamp: new Date()
      });

      setSuccess('Debrief queued for export to ClearCare');
      setTimeout(() => setSuccess(null), 3000);

      return exportRef.id;

    } catch (error) {
      handleError({
        type: 'export_error',
        message: 'Failed to export to ClearCare',
        error
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Data Formatting Functions for Export
  const formatMedicationsForExport = (medications) => {
    return medications.map(med => ({
      name: med.name,
      dosage: med.dosage,
      route: med.route,
      time: formatTime(med.time),
      administered: med.administered ? 'Yes' : 'No',
      administeredBy: med.administeredBy,
      witness: med.witness || 'N/A',
      notes: med.notes,
      missed: med.missed ? 'Yes' : 'No',
      missedReason: med.missedReason || 'N/A'
    }));
  };

[Continuing in next part... Let me know when you want me to proceed]
  // Monthly Focus Management
  const updateMonthlyFocus = async (focusData) => {
    try {
      if (!isManager) throw new Error('Unauthorized action');
      setLoading(true);

      // Validate focus data
      if (!focusData.title || !focusData.description || !focusData.keyPoints) {
        throw new Error('Missing required monthly focus information');
      }

      const batch = db.batch();

      // Deactivate current focus
      const currentFocusQuery = query(
        collection(db, 'monthlyFocus'),
        where('active', '==', true)
      );
      
      const snapshot = await getDocs(currentFocusQuery);
      snapshot.forEach(doc => {
        batch.update(doc.ref, { 
          active: false,
          deactivatedAt: serverTimestamp(),
          deactivatedBy: currentUser.uid
        });
      });

      // Create new focus
      const newFocus = {
        ...focusData,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        active: true,
        version: 1,
        status: 'active',
        metrics: focusData.metrics || [],
        progress: 0,
        participants: [],
        feedback: [],
        history: [{
          action: 'created',
          timestamp: new Date(),
          user: currentUser.uid,
          details: 'Initial creation'
        }]
      };

      const focusRef = doc(collection(db, 'monthlyFocus'));
      batch.set(focusRef, newFocus);

      // Create notification for all users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      usersSnapshot.forEach(userDoc => {
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: userDoc.id,
          type: 'monthly_focus_update',
          message: `New monthly focus: ${newFocus.title}`,
          timestamp: serverTimestamp(),
          read: false,
          data: {
            focusId: focusRef.id,
            title: newFocus.title,
            description: newFocus.description
          }
        });
      });

      // Update metrics
      const metricsRef = doc(collection(db, 'metrics'), 'monthly_focus');
      batch.update(metricsRef, {
        total_focus_updates: increment(1),
        last_update: serverTimestamp(),
        focus_history: arrayUnion({
          id: focusRef.id,
          title: newFocus.title,
          startDate: new Date(),
          updatedBy: currentUser.uid
        })
      });

      // Commit all changes
      await batch.commit();

      // Update local state
      setMonthlyFocus({
        id: focusRef.id,
        ...newFocus
      });

      // Schedule reminders and check-ins
      await scheduleMonthlyFocusReminders(focusRef.id);

      // Track analytics
      trackAnalyticsEvent('monthly_focus_updated', {
        focusId: focusRef.id,
        title: newFocus.title,
        timestamp: new Date()
      });

      setSuccess('Monthly focus updated successfully');
      setTimeout(() => setSuccess(null), 3000);

      return focusRef.id;

    } catch (error) {
      handleError({
        type: 'monthly_focus_error',
        message: 'Failed to update monthly focus',
        error
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const scheduleMonthlyFocusReminders = async (focusId) => {
    try {
      const reminderTasks = [
        {
          type: 'reminder',
          schedule: 'weekly',
          message: 'Weekly focus check-in reminder',
          day: 'Monday',
          time: '09:00'
        },
        {
          type: 'progress_update',
          schedule: 'biweekly',
          message: 'Update monthly focus progress',
          days: ['Monday', 'Thursday'],
          time: '14:00'
        },
        {
          type: 'feedback_request',
          schedule: 'monthly',
          message: 'Monthly focus feedback request',
          day: 'last',
          time: '15:00'
        }
      ];

[Continuing in next part... Let me know when you want me to proceed]
      // Create scheduled tasks
      const batch = db.batch();
      
      reminderTasks.forEach(task => {
        const taskRef = doc(collection(db, 'scheduledTasks'));
        batch.set(taskRef, {
          ...task,
          focusId,
          status: 'scheduled',
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid,
          nextRun: calculateNextRunTime(task),
          recipients: 'all',
          active: true
        });
      });

      await batch.commit();

    } catch (error) {
      console.error('Failed to schedule reminders:', error);
      // Don't throw - non-critical failure
    }
  };

  // Team Strategy Management
  const handleStrategySubmit = async (strategyData) => {
    try {
      if (!currentUser) throw new Error('No user logged in');
      setLoading(true);

      // Validate strategy data
      if (!strategyData.title || !strategyData.description) {
        throw new Error('Missing required strategy information');
      }

      const strategy = {
        ...strategyData,
        author: currentUser.email,
        authorId: currentUser.uid,
        timestamp: serverTimestamp(),
        approved: isManager ? true : false,
        approvedBy: isManager ? currentUser.uid : null,
        approvedAt: isManager ? serverTimestamp() : null,
        status: isManager ? 'approved' : 'pending',
        likes: 0,
        likedBy: [],
        comments: [],
        implementations: 0,
        version: 1,
        history: [{
          action: 'created',
          timestamp: new Date(),
          user: currentUser.uid
        }],
        metadata: {
          browser: navigator.userAgent,
          platform: navigator.platform,
          createdAt: new Date()
        }
      };

      // Add to Firebase
      const docRef = await addDoc(collection(db, 'teamStrategies'), strategy);

      // If manager submitted, create notification for team
      if (isManager) {
        await notifyTeamMembers({
          type: 'new_strategy',
          message: `New team strategy added: ${strategy.title}`,
          data: {
            strategyId: docRef.id,
            title: strategy.title
          }
        });
      } else {
        // Notify managers for review
        await notifyManagers({
          type: 'strategy_review',
          message: `New strategy pending review from ${currentUser.email}`,
          data: {
            strategyId: docRef.id,
            title: strategy.title,
            author: currentUser.email
          }
        });
      }

      // Update user's strategy count
      await updateDoc(doc(db, 'users', currentUser.uid), {
        'metadata.strategiesSubmitted': increment(1),
        lastStrategySubmission: serverTimestamp()
      });

      // Track analytics
      trackAnalyticsEvent('strategy_submitted', {
        strategyId: docRef.id,
        title: strategy.title,
        isManagerSubmission: isManager,
        timestamp: new Date()
      });

      setSuccess('Strategy submitted successfully');
      setTimeout(() => setSuccess(null), 3000);

      return docRef.id;

    } catch (error) {
      handleError({
        type: 'strategy_submission_error',
        message: 'Failed to submit strategy',
        error
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

[Continuing in next part... Let me know when you want me to proceed]
  // Analytics and Performance Monitoring
  const trackAnalyticsEvent = async (eventName, eventData) => {
    try {
      const event = {
        eventName,
        eventData: {
          ...eventData,
          userId: currentUser?.uid,
          userRole: currentUser?.role,
          timestamp: new Date(),
          sessionId: getCurrentSessionId(),
          page: currentPage
        },
        metadata: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screenSize: `${window.innerWidth}x${window.innerHeight}`,
          connection: (navigator as any).connection?.effectiveType || 'unknown',
          memoryUsage: (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize
          } : null
        }
      };

      // Add to local queue
      analyticsEvents.current.push(event);

      // Batch send if queue is large enough or enough time has passed
      if (shouldSendAnalyticsBatch()) {
        await sendAnalyticsBatch();
      }

      // Update performance metrics
      updatePerformanceMetrics(eventName, event);

    } catch (error) {
      console.error('Failed to track analytics:', error);
    }
  };

  const shouldSendAnalyticsBatch = () => {
    const BATCH_SIZE = 10;
    const BATCH_INTERVAL = 30000; // 30 seconds
    
    return (
      analyticsEvents.current.length >= BATCH_SIZE ||
      (analyticsEvents.current.length > 0 && 
       Date.now() - analyticsEvents.current[0].eventData.timestamp > BATCH_INTERVAL)
    );
  };

  const sendAnalyticsBatch = async () => {
    if (analyticsEvents.current.length === 0) return;

    try {
      const batch = analyticsEvents.current;
      analyticsEvents.current = [];

      await addDoc(collection(db, 'analytics'), {
        events: batch,
        timestamp: serverTimestamp(),
        sessionId: getCurrentSessionId()
      });

      // If external analytics service is configured
      if (process.env.REACT_APP_ANALYTICS_ENDPOINT) {
        await fetch(process.env.REACT_APP_ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_ANALYTICS_KEY}`
          },
          body: JSON.stringify({ events: batch })
        });
      }

    } catch (error) {
      console.error('Failed to send analytics batch:', error);
      // Return events to queue
      analyticsEvents.current = [...analyticsEvents.current, ...batch];
    }
  };

  const updatePerformanceMetrics = (eventName, event) => {
    const metrics = performanceMetrics.current;

    // Update page load metrics
    if (eventName.startsWith('page_view')) {
      const page = event.eventData.page;
      if (!metrics.pageLoads[page]) {
        metrics.pageLoads[page] = {
          count: 0,
          totalTime: 0,
          average: 0
        };
      }
      
      metrics.pageLoads[page].count++;
      metrics.pageLoads[page].totalTime += event.eventData.loadTime || 0;
      metrics.pageLoads[page].average = 
        metrics.pageLoads[page].totalTime / metrics.pageLoads[page].count;
    }

    // Update API call metrics
    if (eventName.startsWith('api_')) {
      const endpoint = event.eventData.endpoint;
      if (!metrics.apiCalls[endpoint]) {
        metrics.apiCalls[endpoint] = {
          count: 0,
          totalTime: 0,
          errors: 0
        };
      }

      metrics.apiCalls[endpoint].count++;
      metrics.apiCalls[endpoint].totalTime += event.eventData.duration || 0;
      if (event.eventData.error) {
        metrics.apiCalls[endpoint].errors++;
      }
    }

    // Update render metrics
    if (eventName === 'component_render') {
      const component = event.eventData.component;
      if (!metrics.renderTimes[component]) {
        metrics.renderTimes[component] = [];
      }
      metrics.renderTimes[component].push(event.eventData.duration);
    }
  };

[Continuing in next part... Let me know when you want me to proceed]
  // Main Render Logic
  if (loading) {
    return (
      <div className="loading-container" role="alert" aria-busy="true">
        <LoadingSpinner size="large" />
        <p className="loading-text">Loading your wellbeing hub...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary 
      onError={handleError}
      fallback={<ErrorFallback error={error} resetError={() => setError(null)} />}
    >
      <div 
        className="App" 
        data-theme={userPreferences?.theme || 'light'}
        data-high-contrast={userPreferences?.accessibility?.highContrast}
        data-reduce-motion={userPreferences?.accessibility?.reduceMotion}
      >
        <header className="App-header">
          <div className="header-top">
            <h1>My Tribe Wellbeing Hub</h1>
            {currentUser && (
              <div className="user-controls">
                <div className="user-info">
                  <span className="user-name">{currentUser.name}</span>
                  <span className="user-email">{currentUser.email}</span>
                  {isManager && (
                    <span className="manager-badge" role="status">
                      Manager
                    </span>
                  )}
                </div>

                <NotificationSystem 
                  notifications={notifications}
                  onNotificationClick={handleNotificationClick}
                  onMarkAsRead={markNotificationAsRead}
                  onClearAll={clearAllNotifications}
                  isManager={isManager}
                  preferences={userPreferences?.notifications}
                />

                <div className="user-actions">
                  <button 
                    className="settings-button"
                    onClick={() => setCurrentPage('settings')}
                    title="Settings"
                    aria-label="Open settings"
                  >
                    <i className="fas fa-cog" aria-hidden="true"></i>
                  </button>
                  <button 
                    className="logout-button"
                    onClick={handleLogout}
                    title="Logout"
                    aria-label="Logout"
                  >
                    <i className="fas fa-sign-out-alt" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            )}
          </div>

          <nav className="main-navigation" role="navigation">
            <button 
              className={`nav-button ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => handlePageChange('home')}
              aria-current={currentPage === 'home' ? 'page' : undefined}
              title="Home (Ctrl/Cmd + H)"
            >
              <i className="fas fa-home" aria-hidden="true"></i>
              <span>Home</span>
            </button>

            <button 
              className={`nav-button ${currentPage === 'checkin' ? 'active' : ''}`}
              onClick={() => handlePageChange('checkin')}
              aria-current={currentPage === 'checkin' ? 'page' : undefined}
              title="Daily Check-In (Ctrl/Cmd + C)"
            >
              <i className="fas fa-clipboard-check" aria-hidden="true"></i>
              <span>Daily Check-In</span>
            </button>

            <button 
              className={`nav-button ${currentPage === 'debrief' ? 'active' : ''}`}
              onClick={() => handlePageChange('debrief')}
              aria-current={currentPage === 'debrief' ? 'page' : undefined}
              title="Daily Debrief (Ctrl/Cmd + D)"
            >
              <i className="fas fa-book-open" aria-hidden="true"></i>
              <span>Daily Debrief</span>
            </button>

            <button 
              className={`nav-button ${currentPage === 'strategy' ? 'active' : ''}`}
              onClick={() => handlePageChange('strategy')}
              aria-current={currentPage === 'strategy' ? 'page' : undefined}
              title="Team Strategy (Ctrl/Cmd + S)"
            >
              <i className="fas fa-users" aria-hidden="true"></i>
              <span>Team Strategy</span>
            </button>

[Continuing in next part... Let me know when you want me to proceed]
            {isManager && (
              <button 
                className={`nav-button manager-button ${currentPage === 'manager' ? 'active' : ''}`}
                onClick={() => handlePageChange('manager')}
                aria-current={currentPage === 'manager' ? 'page' : undefined}
                title="Manager Dashboard (Ctrl/Cmd + M)"
              >
                <i className="fas fa-chart-line" aria-hidden="true"></i>
                <span>Manager Dashboard</span>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span 
                    className="notification-badge"
                    role="status"
                    aria-label={`${notifications.filter(n => !n.read).length} unread notifications`}
                  >
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
            )}
          </nav>
        </header>

        <main className="main-content" role="main">
          {currentPage === 'home' && (
            <HomePage 
              currentUser={currentUser}
              currentOnCall={currentOnCall}
              monthlyFocus={monthlyFocus}
              recentCheckIns={pendingSupport.slice(0, 5)}
              isManager={isManager}
              onSupportRequest={handleSupportRequest}
              onCallSchedule={currentOnCall}
              notifications={notifications.filter(n => !n.read)}
              userPreferences={userPreferences}
              analyticsData={getHomePageAnalytics()}
            />
          )}

          {currentPage === 'checkin' && (
            <CheckInForm 
              checkInData={checkInData}
              setCheckInData={setCheckInData}
              handleSubmit={handleCheckInSubmit}
              currentUser={currentUser}
              isLoading={loading}
              onAttachmentUpload={handleAttachmentUpload}
              maxAttachments={5}
              supportedFileTypes={['image/*', 'application/pdf']}
              maxFileSize={5 * 1024 * 1024} // 5MB
              previousCheckIns={getPreviousCheckIns()}
              moodTrends={getMoodTrends()}
              supportHistory={getSupportHistory()}
            />
          )}

          {currentPage === 'debrief' && (
            <DailyDebrief 
              currentUser={currentUser}
              submitDebrief={handleDebriefSubmit}
              exportToClearCare={exportToClearCare}
              debriefs={debriefs}
              isManager={isManager}
              onStrategyShare={handleStrategyShare}
              onAttachmentUpload={handleAttachmentUpload}
              templates={debriefTemplates}
              exportHistory={exportHistory}
              pendingExports={exportQueue}
              previousDebriefs={getPreviousDebriefs()}
              shiftHandover={getShiftHandover()}
              incidentReports={getIncidentReports()}
              medicationRecords={getMedicationRecords()}
            >
              <ClearCareExport 
                onExport={exportToClearCare}
                exportHistory={exportHistory}
                exportQueue={exportQueue}
                templates={exportTemplates}
              />
            </DailyDebrief>
          )}

          {currentPage === 'strategy' && (
            <TeamStrategy 
              strategies={teamStrategies}
              currentUser={currentUser}
              isManager={isManager}
              onStrategySubmit={handleStrategySubmit}
              onStrategyLike={handleStrategyLike}
              onStrategyComment={addStrategyComment}
              onStrategyApprove={approveStrategy}
              onStrategyEdit={editStrategy}
              onStrategyDelete={deleteStrategy}
              categories={strategyCategories}
              tags={availableTags}
              metrics={strategyMetrics}
              analytics={getStrategyAnalytics()}
              filters={strategyFilters}
              sorting={strategySorting}
              pagination={strategyPagination}
            />
          )}

[Continuing in next part... Let me know when you want me to proceed]
          {isManager && currentPage === 'manager' && (
            <ManagerDashboard 
              pendingSupport={pendingSupport}
              handledTickets={handledTickets}
              handleSupportRequest={handleSupportRequest}
              updateOnCallSchedule={updateOnCallSchedule}
              updateMonthlyFocus={updateMonthlyFocus}
              currentOnCall={currentOnCall}
              monthlyFocus={monthlyFocus}
              teamStrategies={teamStrategies}
              debriefs={debriefs}
              currentUser={currentUser}
              teamMetrics={teamMetrics}
              exportData={exportManagerData}
              generateReport={generateManagerReport}
              onCallHistory={onCallHistory}
              staffSchedule={staffSchedule}
              incidentReports={incidentReports}
              performanceMetrics={performanceMetrics}
              analytics={{
                checkIns: getCheckInAnalytics(),
                support: getSupportAnalytics(),
                strategies: getStrategyAnalytics(),
                debriefs: getDebriefAnalytics(),
                team: getTeamAnalytics()
              }}
              notifications={notifications}
              pendingApprovals={pendingApprovals}
              exportQueue={exportQueue}
              staffDirectory={staffDirectory}
              scheduleTemplates={scheduleTemplates}
              reportTemplates={reportTemplates}
            />
          )}

          {currentPage === 'settings' && (
            <Settings 
              userPreferences={userPreferences}
              updateUserPreferences={updateUserPreferences}
              clearCache={clearCache}
              currentUser={currentUser}
              isManager={isManager}
              availableThemes={themes}
              notificationOptions={notificationOptions}
              accessibilitySettings={accessibilitySettings}
              onPasswordChange={handlePasswordChange}
              onEmailChange={handleEmailChange}
              onProfileUpdate={updateUserProfile}
              onDeleteAccount={handleAccountDeletion}
              dataExportOptions={dataExportOptions}
              privacySettings={privacySettings}
              integrationSettings={integrationSettings}
              deviceSettings={deviceSettings}
              backupSettings={backupSettings}
            />
          )}
        </main>

        {/* Modal System */}
        {showModal && (
          <Modal 
            onClose={handleModalClose}
            className={modalContent?.type || ''}
            size={modalContent?.size || 'medium'}
            closeOnEscape={modalContent?.closeOnEscape !== false}
            closeOnOutsideClick={modalContent?.closeOnOutsideClick !== false}
          >
            {modalContent?.component}
          </Modal>
        )}

        {/* Confirmation Dialog */}
        {showConfirm && confirmConfig && (
          <ConfirmDialog
            {...confirmConfig}
            onClose={() => setShowConfirm(false)}
            onConfirm={async () => {
              await confirmConfig.onConfirm();
              setShowConfirm(false);
            }}
            onCancel={() => {
              confirmConfig.onCancel?.();
              setShowConfirm(false);
            }}
          />
        )}

        {/* Toast Notifications */}
        <div 
          className="toast-container" 
          role="alert" 
          aria-live="polite"
        >
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              type={toast.type}
              message={toast.message}
              duration={toast.duration}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </div>

[Continuing in next part... Let me know when you want me to proceed]
        {/* Loading Overlay */}
        {loading && (
          <div 
            className="loading-overlay"
            role="alert"
            aria-busy="true"
          >
            <LoadingSpinner size="large" />
          </div>
        )}

        {/* Error Boundary Fallback */}
        {error && (
          <div 
            className="error-boundary"
            role="alert"
          >
            <h2>Something went wrong</h2>
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="retry-button"
            >
              Refresh Page
            </button>
          </div>
        )}

        {/* Offline Indicator */}
        {!isOnline && (
          <div 
            className="offline-indicator"
            role="alert"
          >
            <i className="fas fa-wifi-slash" aria-hidden="true"></i>
            You are currently offline. Some features may be unavailable.
            <button 
              onClick={retryConnection}
              className="retry-button"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Accessibility Skip Links */}
        <div className="skip-links">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <a href="#nav" className="skip-link">
            Skip to navigation
          </a>
        </div>

        {/* Debug Panel (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <DebugPanel
            currentUser={currentUser}
            currentPage={currentPage}
            notifications={notifications}
            pendingSupport={pendingSupport}
            syncStatus={lastSync}
            performanceMetrics={performanceMetrics.current}
            errorLogs={errorLogs}
            wsStatus={wsConnection.current?.readyState}
            cache={cache.current}
            taskQueue={taskQueue.current}
          />
        )}

        {/* Service Worker Update Notification */}
        {serviceWorkerUpdateAvailable && (
          <div className="update-notification">
            <p>A new version is available</p>
            <button 
              onClick={updateServiceWorker}
              className="update-button"
            >
              Update Now
            </button>
          </div>
        )}

        {/* Background Tasks Status */}
        <div 
          className="background-tasks" 
          aria-hidden="true"
        >
          {pendingUploads.current.map(upload => (
            <div key={upload.id} className="upload-progress">
              <p>Uploading {upload.filename}</p>
              <progress value={upload.progress} max="100" />
            </div>
          ))}
        </div>

        {/* Analytics Tracking (Privacy-Aware) */}
        {userPreferences?.allowAnalytics && (
          <AnalyticsTracker
            userId={currentUser?.uid}
            page={currentPage}
            events={analyticsEvents.current}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;

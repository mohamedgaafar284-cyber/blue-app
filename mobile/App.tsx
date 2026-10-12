import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as Location from 'expo-location';
import { getCachedProjects, saveOfflineSiteVisit, getUnsyncedVisits, CachedProject } from './src/services/db';
import { setAuthToken, fetchAndCacheProjects, syncOfflineData, getAuthToken, removeAuthToken } from './src/services/api';

export default function App() {
  // Navigation & Auth States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'dashboard' | 'checkin'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Data States
  const [projects, setProjects] = useState<CachedProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);

  const loadLocalProjects = async () => {
    try {
      const cached = await getCachedProjects();
      setProjects(cached);
      const unsynced = await getUnsyncedVisits();
      setOfflineCount(unsynced.length);
    } catch (_e) {
      console.error('Failed to load local DB cache', _e);
    }
  };

  // Load initial session & local offline database cache
  useEffect(() => {
    async function checkSession() {
      const token = await getAuthToken();
      if (token) {
        setIsAuthenticated(true);
        setCurrentScreen('dashboard');
        loadLocalProjects();
      }
    }
    checkSession();
  }, []);

  // Mock Login Handler (stores simulated JWT token)
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('خطأ / Error', 'الرجاء إدخال البريد الإلكتروني وكلمة المرور / Please enter credentials');
      return;
    }

    setIsLoading(true);
    setTimeout(async () => {
      try {
        await setAuthToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockToken');
        setIsAuthenticated(true);
        setCurrentScreen('dashboard');
        
        // Mock default projects to database cache
        await fetchAndCacheProjects().catch(() => {});
        await loadLocalProjects();
      } catch (_e) {
        Alert.alert('فشل الدخول / Login Failed', 'عذراً، حدث خطأ أثناء الاتصال / Connection error');
      } finally {
        setIsLoading(false);
      }
    }, 1500);
  };

  // Sign out handler
  const handleLogout = async () => {
    await removeAuthToken();
    setIsAuthenticated(false);
    setCurrentScreen('login');
  };

  // Run Synchronization protocol
  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncOfflineData();
      Alert.alert(
        'مزامنة البيانات / Sync Status',
        `تم مزامنة ${result.syncedCount} بنجاح، وفشل ${result.failedCount} / Synced ${result.syncedCount} successfully, failed ${result.failedCount}`
      );
      await loadLocalProjects();
    } catch (_e) {
      Alert.alert('خطأ المزامنة / Sync Error', 'فشلت عملية المزامنة مع المخدم الرئيسي / Failed to sync');
    } finally {
      setIsSyncing(false);
    }
  };

  // GPS Site Check-in
  const handleCheckInPress = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setIsLoading(true);
    
    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'GPS location access is required for site check-ins.');
      setIsLoading(false);
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      setCurrentScreen('checkin');
    } catch (_e) {
      Alert.alert('Error', 'Unable to fetch current GPS coordinates.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit site visit to offline SQLite DB
  const saveVisitOffline = async () => {
    if (!selectedProjectId || !location) return;

    try {
      await saveOfflineSiteVisit({
        id: Math.random().toString(36).substr(2, 9),
        projectId: selectedProjectId,
        visitDate: new Date().toISOString(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        inspectorName: 'Field Engineer',
        notes: notes,
        photoUri: 'file://simulated_site_photo.jpg'
      });

      Alert.alert('حفظ دون اتصال / Offline Saved', 'تم حفظ التقرير محلياً وسيتم إرساله عند توفر الإنترنت / Saved to SQLite cache');
      setNotes('');
      setCurrentScreen('dashboard');
      loadLocalProjects();
    } catch (_e) {
      Alert.alert('Error', 'Failed to save site visit data offline.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BluePrint ERP Mobile</Text>
        {isAuthenticated && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>خروج / Exit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Screen Renderings */}
      {currentScreen === 'login' && (
        <View style={styles.content}>
          <Text style={styles.title}>تسجيل الدخول / Secure Login</Text>
          <TextInput
            placeholder="البريد الإلكتروني / Email"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            placeholder="كلمة المرور / Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>دخول / Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {currentScreen === 'dashboard' && (
        <View style={styles.content}>
          {/* Sync Header */}
          <View style={styles.syncRow}>
            <Text style={styles.syncText}>
              غير متزامن / Unsynced: <Text style={styles.highlightText}>{offlineCount}</Text>
            </Text>
            <TouchableOpacity style={styles.syncButton} onPress={triggerSync} disabled={isSyncing}>
              {isSyncing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.syncButtonText}>مزامنة / Sync Now</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>مشاريعك النشطة / Active Projects</Text>
          
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.projectCard}>
                <View>
                  <Text style={styles.projectName}>{item.name}</Text>
                  <Text style={styles.projectLoc}>{item.location}</Text>
                  <Text style={styles.projectProgress}>التقدم / Progress: {item.progress}%</Text>
                </View>
                <TouchableOpacity
                  style={styles.checkinBtn}
                  onPress={() => handleCheckInPress(item.id)}
                >
                  <Text style={styles.checkinBtnText}>زيارة / Visit</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {currentScreen === 'checkin' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>تسجيل زيارة ميدانية / Site Check-In</Text>
          
          {location && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>موقع الـ GPS / GPS Coordinates:</Text>
              <Text style={styles.infoValue}>Lat: {location.coords.latitude.toFixed(6)}</Text>
              <Text style={styles.infoValue}>Long: {location.coords.longitude.toFixed(6)}</Text>
            </View>
          )}

          {/* Photo simulator */}
          <View style={styles.photoContainer}>
            <Text style={styles.photoText}>[ الكاميرا نشطة / Site Camera Active ]</Text>
          </View>

          <TextInput
            placeholder="ملاحظات الزيارة الميدانية / Site Visit Notes..."
            placeholderTextColor="#64748b"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={[styles.input, styles.textArea]}
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setCurrentScreen('dashboard')}>
              <Text style={styles.actionBtnText}>إلغاء / Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={saveVisitOffline}>
              <Text style={styles.actionBtnText}>حفظ محلي / Cache Visit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    height: 90,
    backgroundColor: '#1e293b',
    paddingTop: 45,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  headerTitle: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: 'bold'
  },
  logoutButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#ef4444'
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 20
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center'
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 15,
    color: '#ffffff',
    marginBottom: 15,
    fontSize: 14
  },
  textArea: {
    height: 100,
    paddingTop: 15
  },
  button: {
    height: 50,
    backgroundColor: '#0284c7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  syncText: {
    color: '#94a3b8',
    fontSize: 13
  },
  highlightText: {
    color: '#f43f5e',
    fontWeight: 'bold'
  },
  syncButton: {
    backgroundColor: '#10b981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 15
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  projectName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  projectLoc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  projectProgress: {
    color: '#38bdf8',
    fontSize: 11,
    marginTop: 4
  },
  checkinBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  checkinBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  infoCard: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#334155'
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'monospace'
  },
  photoContainer: {
    height: 180,
    backgroundColor: '#334155',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#64748b'
  },
  photoText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  actionBtn: {
    flex: 0.48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelBtn: {
    backgroundColor: '#475569'
  },
  saveBtn: {
    backgroundColor: '#0284c7'
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  }
});

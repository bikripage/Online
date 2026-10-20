import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Linking, Alert, TextInput, ActivityIndicator, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCWquftO39vqj83ZtYqtF_sDfkHVNpjd3k",
  authDomain: "bikripage-3aba6.firebaseapp.com",
  projectId: "bikripage-3aba6",
  storageBucket: "bikripage-3aba6.firebasestorage.app",
  messagingSenderId: "900882116436",
  appId: "1:900882116436:web:8a521d0308347ddcccdc92",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 👉 Push Token & Custom Root Sound Setup
async function registerForPushNotificationsAsync() {
  let token;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Permission Denied', 'Notification permission zaroori hai alert pane ke liye!');
    return null;
  }

  try {
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'f04fd7db-de71-48be-b31a-2e244b307168'
    })).data;
  } catch (e) {
    console.log("Push token error:", e);
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      // ✨ YAHAN CUSTOM SOUND SET KI HAI ✨
      sound: 'voice_alert.wav', 
    });
  }

  return token;
}

export default function App() {
  const [orders, setOrders] = useState([]);
  
  const [currentShopId, setCurrentShopId] = useState(null);
  const [currentShopName, setCurrentShopName] = useState(''); 
  
  const [shopIdInput, setShopIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);

  // ✨ LANGUAGE STATE ✨
  const [speechLang, setSpeechLang] = useState('hi-IN');
  const langRef = useRef(speechLang);

  useEffect(() => {
    langRef.current = speechLang;
  }, [speechLang]);

  useEffect(() => {
    const checkSavedCredentials = async () => {
      try {
        const savedId = await AsyncStorage.getItem('shopId');
        const savedName = await AsyncStorage.getItem('shopName');
        const savedLang = await AsyncStorage.getItem('speechLang');
        
        if (savedLang) setSpeechLang(savedLang);
        
        if (savedId) {
          setCurrentShopId(savedId);
          setCurrentShopName(savedName || 'My Shop');
          
          // Auto-update token on open
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            db.collection('shops').doc(savedId).set({ expoPushToken: pushToken }, { merge: true });
          }
        }
      } catch (e) {
        console.log('Error reading credentials', e);
      }
      setIsCheckingLogin(false);
    };
    checkSavedCredentials();
  }, []);

  const handleLogin = async () => {
    const shopId = shopIdInput.trim();
    const pwd = passwordInput.trim();

    if (shopId === '' || pwd === '') {
      Alert.alert('Error', 'Shop ID aur Password dono daalna zaroori hai');
      return;
    }

    setIsLoggingIn(true);
    try {
      const shopDoc = await db.collection('shops').doc(shopId).get();

      if (!shopDoc.exists) {
        Alert.alert('Error', 'Ye Shop ID nahi mili!');
        setIsLoggingIn(false);
        return;
      }

      const shopData = shopDoc.data();
      if (shopData.password !== pwd) {
        Alert.alert('Error', 'Galat Password!');
        setIsLoggingIn(false);
        return;
      }

      const fetchedShopName = shopData.shopName || shopId;
      await AsyncStorage.setItem('shopId', shopId);
      await AsyncStorage.setItem('shopName', fetchedShopName);
      
      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken) {
          await db.collection('shops').doc(shopId).set(
            { expoPushToken: pushToken },
            { merge: true }
          );
        }
      } catch (tokenError) {
        console.log("Token Error:", tokenError);
      }
      
      setCurrentShopId(shopId);
      setCurrentShopName(fetchedShopName);
      
      Alert.alert('Login Successful! ✅', `Welcome, ${fetchedShopName}`);

    } catch (e) {
      Alert.alert('Asli Error 👇', e.message || 'Kuch galat ho gaya');
    }
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('shopId');
      await AsyncStorage.removeItem('shopName');
      setCurrentShopId(null);
      setCurrentShopName('');
      setShopIdInput('');
      setPasswordInput('');
      setOrders([]);
    } catch (e) {
      console.log('Logout Error', e);
    }
  };

  // ✨ LANGUAGE TOGGLE FUNCTION ✨
  const toggleLanguage = async () => {
    const newLang = speechLang === 'hi-IN' ? 'en-US' : 'hi-IN';
    setSpeechLang(newLang);
    await AsyncStorage.setItem('speechLang', newLang);
    
    Speech.speak(newLang === 'hi-IN' ? "हिंदी भाषा सेट हो गई है" : "English language selected", { language: newLang });
  };

  useEffect(() => {
    if (!currentShopId) return;

    let isFirstFetch = true;

    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.log("Audio Setup Error:", e);
      }
    };
    setupAudio();

    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow notifications for new orders!');
      }
    };
    requestPermissions();

    const unsubscribe = db.collection('orders')
      .where('shopId', '==', currentShopId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot((snapshot) => {
        let liveOrders = [];

        if (isFirstFetch) {
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'pending') {
              liveOrders.push({ id: doc.id, ...data });
            }
          });
          setOrders(liveOrders);
          isFirstFetch = false; 

        } else {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const newOrder = change.doc.data();

              if (newOrder.status === 'pending') {
                const customerName = newOrder.customerName || 'Customer';
                const amount = newOrder.totalAmount || 0;
                
                let msg = "";
                if (langRef.current === 'hi-IN') {
                  msg = `${customerName} ने ${amount} रुपये का नया आर्डर भेजा है।`;
                } else {
                  msg = `New order received from ${customerName} for ${amount} rupees.`;
                }

                Speech.stop(); 
                Speech.speak(msg, {
                  language: langRef.current,
                  pitch: 1.1,
                  rate: 0.9,
                });
              }
            }
          });

          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'pending') {
              liveOrders.push({ id: doc.id, ...data });
            }
          });

          setOrders(liveOrders);
        }
      });

    return () => unsubscribe();
  }, [currentShopId]);

  const openWebsiteDashboard = () => {
    const url = `https://bikripage.github.io/Online/dashboard.html?shop=${currentShopId}`;
    Linking.openURL(url).catch((err) => console.error(err));
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <Text style={styles.statusBadge}>NEW ORDER</Text>
      </View>
      <Text style={styles.price}>₹{item.totalAmount}</Text>
      <TouchableOpacity style={styles.actionBtn} onPress={openWebsiteDashboard}>
        <Text style={styles.btnText}>Manage on Website</Text>
      </TouchableOpacity>
    </View>
  );

  if (isCheckingLogin) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 15 }}>Loading BikriPage...</Text>
      </View>
    );
  }

  if (!currentShopId) {
    return (
      <View style={styles.loginContainer}>
        <Text style={styles.loginTitle}>BikriPage Alert</Text>
        <Text style={styles.loginSubtitle}>Login to receive live order alerts</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Shop ID (e.g. netajijhadustore-3581)"
          placeholderTextColor="#888888"
          value={shopIdInput}
          onChangeText={setShopIdInput}
          autoCapitalize="none"
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="App Password"
            placeholderTextColor="#888888"
            value={passwordInput}
            onChangeText={setPasswordInput}
            secureTextEntry={!showPassword} 
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#888888" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.loginBtn, isLoggingIn && {backgroundColor: '#60A5FA'}]} 
          onPress={handleLogin}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.loginBtnText}>Secure Login</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>BikriPage Alert</Text>
          <Text style={styles.shopNameText}>{currentShopName}</Text> 
        </View>
        
        <View style={styles.headerRightControls}>
          <TouchableOpacity onPress={toggleLanguage} style={styles.langBtn}>
            <Text style={styles.langText}>{speechLang === 'hi-IN' ? 'A🗣️ Hindi' : 'A🗣️ Eng'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{alignItems: 'center', marginTop: 50}}>
            <Text style={{fontSize: 16, color: 'gray', fontWeight: 'bold'}}>No New Orders</Text>
            <Text style={{fontSize: 12, color: 'gray', marginTop: 5}}>All clear! Waiting for new customers...</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loginContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 20 },
  loginTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  loginSubtitle: { color: 'gray', fontSize: 16, textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 15, color: '#000' },
  passwordContainer: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 10, marginBottom: 15, alignItems: 'center' },
  passwordInput: { flex: 1, padding: 15, fontSize: 16, color: '#000' },
  eyeIcon: { padding: 15 },
  loginBtn: { backgroundColor: '#2563EB', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  loginBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  header: { backgroundColor: '#111827', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  shopNameText: { color: '#10B981', fontSize: 14, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase' },
  headerRightControls: { flexDirection: 'row', alignItems: 'center' },
  langBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 5, marginRight: 10 },
  langText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  logoutBtn: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 5 },
  logoutText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#2563EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  customerName: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#E0E7FF', color: '#2563EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, fontSize: 10, fontWeight: 'bold', overflow: 'hidden' },
  price: { fontSize: 22, fontWeight: '900', color: '#16A34A', marginBottom: 15 },
  actionBtn: { backgroundColor: '#111827', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 15 }
});

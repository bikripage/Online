import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Linking, Alert, TextInput, ActivityIndicator } from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export default function App() {
  const [orders, setOrders] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [currentShopId, setCurrentShopId] = useState(null);
  const [currentShopName, setCurrentShopName] = useState(''); 
  
  const [shopIdInput, setShopIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);

  useEffect(() => {
    const checkSavedCredentials = async () => {
      try {
        const savedId = await AsyncStorage.getItem('shopId');
        const savedName = await AsyncStorage.getItem('shopName');
        if (savedId) {
          setCurrentShopId(savedId);
          setCurrentShopName(savedName || 'My Shop');
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
      
      setCurrentShopId(shopId);
      setCurrentShopName(fetchedShopName);
      
      Alert.alert('Login Successful! ✅', `Welcome, ${fetchedShopName}`);

    } catch (e) {
      Alert.alert('Error', 'Login fail ho gaya. Internet check karein.');
      console.log(e);
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

  useEffect(() => {
    if (!currentShopId) return;

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

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && !isInitialLoad) {
            const newOrder = change.doc.data();

            if (newOrder.status === 'pending') {
              const customerName = newOrder.customerName || 'Customer';
              const amount = newOrder.totalAmount || 0;
              const msg = `${customerName} ne ${amount} rupaye ka naya order bheja hai.`;

              Speech.speak(msg, {
                language: 'hi-IN',
                pitch: 1.1,
                rate: 0.9,
              });

              Notifications.scheduleNotificationAsync({
                content: {
                  title: "New Order Received!",
                  body: `${customerName} just placed an order. Check the website.`,
                  sound: 'default',
                },
                trigger: null,
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
        setTimeout(() => setIsInitialLoad(false), 2000);
      });

    return () => unsubscribe();
  }, [currentShopId, isInitialLoad]);

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
        
        <TextInput
          style={styles.input}
          placeholder="App Password"
          placeholderTextColor="#888888"
          value={passwordInput}
          onChangeText={setPasswordInput}
          secureTextEntry={true} 
          autoCapitalize="none"
        />

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
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
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
  loginBtn: { backgroundColor: '#2563EB', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  loginBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  header: { backgroundColor: '#111827', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  shopNameText: { color: '#10B981', fontSize: 14, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase' },
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

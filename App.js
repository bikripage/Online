import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Linking, Alert, TextInput } from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from 'firebase';

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
  
  // Naye Login States
  const [currentShopId, setCurrentShopId] = useState(null);
  const [shopIdInput, setShopIdInput] = useState('');
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);

  // App khulte hi check karega ki koi Shop ID save hai ya nahi
  useEffect(() => {
    const checkSavedShopId = async () => {
      try {
        const savedId = await AsyncStorage.getItem('shopId');
        if (savedId) {
          setCurrentShopId(savedId);
        }
      } catch (e) {
        console.log('Error reading shopId', e);
      }
      setIsCheckingLogin(false);
    };
    checkSavedShopId();
  }, []);

  // Login Function
  const handleLogin = async () => {
    if (shopIdInput.trim() === '') {
      Alert.alert('Error', 'Please enter your Shop ID');
      return;
    }
    try {
      await AsyncStorage.setItem('shopId', shopIdInput.trim());
      setCurrentShopId(shopIdInput.trim());
    } catch (e) {
      Alert.alert('Error', 'Failed to save Shop ID');
    }
  };

  // Logout Function
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('shopId');
      setCurrentShopId(null);
      setShopIdInput('');
      setOrders([]);
    } catch (e) {
      console.log('Logout Error', e);
    }
  };

  // Orders Monitor (Sirf tab chalega jab currentShopId set ho)
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

  // Loading Screen jab tak ID check ho rahi ho
  if (isCheckingLogin) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Loading BikriPage...</Text>
      </View>
    );
  }

  // Agar Shop ID nahi hai, toh Login Screen dikhayein
  if (!currentShopId) {
    return (
      <View style={styles.loginContainer}>
        <Text style={styles.loginTitle}>BikriPage Alert</Text>
        <Text style={styles.loginSubtitle}>Enter your Shop ID to receive live order alerts</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. netajijhadustore-3581"
          value={shopIdInput}
          onChangeText={setShopIdInput}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
          <Text style={styles.loginBtnText}>Start Receiving Orders</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Agar Shop ID hai, toh main Orders Screen dikhayein
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BikriPage Shop Alert</Text>
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
  // Login Screen Styles
  loginContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 20 },
  loginTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  loginSubtitle: { color: 'gray', fontSize: 16, textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 20 },
  loginBtn: { backgroundColor: '#2563EB', padding: 15, borderRadius: 10, alignItems: 'center' },
  loginBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  // Main Screen Styles
  header: { backgroundColor: '#111827', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 },
  logoutText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#2563EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  customerName: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#E0E7FF', color: '#2563EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, fontSize: 10, fontWeight: 'bold', overflow: 'hidden' },
  price: { fontSize: 22, fontWeight: '900', color: '#16A34A', marginBottom: 15 },
  actionBtn: { backgroundColor: '#111827', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 15 }
});
